export type BillingTransactionType = 'Debit' | 'Credit' | string;

export interface BillingTransaction {
  id: string;
  entityId: string;
  date: string;
  transactionType: BillingTransactionType;
  totalActivatedSims: number;
  dailyRate: number;
  debitedAmount: number;
  taxRate: number;
  taxAmount: number;
  creditedAmount: number;
  notes: string | null;
  createdAt: string;
}

export function parseBillingTransaction(json: Record<string, unknown>): BillingTransaction {
  const num = (v: unknown): number => {
    if (v == null) return 0;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  return {
    id: String(json['id'] ?? ''),
    entityId: String(json['entityId'] ?? ''),
    date: String(json['date'] ?? ''),
    transactionType: String(json['transactionType'] ?? ''),
    totalActivatedSims: num(json['totalActivatedSims']),
    dailyRate: num(json['dailyRate']),
    debitedAmount: num(json['debitedAmount']),
    taxRate: num(json['taxRate']),
    taxAmount: num(json['taxAmount']),
    creditedAmount: num(json['creditedAmount']),
    notes: (json['notes'] as string) ?? null,
    createdAt: String(json['createdAt'] ?? ''),
  };
}

export function isCredit(t: BillingTransaction): boolean {
  return t.transactionType === 'Credit';
}

export function transactionNet(t: BillingTransaction): number {
  return isCredit(t)
    ? t.creditedAmount
    : t.debitedAmount + t.taxAmount;
}

export enum BillingProductType {
  Sim = 1,
  License = 2,
}

export const BILLING_PRODUCT_TYPES: BillingProductType[] = [
  BillingProductType.Sim,
  BillingProductType.License,
];

export function parseBillingProductType(value: unknown): BillingProductType {
  const n = Number(value);
  return n === BillingProductType.License ? BillingProductType.License : BillingProductType.Sim;
}

export function billingProductTypeLabelKey(type: BillingProductType): string {
  return type === BillingProductType.License
    ? 'billing.productType.license'
    : 'billing.productType.sim';
}

export function billingProductTypeIcon(type: BillingProductType): string {
  return type === BillingProductType.License ? 'verified_user' : 'sim_card';
}

export interface BillingConfig {
  id: string;
  entityId: string;
  productType: BillingProductType;
  yearlyAmount: number;
  yearInDays: number;
  dailyRate: number;
  taxRate: number;
  creditLimit: number;
  currentOutstanding: number;
  createdAt: string;
  updatedAt: string;
}

export function parseBillingConfig(json: Record<string, unknown>): BillingConfig {
  const num = (v: unknown): number => {
    if (v == null) return 0;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const productType = parseBillingProductType(json['productType']);
  return {
    id: String(json['id'] ?? ''),
    entityId: String(json['entityId'] ?? ''),
    productType,
    yearlyAmount: num(json['yearlyAmount']),
    yearInDays: num(json['yearInDays']),
    dailyRate: num(json['dailyRate']),
    taxRate: num(json['taxRate']),
    creditLimit: num(json['creditLimit']),
    currentOutstanding: num(json['currentOutstanding']),
    createdAt: String(json['createdAt'] ?? ''),
    updatedAt: String(json['updatedAt'] ?? ''),
  };
}

export function parseBillingConfigs(data: unknown): BillingConfig[] {
  if (Array.isArray(data)) {
    return data.map((item) => parseBillingConfig(item as Record<string, unknown>));
  }
  if (data && typeof data === 'object') {
    return [parseBillingConfig(data as Record<string, unknown>)];
  }
  return [];
}

export function findBillingConfig(
  configs: BillingConfig[],
  productType: BillingProductType,
): BillingConfig | null {
  return configs.find((c) => c.productType === productType) ?? null;
}

export function availableCredit(c: BillingConfig): number {
  return c.creditLimit - c.currentOutstanding;
}

export function creditUtilisationPct(c: BillingConfig): number {
  if (c.creditLimit <= 0) return 0;
  return Math.max(0, Math.min(100, (c.currentOutstanding / c.creditLimit) * 100));
}

