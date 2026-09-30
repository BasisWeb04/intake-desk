/**
 * North American Numbering Plan checks. Structural rules only: area code and exchange must
 * start with 2-9 and must not be an N11 service code.
 */
export interface PhoneCheck {
  valid: boolean;
  digits: string | null;
  reason?: string;
  formatted?: string;
}

export function checkNanp(raw: string): PhoneCheck {
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  if (digits.length !== 10) return { valid: false, digits: null, reason: "A phone number needs 10 digits." };
  const area = digits.slice(0, 3);
  const exchange = digits.slice(3, 6);
  if (!/^[2-9]/.test(area)) return { valid: false, digits: null, reason: "Area codes cannot start with 0 or 1." };
  if (area.slice(1) === "11") return { valid: false, digits: null, reason: `${area} is a service code, not an area code.` };
  if (!/^[2-9]/.test(exchange)) return { valid: false, digits: null, reason: "The 3-digit exchange cannot start with 0 or 1." };
  if (exchange.slice(1) === "11") return { valid: false, digits: null, reason: `${exchange} is a service code, not an exchange.` };
  return { valid: true, digits };
}

/** 555-0100 to 555-0199 is reserved for fiction, so the public demo never stores a real number. */
export function isFictionalNumber(digits: string): boolean {
  return /^\d{3}55501\d{2}$/.test(digits);
}

export function formatPhone(digits: string): string {
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/** Validates a callback number for this demo: NANP-valid and in the fictional range. */
export function validateCallback(raw: string): PhoneCheck {
  const check = checkNanp(raw);
  if (!check.valid || !check.digits) return check;
  if (!isFictionalNumber(check.digits)) {
    return {
      valid: false,
      digits: null,
      reason: "This public demo only accepts the fictional range 555-0100 to 555-0199, for example (406) 555-0142.",
    };
  }
  return { ...check, formatted: formatPhone(check.digits) };
}

const PHONE_PATTERN = /(?:\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/;

/** Returns the first phone-shaped substring, valid or not. */
export function findPhoneInText(text: string): string | null {
  const match = text.match(PHONE_PATTERN);
  return match ? match[0].trim() : null;
}
