import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PlatformRole } from '@prisma/client';
import { AuthContext, TenantContext } from '../../common/auth/auth-context';
import { CurrentAuth, CurrentTenant } from '../../common/decorators/current-auth.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { OrganizationsService } from './organizations.service';

@ApiTags('organizations')
@ApiBearerAuth()
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get('current')
  current(@CurrentTenant() tenant: TenantContext) {
    return this.organizations.findById(tenant.organizationId);
  }

  @Post()
  @Roles(PlatformRole.PLATFORM_ADMIN)
  create(@CurrentAuth() auth: AuthContext, @Body() dto: CreateOrganizationDto) {
    return this.organizations.create(auth, dto);
  }

  @Get()
  @Roles(PlatformRole.PLATFORM_ADMIN)
  list() {
    return this.organizations.list();
  }
}
