export interface PasswordChecks {
  length: boolean;
  upper: boolean;
  lower: boolean;
  digit: boolean;
  special: boolean;
  passed: number;
  strong: boolean;
}

const SPECIAL_CHAR_PATTERN = /[!@#$%^&*(),.?":{}|<>_\-+=/\\[\]~`';]/;
const SPECIAL_CHARS = '!@#$%^&*';
const UPPER_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER_CHARS = 'abcdefghijklmnopqrstuvwxyz';
const DIGIT_CHARS = '0123456789';
const ALL_CHARS = UPPER_CHARS + LOWER_CHARS + DIGIT_CHARS + SPECIAL_CHARS;
const DEFAULT_PASSWORD_LENGTH = 16;

export function getPasswordChecks(password: string): PasswordChecks {
  const length = password.length >= 8;
  const upper = /[A-Z]/.test(password);
  const lower = /[a-z]/.test(password);
  const digit = /\d/.test(password);
  const special = SPECIAL_CHAR_PATTERN.test(password);
  const passed = [length, upper, lower, digit, special].filter(Boolean).length;
  return { length, upper, lower, digit, special, passed, strong: passed === 5 };
}

export function getPasswordStrengthLabel(passed: number): string {
  if (passed <= 1) return 'Very Weak';
  if (passed === 2) return 'Weak';
  if (passed === 3) return 'Fair';
  if (passed === 4) return 'Good';
  return 'Strong';
}

export function isStrongPassword(password: string): boolean {
  return getPasswordChecks(password).strong;
}

export function generateStrongPassword(length = DEFAULT_PASSWORD_LENGTH): string {
  const size = Math.max(length, 8);
  const chars = [
    pick(UPPER_CHARS),
    pick(LOWER_CHARS),
    pick(DIGIT_CHARS),
    pick(SPECIAL_CHARS),
  ];
  while (chars.length < size) {
    chars.push(pick(ALL_CHARS));
  }
  return shuffle(chars).join('');
}

function pick(pool: string): string {
  return pool[Math.floor(Math.random() * pool.length)];
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
