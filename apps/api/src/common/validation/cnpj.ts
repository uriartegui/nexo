/**
 * Validação de CNPJ, incluindo o formato alfanumérico (IN RFB 2.229/2024):
 * 12 caracteres [0-9A-Z] + 2 dígitos verificadores numéricos.
 * Cada caractere vale (código ASCII − 48), o que preserva o cálculo dos CNPJs numéricos.
 */
const WEIGHTS_FIRST = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const WEIGHTS_SECOND = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

export function normalizeCnpj(value: string): string {
  return value.replace(/[./\s-]/g, '').toUpperCase();
}

function checkDigit(base: string, weights: number[]): number {
  const sum = [...base].reduce((acc, char, i) => acc + (char.charCodeAt(0) - 48) * weights[i], 0);
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

export function computeCnpjCheckDigits(base12: string): string {
  const first = checkDigit(base12, WEIGHTS_FIRST);
  const second = checkDigit(base12 + first, WEIGHTS_SECOND);
  return `${first}${second}`;
}

export function isValidCnpj(value: string): boolean {
  const cnpj = normalizeCnpj(value);
  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(cnpj)) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;
  return computeCnpjCheckDigits(cnpj.slice(0, 12)) === cnpj.slice(12);
}
