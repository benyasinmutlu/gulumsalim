const TURKISH_IBAN_PATTERN = /^TR\d{24}$/;

export function normalizeIban(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

function mod97(value: string): number {
  let remainder = 0;
  for (const digit of value) {
    remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder;
}

export function isValidTurkishIban(value: string): boolean {
  const iban = normalizeIban(value);
  if (!TURKISH_IBAN_PATTERN.test(iban)) return false;

  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (letter) => String(letter.charCodeAt(0) - 55));
  return mod97(numeric) === 1;
}
