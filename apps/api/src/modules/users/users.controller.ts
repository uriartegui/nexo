import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthContext, TenantContext } from '../../common/auth/auth-context';
import { OPERATOR_MANAGERS } from '../../common/auth/roles';
import { CurrentAuth, CurrentTenant } from '../../common/decorators/current-auth.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@CurrentAuth() auth: AuthContext) {
    return this.users.me(auth);
  }

  @Post()
  @Roles(...OPERATOR_MANAGERS)
  create(@CurrentTenant() tenant: TenantContext, @Body() dto: CreateUserDto) {
    return this.users.create(tenant, dto);
  }

  @Get()
  @Roles(...OPERATOR_MANAGERS)
  list(@CurrentTenant() tenant: TenantContext) {
    return this.users.list(tenant);
  }

  @Get(':id')
  @Roles(...OPERATOR_MANAGERS)
  findOne(@CurrentTenant() tenant: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.users.findOne(tenant, id);
  }
}
