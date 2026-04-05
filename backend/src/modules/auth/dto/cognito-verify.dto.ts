import { IsString, MinLength } from 'class-validator';

export class CognitoVerifyDto {
  @IsString()
  @MinLength(100)
  idToken: string;
}
