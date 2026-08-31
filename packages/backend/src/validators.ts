// Business logic validators

export function isValidCPF(cpf: string): boolean {
  // Remove non-digits
  const cleaned = cpf.replace(/\D/g, '');

  if (cleaned.length !== 11) return false;

  // Check for sequence patterns (invalid CPFs)
  if (/^(\d)\1{10}$/.test(cleaned)) return false;

  // Validate first check digit
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned[i]) * (10 - i);
  }
  let remainder = sum % 11;
  const digit1 = remainder < 2 ? 0 : 11 - remainder;

  if (parseInt(cleaned[9]) !== digit1) return false;

  // Validate second check digit
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned[i]) * (11 - i);
  }
  remainder = sum % 11;
  const digit2 = remainder < 2 ? 0 : 11 - remainder;

  return parseInt(cleaned[10]) === digit2;
}

export function isValidCNPJ(cnpj: string): boolean {
  const cleaned = cnpj.replace(/\D/g, '');

  if (cleaned.length !== 14) return false;

  // Check for sequence patterns
  if (/^(\d)\1{13}$/.test(cleaned)) return false;

  // Validate first check digit
  let sum = 0;
  let factor = 5;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleaned[i]) * factor;
    factor = factor === 2 ? 9 : factor - 1;
  }
  let remainder = sum % 11;
  const digit1 = remainder < 2 ? 0 : 11 - remainder;

  if (parseInt(cleaned[12]) !== digit1) return false;

  // Validate second check digit
  sum = 0;
  factor = 6;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cleaned[i]) * factor;
    factor = factor === 2 ? 9 : factor - 1;
  }
  remainder = sum % 11;
  const digit2 = remainder < 2 ? 0 : 11 - remainder;

  return parseInt(cleaned[13]) === digit2;
}

export function isValidEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

export function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length >= 10 && cleaned.length <= 11;
}

export const AirlinePrograms = {
  smiles: 'Smiles (Gol)',
  latampass: 'Latam Pass',
  azulconnect: 'Azul Connect',
  viceversa: 'Vice Versa (Avianca)',
} as const;

export function isValidProgram(program: string): boolean {
  return Object.keys(AirlinePrograms).includes(program);
}

export function validateOperationAmount(amount: number): boolean {
  return amount >= 1000 && amount <= 50000000; // Max 50M points
}

export function validateCommissionPercentage(percentage: number): boolean {
  return percentage >= 0 && percentage <= 100;
}

export function calculateOperationValues(
  amount: number,
  pricePerThousand: number,
  commissionPercentage: number
) {
  const totalPrice = (amount / 1000) * pricePerThousand;
  const commissionAmount = totalPrice * (commissionPercentage / 100);
  const netAmount = totalPrice - commissionAmount;

  return {
    amount,
    pricePerThousand,
    commissionPercentage,
    totalPrice: Math.round(totalPrice * 100) / 100,
    commissionAmount: Math.round(commissionAmount * 100) / 100,
    netAmount: Math.round(netAmount * 100) / 100,
  };
}
