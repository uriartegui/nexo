import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContext } from '../../common/auth/auth-context';
import { ORG_WIDE_STORE_ROLES } from '../../common/auth/roles';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AddStoreMemberDto, CreateStoreDto, UpdateStoreDto } from './dto/store.dto';

const storeMemberSelect = {
  role: true,
  createdAt: true,
  membership: { select: { user: { select: { id: true, name: true, email: true } } } },
} satisfies Prisma.StoreMembershipSelect;

type StoreMemberRow = Prisma.StoreMembershipGetPayload<{ select: typeof storeMemberSelect }>;

function toMemberResponse(row: StoreMemberRow) {
  return { ...row.membership.user, role: row.role, addedAt: row.createdAt };
}

@Injectable()
export class StoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Toda consulta parte daqui: o operador vem da sessão, nunca do corpo ou da URL,
   * e papéis de unidade só enxergam as lojas às quais foram vinculados.
   */
  private scope(tenant: TenantContext): Prisma.StoreWhereInput {
    const where: Prisma.StoreWhereInput = { organizationId: tenant.organizationId };
    if (!ORG_WIDE_STORE_ROLES.includes(tenant.role)) {
      where.storeMemberships = { some: { userId: tenant.userId } };
    }
    return where;
  }

  private async getAccessible(tenant: TenantContext, id: string) {
    const store = await this.prisma.store.findFirst({ where: { ...this.scope(tenant), id } });
    if (!store) throw new NotFoundException('Unidade não encontrada');
    return store;
  }

  async create(tenant: TenantContext, dto: CreateStoreDto) {
    return this.prisma.$transaction(async (tx) => {
      const store = await tx.store.create({ data: { ...dto, organizationId: tenant.organizationId } });
      await this.audit.record(
        {
          actorId: tenant.userId,
          organizationId: tenant.organizationId,
          action: 'store.created',
          entityType: 'store',
          entityId: store.id,
        },
        tx,
      );
      return store;
    });
  }

  list(tenant: TenantContext) {
    return this.prisma.store.findMany({ where: this.scope(tenant), orderBy: { name: 'asc' } });
  }

  findOne(tenant: TenantContext, id: string) {
    return this.getAccessible(tenant, id);
  }

  async update(tenant: TenantContext, id: string, dto: UpdateStoreDto) {
    await this.getAccessible(tenant, id);
    return this.prisma.$transaction(async (tx) => {
      const store = await tx.store.update({
        where: { id_organizationId: { id, organizationId: tenant.organizationId } },
        data: dto,
      });
      await this.audit.record(
        {
          actorId: tenant.userId,
          organizationId: tenant.organizationId,
          action: 'store.updated',
          entityType: 'store',
          entityId: id,
          metadata: { fields: Object.keys(dto) },
        },
        tx,
      );
      return store;
    });
  }

  async listMembers(tenant: TenantContext, storeId: string) {
    await this.getAccessible(tenant, storeId);
    const rows = await this.prisma.storeMembership.findMany({
      where: { storeId, organizationId: tenant.organizationId },
      select: storeMemberSelect,
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toMemberResponse);
  }

  async addMember(tenant: TenantContext, storeId: string, dto: AddStoreMemberDto) {
    await this.getAccessible(tenant, storeId);
    const membership = await this.prisma.membership.findUnique({
      where: { userId_organizationId: { userId: dto.userId, organizationId: tenant.organizationId } },
    });
    if (!membership) throw new NotFoundException('Usuário não encontrado');

    return this.prisma.$transaction(async (tx) => {
      const row = await tx.storeMembership.create({
        data: { storeId, userId: dto.userId, organizationId: tenant.organizationId, role: dto.role },
        select: storeMemberSelect,
      });
      await this.audit.record(
        {
          actorId: tenant.userId,
          organizationId: tenant.organizationId,
          action: 'store.member_added',
          entityType: 'store',
          entityId: storeId,
          metadata: { userId: dto.userId, role: dto.role },
        },
        tx,
      );
      return toMemberResponse(row);
    });
  }

  async removeMember(tenant: TenantContext, storeId: string, userId: string) {
    await this.getAccessible(tenant, storeId);
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.storeMembership.deleteMany({
        where: { storeId, userId, organizationId: tenant.organizationId },
      });
      if (count === 0) throw new NotFoundException('Vínculo não encontrado');
      await this.audit.record(
        {
          actorId: tenant.userId,
          organizationId: tenant.organizationId,
          action: 'store.member_removed',
          entityType: 'store',
          entityId: storeId,
          metadata: { userId },
        },
        tx,
      );
    });
  }
}
