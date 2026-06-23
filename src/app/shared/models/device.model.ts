import {
  ITEM_STATUS,
  ITEM_STATUSES,
  DEVICE_FILTER_STATUSES,
  ITEM_STATUS_META,
  ItemStatus,
  RECHARGE_BY_STATUS_PARAM,
} from './item-status.model';

/** @deprecated Use {@link ItemStatus} — kept for existing device feature imports */
export type AisDeviceStatus = ItemStatus;

/** @deprecated Use {@link ITEM_STATUSES} */
export const AIS_DEVICE_STATUSES: AisDeviceStatus[] = [...ITEM_STATUSES];

/** Status chips shown on device list / inventory filters */
export const AIS_DEVICE_FILTER_STATUSES: AisDeviceStatus[] = [...DEVICE_FILTER_STATUSES];

export interface AisDeviceRef {
  id: string;
  name: string;
}

export interface AisDevice {
  itemId: string;
  serialNumber: string;
  imei: string;
  iccid: string;
  primarySimPhone: string | null;
  primarySimValidity: string | null;
  secondarySimPhone: string | null;
  secondarySimValidity: string | null;
  status: AisDeviceStatus;
  entityId: string;
  entityName: string;
  onboardedAt: string;
  deviceModel?: AisDeviceRef | null;
  simProvider?: AisDeviceRef | null;
}

export interface AisDeviceStatusCount {
  status: AisDeviceStatus;
  count: number;
}

export interface AisEntityDeviceCount {
  entityId: string;
  entityName: string;
  totalCount: number;
  statusCounts: AisDeviceStatusCount[];
}

export interface AisDeviceListFilters {
  status?: AisDeviceStatus;
  entityId?: string;
}

export interface DailyInstallation {
  date: string;
  count: number;
}

export interface EntityInstallationGraph {
  entityId: string;
  entityName: string;
  totalCount: number;
  dailyInstallations: DailyInstallation[];
}

export type UploadJobState = 'Pending' | 'Processing' | 'Completed' | 'Failed' | string;

export interface UploadJobError {
  rowNumber?: number;
  message?: string;
  [k: string]: unknown;
}

export interface UploadJobResult {
  totalRows: number;
  successfulRows: number;
  skippedRows: number;
  failedRows: number;
  errors: UploadJobError[];
}

export interface UploadJobStatus {
  id: string;
  jobType: string;
  status: UploadJobState;
  createdAt: string;
  completedAt: string | null;
  errorMessage: string | null;
  result: UploadJobResult | null;
}

export interface UploadJobHandle {
  id: string;
  statusUrl: string;
}

export interface MoveDevicesRequest {
  isReturn: boolean;
  toEntityId?: string;
  itemIds: string[];
  remarks?: string;
}

export type DeviceSimOperation = 'Activate' | 'Recharge';

export interface DeviceActivateRequest {
  operation: DeviceSimOperation;
  itemIds: string[];
  simProviderId?: string;
}

export { RECHARGE_BY_STATUS_PARAM, ITEM_STATUS };

export type MovementDirection = 'in' | 'out';

export interface MovementLogItem {
  logId: string;
  itemId: string;
  serialNumber: string;
  direction: MovementDirection;
  fromEntityId: string;
  fromEntityName: string;
  toEntityId: string;
  toEntityName: string;
  remarks: string | null;
  createdAt: string;
}

export interface MovementDayGroup {
  date: string;
  movedIn: number;
  movedOut: number;
  items: MovementLogItem[];
}

export interface MovementChartDay {
  date: string;
  movedIn: number;
  movedOut: number;
  total: number;
}

function normalizeMovementDate(date: string): string {
  return date.slice(0, 10);
}

/** Map API day groups to chart points (dates as returned, oldest → newest). */
export function movementGroupsToChartDays(groups: MovementDayGroup[]): MovementChartDay[] {
  return [...groups]
    .map((g) => ({
      date: normalizeMovementDate(g.date),
      movedIn: g.movedIn,
      movedOut: g.movedOut,
      total: g.movedIn + g.movedOut,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface MovementChartPoint extends MovementChartDay {
  x: number;
  y: number;
  amount: number;
}

export interface MovementChartGeometry {
  points: MovementChartPoint[];
  linePath: string;
  areaPath: string;
  max: number;
  baselineY: number;
}

function smoothMovementLinePath(points: Pick<MovementChartPoint, 'x' | 'y'>[]): string {
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
export function buildMovementChartGeometry(
  days: MovementChartDay[],
  width = 100,
  height = 100,
  padding = { top: 10, right: 6, bottom: 4, left: 6 },
): MovementChartGeometry {
  const amounts = days.map((d) => d.total);
  const max = Math.max(...amounts, 1);
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const baselineY = padding.top + innerH;
  const count = days.length;

  const points: MovementChartPoint[] = days.map((day, i) => {
    const amount = day.total;
    const x =
      count <= 1 ? padding.left + innerW / 2 : padding.left + (i / (count - 1)) * innerW;
    const y = baselineY - (amount / max) * innerH;
    return { ...day, x, y, amount };
  });

  const linePath = smoothMovementLinePath(points);
  const areaPath = points.length
    ? `${linePath} L ${points[points.length - 1].x} ${baselineY} L ${points[0].x} ${baselineY} Z`
    : '';

  return { points, linePath, areaPath, max, baselineY };
}

export interface DeviceByStatus {
  itemId: string;
  uid: string;
  imei: string;
  iccid: string;
  status: AisDeviceStatus;
  deviceModel?: AisDeviceRef | null;
  simProvider?: AisDeviceRef | null;
}

/** @deprecated Use {@link ITEM_STATUS_META} */
export const DEVICE_STATUS_META: Record<
  AisDeviceStatus,
  { label: string; color: string; icon: string }
> = Object.fromEntries(
  ITEM_STATUSES.map((s) => {
    const { label, color, icon } = ITEM_STATUS_META[s];
    return [s, { label, color, icon }];
  }),
) as Record<AisDeviceStatus, { label: string; color: string; icon: string }>;
