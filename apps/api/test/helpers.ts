import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PlatformRole } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { hashPassword } from '../src/common/crypto/password';
import { computeCnpjCheckDigits } from '../src/common/validation/cnpj';
import { PrismaService } from '../src/prisma/prisma.service';

export const PASSWORD = 'senha-de-teste-123';
export const ADMIN_EMAIL = 'admin@plataforma.test';

export async function createTestApp() {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return { app, prisma: app.get(PrismaService) };
}

export async function resetDatabase(prisma: PrismaService) {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE audit_logs, refresh_tokens, store_memberships, stores, memberships, users, organizations CASCADE',
  );
  await prisma.user.create({
    data: {
      email: ADMIN_EMAIL,
      name: 'Admin',
      passwordHash: await hashPassword(PASSWORD),
      platformRole: PlatformRole.PLATFORM_ADMIN,
    },
  });
}

let cnpjSeq = 0;
export function nextCnpj() {
  cnpjSeq += 1;
  const base = `${String(10_000_000 + cnpjSeq)}0001`;
  return base + computeCnpjCheckDigits(base);
}

export function api(app: INestApplication) {
  const server = app.getHttpServer();
  const withAuth = (req: request.Test, token?: string) => (token ? req.set('Authorization', `Bearer ${token}`) : req);
  return {
    get: (path: string, token?: string) => withAuth(request(server).get(`/api/v1${path}`), token),
    post: (path: string, body: object, token?: string) =>
      withAuth(request(server).post(`/api/v1${path}`), token).send(body),
    patch: (path: string, body: object, token?: string) =>
      withAuth(request(server).patch(`/api/v1${path}`), token).send(body),
    delete: (path: string, token?: string) => withAuth(request(server).delete(`/api/v1${path}`), token),
  };
}

export type Api = ReturnType<typeof api>;

export async function login(http: Api, email: string, organizationId?: string) {
  const res = await http.post('/auth/login', { email, password: PASSWORD, organizationId }).expect(200);
  return res.body as { accessToken: string; refreshToken: string };
}

export async function createOrganization(http: Api, adminToken: string, slug: string) {
  const res = await http
    .post(
      '/organizations',
      {
        legalName: `Operador ${slug} LTDA`,
        document: nextCnpj(),
        owner: { name: `Dono ${slug}`, email: `dono@${slug}.test`, password: PASSWORD },
      },
      adminToken,
    )
    .expect(201);
  const { accessToken } = await login(http, `dono@${slug}.test`);
  return { org: res.body as { id: string; owner: { id: string } }, token: accessToken };
}
