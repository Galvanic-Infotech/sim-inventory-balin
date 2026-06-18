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
