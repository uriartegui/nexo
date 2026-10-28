export interface Env {
  NODE_ENV: string;
  PORT: number;
  DATABASE_URL: string;
  JWT_ACCESS_SECRET: string;
  JWT_ACCESS_TTL_SECONDS: number;
  REFRESH_TOKEN_TTL_DAYS: number;
  LOGIN_RATE_LIMIT: number;
}

export function validateEnv(raw: Record<string, unknown>): Env {
  const errors: string[] = [];

  const str = (key: string, fallback?: string): string => {
    const value = raw[key] ?? fallback;
    if (typeof value !== 'string' || value === '') errors.push(`${key} é obrigatória`);
    return value as string;
  };
  const int = (key: string, fallback: number): number => {
    const value = raw[key] === undefined || raw[key] === '' ? fallback : Number(raw[key]);
    if (!Number.isInteger(value) || value <= 0) errors.push(`${key} deve ser um inteiro positivo`);
    return value;
  };

  const env: Env = {
    NODE_ENV: str('NODE_ENV', 'development'),
    PORT: int('PORT', 3000),
    DATABASE_URL: str('DATABASE_URL'),
    JWT_ACCESS_SECRET: str('JWT_ACCESS_SECRET'),
    JWT_ACCESS_TTL_SECONDS: int('JWT_ACCESS_TTL_SECONDS', 900),
    REFRESH_TOKEN_TTL_DAYS: int('REFRESH_TOKEN_TTL_DAYS', 30),
    LOGIN_RATE_LIMIT: int('LOGIN_RATE_LIMIT', 10),
  };

  if (env.JWT_ACCESS_SECRET && env.JWT_ACCESS_SECRET.length < 32) {
    errors.push('JWT_ACCESS_SECRET deve ter pelo menos 32 caracteres');
  }
  if (errors.length > 0) {
    throw new Error(`Configuração inválida:\n- ${errors.join('\n- ')}`);
  }
  return env;
}
