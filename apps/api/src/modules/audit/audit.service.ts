import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditEntry {
  actorId?: string | null;
  organizationId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Prisma.InputJsonObject;
  ip?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /** Aceita o cliente de uma transação para registrar a auditoria junto da operação. */
  async record(entry: AuditEntry, client: Prisma.TransactionClient = this.prisma): Promise<void> {
    await client.auditLog.create({ data: entry });
  }
}
