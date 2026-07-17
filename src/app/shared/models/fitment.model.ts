// ── Fitment ──

export interface FitmentVehicleDetails {
  rcNumber: string;
  registrationDate: string;
  vehiclesChasiNumber: string;
  vehicleEngineNumber: string;
  makerDescription: string;
  makerModel: string;
  mobileNumber: string;
  manufacturingDateFormatted: string;
  fuelType: string;
  ownerName: string;
  presentAddress: string;
  permanentAddress: string;
}

export interface FitmentVehicleDetailsResponse {
  vehicleDetails: FitmentVehicleDetails;
  item: { itemId: string; imei?: string; simProvider?: string };
}

export type RcDetailsRequest = FitmentVehicleDetails;

export type RcVahanDetails = FitmentVehicleDetails;

export interface CreateFitmentRequest {
  itemId: string;
  rtoId: string;
  vehicleCategoryId: string;
  vehicleRegistrationNo: string;
  chassisNo: string;
  engineNo: string;
  vehicleMake: string;
  vehicleModel: string;
  mafYear: number;
  customerName: string;
  mobileNo: string;
  address: string;
}

export interface FitmentRto {
  id: string;
  rtoCode: string;
  rtoName: string;
  district?: {
    id: string;
    districtCode: string;
    districtName: string;
    state?: { id: string; stateCode: string; stateName: string };
  };
}

export interface FitmentVehicleCategory {
  id: string;
  name: string;
  description?: string;
  isActive?: boolean;
  createdAt?: string;
}

export interface FitmentEntity {
  id: string;
  name: string;
  entityType?: { id: string; name: string; description?: string; menuName?: string };
}

export interface Fitment {
  id: string;
  fitmentNo: string;
  itemId: string;
  rto: FitmentRto;
  vehicleCategory: FitmentVehicleCategory;
  entity?: FitmentEntity;
  vehicleRegistrationNo: string;
  chassisNo: string;
  engineNo: string;
  vehicleMake: string;
  vehicleModel: string;
  mafYear: number;
  customerName: string;
  mobileNo: string;
  address: string;
  fitmentDate: string;
  fitmentValidTill: string;
  fitmentCertificateUrl: string | null;
  parentFitmentId: string | null;
  status?: string;
  isSuperseded: boolean;
  createdAt: string;
  imei?: string;
  serialNo?: string;
}

export interface ValidateFitmentOtpRequest {
  fitmentId: string;
  otp: string;
}

export interface ResendFitmentOtpRequest {
  fitmentId: string;
}

export interface FitmentStatusCount {
  OtpPending: number;
  Completed: number;
  Expired: number;
}
