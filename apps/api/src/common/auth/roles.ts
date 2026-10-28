import { MembershipRole, PlatformRole } from '@prisma/client';

export type AccessRole = MembershipRole | PlatformRole;

export const OPERATOR_ROLES = Object.values(MembershipRole);

export const OPERATOR_MANAGERS: MembershipRole[] = [
  MembershipRole.OPERATOR_OWNER,
  MembershipRole.OPERATOR_ADMIN,
];

/** Papéis que enxergam todas as unidades do operador. Os demais só as vinculadas. */
export const ORG_WIDE_STORE_ROLES: MembershipRole[] = [...OPERATOR_MANAGERS, MembershipRole.ANALYST];

export const STORE_LEVEL_ROLES: MembershipRole[] = [
  MembershipRole.STORE_MANAGER,
  MembershipRole.STOCK_OPERATOR,
  MembershipRole.ANALYST,
];
