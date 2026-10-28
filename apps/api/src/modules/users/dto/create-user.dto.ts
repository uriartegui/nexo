import { MembershipRole } from '@prisma/client';
import { IsEmail, IsEnum, IsString, Length } from 'class-validator';
import { NormalizeEmail, Trim } from '../../../common/validation/transforms';

export class CreateUserDto {
  @Trim()
  @IsString()
  @Length(2, 120)
  name: string;

  @NormalizeEmail()
  @IsEmail()
  email: string;

  @IsString()
  @Length(10, 128)
  password: string;

  @IsEnum(MembershipRole)
  role: MembershipRole;
}
