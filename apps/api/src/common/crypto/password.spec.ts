import { hashPassword, verifyPassword } from './password';

describe('password', () => {
  it('verifica a senha correta e rejeita a incorreta', async () => {
    const hash = await hashPassword('senha-muito-segura');
    expect(hash).toMatch(/^scrypt\$/);
    await expect(verifyPassword('senha-muito-segura', hash)).resolves.toBe(true);
    await expect(verifyPassword('senha-errada', hash)).resolves.toBe(false);
  });

  it('gera salts diferentes para a mesma senha', async () => {
    expect(await hashPassword('abc')).not.toEqual(await hashPassword('abc'));
  });

  it('rejeita hashes em formato desconhecido', async () => {
    await expect(verifyPassword('x', 'bcrypt$abc')).resolves.toBe(false);
  });
});
