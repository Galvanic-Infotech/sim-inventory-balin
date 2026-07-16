import { Component, inject, signal, effect, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { AuthService } from '../../../core/services/auth.service';
import { RbacService } from '../../../core/services/rbac.service';
import { PermissionService, PERMS } from '../../../core/services/permission.service';
import { extractApiError, getApiResponseError } from '../../../core/utils/api-error.util';
import {
  SimCardProvider,
  VehicleCategory,
  RbacEntityType,
  State,
  District,
  Rto,
  TestingAgency,
  DocumentType,
  RbacPermission,
  PermissionGroup,
  PaginationMeta,
} from '../../../shared/models/rbac.model';
import { TableQueryParams } from '../../../shared/models/table-query.model';
import { tableQueryFromLazyEvent, tableQuerySignature, isDuplicateTableFetch, trackEntityIdChange } from '../../../shared/utils/table-query.util';
import { SearchBarComponent } from '../../../shared/components/search-bar/search-bar.component';
import { TranslationService } from '../../../core/services/translation.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { RowAction, RowActionsComponent } from '../../../shared/components/row-actions/row-actions.component';

type Section =
  | 'simProviders'
  | 'vehicleCategories'
  | 'testingAgencies'
  | 'documentTypes'
  | 'entityTypes'
  | 'states'
  | 'districts'
  | 'rtos';
type DrawerMode = 'create' | 'edit';

interface SectionMeta {
  key: Section;
  labelKey: string;
  icon: string;
}

@Component({
  selector: 'app-master-data-tab',
  standalone: true,
  imports: [FormsModule, TableModule, InputTextModule, SearchBarComponent, TranslatePipe, RowActionsComponent],
  templateUrl: './master-data-tab.component.html',
  styleUrl: './master-data-tab.component.scss',
})
export class MasterDataTabComponent {
  private readonly auth = inject(AuthService);
  private readonly rbac = inject(RbacService);
  private readonly i18n = inject(TranslationService);
  readonly perm = inject(PermissionService);
  readonly canCreateEntityType = this.perm.can(PERMS.ENTITY_TYPE_CREATE);
  readonly canAssignEtPerms = this.perm.can(PERMS.ENTITY_TYPE_PERMISSIONS_MAP);

  private readonly sectionDefs: SectionMeta[] = [
    { key: 'simProviders', labelKey: 'master.masterData.sections.simProviders', icon: 'sim_card' },
    { key: 'vehicleCategories', labelKey: 'master.masterData.sections.vehicleCategories', icon: 'directions_car' },
    { key: 'testingAgencies', labelKey: 'master.masterData.sections.testingAgencies', icon: 'fact_check' },
    { key: 'documentTypes', labelKey: 'master.masterData.sections.documentTypes', icon: 'description' },
    { key: 'entityTypes', labelKey: 'master.masterData.sections.entityTypes', icon: 'account_tree' },
    { key: 'states', labelKey: 'master.masterData.sections.states', icon: 'map' },
    { key: 'districts', labelKey: 'master.masterData.sections.districts', icon: 'location_city' },
    { key: 'rtos', labelKey: 'master.masterData.sections.rtos', icon: 'local_shipping' },
  ];

  readonly sections = computed(() => {
    this.i18n.lang();
    this.i18n.revision();
    return this.sectionDefs;
  });

  readonly activeSectionLabel = computed(() => {
    this.i18n.lang();
    this.i18n.revision();
    const sec = this.sectionDefs.find((s) => s.key === this.activeSection());
    return sec ? this.i18n.instant(sec.labelKey) : '';
  });

  readonly activeSection = signal<Section>('simProviders');
  readonly loading = signal(false);
  readonly error = signal('');
  readonly showDialog = signal(false);
  readonly saving = signal(false);
  readonly dialogError = signal('');
  readonly permDialogError = signal('');
  readonly sidebarCollapsed = signal(false);

  readonly simProviders = signal<SimCardProvider[]>([]);
  readonly vehicleCategories = signal<VehicleCategory[]>([]);
  readonly testingAgencies = signal<TestingAgency[]>([]);
  readonly documentTypes = signal<DocumentType[]>([]);
  readonly drawerMode = signal<DrawerMode>('create');
  readonly editingItemId = signal<string | null>(null);
  readonly entityTypes = signal<RbacEntityType[]>([]);
  readonly filterStates = signal<State[]>([]);
  readonly tableStates = signal<State[]>([]);
  readonly districts = signal<District[]>([]);
  readonly rtos = signal<Rto[]>([]);

  readonly showPermDialog = signal(false);
  readonly permDialogEntityType = signal<RbacEntityType | null>(null);
  readonly etPermissions = signal<RbacPermission[]>([]);
  readonly permissionGroups = signal<PermissionGroup[]>([]);
  readonly expandedGroups = signal<Set<string>>(new Set());
  readonly selectedPermIds = signal<Set<string>>(new Set());
  readonly permLoading = signal(false);

  readonly filterStateId = signal('');
  readonly filterDistrictId = signal('');
  readonly filterDistricts = signal<District[]>([]);

  readonly pagination = signal<PaginationMeta | null>(null);
  readonly tableQuery = signal<TableQueryParams>({ pageNumber: 1, pageSize: 10 });
  readonly tableFirst = signal(0);
  readonly searchTerm = signal('');

  // ponytail: sections whose backend returns full list — filter+paginate in browser
  private static readonly CLIENT_SECTIONS: ReadonlySet<Section> = new Set<Section>([
    'testingAgencies', 'documentTypes', 'entityTypes', 'states', 'districts', 'rtos',
  ]);
  private static readonly FETCH_ALL: TableQueryParams = { pageNumber: 1, pageSize: 1000 };

  private isClientSection(s: Section = this.activeSection()): boolean {
    return MasterDataTabComponent.CLIENT_SECTIONS.has(s);
  }

  private filterList<T>(list: T[], fields: (keyof T)[]): T[] {
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) return list;
    return list.filter((item) =>
      fields.some((f) => String((item as Record<string, unknown>)[f as string] ?? '').toLowerCase().includes(term)),
    );
  }

  readonly filteredTestingAgencies = computed(() =>
    this.filterList(this.testingAgencies(), ['testingAgencyId', 'testingAgencyName']),
  );
  readonly filteredDocumentTypes = computed(() => this.filterList(this.documentTypes(), ['name']));
  readonly filteredEntityTypes = computed(() => this.filterList(this.entityTypes(), ['name', 'description']));
  readonly filteredStates = computed(() => this.filterList(this.tableStates(), ['stateCode', 'stateName']));
  readonly filteredDistricts = computed(() => this.filterList(this.districts(), ['districtCode', 'districtName']));
  readonly filteredRtos = computed(() => this.filterList(this.rtos(), ['rtoCode', 'rtoName']));

  readonly sectionDataLength = computed(() => {
    switch (this.activeSection()) {
      case 'simProviders':
        return this.simProviders().length;
      case 'vehicleCategories':
        return this.vehicleCategories().length;
      case 'testingAgencies':
        return this.filteredTestingAgencies().length;
      case 'documentTypes':
        return this.filteredDocumentTypes().length;
      case 'entityTypes':
        return this.filteredEntityTypes().length;
      case 'states':
        return this.filteredStates().length;
      case 'districts':
        return this.filteredDistricts().length;
      case 'rtos':
        return this.filteredRtos().length;
    }
  });

  /** API pagination totalCount can be 0/missing for some endpoints (e.g. entity types). */
  readonly totalRecords = computed(
    () => this.pagination()?.totalCount || this.sectionDataLength(),
  );

  /** Ignores out-of-order HTTP responses when filters/search/pagination change quickly. */
  private fetchGen = 0;
  /** True after the table has fired its first lazy-load (avoids duplicate init fetch). */
  private tableReady = false;
  private lastQuerySig = '';
  private prevEntityId: string | undefined;

  createName = '';
  createCode = '';
  createStateName = '';
  createStateCode = '';
  createDistrictName = '';
  createDistrictCode = '';
  createRtoName = '';
  createRtoCode = '';
  createStateId = '';
  createDistrictId = '';
  createDescription = '';
  createTestingAgencyId = '';
  createTestingAgencyName = '';
  createIsRequired = false;

  constructor() {
    this.rbac.getStates({ pageSize: 500 }).subscribe({
      next: (r) => {
        this.filterStates.set(r.data ?? []);
        const sec = this.activeSection();
        if (sec === 'districts' || sec === 'rtos') {
          this.ensureLocationFilters(sec);
        }
      },
    });
    effect(() => {
      const eid = this.auth.entityId();
      const { changed, next } = trackEntityIdChange(this.prevEntityId, eid);
      this.prevEntityId = next;
      if (!changed) return;

      this.lastQuerySig = '';
      this.searchTerm.set('');
      this.tableFirst.set(0);
      this.tableQuery.set({ pageNumber: 1, pageSize: 10 });
      this.showPermDialog.set(false);
      if (this.tableReady) {
        this.fetchSection(this.activeSection(), { pageNumber: 1, pageSize: 10 });
      }
    });
  }

  selectSection(s: Section): void {
    this.activeSection.set(s);
    this.searchTerm.set('');
    this.tableFirst.set(0);
    this.tableQuery.set({ pageNumber: 1, pageSize: 10 });
    if (s === 'districts' || s === 'rtos') {
      this.ensureLocationFilters(s);
    } else {
      this.fetchSection(s, { pageNumber: 1, pageSize: 10 });
    }
  }

  onLazyLoad(event: TableLazyLoadEvent): void {
    this.tableReady = true;
    const query = tableQueryFromLazyEvent(event, { searchTerm: this.searchTerm() });
    this.tableQuery.set(query);
    this.tableFirst.set(event.first ?? 0);
    this.fetchSection(this.activeSection(), query);
  }

  onSearchChange(value: string): void {
    this.searchTerm.set(value);
    this.tableFirst.set(0);
    // Client-side sections: filter is a computed signal, no refetch needed.
    if (this.isClientSection()) {
      this.tableQuery.update((q) => ({ ...q, pageNumber: 1, searchTerm: undefined }));
      return;
    }
    this.tableQuery.update((q) => ({ ...q, pageNumber: 1, searchTerm: value }));
    this.fetchSection(this.activeSection(), { ...this.tableQuery(), searchTerm: value });
  }

  fetchSection(s?: Section, query?: TableQueryParams): void {
    const sec = s ?? this.activeSection();
    const q = this.isClientSection(sec)
      ? { ...MasterDataTabComponent.FETCH_ALL }
      : { ...this.tableQuery(), searchTerm: this.searchTerm(), ...query };

    if (sec === 'districts' || sec === 'rtos') {
      if (!this.filterStateId() || (sec === 'rtos' && !this.filterDistrictId())) {
        this.ensureLocationFilters(sec);
        return;
      }
    }

    const sig = tableQuerySignature(q, {
      section: sec,
      stateId: this.filterStateId(),
      districtId: this.filterDistrictId(),
    });
    if (isDuplicateTableFetch(sig, this.lastQuerySig, this.loading())) return;
    this.lastQuerySig = sig;

    this.loading.set(true);
    this.error.set('');

    const gen = ++this.fetchGen;

    const onSuccess = (data: unknown[], pag?: PaginationMeta | null) => {
      if (gen !== this.fetchGen) return;
      this.loading.set(false);
      // Client-side sections drive totalRecords from filtered length, not server meta.
      this.pagination.set(this.isClientSection(sec) ? null : pag ?? null);
      switch (sec) {
        case 'simProviders': this.simProviders.set(data as SimCardProvider[]); break;
        case 'vehicleCategories': this.vehicleCategories.set(data as VehicleCategory[]); break;
        case 'testingAgencies': this.testingAgencies.set(data as TestingAgency[]); break;
        case 'documentTypes': this.documentTypes.set(data as DocumentType[]); break;
        case 'entityTypes': this.entityTypes.set(data as RbacEntityType[]); break;
        case 'states': this.tableStates.set(data as State[]); break;
        case 'districts': this.districts.set(data as District[]); break;
        case 'rtos': this.rtos.set(data as Rto[]); break;
      }
    };

    const onError = (err: unknown) => {
      if (gen !== this.fetchGen) return;
      this.handleError(err);
    };

    switch (sec) {
      case 'simProviders':
        this.rbac.getSimCardProviders(q).subscribe({
          next: (r) => onSuccess(r.data ?? [], r.metadata?.pagination),
          error: onError,
        });
        break;
      case 'vehicleCategories':
        this.rbac.getVehicleCategories(q).subscribe({
          next: (r) => onSuccess(r.data ?? [], r.metadata?.pagination),
          error: onError,
        });
        break;
      case 'testingAgencies':
        this.rbac.getTestingAgencies().subscribe({
          next: (r) => onSuccess(r.data ?? [], null),
          error: onError,
        });
        break;
      case 'documentTypes':
        this.rbac.getDocumentTypes().subscribe({
          next: (r) => onSuccess(r.data ?? [], null),
          error: onError,
        });
        break;
      case 'entityTypes':
        this.rbac.getEntityTypes(q).subscribe({
          next: (r) => onSuccess(r.data ?? [], r.metadata?.pagination),
          error: onError,
        });
        break;
      case 'states':
        this.rbac.getStates(q).subscribe({
          next: (r) => onSuccess(r.data ?? [], r.metadata?.pagination),
          error: onError,
        });
        break;
      case 'districts': {
        const sid = this.filterStateId();
        if (!sid) { this.districts.set([]); this.loading.set(false); return; }
        this.rbac.getDistricts(sid, q).subscribe({
          next: (r) => onSuccess(r.data ?? [], r.metadata?.pagination),
          error: onError,
        });
        break;
      }
      case 'rtos': {
        const sid = this.filterStateId();
        const did = this.filterDistrictId();
        if (!sid || !did) { this.rtos.set([]); this.loading.set(false); return; }
        this.rbac.getRtos(sid, did, q).subscribe({
          next: (r) => onSuccess(r.data ?? [], r.metadata?.pagination),
          error: onError,
        });
        break;
      }
    }
  }

  onStateFilterChange(stateId: string): void {
    this.filterStateId.set(stateId);
    this.filterDistrictId.set('');
    this.filterDistricts.set([]);
    this.tableFirst.set(0);
    if (!stateId) {
      this.fetchSection();
      return;
    }
    this.loadFilterDistricts(stateId, this.activeSection() === 'rtos', () => this.fetchSection());
  }

  onDistrictFilterChange(districtId: string): void {
    this.filterDistrictId.set(districtId);
    this.tableFirst.set(0);
    this.fetchSection();
  }

  openDialog(): void {
    this.drawerMode.set('create');
    this.editingItemId.set(null);
    this.resetForm();
    this.dialogError.set('');
    const sec = this.activeSection();

    if (sec === 'districts') {
      this.createStateId = this.filterStateId();
    }

    if (sec === 'rtos') {
      this.createStateId = this.filterStateId();
      this.createDistrictId = this.filterDistrictId();
      if (this.createStateId && !this.filterDistricts().length) {
        this.loadCreateDistricts(this.createStateId, this.createDistrictId || undefined);
      }
    }

    this.showDialog.set(true);
  }

  private editAction<T>(labelKey: string, onClick: (item: T) => void) {
    return (item: T): RowAction[] => [
      {
        label: this.i18n.instant(labelKey),
        icon: 'edit',
        iconColor: 'var(--color-primary)',
        onClick: () => onClick(item),
      },
    ];
  }

  readonly providerActions = this.editAction<SimCardProvider>(
    'master.masterData.edit.simProvider',
    (p) => this.openEditProvider(p),
  );
  readonly vehicleCategoryActions = this.editAction<VehicleCategory>(
    'master.masterData.edit.vehicleCategory',
    (c) => this.openEditVehicleCategory(c),
  );
  readonly testingAgencyActions = this.editAction<TestingAgency>(
    'master.masterData.edit.testingAgency',
    (a) => this.openEditTestingAgency(a),
  );
  readonly documentTypeActions = this.editAction<DocumentType>(
    'master.masterData.edit.documentType',
    (d) => this.openEditDocumentType(d),
  );

  entityTypeActions(et: RbacEntityType): RowAction[] {
    if (!this.canAssignEtPerms()) return [];
    return [
      {
        label: this.i18n.instant('master.masterData.editPerms'),
        icon: 'edit',
        iconColor: 'var(--color-primary)',
        onClick: () => this.openAssignEtPerms(et),
      },
    ];
  }

  openEditProvider(provider: SimCardProvider): void {
    this.openEditItem(provider.id, provider.name, provider.description);
  }

  openEditVehicleCategory(category: VehicleCategory): void {
    this.openEditItem(category.id, category.name, category.description);
  }

  openEditTestingAgency(agency: TestingAgency): void {
    this.drawerMode.set('edit');
    this.editingItemId.set(agency.id);
    this.createTestingAgencyId = agency.testingAgencyId;
    this.createTestingAgencyName = agency.testingAgencyName;
    this.dialogError.set('');
    this.showDialog.set(true);
  }

  openEditItem(id: string, name: string, description?: string): void {
    this.drawerMode.set('edit');
    this.editingItemId.set(id);
    this.createName = name;
    this.createDescription = description ?? '';
    this.dialogError.set('');
    this.showDialog.set(true);
  }

  openEditDocumentType(doc: DocumentType): void {
    this.drawerMode.set('edit');
    this.editingItemId.set(doc.id);
    this.createName = doc.name;
    this.createIsRequired = !!doc.isRequired;
    this.dialogError.set('');
    this.showDialog.set(true);
  }

  drawerTitle(): string {
    const sec = this.activeSection();
    if (this.drawerMode() === 'edit') {
      const editKeys: Partial<Record<Section, string>> = {
        simProviders: 'master.masterData.edit.simProvider',
        vehicleCategories: 'master.masterData.edit.vehicleCategory',
        testingAgencies: 'master.masterData.edit.testingAgency',
        documentTypes: 'master.masterData.edit.documentType',
      };
      const key = editKeys[sec];
      if (key) return this.i18n.instant(key);
    }
    return this.i18n.instant('master.masterData.createSection', { section: this.activeSectionLabel() });
  }

  drawerSubmitLabel(): string {
    const sec = this.activeSection();
    if (
      this.drawerMode() === 'edit'
      && (sec === 'simProviders' || sec === 'vehicleCategories' || sec === 'testingAgencies' || sec === 'documentTypes')
    ) {
      return this.i18n.instant('master.common.save');
    }
    return this.i18n.instant('master.common.create');
  }

  emptyMessage(): string {
    return this.i18n.instant(`master.masterData.empty.${this.activeSection()}`);
  }

  statusLabel(isActive: boolean | undefined): string {
    return isActive === false
      ? this.i18n.instant('oem.common.inactive')
      : this.i18n.instant('devices.status.Active');
  }

  onCreateStateChange(stateId: string): void {
    this.createStateId = stateId;
    this.createDistrictId = '';
    if (stateId) {
      this.loadCreateDistricts(stateId);
    } else {
      this.filterDistricts.set([]);
    }
  }

  createItem(): void {
    this.dialogError.set('');
    const sec = this.activeSection();
    const onResult = {
      next: (res: { success?: boolean; message?: string }) => {
        this.saving.set(false);
        const msg = getApiResponseError(res, this.i18n.instant('master.errors.save'));
        if (msg) {
          this.dialogError.set(msg);
          return;
        }
        this.onCreated();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.dialogError.set(extractApiError(err, this.i18n.instant('master.errors.save')));
      },
    };

    switch (sec) {
      case 'simProviders':
      case 'vehicleCategories':
        if (!this.createName) return;
        break;
      case 'testingAgencies':
        if (!this.createTestingAgencyId || !this.createTestingAgencyName) return;
        break;
      case 'documentTypes':
        if (!this.createName) return;
        break;
      case 'entityTypes':
        if (!this.createName) return;
        break;
      case 'states':
        if (!this.createStateCode || !this.createStateName) return;
        break;
      case 'districts':
        if (!this.createStateId || !this.createDistrictCode || !this.createDistrictName) return;
        break;
      case 'rtos':
        if (!this.createStateId || !this.createDistrictId || !this.createRtoCode || !this.createRtoName) return;
        break;
      default:
        return;
    }

    this.saving.set(true);
    switch (sec) {
      case 'simProviders': {
        const body = { name: this.createName, description: this.createDescription };
        const editId = this.editingItemId();
        const req =
          this.drawerMode() === 'edit' && editId
            ? this.rbac.updateSimCardProvider(editId, body)
            : this.rbac.createSimCardProvider(body);
        req.subscribe(onResult);
        break;
      }
      case 'vehicleCategories': {
        const body = { name: this.createName, description: this.createDescription };
        const editId = this.editingItemId();
        const req =
          this.drawerMode() === 'edit' && editId
            ? this.rbac.updateVehicleCategory(editId, body)
            : this.rbac.createVehicleCategory(body);
        req.subscribe(onResult);
        break;
      }
      case 'testingAgencies': {
        const body = { testingAgencyId: this.createTestingAgencyId, testingAgencyName: this.createTestingAgencyName };
        const editId = this.editingItemId();
        const req =
          this.drawerMode() === 'edit' && editId
            ? this.rbac.updateTestingAgency(editId, body)
            : this.rbac.createTestingAgency(body);
        req.subscribe(onResult);
        break;
      }
      case 'documentTypes': {
        const body = { name: this.createName, isRequired: this.createIsRequired };
        const editId = this.editingItemId();
        const req =
          this.drawerMode() === 'edit' && editId
            ? this.rbac.updateDocumentType(editId, body)
            : this.rbac.createDocumentType(body);
        req.subscribe(onResult);
        break;
      }
      case 'entityTypes':
        this.rbac.createEntityType({ name: this.createName, description: this.createDescription }).subscribe(onResult);
        break;
      case 'states':
        this.rbac.createState(this.createStateCode, this.createStateName).subscribe(onResult);
        break;
      case 'districts':
        this.rbac.createDistrict(this.createStateId, this.createDistrictCode, this.createDistrictName).subscribe(onResult);
        break;
      case 'rtos':
        this.rbac.createRto(this.createStateId, this.createDistrictId, this.createRtoCode, this.createRtoName).subscribe(onResult);
        break;
    }
  }

  openAssignEtPerms(et: RbacEntityType): void {
    this.permDialogEntityType.set(et);
    this.permLoading.set(true);
    this.permDialogError.set('');
    this.showPermDialog.set(true);
    this.rbac.getPermissionGroups().subscribe({
      next: (groups) => {
        this.permissionGroups.set(groups);
        this.expandedGroups.set(new Set(groups.map((g) => g.id)));
      },
      error: (err) => {
        this.permLoading.set(false);
        this.permDialogError.set(extractApiError(err, this.i18n.instant('master.errors.loadPermGroups')));
      },
    });
    this.rbac.getEntityTypePermissions(et.id).subscribe({
      next: (perms) => {
        this.etPermissions.set(perms);
        this.selectedPermIds.set(new Set(perms.map((p) => p.id)));
        this.permLoading.set(false);
      },
      error: (err) => {
        this.permLoading.set(false);
        this.permDialogError.set(extractApiError(err, this.i18n.instant('master.errors.loadPermissions')));
      },
    });
  }

  togglePerm(id: string): void {
    const s = new Set(this.selectedPermIds());
    s.has(id) ? s.delete(id) : s.add(id);
    this.selectedPermIds.set(s);
  }

  toggleGroup(groupId: string): void {
    const s = new Set(this.expandedGroups());
    s.has(groupId) ? s.delete(groupId) : s.add(groupId);
    this.expandedGroups.set(s);
  }

  toggleGroupAll(group: PermissionGroup): void {
    const s = new Set(this.selectedPermIds());
    const allSelected = group.permissions.every((p) => s.has(p.id));
    group.permissions.forEach((p) => allSelected ? s.delete(p.id) : s.add(p.id));
    this.selectedPermIds.set(s);
  }

  isGroupAllSelected(group: PermissionGroup): boolean {
    return group.permissions.length > 0 && group.permissions.every((p) => this.selectedPermIds().has(p.id));
  }

  isGroupPartial(group: PermissionGroup): boolean {
    const sel = this.selectedPermIds();
    const some = group.permissions.some((p) => sel.has(p.id));
    const all = group.permissions.every((p) => sel.has(p.id));
    return some && !all;
  }

  saveEtPermissions(): void {
    const et = this.permDialogEntityType();
    if (!et) return;
    this.saving.set(true);
    this.permDialogError.set('');
    this.rbac.assignEntityTypePermissions(et.id, [...this.selectedPermIds()]).subscribe({
      next: (res) => {
        this.saving.set(false);
        const msg = getApiResponseError(res, this.i18n.instant('master.errors.assignPerms'));
        if (msg) {
          this.permDialogError.set(msg);
          return;
        }
        this.showPermDialog.set(false);
        this.fetchSection('entityTypes');
      },
      error: (err) => {
        this.saving.set(false);
        this.permDialogError.set(extractApiError(err, this.i18n.instant('master.errors.assignPerms')));
      },
    });
  }

  private onCreated(): void {
    this.saving.set(false);
    this.showDialog.set(false);
    this.fetchSection();
  }

  private handleError(err: unknown): void {
    this.loading.set(false);
    this.error.set(extractApiError(err, this.i18n.instant('master.errors.loadData')));
  }

  private ensureLocationFilters(section: Section): void {
    const stateList = this.filterStates();
    if (!stateList.length) {
      this.loading.set(true);
      this.rbac.getStates({ pageSize: 500 }).subscribe({
        next: (r) => {
          this.filterStates.set(r.data ?? []);
          this.applyDefaultLocationFilters(section);
        },
        error: (e) => this.handleError(e),
      });
      return;
    }
    this.applyDefaultLocationFilters(section);
  }

  private applyDefaultLocationFilters(section: Section): void {
    const stateList = this.filterStates();
    if (!stateList.length) {
      this.loading.set(false);
      this.fetchSection(section);
      return;
    }

    if (!this.filterStateId()) {
      this.filterStateId.set(stateList[0].id);
      this.filterDistrictId.set('');
      this.loadFilterDistricts(stateList[0].id, section === 'rtos', () => this.fetchSection(section));
      return;
    }

    if (section === 'rtos' && !this.filterDistrictId()) {
      const districts = this.filterDistricts();
      if (districts.length) {
        this.filterDistrictId.set(districts[0].id);
        this.fetchSection(section);
        return;
      }
      this.loadFilterDistricts(this.filterStateId(), true, () => this.fetchSection(section));
      return;
    }

    this.fetchSection(section);
  }

  private loadFilterDistricts(
    stateId: string,
    autoSelectFirst: boolean,
    onComplete?: () => void,
  ): void {
    this.rbac.getDistricts(stateId, { pageSize: 500 }).subscribe({
      next: (r) => {
        const districts = r.data ?? [];
        this.filterDistricts.set(districts);
        if (autoSelectFirst && districts.length) {
          this.filterDistrictId.set(districts[0].id);
        }
        onComplete?.();
      },
      error: (e) => this.handleError(e),
    });
  }

  private loadCreateDistricts(stateId: string, preferredDistrictId?: string): void {
    this.rbac.getDistricts(stateId, { pageSize: 500 }).subscribe({
      next: (r) => {
        const districts = r.data ?? [];
        this.filterDistricts.set(districts);
        if (!districts.length) {
          this.createDistrictId = '';
          return;
        }
        this.createDistrictId =
          preferredDistrictId && districts.some((d) => d.id === preferredDistrictId)
            ? preferredDistrictId
            : districts[0].id;
      },
    });
  }

  private resetForm(): void {
    this.createName = this.createCode = this.createDescription = '';
    this.createStateName = this.createStateCode = '';
    this.createDistrictName = this.createDistrictCode = '';
    this.createRtoName = this.createRtoCode = '';
    this.createStateId = this.createDistrictId = '';
    this.createTestingAgencyId = this.createTestingAgencyName = '';
    this.createIsRequired = false;
  }
}
