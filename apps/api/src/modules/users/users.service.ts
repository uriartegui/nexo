import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MembershipRole, Prisma } from '@prisma/client';
import { AuthContext, TenantContext } from '../../common/auth/auth-context';
import { hashPassword } from '../../common/crypto/password';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateUserDto } from './dto/create-user.dto';

const memberSelect = {
  role: true,
  createdAt: true,
  user: { select: { id: true, name: true, email: true, status: true } },
} satisfies Prisma.MembershipSelect;

type MemberRow = Prisma.MembershipGetPayload<{ select: typeof memberSelect }>;

function toResponse(row: MemberRow) {
  return { ...row.user, role: row.role, memberSince: row.createdAt };
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(tenant: TenantContext, dto: CreateUserDto) {
    if (dto.role === MembershipRole.OPERATOR_OWNER && tenant.role !== MembershipRole.OPERATOR_OWNER) {
      throw new ForbiddenException('Apenas o proprietário pode cadastrar outro proprietário');
    }
    const passwordHash = await hashPassword(dto.password);

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name: dto.name, email: dto.email, passwordHash },
        select: { id: true },
      });
      const membership = await tx.membership.create({
        data: { userId: user.id, organizationId: tenant.organizationId, role: dto.role },
        select: memberSelect,
      });
      await this.audit.record(
        {
          actorId: tenant.userId,
          organizationId: tenant.organizationId,
          action: 'user.created',
          entityType: 'user',
          entityId: user.id,
          metadata: { role: dto.role },
        },
        tx,
      );
      return toResponse(membership);
    });
  }

  async list(tenant: TenantContext) {
    const rows = await this.prisma.membership.findMany({
      where: { organizationId: tenant.organizationId },
      select: memberSelect,
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toResponse);
  }

  async findOne(tenant: TenantContext, userId: string) {
    const row = await this.prisma.membership.findUnique({
      where: { userId_organizationId: { userId, organizationId: tenant.organizationId } },
      select: memberSelect,
    });
    if (!row) throw new NotFoundException('Usuário não encontrado');
    return toResponse(row);
  }

  async me(auth: AuthContext) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: auth.userId },
      select: { id: true, name: true, email: true, status: true, platformRole: true },
    });
    return { ...user, organizationId: auth.organizationId, role: auth.role };
  }
}
