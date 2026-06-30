import { Component, inject, signal, computed, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { SearchBarComponent } from '../../../shared/components/search-bar/search-bar.component';
import { AuthService } from '../../../core/services/auth.service';
import { RbacService } from '../../../core/services/rbac.service';
import { PermissionService, PERMS } from '../../../core/services/permission.service';
import { TranslationService } from '../../../core/services/translation.service';
import { translateEntityTypeName } from '../../../core/utils/entity-type-i18n.util';
import { extractApiError, getApiResponseError } from '../../../core/utils/api-error.util';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { RbacEntity, RbacEntityType, PaginationMeta, EntityTypeResponseData } from '../../../shared/models/rbac.model';
import { TableQueryParams } from '../../../shared/models/table-query.model';
import { tableQueryFromLazyEvent, tableQuerySignature, isDuplicateTableFetch, trackEntityIdChange } from '../../../shared/utils/table-query.util';
import { BillingConfigDrawerComponent } from '../../../shared/components/billing-config-drawer/billing-config-drawer.component';
import { BillingCreditDialogComponent } from '../../../shared/components/billing-credit-dialog/billing-credit-dialog.component';
import { BillingGenerateDialogComponent } from '../../../shared/components/billing-generate-dialog/billing-generate-dialog.component';
import { RowAction, RowActionsComponent } from '../../../shared/components/row-actions/row-actions.component';

@Component({
  selector: 'app-entities-tab',
  standalone: true,
  imports: [
    FormsModule,
    TableModule,
    InputTextModule,
    SearchBarComponent,
    TranslatePipe,
    BillingConfigDrawerComponent,
    BillingCreditDialogComponent,
    BillingGenerateDialogComponent,
    RowActionsComponent,
  ],
  templateUrl: './entities-tab.component.html',
})
export class EntitiesTabComponent {
  readonly auth = inject(AuthService);
  private readonly rbac = inject(RbacService);
  private readonly i18n = inject(TranslationService);
  readonly perm = inject(PermissionService);
  readonly canCreate = this.perm.can(PERMS.ENTITY_CREATE);
  readonly canUpdate = this.perm.can(PERMS.ENTITY_UPDATE);
  readonly canAssignType = this.perm.can(PERMS.ENTITY_ENTITY_TYPES_MAP);
  readonly canEditBilling = this.perm.can(PERMS.BILLING_CONFIG_UPDATE);
  readonly canAddCredit = this.perm.can(PERMS.BILLING_AMOUNT_CREDIT);
  readonly canGenerateBill = this.perm.can(PERMS.BILLING_GENERATE);
  readonly menuLabel = computed(() => {
    this.i18n.lang();
    this.i18n.revision();
    const t = (key: string) => this.i18n.instant(key);
    return translateEntityTypeName(this.auth.menuName(), t) || t('layout.entityTypes.oem');
  });

  shortName(name?: string | null): string {
    if (!name) return '—';
    return name.split('(')[0].trim() || name;
  }

  /** Ignores out-of-order HTTP responses when filters/search/pagination change quickly. */
  private fetchGen = 0;
  /** True after the table has fired its first lazy-load (avoids duplicate init fetch). */
  private tableReady = false;
  private lastQuerySig = '';
  private prevEntityId: string | undefined;

  readonly entities = signal<RbacEntity[]>([]);
  readonly entityTypes = signal<RbacEntityType[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly showDialog = signal(false);
  readonly saving = signal(false);
  readonly dialogError = signal('');

  readonly showAssignDialog = signal(false);
  readonly assignLoading = signal(false);
  readonly savingAssign = signal(false);
  readonly assignDialogError = signal('');
  readonly assignEntity = signal<RbacEntity | null>(null);
  readonly assignTypeSearch = signal('');
  readonly selectedTypeIds = signal<Set<string>>(new Set());
  readonly previousTypeIds = signal<Set<string>>(new Set());

  readonly selectedTypeCount = computed(() => this.selectedTypeIds().size);

  readonly previousTypeNames = computed(() => {
    const ids = this.previousTypeIds();
    const types = this.entityTypes();
    return [...ids]
      .map((id) => types.find((t) => t.id === id)?.name)
      .filter((name): name is string => !!name);
  });

  readonly filteredEntityTypes = computed(() => {
    const q = this.assignTypeSearch().toLowerCase().trim();
    const list = this.entityTypes();
    if (!q) return list;
    return list.filter(
      (t) => t.name.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q),
    );
  });

  readonly filterTypeId = signal('');
  readonly searchTerm = signal('');
  readonly pagination = signal<PaginationMeta | null>(null);
  readonly tableQuery = signal<TableQueryParams>({ pageNumber: 1, pageSize: 10 });
  readonly tableFirst = signal(0);
  readonly totalRecords = computed(() => this.pagination()?.totalCount ?? 0);

  readonly createEntityTypeId = signal('');

  readonly billingEntity = signal<RbacEntity | null>(null);
  readonly creditEntity = signal<RbacEntity | null>(null);
  readonly generateEntity = signal<RbacEntity | null>(null);

  rowActions(e: RbacEntity): RowAction[] {
    const t = (key: string) => this.i18n.instant(key);
    return [
      {
        label: t('master.entities.assignType'),
        icon: 'category',
        disabled: !this.canAssignType(),
        onClick: () => this.openAssignDialog(e),
      },
      {
        label: t(e.isBillingEnabled ? 'master.entities.editBilling' : 'master.entities.enableBilling'),
        icon: 'receipt_long',
        iconColor: 'var(--color-primary)',
        dividerBefore: true,
        disabled: !this.canEditBilling(),
        onClick: () => this.openBillingDrawer(e),
      },
      {
        label: t('master.entities.addCredit'),
        icon: 'savings',
        iconColor: 'var(--color-success)',
        disabled: !this.canAddCredit() || !e.isBillingEnabled,
        onClick: () => this.openCreditDialog(e),
      },
      {
        label: t('master.entities.generateBill'),
        icon: 'play_circle',
        iconColor: 'var(--color-warning)',
        disabled: !this.canGenerateBill() || !e.isBillingEnabled,
        onClick: () => this.openGenerateDialog(e),
      },
    ];
  }

  openBillingDrawer(entity: RbacEntity): void {
    this.billingEntity.set(entity);
  }

  closeBillingDrawer(saved: boolean): void {
    this.billingEntity.set(null);
    if (saved) this.fetch();
  }

  openCreditDialog(entity: RbacEntity): void {
    this.creditEntity.set(entity);
  }

  closeCreditDialog(_saved: boolean): void {
    this.creditEntity.set(null);
  }

  openGenerateDialog(entity: RbacEntity): void {
    this.generateEntity.set(entity);
  }

  closeGenerateDialog(_saved: boolean): void {
    this.generateEntity.set(null);
  }

  name = '';
  description = '';
  parentEntityId = '';

  /** Ignores out-of-order entity type responses when entity context changes quickly. */
  private entityTypesGen = 0;

  constructor() {
    effect(() => {
      const eid = this.auth.entityId();
      const { changed, next } = trackEntityIdChange(this.prevEntityId, eid);
      this.prevEntityId = next;

      if (changed) {
        this.lastQuerySig = '';
        this.searchTerm.set('');
        this.filterTypeId.set('');
        this.tableFirst.set(0);
        this.tableQuery.set({ pageNumber: 1, pageSize: 10 });
        this.showAssignDialog.set(false);
        this.showDialog.set(false);
        if (this.tableReady) {
          this.fetch({ pageNumber: 1, pageSize: 10 });
        }
      }

      this.loadEntityTypes();
    });
  }

  onLazyLoad(event: TableLazyLoadEvent): void {
    this.tableReady = true;
    const query = tableQueryFromLazyEvent(event, { searchTerm: this.searchTerm() });
    this.tableQuery.set(query);
    this.tableFirst.set(event.first ?? 0);
    this.fetch(query);
  }

  onSearchChange(value: string): void {
    this.searchTerm.set(value);
    this.tableFirst.set(0);
    this.tableQuery.update((q) => ({ ...q, pageNumber: 1, searchTerm: value }));
    this.fetch({ ...this.tableQuery(), searchTerm: value });
  }

  onTypeFilterChange(typeId: string): void {
    this.filterTypeId.set(typeId);
    this.tableFirst.set(0);
    this.fetch({ ...this.tableQuery(), pageNumber: 1 });
  }

  fetch(query?: TableQueryParams): void {
    const q = { ...this.tableQuery(), searchTerm: this.searchTerm(), ...query };
    const typeId = this.filterTypeId() || undefined;
    const sig = tableQuerySignature(q, { typeId });
    if (isDuplicateTableFetch(sig, this.lastQuerySig, this.loading())) return;
    this.lastQuerySig = sig;
    const gen = ++this.fetchGen;
    this.loading.set(true);
    this.error.set('');
    this.rbac.getEntities(typeId, q).subscribe({
      next: (res) => {
        if (gen !== this.fetchGen) return;
        this.loading.set(false);
        this.entities.set(res.data ?? []);
        this.pagination.set(res.metadata?.pagination ?? null);
      },
      error: (err) => {
        if (gen !== this.fetchGen) return;
        this.loading.set(false);
        this.error.set(extractApiError(err, this.i18n.instant('master.errors.loadEntities')));
      },
    });
  }

  openAssignDialog(entity: RbacEntity): void {
    this.assignEntity.set(entity);
    this.assignTypeSearch.set('');
    this.assignDialogError.set('');
    this.previousTypeIds.set(new Set());
    this.selectedTypeIds.set(new Set());
    this.assignLoading.set(true);
    this.showAssignDialog.set(true);

    this.rbac.getEntityTypeOfEntity(entity.id).subscribe({
      next: (res) => {
        this.assignLoading.set(false);
        const msg = getApiResponseError(res, this.i18n.instant('master.errors.loadEntityTypes'));
        if (msg) {
          if (/no data found/i.test(msg)) return;
          this.assignDialogError.set(msg);
          return;
        }
        const data = res.data;
        if (!data) return;
        if (data.entity) {
          this.assignEntity.set({ ...entity, ...data.entity });
        }
        const assignedIds = this.assignedTypeIds(data);
        this.previousTypeIds.set(new Set(assignedIds));
        this.selectedTypeIds.set(new Set(assignedIds));
      },
      error: (err) => {
        this.assignLoading.set(false);
        const msg = extractApiError(err, this.i18n.instant('master.errors.loadEntityTypes'));
        if (/no data found/i.test(msg)) return;
        this.assignDialogError.set(msg);
      },
    });
  }

  toggleTypeId(id: string): void {
    const next = new Set(this.selectedTypeIds());
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this.selectedTypeIds.set(next);
  }

  isTypeSelected(id: string): boolean {
    return this.selectedTypeIds().has(id);
  }

  isPreviousType(id: string): boolean {
    return this.previousTypeIds().has(id);
  }

  assignType(): void {
    const entity = this.assignEntity();
    const typeIds = [...this.selectedTypeIds()];
    if (!entity || !typeIds.length) return;
    this.savingAssign.set(true);
    this.assignDialogError.set('');
    this.rbac.assignEntityTypeOnEntity(entity.id, typeIds).subscribe({
      next: (res) => {
        this.savingAssign.set(false);
        const msg = getApiResponseError(res, this.i18n.instant('master.errors.assignEntityType'));
        if (msg) {
          this.assignDialogError.set(msg);
          return;
        }
        this.showAssignDialog.set(false);
        this.fetch();
      },
      error: (err) => {
        this.savingAssign.set(false);
        this.assignDialogError.set(extractApiError(err, this.i18n.instant('master.errors.assignEntityType')));
      },
    });
  }

  openDialog(): void {
    this.name = this.description = '';
    this.createEntityTypeId.set(this.resolveCreateEntityTypeId());
    this.parentEntityId = this.auth.entityId() ?? '';
    this.dialogError.set('');
    this.showDialog.set(true);
  }

  create(): void {
    const entityTypeId = this.createEntityTypeId();
    if (!this.name || !entityTypeId) return;
    this.saving.set(true);
    this.dialogError.set('');
    this.rbac
      .createEntity({
        name: this.name,
        description: this.description,
        entityTypeId,
        parentEntityId: this.parentEntityId || undefined,
      })
      .subscribe({
        next: (res) => {
          this.saving.set(false);
          const msg = getApiResponseError(res, this.i18n.instant('master.errors.createEntity'));
          if (msg) {
            this.dialogError.set(msg);
            return;
          }
          this.showDialog.set(false);
          this.tableFirst.set(0);
          this.tableQuery.update((q) => ({ ...q, pageNumber: 1 }));
          this.auth.fetchEntities();
          this.fetch({ pageNumber: 1, pageSize: this.tableQuery().pageSize ?? 10 });
        },
        error: (err) => {
          this.saving.set(false);
          this.dialogError.set(extractApiError(err, this.i18n.instant('master.errors.createEntity')));
        },
      });
  }

  private assignedTypeIds(data: EntityTypeResponseData): string[] {
    const ids = new Set<string>();
    for (const type of data.entityTypes ?? []) {
      ids.add(type.id);
    }
    return [...ids];
  }

  private loadEntityTypes(): void {
    const gen = ++this.entityTypesGen;
    this.rbac.getEntityTypes({ pageSize: 200 }).subscribe({
      next: (res) => {
        if (gen !== this.entityTypesGen) return;
        const types = res.data ?? [];
        this.entityTypes.set(types);
        this.syncTypeFilter(types);
      },
      error: () => {
        if (gen !== this.entityTypesGen) return;
        this.entityTypes.set([]);
        this.syncTypeFilter([]);
      },
    });
  }

  private syncTypeFilter(types: RbacEntityType[]): void {
    const filterId = this.filterTypeId();
    if (filterId && !types.some((t) => t.id === filterId)) {
      this.filterTypeId.set('');
      if (this.tableReady) {
        this.fetch({ pageNumber: 1, pageSize: this.tableQuery().pageSize ?? 10 });
      }
    }
    if (this.showDialog()) {
      this.createEntityTypeId.set(this.resolveCreateEntityTypeId());
    }
  }

  private resolveCreateEntityTypeId(): string {
    const filterId = this.filterTypeId();
    const types = this.entityTypes();
    return filterId && types.some((t) => t.id === filterId) ? filterId : '';
  }
}
