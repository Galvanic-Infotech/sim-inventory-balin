import { UploadJobError, UploadJobResult, UploadJobState } from './device.model';

export const JOB_STATUSES = ['Pending', 'Processing', 'Completed', 'Failed'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const JOB_TYPES = ['BulkDeviceUpload', 'ActivateSim', 'RechargeSim'] as const;
export type JobType = (typeof JOB_TYPES)[number];

export type BulkJobType = JobType | string;

export interface BulkUploadJob {
  id: string;
  entityId: string;
  jobType: BulkJobType;
  status: UploadJobState;
  result: string | null;
  errorMessage: string | null;
  attributes: { fileUrl?: string | null; [k: string]: unknown } | null;
  hangfireJobId: string | null;
  createdAt: string;
  createdBy: string | null;
  completedAt: string | null;
  entity: unknown;
  createdByUser: unknown;
}

export interface BulkUploadJobListFilters {
  status?: string;
  jobType?: BulkJobType;
}

export interface ParsedJobResult {
  totalRows: number;
  successfulRows: number;
  skippedRows: number;
  failedRows: number;
  errors: UploadJobError[];
}

export const JOB_TYPE_META: Record<string, { label: string; icon: string }> = {
  BulkDeviceUpload: { label: 'Device Upload', icon: 'upload_file' },
  ActivateSim: { label: 'Activate SIM', icon: 'sim_card' },
  RechargeSim: { label: 'Recharge SIM', icon: 'payments' },
};

export function jobTypeLabel(type: string): string {
  return JOB_TYPE_META[type]?.label ?? type;
}

export function jobTypeIcon(type: string): string {
  return JOB_TYPE_META[type]?.icon ?? 'work';
}

export const BULK_JOB_STATUS_META: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  Pending: { label: 'Pending', color: 'var(--color-text-muted)', icon: 'hourglass_empty' },
  Processing: { label: 'Processing', color: 'var(--color-primary)', icon: 'sync' },
  Completed: { label: 'Completed', color: 'var(--color-success)', icon: 'check_circle' },
  Failed: { label: 'Failed', color: 'var(--color-danger)', icon: 'error' },
};

export function parseJobResult(raw: string | null | undefined): ParsedJobResult | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    return {
      totalRows: obj.TotalRows ?? obj.totalRows ?? 0,
      successfulRows: obj.SuccessfulRows ?? obj.successfulRows ?? 0,
      skippedRows: obj.SkippedRows ?? obj.skippedRows ?? 0,
      failedRows: obj.FailedRows ?? obj.failedRows ?? 0,
      errors: (obj.Errors ?? obj.errors ?? []).map(
        (e: {
          RowNumber?: number;
          rowNumber?: number;
          Message?: string;
          message?: string;
        }) => ({
          rowNumber: e.RowNumber ?? e.rowNumber,
          message: e.Message ?? e.message,
        }),
      ),
    };
  } catch {
    return null;
  }
}

export type { UploadJobResult };
