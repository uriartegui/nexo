import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Libera a rota da autenticação, que é obrigatória por padrão. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
