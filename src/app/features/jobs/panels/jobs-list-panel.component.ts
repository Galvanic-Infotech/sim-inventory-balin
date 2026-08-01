import { Component, OnDestroy, OnInit, computed, effect, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { AuthService } from '../../../core/services/auth.service';
import { JobService } from '../../../core/services/job.service';
import { SearchBarComponent } from '../../../shared/components/search-bar/search-bar.component';
import { extractApiError } from '../../../core/utils/api-error.util';
import {
  BulkUploadJob,
  JOB_STATUSES,
  ParsedJobResult,
  parseJobResult,
} from '../../../shared/models/bulk-upload-job.model';
import { PaginationMeta } from '../../../shared/models/rbac.model';
import { TableQueryParams } from '../../../shared/models/table-query.model';
import {
  isDuplicateTableFetch,
  tableQueryFromLazyEvent,
  tableQuerySignature,
  trackEntityIdChange,
} from '../../../shared/utils/table-query.util';
import { TranslationService } from '../../../core/services/translation.service';
import {
  translatedJobStatusInfo,
  translatedJobTypeIcon,
  translateJobTypeLabel,
} from '../../../core/utils/job-i18n.util';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

const ACTIVE_STATUSES = new Set<string>(['Pending', 'Processing']);
const ACTIVE_POLL_INTERVAL_MS = 4000;
const IDLE_POLL_INTERVAL_MS = 10000;

type StatusFilter = (typeof JOB_STATUSES)[number] | '';

interface StatusStat {
  status: StatusFilter;
  label: string;
  icon: string;
  color: string;
  count: number;
}

@Component({
  selector: 'app-jobs-list-panel',
  standalone: true,
  imports: [FormsModule, TableModule, InputTextModule, DatePipe, SearchBarComponent, TranslatePipe],
  templateUrl: './jobs-list-panel.component.html',
  styleUrl: './jobs-list-panel.component.scss',
})
export class JobsListPanelComponent implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly jobs = inject(JobService);
  private readonly i18n = inject(TranslationService);

  private readonly isVisible = signal(
    typeof document === 'undefined' ? true : document.visibilityState === 'visible',
  );

  /** When set, only jobs of this type are loaded (e.g. BulkDeviceUpload). */
  readonly jobTypeFilter = input<string>('');

  readonly rows = signal<BulkUploadJob[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');

  readonly pagination = signal<PaginationMeta | null>(null);
  readonly tableQuery = signal<TableQueryParams>({ pageNumber: 1, pageSize: 10 });
  readonly tableFirst = signal(0);
  readonly searchTerm = signal('');
  readonly statusFilter = signal<StatusFilter>('');
  readonly totalRecords = computed(() => this.pagination()?.totalCount ?? 0);

  readonly selectedJob = signal<BulkUploadJob | null>(null);
  readonly selectedResult = computed<ParsedJobResult | null>(() => {
    const job = this.selectedJob();
    return job ? parseJobResult(job.result) : null;
  });

  readonly activeCount = computed(
    () => this.rows().filter((j) => ACTIVE_STATUSES.has(j.status)).length,
  );

  readonly statusStats = computed<StatusStat[]>(() => {
    this.i18n.lang();
    this.i18n.revision();
    const t = (key: string) => this.i18n.instant(key);
    const list = this.rows();
    const counts: Record<string, number> = {};
    for (const j of list) counts[j.status] = (counts[j.status] ?? 0) + 1;
    return JOB_STATUSES.map((s) => {
      const info = translatedJobStatusInfo(s, t);
      return {
        status: s,
        label: info.label,
        icon: info.icon,
        color: info.color,
        count: counts[s] ?? 0,
      };
    });
  });

  private pollTimer?: ReturnType<typeof setTimeout>;
  private fetchGen = 0;
  private tableReady = false;
  private lastQuerySig = '';
  private prevEntityId: string | undefined;
  private prevJobTypeFilter: string | undefined;

  constructor() {
    effect(() => {
      const eid = this.auth.entityId();
      const jobType = this.jobTypeFilter();
      const { changed: entityChanged, next } = trackEntityIdChange(this.prevEntityId, eid);
      this.prevEntityId = next;

      const typeChanged =
        this.prevJobTypeFilter !== undefined && this.prevJobTypeFilter !== jobType;
      this.prevJobTypeFilter = jobType;

      if (!entityChanged && !typeChanged) return;

      this.lastQuerySig = '';
      this.searchTerm.set('');
      this.statusFilter.set('');
      this.selectedJob.set(null);
      this.rows.set([]);
      this.pagination.set(null);
      this.tableFirst.set(0);
      this.tableQuery.set({ pageNumber: 1, pageSize: 10 });
      // PrimeNG only re-emits onLazyLoad when [first] changes — if already on
      // page 1, entity switch would not trigger a lazy load without this fetch.
      if (this.tableReady) {
        this.fetch();
      }
    });

    effect(() => {
      if (!this.isVisible()) {
        this.stopPolling();
        return;
      }
      const hasActive = this.activeCount() > 0;
      this.schedulePoll(hasActive ? ACTIVE_POLL_INTERVAL_MS : IDLE_POLL_INTERVAL_MS);
    });
  }

  private readonly onVisibilityChange = () => {
    const visible = document.visibilityState === 'visible';
    this.isVisible.set(visible);
    if (visible) this.fetch(undefined, { silent: true });
  };

  ngOnInit(): void {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onVisibilityChange);
    }
  }

  ngOnDestroy(): void {
    this.stopPolling();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
    }
  }

  onLazyLoad(event: TableLazyLoadEvent): void {
    this.tableReady = true;
    const query = tableQueryFromLazyEvent(event, {
      searchTerm: this.searchTerm(),
      sortBy: this.tableQuery().sortBy,
      sortOrder: this.tableQuery().sortOrder,
    });
    this.tableQuery.set(query);
    this.tableFirst.set(event.first ?? 0);
    this.fetch(query);
  }

  onSearchChange(value: string): void {
    this.searchTerm.set(value);
    this.lastQuerySig = '';
    this.tableFirst.set(0);
    this.tableQuery.update((q) => ({ ...q, pageNumber: 1, searchTerm: value }));
    this.fetch();
  }

  selectStatus(status: StatusFilter): void {
    if (this.statusFilter() === status) return;
    this.statusFilter.set(status);
    this.lastQuerySig = '';
    this.tableFirst.set(0);
    this.tableQuery.update((q) => ({ ...q, pageNumber: 1 }));
    this.fetch();
  }

  statusInfo(status: string) {
    return translatedJobStatusInfo(status, (key) => this.i18n.instant(key));
  }

  jobTypeLabel(type: string): string {
    return translateJobTypeLabel(type, (key) => this.i18n.instant(key));
  }

  jobTypeIcon(type: string): string {
    return translatedJobTypeIcon(type);
  }

  isActive(status: string): boolean {
    return ACTIVE_STATUSES.has(status);
  }

  jobResult(job: BulkUploadJob): ParsedJobResult | null {
    return parseJobResult(job.result);
  }

  fileName(url: string | null | undefined): string {
    if (!url) return '';
    const clean = url.split('?')[0];
    const parts = clean.split('/');
    return decodeURIComponent(parts[parts.length - 1] || url);
  }

  download(job: BulkUploadJob, event?: Event): void {
    event?.stopPropagation();
    const url = job.attributes?.fileUrl;
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = this.fileName(url);
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  openDetails(job: BulkUploadJob): void {
    this.selectedJob.set(job);
  }

  closeDetails(): void {
    this.selectedJob.set(null);
  }

  refresh(): void {
    this.lastQuerySig = '';
    this.fetch();
  }

  fetch(query?: TableQueryParams, opts: { silent?: boolean } = {}): void {
    const q = { ...this.tableQuery(), searchTerm: this.searchTerm(), ...query };
    const status = this.statusFilter();
    const jobType = this.jobTypeFilter();
    const sig = tableQuerySignature(q, {
      status: status || undefined,
      jobType: jobType || undefined,
    });
    if (!opts.silent && isDuplicateTableFetch(sig, this.lastQuerySig, this.loading())) return;
    this.lastQuerySig = sig;
    const gen = ++this.fetchGen;
    if (!opts.silent) this.loading.set(true);
    this.error.set('');
    this.jobs
      .getJobs(q, {
        ...(status ? { status } : {}),
        ...(jobType ? { jobType } : {}),
      })
      .subscribe({
        next: (res) => {
          if (gen !== this.fetchGen) return;
          this.loading.set(false);
          this.rows.set(res.data ?? []);
          this.pagination.set(res.metadata?.pagination ?? null);
        },
        error: (err) => {
          if (gen !== this.fetchGen) return;
          this.loading.set(false);
          if (!opts.silent) {
            this.error.set(extractApiError(err, this.i18n.instant('jobs.errors.loadJobs')));
          }
        },
      });
  }

  private schedulePoll(intervalMs: number): void {
    this.stopPolling();
    this.pollTimer = setTimeout(() => {
      this.pollTimer = undefined;
      this.fetch(undefined, { silent: true });
    }, intervalMs);
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = undefined;
    }
  }
}
