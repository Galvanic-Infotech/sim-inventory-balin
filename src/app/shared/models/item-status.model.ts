/**
 * Canonical item (device / SIM) lifecycle statuses from the API.
 * Update this file when backend status values change.
 */
export const ITEM_STATUS = {
  Initial: 'Initial',
  Available: 'Available',
  Fitted: 'Fitted',
  Expired: 'Expired',
  AboutExpired: 'AboutExpired',
  Activated: 'Activated',
  InProgress: 'InProgress',
  Active: 'Active',
  TempDisconnect: 'TempDisconnect',
} as const;

export type ItemStatus = (typeof ITEM_STATUS)[keyof typeof ITEM_STATUS];

/** Display / filter order for device inventory UI */
export const ITEM_STATUSES: readonly ItemStatus[] = [
  ITEM_STATUS.Initial,
  ITEM_STATUS.Available,
  ITEM_STATUS.Fitted,
  ITEM_STATUS.Expired,
  ITEM_STATUS.AboutExpired,
  ITEM_STATUS.Activated,
  ITEM_STATUS.InProgress,
  ITEM_STATUS.Active,
  ITEM_STATUS.TempDisconnect,
];

/** Status filter chips on device list & inventory chart (excludes Initial, TempDisconnect). */
export const DEVICE_FILTER_STATUSES: readonly ItemStatus[] = [
  ITEM_STATUS.Available,
  ITEM_STATUS.Fitted,
  ITEM_STATUS.Expired,
  ITEM_STATUS.AboutExpired,
  ITEM_STATUS.Activated,
  ITEM_STATUS.InProgress,
  ITEM_STATUS.Active,
];

const ITEM_STATUS_SET = new Set<string>(ITEM_STATUSES);

export interface ItemStatusMeta {
  label: string;
  color: string;
  icon: string;
  chipClass: string;
}

export const ITEM_STATUS_META: Record<ItemStatus, ItemStatusMeta> = {
  Initial: {
    label: 'Initial',
    color: '#6366f1',
    icon: 'fiber_new',
    chipClass: 'chip chip--primary',
  },
  Available: {
    label: 'Available',
    color: '#10b981',
    icon: 'inventory_2',
    chipClass: 'chip chip--success',
  },
  Fitted: {
    label: 'Fitted',
    color: '#3b82f6',
    icon: 'memory',
    chipClass: 'chip',
  },
  Expired: {
    label: 'Expired',
    color: '#ef4444',
    icon: 'event_busy',
    chipClass: 'chip chip--danger',
  },
  AboutExpired: {
    label: 'About to Expire',
    color: '#f59e0b',
    icon: 'schedule',
    chipClass: 'chip chip--warning',
  },
  Activated: {
    label: 'Activated',
    color: '#06b6d4',
    icon: 'check_circle',
    chipClass: 'chip chip--success',
  },
  InProgress: {
    label: 'In Progress',
    color: '#8b5cf6',
    icon: 'sync',
    chipClass: 'chip',
  },
  Active: {
    label: 'Active',
    color: '#14b8a6',
    icon: 'bolt',
    chipClass: 'chip chip--success',
  },
  TempDisconnect: {
    label: 'Temp Disconnected',
    color: '#78909c',
    icon: 'link_off',
    chipClass: 'chip chip--warning',
  },
};

/** Comma-separated status query for device recharge (all except Available and InProgress). */
export const RECHARGE_BY_STATUS_PARAM = ITEM_STATUSES.filter(
  (s) => s !== ITEM_STATUS.Available && s !== ITEM_STATUS.InProgress,
).join(',');

function screamingSnakeToPascal(status: string): string {
  return status
    .trim()
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');
}

/** Maps API variants ("Initial", "TEMP_DISCONNECT", "IN_PROGRESS") to canonical PascalCase. */
export function normalizeItemStatus(status: string): ItemStatus | string {
  const trimmed = status.trim();
  if (!trimmed) return '';

  if (ITEM_STATUS_SET.has(trimmed)) {
    return trimmed as ItemStatus;
  }

  const pascal = trimmed.includes('_') || trimmed === trimmed.toUpperCase()
    ? screamingSnakeToPascal(trimmed)
    : trimmed.charAt(0).toUpperCase() + trimmed.slice(1);

  if (ITEM_STATUS_SET.has(pascal)) {
    return pascal as ItemStatus;
  }

  const compact = trimmed.toLowerCase().replace(/[\s_-]/g, '');
  const match = ITEM_STATUSES.find(
    (s) => s.toLowerCase() === compact,
  );
  return match ?? pascal;
}

export function isItemStatus(status: string, expected: ItemStatus): boolean {
  return normalizeItemStatus(status) === expected;
}

export function itemStatusLabel(status: string): string {
  const normalized = normalizeItemStatus(status);
  const meta = ITEM_STATUS_META[normalized as ItemStatus];
  if (meta) return meta.label;
  return typeof normalized === 'string' ? normalized.replaceAll('_', ' ') : String(status);
}

export function itemStatusMeta(status: string): ItemStatusMeta {
  const normalized = normalizeItemStatus(status);
  return (
    ITEM_STATUS_META[normalized as ItemStatus] ?? {
      label: itemStatusLabel(status),
      color: '#94a3b8',
      icon: 'help_outline',
      chipClass: 'chip',
    }
  );
}

export function itemStatusChipClass(status: string): string {
  return itemStatusMeta(status).chipClass;
}

export function isItemInitial(status: string): boolean {
  return isItemStatus(status, ITEM_STATUS.Initial);
}

export function isItemActive(status: string): boolean {
  const s = normalizeItemStatus(status);
  return s === ITEM_STATUS.Active || s === ITEM_STATUS.Activated;
}

export function isItemTempDisconnected(status: string): boolean {
  return isItemStatus(status, ITEM_STATUS.TempDisconnect);
}
