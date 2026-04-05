import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { User } from '../../database/entities/user.entity';
import { CognitoExchangeDto } from './dto/cognito-exchange.dto';
import { CognitoVerifyDto } from './dto/cognito-verify.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private createCognitoVerifier() {
    const userPoolId = this.config.get<string>('cognito.userPoolId');
    const clientId = this.config.get<string>('cognito.clientId');
    if (!userPoolId || !clientId) return null;
    return CognitoJwtVerifier.create({
      userPoolId,
      clientId,
      tokenUse: 'id',
    });
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.users.findOne({ where: { email } });
    if (!user?.passwordHash) return null;
    const ok = await bcrypt.compare(password, user.passwordHash);
    return ok ? user : null;
  }

  async login(dto: LoginDto) {
    const user = await this.validateUser(dto.email, dto.password);
    if (!user) throw new UnauthorizedException('Credenciales inválidas');
    return this.issueTokens(user);
  }

  private async issueTokens(user: User) {
    const token = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
    });
    return {
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      },
    };
  }

  /** Intercambia el código OAuth2 de Cognito Hosted UI por tokens y emite JWT de la API. */
  async cognitoExchange(dto: CognitoExchangeDto) {
    const domain = this.config.get<string>('cognito.domain');
    const clientId = this.config.get<string>('cognito.clientId');
    const clientSecret = this.config.get<string>('cognito.clientSecret');
    const expectedRedirect = this.config.get<string>('cognito.redirectUri')?.trim();
    if (!domain || !clientId) {
      throw new BadRequestException(
        'Cognito no configurado (COGNITO_DOMAIN, COGNITO_CLIENT_ID)',
      );
    }
    if (!expectedRedirect) {
      throw new BadRequestException(
        'Cognito: falta COGNITO_REDIRECT_URI en el servidor (debe coincidir con Callback URL en AWS).',
      );
    }
    const sent = dto.redirectUri?.trim();
    if (!sent) {
      throw new BadRequestException('redirect_uri es obligatorio en el cuerpo de la petición.');
    }
    if (sent !== expectedRedirect) {
      this.logger.warn(
        `Cognito exchange: redirect_uri del cliente no coincide con COGNITO_REDIRECT_URI (cliente="${sent}", servidor="${expectedRedirect}")`,
      );
      throw new BadRequestException(
        'redirect_uri no coincide con la configuración del servidor; debe ser el mismo valor que GET /api/auth/cognito/config.',
      );
    }
    const tokenUrl = `https://${domain}/oauth2/token`;
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      code: dto.code,
      redirect_uri: sent,
    });
    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };
    if (clientSecret) {
      const basic = globalThis.btoa(`${clientId}:${clientSecret}`);
      headers['Authorization'] = `Basic ${basic}`;
    }
    let res: Response;
    try {
      res = await fetch(tokenUrl, {
        method: 'POST',
        headers,
        body: params,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Cognito fetch ${tokenUrl} failed: ${msg}`);
      throw new BadRequestException(
        `No se pudo conectar con Cognito. Compruebe COGNITO_DOMAIN y la red. Detalle: ${msg}`,
      );
    }
    if (!res.ok) {
      const text = await res.text();
      this.logger.warn(
        `Cognito /oauth2/token failed status=${res.status} body=${text}`,
      );
      let hint = '';
      try {
        const j = JSON.parse(text) as { error?: string };
        if (j.error === 'invalid_client' && text.includes('invalid_client_secret')) {
          hint =
            ' Revise COGNITO_CLIENT_SECRET en backend/.env: debe coincidir con el App client en Cognito. ' +
            'Si el cliente es público (sin secreto en la consola), deje COGNITO_CLIENT_SECRET vacío o comentada y reinicie el API.';
        }
      } catch {
        /* cuerpo no JSON */
      }
      throw new UnauthorizedException(
        `Error al obtener tokens de Cognito: ${res.status} ${text}.${hint}`,
      );
    }
    const tokens = (await res.json()) as { id_token?: string };
    if (!tokens.id_token) {
      throw new UnauthorizedException('Respuesta de Cognito sin id_token');
    }
    return this.finishCognitoLogin(tokens.id_token);
  }

  /** Verifica un id_token de Cognito (útil si el front ya lo tiene). */
  async cognitoVerify(dto: CognitoVerifyDto) {
    return this.finishCognitoLogin(dto.idToken);
  }

  private async finishCognitoLogin(idToken: string) {
    const verifier = this.createCognitoVerifier();
    if (!verifier) {
      throw new BadRequestException(
        'Cognito no configurado (COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID)',
      );
    }
    try {
      const payload = await verifier.verify(idToken);
      const email =
        (payload.email as string) ?? (payload['cognito:username'] as string);
      const sub = payload.sub as string;
      if (!email) {
        throw new UnauthorizedException(
          'El token de Cognito no incluye email; añada el scope email en el App client y en la petición authorize.',
        );
      }
      let user = await this.users.findOne({ where: { cognitoSub: sub } });
      if (!user) {
        user = await this.users.findOne({ where: { email } });
      }
      if (!user) {
        user = this.users.create({
          email,
          cognitoSub: sub,
          displayName: email.split('@')[0] ?? 'Usuario',
          passwordHash: null,
        });
        await this.users.save(user);
      } else {
        if (!user.cognitoSub) user.cognitoSub = sub;
        if (user.email !== email) user.email = email;
        await this.users.save(user);
      }
      return this.issueTokens(user);
    } catch (e: unknown) {
      if (e instanceof HttpException) throw e;
      if (e instanceof QueryFailedError) {
        this.logger.error(`Cognito login DB error: ${e.message}`, e.stack);
        throw new BadRequestException(
          'Error al guardar el usuario en la base de datos (tabla users / cognitoSub). Revise que Postgres esté arriba y TYPEORM_SYNC o migraciones.',
        );
      }
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`finishCognitoLogin: ${msg}`, e instanceof Error ? e.stack : undefined);
      throw new UnauthorizedException(
        `No se pudo validar el token de Cognito o completar la sesión: ${msg}. ` +
          'Compruebe que COGNITO_USER_POOL_ID y COGNITO_CLIENT_ID coinciden con el token (mismo pool y mismo App client que en Hosted UI).',
      );
    }
  }
}
