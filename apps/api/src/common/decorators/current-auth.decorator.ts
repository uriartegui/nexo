import { createParamDecorator, ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AuthContext, AuthenticatedRequest, TenantContext } from '../auth/auth-context';

function getAuth(ctx: ExecutionContext): AuthContext {
  const auth = ctx.switchToHttp().getRequest<AuthenticatedRequest>().auth;
  if (!auth) throw new UnauthorizedException();
  return auth;
}

export const CurrentAuth = createParamDecorator((_: unknown, ctx: ExecutionContext) => getAuth(ctx));

/** Exige que a sessão esteja vinculada a um operador. */
export const CurrentTenant = createParamDecorator((_: unknown, ctx: ExecutionContext): TenantContext => {
  const auth = getAuth(ctx);
  if (!auth.organizationId || !auth.role) {
    throw new ForbiddenException('Sessão sem operador vinculado');
  }
  return auth as TenantContext;
});
