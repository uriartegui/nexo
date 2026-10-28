import { Injectable, NotFoundException } from '@nestjs/common';
import { MembershipRole, Organization } from '@prisma/client';
import { AuthContext } from '../../common/auth/auth-context';
import { hashPassword } from '../../common/crypto/password';
import { normalizeCnpj } from '../../common/validation/cnpj';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';

function toResponse(org: Organization) {
  return {
    id: org.id,
    legalName: org.legalName,
    tradeName: org.tradeName,
    document: org.document,
    status: org.status,
    createdAt: org.createdAt,
  };
}

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(actor: AuthContext, dto: CreateOrganizationDto) {
    const passwordHash = await hashPassword(dto.owner.password);

    return this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { legalName: dto.legalName, tradeName: dto.tradeName, document: normalizeCnpj(dto.document) },
      });
      const owner = await tx.user.create({
        data: {
          name: dto.owner.name,
          email: dto.owner.email,
          passwordHash,
          memberships: { create: { organizationId: org.id, role: MembershipRole.OPERATOR_OWNER } },
        },
        select: { id: true, name: true, email: true },
      });
      await this.audit.record(
        {
          actorId: actor.userId,
          organizationId: org.id,
          action: 'organization.created',
          entityType: 'organization',
          entityId: org.id,
          metadata: { ownerId: owner.id },
        },
        tx,
      );
      return { ...toResponse(org), owner };
    });
  }

  async list() {
    const orgs = await this.prisma.organization.findMany({ orderBy: { createdAt: 'desc' } });
    return orgs.map(toResponse);
  }

  async findById(id: string) {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) throw new NotFoundException('Operador não encontrado');
    return toResponse(org);
  }
}
