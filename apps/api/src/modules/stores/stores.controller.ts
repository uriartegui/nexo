import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MembershipRole } from '@prisma/client';
import { TenantContext } from '../../common/auth/auth-context';
import { OPERATOR_MANAGERS, OPERATOR_ROLES } from '../../common/auth/roles';
import { CurrentTenant } from '../../common/decorators/current-auth.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AddStoreMemberDto, CreateStoreDto, UpdateStoreDto } from './dto/store.dto';
import { StoresService } from './stores.service';

@ApiTags('stores')
@ApiBearerAuth()
@Controller('stores')
export class StoresController {
  constructor(private readonly stores: StoresService) {}

  @Post()
  @Roles(...OPERATOR_MANAGERS)
  create(@CurrentTenant() tenant: TenantContext, @Body() dto: CreateStoreDto) {
    return this.stores.create(tenant, dto);
  }

  @Get()
  @Roles(...OPERATOR_ROLES)
  list(@CurrentTenant() tenant: TenantContext) {
    return this.stores.list(tenant);
  }

  @Get(':id')
  @Roles(...OPERATOR_ROLES)
  findOne(@CurrentTenant() tenant: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.stores.findOne(tenant, id);
  }

  @Patch(':id')
  @Roles(...OPERATOR_MANAGERS, MembershipRole.STORE_MANAGER)
  update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStoreDto,
  ) {
    return this.stores.update(tenant, id, dto);
  }

  @Get(':id/members')
  @Roles(...OPERATOR_MANAGERS, MembershipRole.STORE_MANAGER)
  listMembers(@CurrentTenant() tenant: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.stores.listMembers(tenant, id);
  }

  @Post(':id/members')
  @Roles(...OPERATOR_MANAGERS)
  addMember(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddStoreMemberDto,
  ) {
    return this.stores.addMember(tenant, id, dto);
  }

  @Delete(':id/members/:userId')
  @Roles(...OPERATOR_MANAGERS)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMember(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.stores.removeMember(tenant, id, userId);
  }
}
