import { IsString, MinLength } from 'class-validator';

export class CognitoExchangeDto {
  @IsString()
  @MinLength(10)
  code: string;

  /** Debe coincidir exactamente con la URL de callback registrada en el cliente Cognito. */
  @IsString()
  @MinLength(8)
  redirectUri: string;
}
