import { registerDecorator, ValidationOptions } from 'class-validator';
import { isValidCnpj } from './cnpj';

export function IsCnpj(options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isCnpj',
      target: object.constructor,
      propertyName,
      options: { message: 'CNPJ inválido', ...options },
      validator: {
        validate: (value: unknown) => typeof value === 'string' && isValidCnpj(value),
      },
    });
}
