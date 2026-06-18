export interface SimInventoryUser {
  id: string | null;
  firstName: string;
  lastName: string;
  email: string;
  mobileNumber: string;
}

export interface SimInventoryItem {
  itemId: string;
  iccid: string;
  status: string;
  onBoardedAt: string | null;
  activationAt: string | null;
  user: SimInventoryUser | null;
  mobileNo: string;
  customerName: string;
  iotId: string;
  remarks: string;
  validTill: string | null;
}

export const SIM_INVENTORY_STATUSES = [
  'All',
  'Active',
  'Initial',
  'Available',
  'Fitted',
  'InProgress',
  'AboutExpired',
  'Expired',
  'TempDisconnect',
] as const;

export type SimInventoryStatus = (typeof SIM_INVENTORY_STATUSES)[number];

export const SIM_INVENTORY_ACTIVATABLE: ReadonlySet<string> = new Set([
  'Initial',
  'Available',
]);

export interface SimInventoryActivateResult {
  success: string[];
  failed: string[];
  errors: Record<string, string>;
}

export function parseSimInventoryItem(json: Record<string, unknown>): SimInventoryItem {
  const userRaw = json['user'] as Record<string, unknown> | null | undefined;
  return {
    itemId: String(json['itemId'] ?? ''),
    iccid: String(json['iccid'] ?? ''),
    status: String(json['status'] ?? ''),
    onBoardedAt: (json['onBoardedAt'] as string) ?? null,
    activationAt: (json['activationAt'] as string) ?? null,
    user: userRaw
      ? {
          id: (userRaw['id'] as string) ?? null,
          firstName: String(userRaw['firstName'] ?? ''),
          lastName: String(userRaw['lastName'] ?? ''),
          email: String(userRaw['email'] ?? ''),
          mobileNumber: String(userRaw['mobileNumber'] ?? ''),
        }
      : null,
    mobileNo: String(json['mobileNo'] ?? ''),
    customerName: String(json['customerName'] ?? ''),
    iotId: String(json['iotId'] ?? ''),
    remarks: String(json['remarks'] ?? ''),
    validTill: (json['validTill'] as string) ?? null,
  };
}

export function canActivateSim(status: string): boolean {
  return SIM_INVENTORY_ACTIVATABLE.has(status);
}

export function formatValidTill(d: Date): string {
  const y = String(d.getFullYear()).padStart(4, '0');
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatInventoryDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return formatValidTill(d);
}
