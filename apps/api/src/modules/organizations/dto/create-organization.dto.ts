import { Type } from 'class-transformer';
import { IsEmail, IsOptional, IsString, Length, ValidateNested } from 'class-validator';
import { IsCnpj } from '../../../common/validation/is-cnpj.decorator';
import { NormalizeEmail, Trim } from '../../../common/validation/transforms';

export class OrganizationOwnerDto {
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
}

export class CreateOrganizationDto {
  @Trim()
  @IsString()
  @Length(2, 200)
  legalName: string;

  @IsOptional()
  @Trim()
  @IsString()
  @Length(2, 200)
  tradeName?: string;

  /** CNPJ com ou sem máscara; aceita o formato alfanumérico. */
  @IsCnpj()
  document: string;

  @ValidateNested()
  @Type(() => OrganizationOwnerDto)
  owner: OrganizationOwnerDto;
}
