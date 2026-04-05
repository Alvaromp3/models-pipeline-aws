import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { CognitoExchangeDto } from './dto/cognito-exchange.dto';
import { CognitoVerifyDto } from './dto/cognito-verify.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  /** Público: dominio y client id para Hosted UI (no secretos). El navegador usa el mismo redirect_uri que envíe al intercambiar el código. */
  @Get('cognito/config')
  cognitoConfig() {
    const domain = this.config.get<string>('cognito.domain')?.trim() || '';
    const clientId = this.config.get<string>('cognito.clientId')?.trim() || '';
    const redirectUri =
      this.config.get<string>('cognito.redirectUri')?.trim() || '';
    const configured = !!(domain && clientId && redirectUri);
    return {
      configured,
      domain: domain || null,
      clientId: clientId || null,
      /** Misma URL que debes tener en Cognito (App client → Callback URL). */
      redirectUri: redirectUri || null,
    };
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    if (!this.config.get<boolean>('auth.localLoginEnabled')) {
      throw new ForbiddenException(
        'El inicio de sesión con email/contraseña está desactivado. Usa Amazon Cognito.',
      );
    }
    return this.auth.login(dto);
  }

  /** OAuth2 authorization code → tokens Cognito → JWT de la API. */
  @Post('cognito/exchange')
  cognitoExchange(@Body() dto: CognitoExchangeDto) {
    return this.auth.cognitoExchange(dto);
  }

  /** id_token de Cognito ya en el cliente → JWT de la API. */
  @Post('cognito/verify')
  cognitoVerify(@Body() dto: CognitoVerifyDto) {
    return this.auth.cognitoVerify(dto);
  }
}
