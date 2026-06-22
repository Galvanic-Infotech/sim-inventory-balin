import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../constants/api.constants';
import {
  CreateFitmentRequest,
  Fitment,
  FitmentStatusCount,
  FitmentVehicleDetailsResponse,
  RcDetailsRequest,
  ResendFitmentOtpRequest,
  ValidateFitmentOtpRequest,
} from '../../shared/models/fitment.model';
import { RbacResponse } from '../../shared/models/rbac.model';
import { TableQueryParams } from '../../shared/models/table-query.model';
import { toQueryRecord } from '../../shared/utils/table-query.util';

@Injectable({ providedIn: 'root' })
export class FitmentService {
  private readonly http = inject(HttpClient);
  private readonly EP = API_ENDPOINTS.RBAC;

  getVehicleDetails(serialNo: string): Observable<RbacResponse<FitmentVehicleDetailsResponse>> {
    return this.http.get<RbacResponse<FitmentVehicleDetailsResponse>>(
      `${this.EP.FITMENT_VEHICLE_DETAILS}/${encodeURIComponent(serialNo)}`,
    );
  }

  createFitment(body: CreateFitmentRequest): Observable<RbacResponse<Fitment>> {
    return this.http.post<RbacResponse<Fitment>>(this.EP.FITMENT, body);
  }

  validateOtp(body: ValidateFitmentOtpRequest): Observable<RbacResponse<{ message: string }>> {
    return this.http.post<RbacResponse<{ message: string }>>(this.EP.FITMENT_VALIDATE_OTP, body);
  }

  resendOtp(body: ResendFitmentOtpRequest): Observable<RbacResponse<unknown>> {
    return this.http.post<RbacResponse<unknown>>(this.EP.FITMENT_RESEND_OTP, body);
  }

  initiateOtp(body: ResendFitmentOtpRequest): Observable<RbacResponse<unknown>> {
    return this.http.post<RbacResponse<unknown>>(this.EP.FITMENT_INITIATE_OTP, body);
  }

  getStatusCount(): Observable<RbacResponse<FitmentStatusCount>> {
    return this.http.get<RbacResponse<FitmentStatusCount>>(this.EP.FITMENT_STATUS_COUNT);
  }

  deleteFitment(id: string): Observable<RbacResponse<{ message: string }>> {
    return this.http.delete<RbacResponse<{ message: string }>>(
      `${this.EP.FITMENT}/${encodeURIComponent(id)}`,
    );
  }

  generateCertificate(id: string): Observable<RbacResponse<{ message: string; data: string }>> {
    return this.http.get<RbacResponse<{ message: string; data: string }>>(
      `${this.EP.FITMENT}/${encodeURIComponent(id)}/generate-certificate`,
    );
  }

  getFitments(query: TableQueryParams = {}): Observable<RbacResponse<Fitment[]>> {
    const record = toQueryRecord(query);
    let params = new HttpParams();
    Object.entries(record).forEach(([k, v]) => (params = params.set(k, v)));
    return this.http.get<RbacResponse<Fitment[]>>(this.EP.FITMENT_LIST, { params });
  }

  fillRcDetails(
    serialNo: string,
    body: RcDetailsRequest,
  ): Observable<RbacResponse<{ message: string }>> {
    return this.http.post<RbacResponse<{ message: string }>>(
      `${this.EP.FITMENT_FILL_RC_DETAILS}/${encodeURIComponent(serialNo)}/fill-device-rc-details`,
      body,
    );
  }

  deleteRcDetails(serialNo: string): Observable<RbacResponse<{ message: string }>> {
    return this.http.delete<RbacResponse<{ message: string }>>(
      `${this.EP.FITMENT_DELETE_RC_DETAILS}/${encodeURIComponent(serialNo)}/delete-device-rc-details`,
    );
  }
}
