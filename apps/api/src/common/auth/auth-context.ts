import { MembershipRole, PlatformRole } from '@prisma/client';
import { Request } from 'express';

/** Identidade resolvida pelo JwtAuthGuard a partir do banco, nunca do cliente. */
export interface AuthContext {
  userId: string;
  organizationId: string | null;
  role: MembershipRole | null;
  platformRole: PlatformRole | null;
}

/** Contexto de uma requisição feita dentro de um operador. */
export interface TenantContext extends AuthContext {
  organizationId: string;
  role: MembershipRole;
}

export interface AuthenticatedRequest extends Request {
  auth?: AuthContext;
}

export interface AccessTokenPayload {
  sub: string;
  org: string | null;
  typ: 'access';
}
