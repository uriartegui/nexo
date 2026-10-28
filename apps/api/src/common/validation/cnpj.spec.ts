import { computeCnpjCheckDigits, isValidCnpj, normalizeCnpj } from './cnpj';

describe('cnpj', () => {
  it('aceita CNPJ numérico válido com ou sem máscara', () => {
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true);
    expect(isValidCnpj('11222333000181')).toBe(true);
  });

  it('aceita CNPJ alfanumérico válido', () => {
    expect(isValidCnpj('12.ABC.345/01DE-35')).toBe(true);
  });

  it('rejeita dígitos verificadores incorretos e sequências repetidas', () => {
    expect(isValidCnpj('11222333000182')).toBe(false);
    expect(isValidCnpj('00000000000000')).toBe(false);
    expect(isValidCnpj('123')).toBe(false);
  });

  it('normaliza máscara e caixa', () => {
    expect(normalizeCnpj('12.abc.345/01de-35')).toBe('12ABC34501DE35');
  });

  it('calcula dígitos verificadores', () => {
    expect(computeCnpjCheckDigits('112223330001')).toBe('81');
  });
});
