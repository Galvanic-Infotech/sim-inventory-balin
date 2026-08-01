import {
  BULK_JOB_STATUS_META,
  jobTypeIcon,
  jobTypeLabel,
} from '../../shared/models/bulk-upload-job.model';

const STATUS_KEYS: Record<string, string> = {
  Pending: 'jobs.statuses.pending',
  Processing: 'jobs.statuses.processing',
  Completed: 'jobs.statuses.completed',
  Failed: 'jobs.statuses.failed',
};

const TYPE_KEYS: Record<string, string> = {
  BulkDeviceUpload: 'jobs.types.bulkDeviceUpload',
  ActivateSim: 'jobs.types.activateSim',
  RechargeSim: 'jobs.types.rechargeSim',
};

export function translateJobStatusLabel(
  status: string,
  translate: (key: string) => string,
): string {
  const key = STATUS_KEYS[status];
  if (!key) return BULK_JOB_STATUS_META[status]?.label ?? status;
  const translated = translate(key);
  return translated !== key ? translated : (BULK_JOB_STATUS_META[status]?.label ?? status);
}

export function translatedJobStatusInfo(
  status: string,
  translate: (key: string) => string,
): { label: string; color: string; icon: string } {
  const base = BULK_JOB_STATUS_META[status] ?? {
    label: status || '—',
    color: 'var(--color-text-muted)',
    icon: 'help_outline',
  };
  return { ...base, label: translateJobStatusLabel(status, translate) };
}

export function translateJobTypeLabel(
  type: string,
  translate: (key: string) => string,
): string {
  const key = TYPE_KEYS[type];
  if (!key) return jobTypeLabel(type);
  const translated = translate(key);
  return translated !== key ? translated : jobTypeLabel(type);
}

export function translatedJobTypeIcon(type: string): string {
  return jobTypeIcon(type);
}
