import { RbacResponse } from './rbac.model';
import {
  ItemStatus,
  normalizeItemStatus,
  itemStatusLabel,
  isItemInitial,
  isItemActive,
  isItemTempDisconnected,
} from './item-status.model';

export type { ItemStatus } from './item-status.model';
export {
  ITEM_STATUS,
  ITEM_STATUSES,
  ITEM_STATUS_META,
  normalizeItemStatus,
  itemStatusLabel,
  itemStatusMeta,
  itemStatusChipClass,
  isItemInitial,
  isItemActive,
  isItemTempDisconnected,
} from './item-status.model';

export type SimFilterType = 'SIM_NO' | 'MSISDN';

export type SmsWhitelistType =
  | 'INCOMING'
  | 'OUTGOING'
  | 'INCOMINGANDOUTGOING'
  | null;

export interface BasketDetails {
  totalSim: number;
  totalActiveSims: number;
  totalAvailableSims: number;
  totalSafeCustodySims: number;
  totalInActiveSims: number;
  totalInProgressSims: number;
  totalSuspendedSims: number;
  tempDisconnected: number;
}

export interface SimDetail {
  id: string;
  serialNumber: string;
  status: ItemStatus | string;
  onboardedAt: string | null;
  activationAt: string | null;
  iccid: string;
  simPhone: string;
}

export interface SmsWhitelistEntry {
  number: string | null;
  type: string | null;
}

export interface SmsWhitelisting {
  msisdn: string | null;
  simNo: string | null;
  basketName: string | null;
  remainingOrderCount: string | null;
  entries: SmsWhitelistEntry[];
}

export interface SmsWhitelistPatch {
  msisdn: string;
  whitelistNumber1: string | null;
  whitelistNumber2: string | null;
  whitelistNumber3: string | null;
  whitelistNumber4: string | null;
  whitelistNumberType1: string | null;
  whitelistNumberType2: string | null;
  whitelistNumberType3: string | null;
  whitelistNumberType4: string | null;
}

export interface StatItem {
  label: string;
  value: number;
  icon: string;
  color: string;
}

export interface ChartSegment {
  label: string;
  value: number;
  color: string;
}

export type SimResponse<T> = RbacResponse<T>;

export function parseBasketDetails(json: Record<string, unknown>): BasketDetails {
  return {
    totalSim: Number(json['totalSim'] ?? 0),
    totalActiveSims: Number(json['totalActiveSims'] ?? 0),
    totalAvailableSims: Number(json['totalAvailableSims'] ?? 0),
    totalSafeCustodySims: Number(json['totalSafeCustodySims'] ?? 0),
    totalInActiveSims: Number(json['totalInActiveSims'] ?? 0),
    totalInProgressSims: Number(json['totalInProgressSims'] ?? 0),
    totalSuspendedSims: Number(json['totalSuspendedSims'] ?? 0),
    tempDisconnected: Number(json['tempDisconnected'] ?? 0),
  };
}

export function parseSimDetail(json: Record<string, unknown>): SimDetail {
  const item = (json['item'] as Record<string, unknown>) ?? {};
  return {
    id: String(item['id'] ?? ''),
    serialNumber: String(item['serialNumber'] ?? ''),
    status: normalizeItemStatus(String(item['status'] ?? '')),
    onboardedAt: item['onboardedAt'] ? String(item['onboardedAt']) : null,
    activationAt: item['activationAt'] ? String(item['activationAt']) : null,
    iccid: String(json['iccid'] ?? ''),
    simPhone: String(json['simPhone'] ?? ''),
  };
}

export function parseSmsWhitelisting(json: Record<string, unknown>): SmsWhitelisting {
  const entries: SmsWhitelistEntry[] = [];
  for (let i = 1; i <= 4; i++) {
    entries.push({
      number: (json[`whitelistNumber${i}`] as string) ?? null,
      type: (json[`whitelistType${i}`] as string) ?? null,
    });
  }
  return {
    msisdn: (json['msisdn'] as string) ?? null,
    simNo: (json['simNo'] as string) ?? null,
    basketName: (json['basketName'] as string) ?? null,
    remainingOrderCount: (json['remainingOrderCount'] as string) ?? null,
    entries,
  };
}

export function emptySmsWhitelisting(): SmsWhitelisting {
  return {
    msisdn: null,
    simNo: null,
    basketName: null,
    remainingOrderCount: null,
    entries: Array.from({ length: 4 }, () => ({ number: null, type: null })),
  };
}

export function resolveSimFilterType(value: string): SimFilterType | null {
  const v = value.trim();
  if (v.startsWith('899')) return 'SIM_NO';
  if (v.startsWith('57')) return 'MSISDN';
  return null;
}

/** @deprecated Use {@link itemStatusLabel} */
export const simStatusLabel = itemStatusLabel;

/** @deprecated Use {@link normalizeItemStatus} */
export const normalizeSimStatus = normalizeItemStatus;

export function isSimInitial(sim: SimDetail): boolean {
  return isItemInitial(sim.status);
}

export function isSimActive(sim: SimDetail): boolean {
  return isItemActive(sim.status);
}

export function isSimTempDisconnected(sim: SimDetail): boolean {
  return isItemTempDisconnected(sim.status);
}

export function statSubtitle(value: number, total: number): string {
  if (total <= 0) return '—';
  if (value === total) return 'All SIMs in inventory';
  const pct = (value / total) * 100;
  const formatted = pct === 100 ? '100' : pct.toFixed(2);
  return `${formatted}% of total`;
}

export function formatIstDateTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Kolkata',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
