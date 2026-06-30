export interface OutstandingReportRow {
  entityId: string;
  entityName: string;
  simOutstanding: number;
  simCreditLimit: number | null;
  simOverLimit: boolean;
  licenseOutstanding: number;
  licenseCreditLimit: number | null;
  licenseOverLimit: boolean;
}

export interface FitmentDuration {
  durationMonths: number;
  count: number;
}

export interface FitmentEntity {
  entityName: string;
  totalFitments: number;
  durations: FitmentDuration[];
}

export interface FitmentDay {
  date: string;
  totalFitments: number;
  entities: FitmentEntity[];
}

export interface FitmentReport {
  from: string;
  to: string;
  totalFitments: number;
  days: FitmentDay[];
}

export interface FitmentDetailRow {
  fitmentNo: string;
  serialNumber: string;
  vehicleRegistrationNo: string;
  chassisNo: string;
  engineNo: string;
  vehicleMake: string;
  vehicleModel: string;
  mafYear: number;
  customerName: string;
  mobileNo: string;
  fitmentDate: string;
  fitmentValidTill: string;
  durationMonths: number;
  status: string;
}

export interface FitmentDetailGroup {
  entityName: string;
  entityType: string;
  totalFitments: number;
  durationSummary: FitmentDuration[];
  fitments: FitmentDetailRow[];
}
