import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { ADMIN_EMAIL, Api, api, createOrganization, createTestApp, login, PASSWORD, resetDatabase } from './helpers';

/**
 * Definition of Done da Sprint 01: uma organização cadastra unidade e usuário,
 * e outra organização não acessa nenhum desses recursos, mesmo manipulando IDs.
 */
describe('Isolamento multi-tenant (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: Api;

  let tokenA: string;
  let tokenB: string;
  let orgA: { id: string; owner: { id: string } };
  let orgB: { id: string; owner: { id: string } };
  let storeA: { id: string };
  let storeB: { id: string };
  let managerA: { id: string };

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    http = api(app);
    await resetDatabase(prisma);

    const admin = await login(http, ADMIN_EMAIL);
    ({ org: orgA, token: tokenA } = await createOrganization(http, admin.accessToken, 'alfa'));
    ({ org: orgB, token: tokenB } = await createOrganization(http, admin.accessToken, 'beta'));

    storeA = (await http.post('/stores', { name: 'Alfa Centro', city: 'Curitiba', state: 'pr' }, tokenA).expect(201)).body;
    storeB = (await http.post('/stores', { name: 'Beta Norte' }, tokenB).expect(201)).body;
    managerA = (
      await http
        .post('/users', { name: 'Gerente Alfa', email: 'gerente@alfa.test', password: PASSWORD, role: 'STORE_MANAGER' }, tokenA)
        .expect(201)
    ).body;
  });

  afterAll(async () => {
    await app.close();
  });

  it('operador A cadastra unidade e usuário no próprio operador', async () => {
    const stores = await http.get('/stores', tokenA).expect(200);
    expect(stores.body.map((s: { id: string }) => s.id)).toEqual([storeA.id]);
    expect(stores.body[0]).toMatchObject({ organizationId: orgA.id, state: 'PR' });

    const users = await http.get('/users', tokenA).expect(200);
    expect(users.body.map((u: { email: string }) => u.email).sort()).toEqual(['dono@alfa.test', 'gerente@alfa.test']);

    const current = await http.get('/organizations/current', tokenA).expect(200);
    expect(current.body.id).toBe(orgA.id);
  });

  describe('operador B tentando acessar recursos de A', () => {
    it('não vê unidades de A na listagem', async () => {
      const res = await http.get('/stores', tokenB).expect(200);
      expect(res.body.map((s: { id: string }) => s.id)).toEqual([storeB.id]);
    });

    it('recebe 404 ao consultar, alterar ou listar membros de unidade de A por ID', async () => {
      await http.get(`/stores/${storeA.id}`, tokenB).expect(404);
      await http.patch(`/stores/${storeA.id}`, { name: 'Invadida' }, tokenB).expect(404);
      await http.get(`/stores/${storeA.id}/members`, tokenB).expect(404);

      const unchanged = await prisma.store.findUniqueOrThrow({ where: { id: storeA.id } });
      expect(unchanged.name).toBe('Alfa Centro');
    });

    it('recebe 404 ao consultar usuário de A por ID', async () => {
      await http.get(`/users/${managerA.id}`, tokenB).expect(404);
      await http.get(`/users/${orgA.owner.id}`, tokenB).expect(404);
    });

    it('não vincula usuário de A à própria unidade nem usuário próprio à unidade de A', async () => {
      await http.post(`/stores/${storeB.id}/members`, { userId: managerA.id, role: 'STORE_MANAGER' }, tokenB).expect(404);
      await http.post(`/stores/${storeA.id}/members`, { userId: orgB.owner.id, role: 'STORE_MANAGER' }, tokenB).expect(404);
      await http.delete(`/stores/${storeA.id}/members/${managerA.id}`, tokenB).expect(404);
    });

    it('não consegue forçar organizationId no corpo da requisição', async () => {
      await http.post('/stores', { name: 'Loja falsa', organizationId: orgA.id }, tokenB).expect(400);
      await http.patch(`/stores/${storeB.id}`, { organizationId: orgA.id }, tokenB).expect(400);
      expect(await prisma.store.count({ where: { organizationId: orgA.id } })).toBe(1);
    });

    it('não consegue entrar no operador A informando organizationId no login', async () => {
      await http.post('/auth/login', { email: 'dono@beta.test', password: PASSWORD, organizationId: orgA.id }).expect(401);
    });

    it('não consegue criar operadores (rota exclusiva da plataforma)', async () => {
      await http.get('/organizations', tokenB).expect(403);
    });
  });

  it('o banco rejeita vínculo entre unidade e membro de operadores diferentes', async () => {
    await expect(
      prisma.storeMembership.create({
        data: { storeId: storeA.id, userId: orgB.owner.id, organizationId: orgA.id, role: 'STORE_MANAGER' },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
    await expect(
      prisma.storeMembership.create({
        data: { storeId: storeA.id, userId: orgB.owner.id, organizationId: orgB.id, role: 'STORE_MANAGER' },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });

  describe('papéis dentro do operador', () => {
    let managerToken: string;
    let storeA2: { id: string };

    beforeAll(async () => {
      storeA2 = (await http.post('/stores', { name: 'Alfa Sul' }, tokenA).expect(201)).body;
      await http.post(`/stores/${storeA.id}/members`, { userId: managerA.id, role: 'STORE_MANAGER' }, tokenA).expect(201);
      managerToken = (await login(http, 'gerente@alfa.test')).accessToken;
    });

    it('gerente de unidade só enxerga as unidades vinculadas', async () => {
      const res = await http.get('/stores', managerToken).expect(200);
      expect(res.body.map((s: { id: string }) => s.id)).toEqual([storeA.id]);
      await http.get(`/stores/${storeA2.id}`, managerToken).expect(404);
      await http.patch(`/stores/${storeA.id}`, { name: 'Alfa Centro 2' }, managerToken).expect(200);
    });

    it('gerente de unidade não cria unidades nem usuários', async () => {
      await http.post('/stores', { name: 'Não pode' }, managerToken).expect(403);
      await http
        .post('/users', { name: 'Analista X', email: 'x@alfa.test', password: PASSWORD, role: 'ANALYST' }, managerToken)
        .expect(403);
    });

    it('administrador do operador não pode criar proprietário', async () => {
      await http
        .post('/users', { name: 'Admin Alfa', email: 'admin@alfa.test', password: PASSWORD, role: 'OPERATOR_ADMIN' }, tokenA)
        .expect(201);
      const adminToken = (await login(http, 'admin@alfa.test')).accessToken;
      await http
        .post('/users', { name: 'Dono 2', email: 'dono2@alfa.test', password: PASSWORD, role: 'OPERATOR_OWNER' }, adminToken)
        .expect(403);
    });

    it('perde acesso imediatamente quando o vínculo com a unidade é removido', async () => {
      await http.delete(`/stores/${storeA.id}/members/${managerA.id}`, tokenA).expect(204);
      const res = await http.get('/stores', managerToken).expect(200);
      expect(res.body).toEqual([]);
    });
  });

  it('registra auditoria apenas no operador correspondente', async () => {
    const logs = await prisma.auditLog.findMany({ where: { organizationId: orgB.id, action: { startsWith: 'store.' } } });
    expect(logs.map((l) => l.entityId)).toEqual([storeB.id]);
  });
});
