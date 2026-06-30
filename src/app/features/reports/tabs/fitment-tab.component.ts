import { Component, computed, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { AuthService } from '../../../core/services/auth.service';
import { ReportsService } from '../../../core/services/reports.service';
import { TranslationService } from '../../../core/services/translation.service';
import { extractApiError } from '../../../core/utils/api-error.util';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import {
  FitmentDetailGroup,
  FitmentDetailRow,
  FitmentReport,
} from '../../../shared/models/reports.model';
import { PaginationMeta } from '../../../shared/models/rbac.model';
import { trackEntityIdChange } from '../../../shared/utils/table-query.util';

interface FitmentFlatRow {
  entityName: string;
  entityType: string;
  isFirstOfEntity: boolean;
  entityRowSpan: number;
  fitment: FitmentDetailRow;
}

function toIsoStart(date: string): string {
  return `${date}T00:00:00Z`;
}

function toIsoEnd(date: string): string {
  return `${date}T23:59:00Z`;
}

function todayIso(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function firstOfMonthIso(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${m}-01`;
}

@Component({
  selector: 'app-fitment-tab',
  standalone: true,
  imports: [DatePipe, FormsModule, TableModule, TranslatePipe],
  templateUrl: './fitment-tab.component.html',
  styleUrl: './fitment-tab.component.scss',
})
export class FitmentTabComponent {
  private readonly reports = inject(ReportsService);
  private readonly i18n = inject(TranslationService);
  private readonly auth = inject(AuthService);

  readonly fromDate = signal(firstOfMonthIso());
  readonly toDate = signal(todayIso());
  readonly maxDate = todayIso();

  readonly summary = signal<FitmentReport | null>(null);
  readonly groups = signal<FitmentDetailGroup[]>([]);
  readonly pagination = signal<PaginationMeta | null>(null);
  readonly pageNumber = signal(1);
  readonly pageSize = signal(10);
  readonly tableFirst = signal(0);

  readonly loadingSummary = signal(false);
  readonly loadingDetail = signal(false);
  readonly error = signal('');

  readonly totalRecords = computed(() => this.pagination()?.totalCount ?? 0);
  readonly totalFitments = computed(() => this.summary()?.totalFitments ?? 0);
  readonly entityCount = computed(() => this.groups().length);

  readonly rows = computed<FitmentFlatRow[]>(() => {
    const out: FitmentFlatRow[] = [];
    for (const g of this.groups()) {
      const list = g.fitments ?? [];
      const span = Math.max(list.length, 1);
      let first = true;
      for (const f of list) {
        out.push({
          entityName: g.entityName,
          entityType: g.entityType,
          isFirstOfEntity: first,
          entityRowSpan: span,
          fitment: f,
        });
        first = false;
      }
    }
    return out;
  });

  private fetchGen = 0;
  private prevEntityId: string | undefined;

  constructor() {
    this.fetchAll();
    effect(() => {
      const eid = this.auth.entityId();
      const { changed, next } = trackEntityIdChange(this.prevEntityId, eid);
      this.prevEntityId = next;
      if (!changed) return;
      this.pageNumber.set(1);
      this.tableFirst.set(0);
      this.fetchAll();
    });
  }

  apply(): void {
    this.pageNumber.set(1);
    this.tableFirst.set(0);
    this.fetchAll();
  }

  onLazyLoad(event: TableLazyLoadEvent): void {
    const size = event.rows ?? this.pageSize();
    const first = event.first ?? 0;
    const page = Math.floor(first / size) + 1;
    this.pageSize.set(size);
    this.pageNumber.set(page);
    this.tableFirst.set(first);
    this.fetchDetail();
  }

  private validateRange(): boolean {
    const from = this.fromDate();
    const to = this.toDate();
    if (!from || !to || from > to) {
      this.error.set(this.i18n.instant('reports.fitment.errors.invalidRange'));
      return false;
    }
    this.error.set('');
    return true;
  }

  private fetchAll(): void {
    if (!this.validateRange()) return;
    this.fetchSummary();
    this.fetchDetail();
  }

  private fetchSummary(): void {
    const from = toIsoStart(this.fromDate());
    const to = toIsoEnd(this.toDate());
    this.loadingSummary.set(true);
    this.reports.getFitments(from, to).subscribe({
      next: (res) => {
        this.loadingSummary.set(false);
        this.summary.set(res.data ?? null);
      },
      error: () => {
        this.loadingSummary.set(false);
        this.summary.set(null);
      },
    });
  }

  private fetchDetail(): void {
    if (!this.validateRange()) return;
    const from = toIsoStart(this.fromDate());
    const to = toIsoEnd(this.toDate());
    const gen = ++this.fetchGen;
    this.loadingDetail.set(true);
    this.reports.getFitmentsDetailed(from, to, this.pageNumber(), this.pageSize()).subscribe({
      next: (res) => {
        if (gen !== this.fetchGen) return;
        this.loadingDetail.set(false);
        this.groups.set(res.data ?? []);
        this.pagination.set(res.metadata?.pagination ?? null);
      },
      error: (err) => {
        if (gen !== this.fetchGen) return;
        this.loadingDetail.set(false);
        this.groups.set([]);
        this.pagination.set(null);
        this.error.set(extractApiError(err, this.i18n.instant('reports.fitment.errors.load')));
      },
    });
  }

  onFromChange(value: string): void {
    this.fromDate.set(value);
  }

  onToChange(value: string): void {
    this.toDate.set(value);
  }
}
