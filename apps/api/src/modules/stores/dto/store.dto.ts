import { PartialType } from '@nestjs/swagger';
import { MembershipRole, StoreStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsOptional, IsString, IsUUID, Length, Matches, MaxLength } from 'class-validator';
import { STORE_LEVEL_ROLES } from '../../../common/auth/roles';
import { Trim } from '../../../common/validation/transforms';

const TIME_ZONES = Intl.supportedValuesOf('timeZone');

export class CreateStoreDto {
  @Trim()
  @IsString()
  @Length(2, 120)
  name: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(160)
  street?: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(20)
  number?: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(80)
  complement?: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(80)
  district?: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(80)
  city?: string;

  /** UF com duas letras */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^[A-Z]{2}$/, { message: 'state deve ser a UF com duas letras' })
  state?: string;

  /** CEP com 8 dígitos, sem hífen */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/\D/g, '') : value))
  @Matches(/^\d{8}$/, { message: 'postalCode deve ter 8 dígitos' })
  postalCode?: string;

  @IsOptional()
  @IsIn(TIME_ZONES, { message: 'timezone deve ser um fuso IANA válido' })
  timezone?: string;
}

export class UpdateStoreDto extends PartialType(CreateStoreDto) {
  @IsOptional()
  @IsEnum(StoreStatus)
  status?: StoreStatus;
}

export class AddStoreMemberDto {
  @IsUUID()
  userId: string;

  @IsIn(STORE_LEVEL_ROLES)
  role: MembershipRole;
}
