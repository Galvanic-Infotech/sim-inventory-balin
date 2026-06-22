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

export interface BillingChartDay {
  date: string;
  debited: number;
  credited: number;
  net: number;
}

function billingDateIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Aggregate transactions into the last N calendar days (oldest → newest). */
export function buildBillingChartDays(
  transactions: BillingTransaction[],
  dayCount = 7,
  endDate: Date = new Date(),
): BillingChartDay[] {
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  const days: BillingChartDay[] = [];
  for (let i = dayCount - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    days.push({ date: billingDateIso(d), debited: 0, credited: 0, net: 0 });
  }

  const byDate = new Map(days.map((day) => [day.date, day]));
  for (const t of transactions) {
    const day = byDate.get(t.date);
    if (!day) continue;
    if (isCredit(t)) {
      day.credited += t.creditedAmount;
    } else {
      day.debited += t.debitedAmount + t.taxAmount;
    }
  }

  for (const day of days) {
    day.net = day.credited - day.debited;
  }

  return days;
}

export interface BillingChartPoint extends BillingChartDay {
  x: number;
  y: number;
  amount: number;
}

export interface BillingChartGeometry {
  points: BillingChartPoint[];
  linePath: string;
  areaPath: string;
  max: number;
  baselineY: number;
}

function smoothLinePath(points: Pick<BillingChartPoint, 'x' | 'y'>[]): string {
  if (!points.length) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cpx = (p0.x + p1.x) / 2;
    d += ` C ${cpx} ${p0.y}, ${cpx} ${p1.y}, ${p1.x} ${p1.y}`;
  }
  return d;
}

/** Map chart days to SVG coordinates (oldest → newest, left → right). */
export function buildBillingChartGeometry(
  days: BillingChartDay[],
  width = 100,
  height = 100,
  padding = { top: 10, right: 6, bottom: 4, left: 6 },
): BillingChartGeometry {
  const amounts = days.map((d) => Math.abs(d.net));
  const max = Math.max(...amounts, 1);
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const baselineY = padding.top + innerH;
  const count = days.length;

  const points: BillingChartPoint[] = days.map((day, i) => {
    const amount = Math.abs(day.net);
    const x =
      count <= 1 ? padding.left + innerW / 2 : padding.left + (i / (count - 1)) * innerW;
    const y = baselineY - (amount / max) * innerH;
    return { ...day, x, y, amount };
  });

  const linePath = smoothLinePath(points);
  const areaPath = points.length
    ? `${linePath} L ${points[points.length - 1].x} ${baselineY} L ${points[0].x} ${baselineY} Z`
    : '';

  return { points, linePath, areaPath, max, baselineY };
}

