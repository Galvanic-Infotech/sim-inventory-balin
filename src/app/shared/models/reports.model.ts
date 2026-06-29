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
