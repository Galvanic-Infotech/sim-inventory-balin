// ── Pagination ──
export interface PaginationMeta {
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

// ── API Response Wrapper ──
export interface RbacResponse<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
  metadata?: { pagination?: PaginationMeta; correlationId: string; responseTime: number; version: string };
  timestamp: string;
  path: string;
}

// ── Auth ──
export interface RbacLoginRequest {
  mobile: string;
  password: string;
}

export interface RbacLoginData {
  token: string;
  firstName: string;
  lastName: string;
  entityType: string;
}

export interface RbacTokenPayload {
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier': string;
  entityId: string;
  roleId: string;
  exp: number;
  iss: string;
  aud: string;
}

// ── User ──
export interface RbacUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  mobileNumber: string;
  isActive?: boolean;
  role?: { id: string; name: string };
  entity?: { id: string; name: string; entityType?: { id: string; name: string; description?: string } };
}

export interface CreateUserRequest {
  firstName: string;
  lastName: string;
  email: string;
  mobileNumber: string;
  password: string;
  roleId: string;
  entityId: string;
}

// ── Entity ──
export interface RbacEntity {
  id: string;
  name: string;
  description: string;
  entityType?: { id: string; name: string };
  entityTypes?: { id: string; name: string }[];
  isBillingEnabled?: boolean;
}

export interface CreateEntityRequest {
  name: string;
  description: string;
  entityTypeId: string;
  parentEntityId?: string;
}

// ── Role ──
export interface RbacRole {
  id: string;
  roleName: string;
  description?: string;
  entityName?: string;
  permissions?: RbacPermission[];
  entityId?: string;
}

export interface CreateRoleRequest {
  name: string;
  description: string;
  entityId: string;
}

// ── Permission ──
export interface RbacPermission {
  id: string;
  name: string;
  description?: string;
}

export interface CreatePermissionRequest {
  groupId: string;
  name: string;
  description: string;
}

export interface CreatePermissionGroupRequest {
  name: string;
  description: string;
}

// ── Permission Group ──
export interface PermissionGroup {
  id: string;
  name: string;
  description?: string;
  permissions: RbacPermission[];
}

// Response shape for entity-permissions endpoint
export interface EntityPermissionsData {
  id: string;
  name: string;
  entityTypePermission: {
    id: string;
    name: string;
    description: string;
    permissions: RbacPermission[];
  };
}

// ── Entity Type ──
export interface RbacEntityType {
  id: string;
  name: string;
  description?: string;
  permissions?: RbacPermission[];
}

export interface EntityTypeResponseData {
  entity: RbacEntity;
  entityTypes: RbacEntityType[];
}

export interface CreateEntityTypeRequest {
  name: string;
  description: string;
}

// ── Master Data ──
export interface ItemType {
  id: string;
  name: string;
}

export interface SimCardProvider {
  id: string;
  name: string;
  description?: string;
  isActive?: boolean;
}

export interface CreateSimCardProviderRequest {
  name: string;
  description: string;
}

export interface UpdateSimCardProviderRequest {
  name: string;
  description: string;
}

export interface VehicleCategory {
  id: string;
  name: string;
  description?: string;
  isActive?: boolean;
  createdAt?: string;
}

export interface CreateVehicleCategoryRequest {
  name: string;
  description: string;
}

export interface UpdateVehicleCategoryRequest {
  name: string;
  description: string;
}

export interface State {
  id: string;
  stateCode: string;
  stateName: string;
}

export interface District {
  id: string;
  districtCode: string;
  districtName: string;
  stateId: string;
}

export interface Rto {
  id: string;
  rtoCode: string;
  rtoName: string;
  stateId: string;
  districtId: string;
}

export interface TestingAgency {
  id: string;
  testingAgencyId: string;
  testingAgencyName: string;
}

export interface CreateTestingAgencyRequest {
  testingAgencyId: string;
  testingAgencyName: string;
}

export interface UpdateTestingAgencyRequest {
  testingAgencyId: string;
  testingAgencyName: string;
}

export interface DocumentType {
  id: string;
  name: string;
  isRequired?: boolean;
  createdAt?: string;
}

export interface CreateDocumentTypeRequest {
  name: string;
  isRequired: boolean;
}

export interface UpdateDocumentTypeRequest {
  name: string;
  isRequired: boolean;
}

// ── Entity RTO ──
export interface EntityRtoItem {
  entityId: string;
  rto: {
    id: string;
    rtoCode: string;
    rtoName: string;
    district: {
      id: string;
      districtCode: string;
      districtName: string;
      state: { id: string; stateCode: string; stateName: string };
    };
  };
  createdAt: string;
}

export interface AssignEntityRtosRequest {
  rtoIds: string[];
}

// ── Entity Document ──
export interface EntityDocument {
  id: string;
  entityId: string;
  ownerType: string;
  documentType: { id: string; name: string };
  fileName: string;
  fileUrl: string;
  createdAt: string;
}

export interface UploadEntityDocumentRequest {
  EntityId: string;
  OwnerType?: string;
  DocumentTypeId: string;
  File: File;
}

// ── Firmware ──
export interface Firmware {
  id: string;
  entity?: {
    id: string;
    name: string;
    entityType?: { id: string; name: string; description?: string; menuName?: string };
  };
  aisDeviceModel?: { id: string; name: string };
  version: string;
  fileName: string;
  fileUrl: string;
  description?: string | null;
  createdAt: string;
}

export interface UploadFirmwareRequest {
  version: string;
  description?: string;
  file: File;
  aisDeviceModelId: string;
}

// ── AIS Device Model ──
export interface AisDeviceModel {
  id: string;
  entity?: {
    id: string;
    name: string;
    entityType?: { id: string; name: string; description?: string };
  };
  name: string;
  description?: string;
  isActive: boolean;
  isApproved: boolean;
  testingAgency?: TestingAgency | null;
  copNo?: string | null;
  copValidTill?: string | null;
  tacDocument?: string | null;
  copDocument?: string | null;
}

export interface CreateAisDeviceModelRequest {
  Name: string;
  Description?: string;
  testingAgencyId?: string;
  CopNo?: string;
}

// ── Entity Attributes (VLTD Manufacturer/Model Registration) ──
export interface EntityAddress {
  houseNo?: string;
  street?: string;
  city?: string;
  state?: string;
  district?: string;
  pinCode?: string;
}

export interface EntityContact {
  personName?: string;
  landLine?: string;
  fax?: string;
  mobileNumber?: string;
  email?: string;
  isPrimary?: boolean;
}

export interface EntityBasicDetails {
  code?: string;
  establishmentYear?: number;
  cinNumber?: string;
  gstnNumber?: string;
  manufactureName?: string;
  address?: EntityAddress;
}

/** GET /Entity/{id}/attributes response shape */
export interface EntityAttributesGet {
  basicDetails?: EntityBasicDetails;
  contacts?: EntityContact[];
}

/** PUT /Entity/{id}/attributes request body — replace approach */
export interface EntityAttributesUpdate {
  basicDetails?: EntityBasicDetails;
  contacts?: EntityContact[];
}

// ── Entity Profile (/Entity/Profile) ──
export interface EntityProfileAttributes {
  basicDetails?: EntityBasicDetails;
  contacts?: EntityContact[];
}

export interface EntityProfileRtoDistrict {
  id: string;
  districtCode: string;
  districtName: string;
  state: { id: string; stateCode: string; stateName: string } | null;
}

export interface EntityProfileRtoItem {
  entityId: string;
  rto: {
    id: string;
    rtoCode: string;
    rtoName: string;
    district: EntityProfileRtoDistrict;
  };
  createdAt: string;
}

export interface EntityProfilePortMapping {
  id: string;
  deviceModelId?: string;
  ipAddress: string;
  port: number;
  protocol?: string;
}

export interface EntityProfileDeviceModel {
  id: string;
  name: string;
  description: string | null;
  vendor: string | null;
  modelCode: string | null;
  isActive: boolean;
  isApproved: boolean;
  isApprovedText: string | null;
  copValidTill: string | null;
  tacDocument: string | null;
  copDocument: string | null;
}

export interface EntityProfileDocument {
  id: string;
  entityId: string;
  ownerType: string;
  documentType: { id: string; name: string };
  fileName: string;
  fileUrl: string;
  isVerified: boolean;
  createdAt: string;
}

export interface EntityProfileRfcItem {
  id: string;
  name: string;
  entityType: { id: string; name: string; description?: string };
}

export interface EntityProfile {
  id: string;
  name: string;
  isActive: boolean;
  attributes: EntityProfileAttributes;
  entityType: { id: string; name: string; description?: string; menuName?: string | null };
  rtos: EntityProfileRtoItem[];
  rfc: EntityProfileRfcItem[];
  portMapping: EntityProfilePortMapping[];
  deviceModels: EntityProfileDeviceModel[];
  documents: EntityProfileDocument[];
  requiredDocuments: string[];
}

// ── Entity Port Mapping (per AIS device model) ──
export interface SetDevicePortMappingRequest {
  deviceModelId: string;
  ipAddress: string;
  port: string;
  protocol: string;
}
