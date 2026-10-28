import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedRequest } from '../auth/auth-context';
import { AccessRole } from '../auth/roles';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<AccessRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;

    const { auth } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (auth?.platformRole && roles.includes(auth.platformRole)) return true;
    if (auth?.role && roles.includes(auth.role)) return true;
    throw new ForbiddenException('Permissão insuficiente');
  }
}
