import { IsEmail, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { NormalizeEmail } from '../../../common/validation/transforms';

export class LoginDto {
  @NormalizeEmail()
  @IsEmail()
  email: string;

  @IsString()
  @MaxLength(128)
  password: string;

  /** Obrigatório quando o usuário pertence a mais de um operador. */
  @IsOptional()
  @IsUUID()
  organizationId?: string;
}
