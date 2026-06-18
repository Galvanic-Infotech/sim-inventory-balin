import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, expand, reduce, EMPTY } from 'rxjs';
import { API_ENDPOINTS } from '../constants/api.constants';
import {
  RbacResponse,
  RbacUser,
  CreateUserRequest,
  RbacEntity,
  CreateEntityRequest,
  RbacRole,
  CreateRoleRequest,
  RbacPermission,
  CreatePermissionRequest,
  CreatePermissionGroupRequest,
  PermissionGroup,
  RbacEntityType,
  EntityTypeResponseData,
  CreateEntityTypeRequest,
  EntityPermissionsData,
  ItemType,
  SimCardProvider,
  CreateSimCardProviderRequest,
  UpdateSimCardProviderRequest,
  VehicleCategory,
  CreateVehicleCategoryRequest,
  UpdateVehicleCategoryRequest,
  State,
  District,
  Rto,
  EntityAttributesGet,
  EntityAttributesUpdate,
  EntityProfile,
  SetDevicePortMappingRequest,
  TestingAgency,
  CreateTestingAgencyRequest,
  UpdateTestingAgencyRequest,
  DocumentType,
  CreateDocumentTypeRequest,
  UpdateDocumentTypeRequest,
  AisDeviceModel,
  CreateAisDeviceModelRequest,
  EntityDocument,
  UploadEntityDocumentRequest,
  Firmware,
  UploadFirmwareRequest,
  EntityRtoItem,
  AssignEntityRtosRequest,
} from '../../shared/models/rbac.model';
import { TableQueryParams } from '../../shared/models/table-query.model';
import { toQueryRecord } from '../../shared/utils/table-query.util';

@Injectable({ providedIn: 'root' })
export class RbacService {
  private readonly http = inject(HttpClient);
  private readonly EP = API_ENDPOINTS.RBAC;

  // ── Users ──
  getUsers(entityId: string, query: TableQueryParams = {}): Observable<RbacResponse<RbacUser[]>> {
    return this.get(this.EP.USERS, toQueryRecord(query, { entityId }));
  }

  createUser(req: CreateUserRequest): Observable<RbacResponse<unknown>> {
    return this.post(this.EP.USERS, req);
  }

  updateUserRole(userId: string, roleId: string): Observable<RbacResponse<unknown>> {
    return this.http.patch<RbacResponse<unknown>>(`${this.EP.UPDATE_USER_ROLE}/${userId}`, { userId, roleId });
  }

  setUserEnabled(userId: string, isEnabled: boolean): Observable<RbacResponse<unknown>> {
    return this.http.patch<RbacResponse<unknown>>(
      `${this.EP.DISABLE_USER}/${userId}/disable-user`,
      { userId, isEnabled },
    );
  }

  checkEmailExists(email: string, excludeUserId?: string): Observable<RbacResponse<{ exists: boolean }>> {
    const params: Record<string, string> = { email };
    if (excludeUserId) params['excludeUserId'] = excludeUserId;
    return this.get(this.EP.CHECK_EMAIL, params);
  }

  checkMobileExists(mobileNumber: string, excludeUserId?: string): Observable<RbacResponse<{ exists: boolean }>> {
    const params: Record<string, string> = { mobileNumber };
    if (excludeUserId) params['excludeUserId'] = excludeUserId;
    return this.get(this.EP.CHECK_MOBILE, params);
  }

  // ── Entities ──
  getEntities(entityTypeId?: string, query: TableQueryParams = {}): Observable<RbacResponse<RbacEntity[]>> {
    const extra: Record<string, string> = {};
    if (entityTypeId) extra['entityTypeId'] = entityTypeId;
    return this.get(this.EP.ENTITY, toQueryRecord(query, extra));
  }

  /** Fetch all entities across all pages */
  getAllEntities(entityTypeId?: string): Observable<RbacEntity[]> {
    return this.getEntities(entityTypeId, { pageNumber: 1, pageSize: 50 }).pipe(
      expand((res) =>
        res.metadata?.pagination?.hasNext
          ? this.getEntities(entityTypeId, {
              pageNumber: res.metadata.pagination.pageNumber + 1,
              pageSize: 50,
            })
          : EMPTY,
      ),
      reduce<RbacResponse<RbacEntity[]>, RbacEntity[]>(
        (all, res) => [...all, ...(res.data ?? [])],
        [],
      ),
    );
  }

  createEntity(req: CreateEntityRequest): Observable<RbacResponse<unknown>> {
    return this.post(this.EP.ENTITY, req);
  }

  // ── Entity Profile (consolidated dashboard payload) ──
  getEntityProfile(): Observable<RbacResponse<EntityProfile>> {
    return this.get<EntityProfile>(this.EP.ENTITY_PROFILE);
  }

  // ── Entity Attributes (VLTD Manufacturer Registration) ──
  getEntityAttributes(entityId: string): Observable<RbacResponse<EntityAttributesGet>> {
    return this.get<EntityAttributesGet>(`${this.EP.ENTITY_ATTRIBUTES}/${entityId}/attributes`);
  }

  updateEntityAttributes(
    entityId: string,
    attributes: EntityAttributesUpdate,
  ): Observable<RbacResponse<EntityAttributesGet>> {
    return this.http.put<RbacResponse<EntityAttributesGet>>(
      `${this.EP.ENTITY_ATTRIBUTES}/${entityId}/attributes`,
      { attributes },
    );
  }

  // ── Entity Port Mapping (per AIS device model) ──
  setDevicePortMapping(
    deviceModelId: string,
    body: SetDevicePortMappingRequest,
  ): Observable<RbacResponse<unknown>> {
    return this.http.put<RbacResponse<unknown>>(
      `${this.EP.ENTITY_PORT_MAPPING}/${deviceModelId}`,
      body,
    );
  }

  deletePortMapping(): Observable<RbacResponse<unknown>> {
    return this.http.delete<RbacResponse<unknown>>(this.EP.ENTITY_PORT_MAPPING);
  }

  // ── Roles ──
  getRoles(entityId: string, query: TableQueryParams = {}): Observable<RbacResponse<RbacRole[]>> {
    return this.get(this.EP.ROLE, toQueryRecord(query, { entityId }));
  }

  createRole(req: CreateRoleRequest): Observable<RbacResponse<unknown>> {
    return this.post(this.EP.ROLE, req);
  }

  getRolePermissions(roleId: string): Observable<RbacPermission[]> {
    return this.get<{ id: string; permissions: RbacPermission[] }>(
      this.EP.ROLE_PERMISSIONS,
      { roleId },
    ).pipe(map((res) => res.data?.permissions ?? []));
  }

  assignRolePermissions(roleId: string, permissionIds: string[]): Observable<RbacResponse<unknown>> {
    return this.post(this.EP.ASSIGN_ROLE_PERMISSIONS, { roleId, permissionIds });
  }

  // ── Permissions ──
  getPermissions(): Observable<RbacPermission[]> {
    return this.get<EntityPermissionsData>(this.EP.PERMISSIONS).pipe(
      map((res) => res.data?.entityTypePermission?.permissions ?? []),
    );
  }

  createPermission(req: CreatePermissionRequest): Observable<RbacResponse<unknown>> {
    return this.post(this.EP.CREATE_PERMISSION, req);
  }

  getPermissionGroups(): Observable<PermissionGroup[]> {
    return this.get<PermissionGroup[]>(this.EP.PERMISSION_GROUPS, toQueryRecord({ pageSize: 50 })).pipe(
      map((res) => res.data ?? []),
    );
  }

  createPermissionGroup(req: CreatePermissionGroupRequest): Observable<RbacResponse<unknown>> {
    return this.post(this.EP.CREATE_PERMISSION_GROUP, req);
  }

  getPermissionGroupsByEntity(): Observable<PermissionGroup[]> {
    return this.get<{ permissions: PermissionGroup[] }>(this.EP.PERMISSION_GROUPS_BY_ENTITY).pipe(
      map((res) => res.data?.permissions ?? []),
    );
  }

  getPermissionGroupsByRole(): Observable<PermissionGroup[]> {
    return this.get<{ permissions: PermissionGroup[] }>(this.EP.PERMISSION_GROUPS_BY_ROLE).pipe(
      map((res) => res.data?.permissions ?? []),
    );
  }

  // ── Entity Types ──
  getEntityTypes(query: TableQueryParams = {}): Observable<RbacResponse<RbacEntityType[]>> {
    return this.get<EntityTypeResponseData>(this.EP.ENTITY_TYPE, toQueryRecord(query)).pipe(
      map((res) => {
        const entityTypes = res.data?.entityTypes ?? [];
        const pagination = res.metadata?.pagination;
        const totalCount = pagination?.totalCount || entityTypes.length;
        return {
          ...res,
          data: entityTypes,
          metadata: res.metadata
            ? {
                ...res.metadata,
                pagination: pagination
                  ? { ...pagination, totalCount }
                  : {
                      pageNumber: 1,
                      pageSize: entityTypes.length || query.pageSize || 10,
                      totalCount,
                      totalPages: 1,
                      hasPrevious: false,
                      hasNext: false,
                    },
              }
            : undefined,
        } as RbacResponse<RbacEntityType[]>;
      }),
    );
  }

  getEntityTypeOfEntity(entityId: string): Observable<RbacResponse<EntityTypeResponseData>> {
    return this.get<EntityTypeResponseData>(this.EP.ENTITY_TYPE_OF_ENTITY, { entityId });
  }

  createEntityType(req: CreateEntityTypeRequest): Observable<RbacResponse<unknown>> {
    return this.post(this.EP.ENTITY_TYPE, req);
  }

  getEntityTypePermissions(entityTypeId: string): Observable<RbacPermission[]> {
    return this.get<{ permissions: PermissionGroup[] }>(
      this.EP.ENTITY_TYPE_PERMISSIONS,
      { entityTypeId },
    ).pipe(
      map((res) => {
        const groups = res.data?.permissions ?? [];
        return groups.flatMap((g) => g.permissions ?? []);
      }),
    );
  }

  assignEntityTypePermissions(entityTypeId: string, permissionIds: string[]): Observable<RbacResponse<unknown>> {
    return this.post(this.EP.ASSIGN_ENTITY_TYPE_PERMISSIONS, { entityTypeId, permissionIds });
  }

  assignEntityTypeOnEntity(entityId: string, entityTypeId: string[]): Observable<RbacResponse<unknown>> {
    return this.post(this.EP.ASSIGN_ENTITY_TYPE_ON_ENTITY, { entityId, entityTypeId });
  }

  // ── Master Data ──
  getItemTypes(): Observable<RbacResponse<ItemType[]>> {
    return this.get(this.EP.ITEM_TYPES);
  }

  createItemType(name: string): Observable<RbacResponse<unknown>> {
    return this.post(this.EP.CREATE_ITEM_TYPE, { name });
  }

  getSimCardProviders(query: TableQueryParams = {}): Observable<RbacResponse<SimCardProvider[]>> {
    return this.get(this.EP.SIM_CARD_PROVIDER, toQueryRecord(query));
  }

  createSimCardProvider(req: CreateSimCardProviderRequest): Observable<RbacResponse<SimCardProvider>> {
    return this.post(this.EP.SIM_CARD_PROVIDER, req);
  }

  updateSimCardProvider(
    id: string,
    req: UpdateSimCardProviderRequest,
  ): Observable<RbacResponse<SimCardProvider>> {
    return this.patch(`${this.EP.SIM_CARD_PROVIDER}/${id}`, req);
  }

  getVehicleCategories(query: TableQueryParams = {}): Observable<RbacResponse<VehicleCategory[]>> {
    return this.get(this.EP.VEHICLE_CATEGORY, toQueryRecord(query));
  }

  createVehicleCategory(req: CreateVehicleCategoryRequest): Observable<RbacResponse<VehicleCategory>> {
    return this.post(this.EP.VEHICLE_CATEGORY, req);
  }

  updateVehicleCategory(
    id: string,
    req: UpdateVehicleCategoryRequest,
  ): Observable<RbacResponse<VehicleCategory>> {
    return this.patch(`${this.EP.VEHICLE_CATEGORY}/${id}`, req);
  }

  getStates(query: TableQueryParams = {}): Observable<RbacResponse<State[]>> {
    return this.get(this.EP.STATES, toQueryRecord(query));
  }

  createState(stateCode: string, stateName: string): Observable<RbacResponse<unknown>> {
    return this.post(this.EP.CREATE_STATE, { stateCode, stateName });
  }

  getDistricts(stateId: string, query: TableQueryParams = {}): Observable<RbacResponse<District[]>> {
    return this.get(this.EP.DISTRICTS, toQueryRecord(query, { stateId }));
  }

  createDistrict(stateId: string, districtCode: string, districtName: string): Observable<RbacResponse<unknown>> {
    return this.post(this.EP.CREATE_DISTRICT, { stateId, districtCode, districtName });
  }

  getRtos(stateId: string, districtId: string, query: TableQueryParams = {}): Observable<RbacResponse<Rto[]>> {
    return this.get(this.EP.RTOS, toQueryRecord(query, { stateId, districtId }));
  }

  createRto(stateId: string, districtId: string, rtoCode: string, rtoName: string): Observable<RbacResponse<unknown>> {
    return this.post(this.EP.CREATE_RTO, { stateId, districtId, rtoCode, rtoName });
  }

  getTestingAgencies(): Observable<RbacResponse<TestingAgency[]>> {
    return this.get<TestingAgency[]>(this.EP.TESTING_AGENCIES);
  }

  createTestingAgency(req: CreateTestingAgencyRequest): Observable<RbacResponse<TestingAgency>> {
    return this.post<TestingAgency>(this.EP.CREATE_TESTING_AGENCY, req);
  }

  updateTestingAgency(id: string, req: UpdateTestingAgencyRequest): Observable<RbacResponse<TestingAgency>> {
    return this.patch<TestingAgency>(`${this.EP.UPDATE_TESTING_AGENCY}/${id}`, req);
  }

  getDocumentTypes(): Observable<RbacResponse<DocumentType[]>> {
    return this.get<DocumentType[]>(this.EP.DOCUMENT_TYPES);
  }

  createDocumentType(req: CreateDocumentTypeRequest): Observable<RbacResponse<DocumentType>> {
    return this.post<DocumentType>(this.EP.CREATE_DOCUMENT_TYPE, req);
  }

  updateDocumentType(id: string, req: UpdateDocumentTypeRequest): Observable<RbacResponse<DocumentType>> {
    return this.patch<DocumentType>(`${this.EP.UPDATE_DOCUMENT_TYPE}/${id}`, req);
  }

  // ── AIS Device Model ──
  getAisDeviceModels(query: TableQueryParams = {}): Observable<RbacResponse<AisDeviceModel[]>> {
    return this.get<AisDeviceModel[]>(this.EP.AIS_DEVICE_MODEL, toQueryRecord(query));
  }

  createAisDeviceModel(req: CreateAisDeviceModelRequest): Observable<RbacResponse<AisDeviceModel>> {
    return this.post<AisDeviceModel>(this.EP.AIS_DEVICE_MODEL, req);
  }

  setAisDeviceModelApproval(id: string, isApproved: boolean): Observable<RbacResponse<AisDeviceModel>> {
    return this.http.patch<RbacResponse<AisDeviceModel>>(
      `${this.EP.AIS_DEVICE_MODEL}/${id}/approval`,
      null,
      { params: new HttpParams().set('isApproved', String(isApproved)) },
    );
  }

  uploadAisDeviceModelDocuments(
    id: string,
    payload: { copValidTill?: string; tacDocument?: File | null; copDocument?: File | null },
  ): Observable<RbacResponse<AisDeviceModel>> {
    const form = new FormData();
    if (payload.copValidTill) form.append('copValidTill', payload.copValidTill);
    if (payload.tacDocument) form.append('tacDocument', payload.tacDocument);
    if (payload.copDocument) form.append('copDocument', payload.copDocument);
    return this.http.post<RbacResponse<AisDeviceModel>>(
      `${this.EP.AIS_DEVICE_MODEL_UPLOAD_DOCS}/${id}/upload-documents`,
      form,
    );
  }

  // ── Entity Document ──
  getEntityDocuments(): Observable<RbacResponse<EntityDocument[]>> {
    return this.get<EntityDocument[]>(this.EP.ENTITY_DOCUMENT);
  }

  uploadEntityDocument(req: UploadEntityDocumentRequest): Observable<RbacResponse<EntityDocument>> {
    const form = new FormData();
    form.append('EntityId', req.EntityId);
    form.append('OwnerType', req.OwnerType ?? 'Entity');
    form.append('DocumentTypeId', req.DocumentTypeId);
    form.append('File', req.File);
    return this.http.post<RbacResponse<EntityDocument>>(this.EP.ENTITY_DOCUMENT_UPLOAD, form);
  }

  // ── Firmware ──
  getFirmware(): Observable<RbacResponse<Firmware[]>> {
    return this.get<Firmware[]>(this.EP.FIRMWARE);
  }

  uploadFirmware(req: UploadFirmwareRequest): Observable<RbacResponse<Firmware>> {
    const form = new FormData();
    form.append('version', req.version);
    if (req.description) form.append('description', req.description);
    form.append('file', req.file);
    form.append('aisDeviceModelId', req.aisDeviceModelId);
    return this.http.post<RbacResponse<Firmware>>(this.EP.FIRMWARE_UPLOAD, form);
  }

  deleteFirmware(id: string): Observable<RbacResponse<unknown>> {
    return this.http.delete<RbacResponse<unknown>>(`${this.EP.FIRMWARE}/${id}`);
  }

  // ── Entity RTO ──
  getEntityRtos(): Observable<RbacResponse<EntityRtoItem[]>> {
    return this.get<EntityRtoItem[]>(this.EP.ENTITY_RTO);
  }

  /** RTO pool available to the parent (logged-in) entity. */
  getParentEntityRtos(): Observable<RbacResponse<EntityRtoItem[]>> {
    return this.get<EntityRtoItem[]>(this.EP.ENTITY_RTO_PARENT_POOL);
  }

  assignEntityRtos(req: AssignEntityRtosRequest): Observable<RbacResponse<unknown>> {
    return this.post(this.EP.ENTITY_RTO, req);
  }

  // ── HTTP helpers (relative URLs → interceptors handle baseUrl + auth) ──
  private get<T>(path: string, params?: Record<string, string>): Observable<RbacResponse<T>> {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => (httpParams = httpParams.set(k, v)));
    }
    return this.http.get<RbacResponse<T>>(path, { params: httpParams });
  }

  private post<T>(path: string, body: unknown): Observable<RbacResponse<T>> {
    return this.http.post<RbacResponse<T>>(path, body);
  }

  private patch<T>(path: string, body: unknown): Observable<RbacResponse<T>> {
    return this.http.patch<RbacResponse<T>>(path, body);
  }
}
