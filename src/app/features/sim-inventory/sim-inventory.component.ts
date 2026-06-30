import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { SimService } from '../../core/services/sim.service';
import { AuthService } from '../../core/services/auth.service';
import { PermissionService, PERMS } from '../../core/services/permission.service';
import { extractApiError } from '../../core/utils/api-error.util';
import { TranslationService } from '../../core/services/translation.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { SearchBarComponent } from '../../shared/components/search-bar/search-bar.component';
import { PaginationMeta } from '../../shared/models/rbac.model';
import { TableQueryParams } from '../../shared/models/table-query.model';
import { tableQueryFromLazyEvent, tableQuerySignature, isDuplicateTableFetch, trackEntityIdChange } from '../../shared/utils/table-query.util';
import { itemStatusChipClass, itemStatusLabel } from '../../shared/models/item-status.model';
import {
  SIM_INVENTORY_STATUSES,
  SimInventoryItem,
  formatInventoryDate,
} from '../../shared/models/sim-inventory.model';
import { ActivateDialogComponent } from './activate-dialog.component';
import { RowAction, RowActionsComponent } from '../../shared/components/row-actions/row-actions.component';

@Component({
  selector: 'app-sim-inventory',
  standalone: true,
  imports: [
    FormsModule,
    TableModule,
    InputTextModule,
    SearchBarComponent,
    TranslatePipe,
    ActivateDialogComponent,
    RowActionsComponent,
  ],
  templateUrl: './sim-inventory.component.html',
  styleUrl: './sim-inventory.component.scss',
})
export class SimInventoryComponent {
  private readonly sim = inject(SimService);
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(TranslationService);
  readonly perm = inject(PermissionService);

  readonly canEditPerm = this.perm.canAny(PERMS.SIM_EDIT, PERMS.SIM_ACTIVATE);

  readonly statusOptions = SIM_INVENTORY_STATUSES;

  readonly items = signal<SimInventoryItem[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly pagination = signal<PaginationMeta | null>(null);
  readonly tableQuery = signal<TableQueryParams>({
    pageNumber: 1,
    pageSize: 10,
    status: 'All',
  });
  readonly tableFirst = signal(0);
  readonly searchTerm = signal('');
  readonly status = signal<string>('All');

  readonly totalRecords = computed(() => this.pagination()?.totalCount ?? 0);

  readonly selectedIds = signal<Set<string>>(new Set());
  private readonly selectedMap = new Map<string, SimInventoryItem>();
  readonly selectedCount = computed(() => this.selectedIds().size);
  readonly allOnPageSelected = computed(() => {
    const ids = this.selectedIds();
    const list = this.items();
    return list.length > 0 && list.every((it) => ids.has(it.itemId));
  });

  readonly editTargets = signal<SimInventoryItem[] | null>(null);

  private fetchGen = 0;
  private tableReady = false;
  private lastQuerySig = '';
  private prevEntityId: string | undefined;

  readonly statusLabel = itemStatusLabel;
  readonly statusChipClass = itemStatusChipClass;
  readonly fmtDate = formatInventoryDate;

  constructor() {
    effect(() => {
      const eid = this.auth.entityId();
      const { changed, next } = trackEntityIdChange(this.prevEntityId, eid);
      this.prevEntityId = next;
      if (!changed) return;

      this.lastQuerySig = '';
      this.searchTerm.set('');
      this.status.set('All');
      this.tableFirst.set(0);
      this.tableQuery.set({ pageNumber: 1, pageSize: 10, status: 'All' });
      this.clearSelection();
      // PrimeNG only re-emits onLazyLoad when [first] changes — if the user was
      // already on page 1, switching entity would not trigger a lazy load.
      if (this.tableReady) {
        this.fetch();
      }
    });
  }

  onLazyLoad(event: TableLazyLoadEvent): void {
    this.tableReady = true;
    const query = tableQueryFromLazyEvent(event, {
      searchTerm: this.searchTerm(),
      status: this.status(),
      sortBy: 'activationAt',
      sortOrder: 'desc',
    });
    this.tableQuery.set(query);
    this.tableFirst.set(event.first ?? 0);
    this.fetch(query);
  }

  onSearchChange(value: string): void {
    this.searchTerm.set(value);
    this.tableFirst.set(0);
    this.tableQuery.update((q) => ({ ...q, pageNumber: 1, searchTerm: value }));
    this.fetch();
  }

  onStatusChange(value: string): void {
    this.status.set(value);
    this.tableFirst.set(0);
    this.tableQuery.update((q) => ({ ...q, pageNumber: 1, status: value }));
    this.fetch();
  }

  fetch(query?: TableQueryParams): void {
    const q: TableQueryParams = {
      ...this.tableQuery(),
      searchTerm: this.searchTerm(),
      status: this.status(),
      ...query,
    };
    const sig = tableQuerySignature(q);
    if (isDuplicateTableFetch(sig, this.lastQuerySig, this.loading())) return;
    this.lastQuerySig = sig;
    const gen = ++this.fetchGen;
    this.loading.set(true);
    this.error.set('');
    this.sim.fetchSimInventory(q).subscribe({
      next: (res) => {
        if (gen !== this.fetchGen) return;
        this.loading.set(false);
        this.items.set(res.items);
        this.pagination.set(res.pagination);
      },
      error: (err) => {
        if (gen !== this.fetchGen) return;
        this.loading.set(false);
        this.items.set([]);
        this.pagination.set(null);
        this.error.set(extractApiError(err, this.i18n.instant('simInventory.errors.load')));
      },
    });
  }

  isSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  toggleSelected(item: SimInventoryItem): void {
    const next = new Set(this.selectedIds());
    if (next.has(item.itemId)) {
      next.delete(item.itemId);
      this.selectedMap.delete(item.itemId);
    } else {
      next.add(item.itemId);
      this.selectedMap.set(item.itemId, item);
    }
    this.selectedIds.set(next);
  }

  toggleSelectAllOnPage(): void {
    const next = new Set(this.selectedIds());
    const list = this.items();
    if (this.allOnPageSelected()) {
      for (const it of list) {
        next.delete(it.itemId);
        this.selectedMap.delete(it.itemId);
      }
    } else {
      for (const it of list) {
        next.add(it.itemId);
        this.selectedMap.set(it.itemId, it);
      }
    }
    this.selectedIds.set(next);
  }

  clearSelection(): void {
    this.selectedIds.set(new Set());
    this.selectedMap.clear();
  }

  openEditForRow(item: SimInventoryItem): void {
    this.editTargets.set([item]);
  }

  openEditForSelection(): void {
    const ids = Array.from(this.selectedIds());
    const targets = ids
      .map((id) => this.selectedMap.get(id))
      .filter((t): t is SimInventoryItem => !!t);
    if (targets.length === 0) return;
    this.editTargets.set(targets);
  }

  closeEdit(refresh: boolean): void {
    this.editTargets.set(null);
    if (refresh) {
      this.clearSelection();
      this.fetch();
    }
  }

  rowActions(item: SimInventoryItem): RowAction[] {
    return [
      {
        label: this.i18n.instant('simInventory.editLabel'),
        icon: 'edit',
        iconColor: 'var(--color-primary)',
        disabled: !this.canEditPerm(),
        onClick: () => this.openEditForRow(item),
      },
    ];
  }

  userFullName(item: SimInventoryItem): string {
    if (!item.user) return '—';
    const name = `${item.user.firstName} ${item.user.lastName}`.trim();
    return name || '—';
  }
}
