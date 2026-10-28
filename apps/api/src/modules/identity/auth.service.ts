import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { MembershipRole, OrganizationStatus, Prisma, UserStatus } from '@prisma/client';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { AccessTokenPayload } from '../../common/auth/auth-context';
import { hashPassword, verifyPassword } from '../../common/crypto/password';
import { randomToken, sha256 } from '../../common/crypto/tokens';
import { Env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LoginDto } from './dto/login.dto';

export interface ClientInfo {
  ip?: string;
  userAgent?: string;
}

export interface SessionTokens {
  tokenType: 'Bearer';
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  organization: { id: string; legalName: string } | null;
  role: MembershipRole | null;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class AuthService {
  /** Hash usado quando o e-mail não existe, para que o tempo de resposta não revele contas. */
  private readonly dummyHash = hashPassword(randomToken());

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    private readonly audit: AuditService,
  ) {}

  async login(dto: LoginDto, client: ClientInfo): Promise<SessionTokens> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: {
        memberships: {
          where: { organization: { status: OrganizationStatus.ACTIVE } },
          include: { organization: { select: { id: true, legalName: true } } },
        },
      },
    });

    const passwordOk = await verifyPassword(dto.password, user?.passwordHash ?? (await this.dummyHash));
    if (!user || !passwordOk || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const membership = dto.organizationId
      ? user.memberships.find((m) => m.organizationId === dto.organizationId)
      : user.memberships.length === 1
        ? user.memberships[0]
        : undefined;

    if (dto.organizationId && !membership) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    if (!membership && user.memberships.length > 1) {
      throw new ConflictException({
        message: 'Informe organizationId: o usuário pertence a mais de um operador',
        organizations: user.memberships.map((m) => m.organization),
      });
    }
    if (!membership && !user.platformRole) {
      throw new UnauthorizedException('Usuário sem operador ativo');
    }

    const tokens = await this.issueTokens(this.prisma, {
      userId: user.id,
      organizationId: membership?.organizationId ?? null,
      familyId: randomUUID(),
      client,
    });
    await this.audit.record({
      actorId: user.id,
      organizationId: membership?.organizationId ?? null,
      action: 'auth.login',
      ip: client.ip,
    });

    return {
      ...tokens,
      organization: membership?.organization ?? null,
      role: membership?.role ?? null,
    };
  }

  async refresh(rawToken: string, client: ClientInfo): Promise<SessionTokens> {
    const current = await this.findValidToken(rawToken);
    if (!current) throw new UnauthorizedException('Refresh token inválido');

    if (current.revokedAt) {
      // Token já rotacionado sendo reapresentado: possível roubo. Revoga a família inteira.
      await this.revokeFamily(current.familyId);
      await this.audit.record({
        actorId: current.userId,
        organizationId: current.organizationId,
        action: 'auth.refresh_reuse_detected',
        metadata: { familyId: current.familyId },
        ip: client.ip,
      });
      throw new UnauthorizedException('Refresh token inválido');
    }
    if (current.expiresAt <= new Date()) throw new UnauthorizedException('Refresh token expirado');

    const membership = current.organizationId
      ? await this.prisma.membership.findUnique({
          where: { userId_organizationId: { userId: current.userId, organizationId: current.organizationId } },
          include: { organization: { select: { id: true, legalName: true, status: true } } },
        })
      : null;
    const user = await this.prisma.user.findUnique({ where: { id: current.userId } });
    const contextValid =
      user?.status === UserStatus.ACTIVE &&
      (current.organizationId
        ? membership?.organization.status === OrganizationStatus.ACTIVE
        : user.platformRole !== null);
    if (!contextValid) {
      await this.revokeFamily(current.familyId);
      throw new UnauthorizedException('Sessão não é mais válida');
    }

    const tokens = await this.prisma.$transaction(async (tx) => {
      // Revogação condicional: só uma requisição concorrente consegue rotacionar o token.
      const { count } = await tx.refreshToken.updateMany({
        where: { id: current.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (count === 0) return null;
      return this.issueTokens(tx, {
        userId: current.userId,
        organizationId: current.organizationId,
        familyId: current.familyId,
        client,
        replaces: current.id,
      });
    });
    if (!tokens) {
      await this.revokeFamily(current.familyId);
      throw new UnauthorizedException('Refresh token inválido');
    }

    return {
      ...tokens,
      organization: membership ? { id: membership.organization.id, legalName: membership.organization.legalName } : null,
      role: membership?.role ?? null,
    };
  }

  async logout(rawToken: string): Promise<void> {
    const token = await this.findValidToken(rawToken);
    if (token) await this.revokeFamily(token.familyId);
  }

  private async findValidToken(rawToken: string) {
    const [id, secret] = rawToken.split('.');
    if (!id || !secret || !UUID_PATTERN.test(id)) return null;

    const token = await this.prisma.refreshToken.findUnique({ where: { id } });
    if (!token) return null;

    const expected = Buffer.from(token.tokenHash, 'hex');
    const actual = Buffer.from(sha256(secret), 'hex');
    return timingSafeEqual(expected, actual) ? token : null;
  }

  private async revokeFamily(familyId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokens(
    client: Prisma.TransactionClient,
    params: {
      userId: string;
      organizationId: string | null;
      familyId: string;
      client: ClientInfo;
      replaces?: string;
    },
  ) {
    const secret = randomToken();
    const ttlDays = this.config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true });
    const refresh = await client.refreshToken.create({
      data: {
        userId: params.userId,
        organizationId: params.organizationId,
        familyId: params.familyId,
        tokenHash: sha256(secret),
        expiresAt: new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000),
        ip: params.client.ip,
        userAgent: params.client.userAgent?.slice(0, 255),
      },
    });
    if (params.replaces) {
      await client.refreshToken.update({ where: { id: params.replaces }, data: { replacedById: refresh.id } });
    }

    const payload: AccessTokenPayload = { sub: params.userId, org: params.organizationId, typ: 'access' };
    return {
      tokenType: 'Bearer' as const,
      accessToken: await this.jwt.signAsync(payload),
      expiresIn: this.config.get('JWT_ACCESS_TTL_SECONDS', { infer: true }),
      refreshToken: `${refresh.id}.${secret}`,
    };
  }
}
