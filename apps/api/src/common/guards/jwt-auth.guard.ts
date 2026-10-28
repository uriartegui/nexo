import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { MembershipRole, OrganizationStatus, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AccessTokenPayload, AuthenticatedRequest } from '../auth/auth-context';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Valida o access token e recarrega usuário e vínculo do banco a cada requisição,
 * para que desativações e remoções de acesso tenham efeito imediato.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException();

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw new UnauthorizedException();
    }
    if (payload.typ !== 'access') throw new UnauthorizedException();

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { status: true, platformRole: true },
    });
    if (!user || user.status !== UserStatus.ACTIVE) throw new UnauthorizedException();

    let role: MembershipRole | null = null;
    if (payload.org) {
      const membership = await this.prisma.membership.findUnique({
        where: { userId_organizationId: { userId: payload.sub, organizationId: payload.org } },
        select: { role: true, organization: { select: { status: true } } },
      });
      if (!membership || membership.organization.status !== OrganizationStatus.ACTIVE) {
        throw new UnauthorizedException();
      }
      role = membership.role;
    }

    request.auth = {
      userId: payload.sub,
      organizationId: payload.org,
      role,
      platformRole: user.platformRole,
    };
    return true;
  }
}
