import { PlatformRole, PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/common/crypto/password';

/** Cria (ou promove) o administrador da plataforma. */
async function main() {
  const email = process.env.PLATFORM_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.PLATFORM_ADMIN_PASSWORD;
  if (!email || !password || password.length < 10) {
    throw new Error('Defina PLATFORM_ADMIN_EMAIL e PLATFORM_ADMIN_PASSWORD (mín. 10 caracteres)');
  }

  const prisma = new PrismaClient();
  try {
    await prisma.user.upsert({
      where: { email },
      update: { platformRole: PlatformRole.PLATFORM_ADMIN },
      create: {
        email,
        name: 'Administrador da plataforma',
        passwordHash: await hashPassword(password),
        platformRole: PlatformRole.PLATFORM_ADMIN,
      },
    });
    console.log(`Administrador da plataforma pronto: ${email}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
