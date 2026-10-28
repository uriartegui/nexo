import { ArgumentsHost, Catch, ConflictException, NotFoundException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '@prisma/client';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter extends BaseExceptionFilter {
  override catch(error: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    switch (error.code) {
      case 'P2002':
        return super.catch(new ConflictException('Registro já existe'), host);
      case 'P2003':
        return super.catch(new ConflictException('Violação de integridade referencial'), host);
      case 'P2025':
        return super.catch(new NotFoundException('Registro não encontrado'), host);
      default:
        return super.catch(error, host);
    }
  }
}
