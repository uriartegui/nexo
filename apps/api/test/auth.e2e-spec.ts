import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { ADMIN_EMAIL, Api, api, createOrganization, createTestApp, login, PASSWORD, resetDatabase } from './helpers';

describe('Autenticação (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: Api;
  let adminToken: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    http = api(app);
    await resetDatabase(prisma);
    adminToken = (await login(http, ADMIN_EMAIL)).accessToken;
    await createOrganization(http, adminToken, 'gama');
  });

  afterAll(async () => {
    await app.close();
  });

  it('exige autenticação por padrão', async () => {
    await http.get('/stores').expect(401);
    await http.get('/stores', 'token-invalido').expect(401);
  });

  it('responde 401 genérico para senha errada e e-mail inexistente', async () => {
    const wrong = await http.post('/auth/login', { email: 'dono@gama.test', password: 'errada-123456' }).expect(401);
    const missing = await http.post('/auth/login', { email: 'ninguem@gama.test', password: PASSWORD }).expect(401);
    expect(wrong.body.message).toBe(missing.body.message);
  });

  it('normaliza o e-mail no login', async () => {
    await http.post('/auth/login', { email: '  DONO@Gama.test ', password: PASSWORD }).expect(200);
  });

  it('rotaciona o refresh token e revoga a família ao detectar reutilização', async () => {
    const first = await login(http, 'dono@gama.test');

    const rotated = await http.post('/auth/refresh', { refreshToken: first.refreshToken }).expect(200);
    expect(rotated.body.refreshToken).not.toBe(first.refreshToken);
    await http.get('/organizations/current', rotated.body.accessToken).expect(200);

    // Reapresentar o token antigo invalida também o novo.
    await http.post('/auth/refresh', { refreshToken: first.refreshToken }).expect(401);
    await http.post('/auth/refresh', { refreshToken: rotated.body.refreshToken }).expect(401);
  });

  it('logout revoga a sessão', async () => {
    const session = await login(http, 'dono@gama.test');
    await http.post('/auth/logout', { refreshToken: session.refreshToken }).expect(204);
    await http.post('/auth/refresh', { refreshToken: session.refreshToken }).expect(401);
  });

  it('rejeita refresh token adulterado', async () => {
    const session = await login(http, 'dono@gama.test');
    const [id] = session.refreshToken.split('.');
    await http.post('/auth/refresh', { refreshToken: `${id}.adulterado` }).expect(401);
    await http.post('/auth/refresh', { refreshToken: 'lixo' }).expect(401);
  });

  it('usuário desativado perde acesso mesmo com access token válido', async () => {
    const session = await login(http, 'dono@gama.test');
    await prisma.user.update({ where: { email: 'dono@gama.test' }, data: { status: 'DISABLED' } });
    await http.get('/organizations/current', session.accessToken).expect(401);
    await http.post('/auth/refresh', { refreshToken: session.refreshToken }).expect(401);
    await prisma.user.update({ where: { email: 'dono@gama.test' }, data: { status: 'ACTIVE' } });
  });

  it('administrador da plataforma sem operador não acessa rotas de operador', async () => {
    await http.get('/stores', adminToken).expect(403);
    await http.get('/organizations', adminToken).expect(200);
  });

  it('valida CNPJ e e-mail duplicado ao criar operador', async () => {
    await http
      .post(
        '/organizations',
        { legalName: 'X LTDA', document: '11222333000182', owner: { name: 'Dono X', email: 'x@x.test', password: PASSWORD } },
        adminToken,
      )
      .expect(400);
    await http
      .post(
        '/organizations',
        { legalName: 'Y LTDA', document: '11.222.333/0001-81', owner: { name: 'Dono Y', email: 'dono@gama.test', password: PASSWORD } },
        adminToken,
      )
      .expect(409);
    expect(await prisma.organization.count({ where: { document: '11222333000181' } })).toBe(0);
  });

  it('responde health check sem autenticação', async () => {
    await http.get('/health').expect(200, { status: 'ok', database: 'up' });
  });
});
