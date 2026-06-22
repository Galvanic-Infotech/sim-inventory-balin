import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../constants/api.constants';
import { RbacResponse } from '../../shared/models/rbac.model';
import { TableQueryParams } from '../../shared/models/table-query.model';
import { toQueryRecord } from '../../shared/utils/table-query.util';
import {
  AisDevice,
  AisDeviceListFilters,
  AisEntityDeviceCount,
  DeviceActivateRequest,
  DeviceByStatus,
  EntityInstallationGraph,
  MoveDevicesRequest,
  MovementDayGroup,
  UploadJobHandle,
  UploadJobStatus,
} from '../../shared/models/device.model';

@Injectable({ providedIn: 'root' })
export class DeviceService {
  private readonly http = inject(HttpClient);
  private readonly EP = API_ENDPOINTS.RBAC;

  getDevices(
    query: TableQueryParams = {},
    filters: AisDeviceListFilters = {},
  ): Observable<RbacResponse<AisDevice[]>> {
    const extra: Record<string, string> = {};
    if (filters.status) extra['status'] = filters.status;
    if (filters.entityId) extra['entityId'] = filters.entityId;
    return this.get<AisDevice[]>(this.EP.AIS_DEVICE_LIST, toQueryRecord(query, extra));
  }

  getEntityDeviceCounts(): Observable<RbacResponse<AisEntityDeviceCount[]>> {
    return this.get<AisEntityDeviceCount[]>(this.EP.AIS_DEVICE_ENTITY_COUNT);
  }

  getInstallationGraph(): Observable<RbacResponse<EntityInstallationGraph[]>> {
    return this.get<EntityInstallationGraph[]>(this.EP.AIS_DEVICE_INSTALLATION_GRAPH);
  }

  uploadDevicesTxt(
    file: File,
    options: { simCardProviderId: string; aisDeviceModelId: string },
  ): Observable<RbacResponse<UploadJobHandle>> {
    const form = new FormData();
    form.append('file', file);
    form.append('simCardProviderId', options.simCardProviderId);
    form.append('aisDeviceModelId', options.aisDeviceModelId);
    return this.http.post<RbacResponse<UploadJobHandle>>(this.EP.AIS_DEVICE_UPLOAD_TXT, form);
  }

  getUploadStatus(id: string): Observable<RbacResponse<UploadJobStatus>> {
    return this.http.get<RbacResponse<UploadJobStatus>>(`${this.EP.AIS_DEVICE_STATUS}/${id}`);
  }

  moveDevices(req: MoveDevicesRequest): Observable<RbacResponse<unknown>> {
    return this.http.post<RbacResponse<unknown>>(this.EP.AIS_DEVICE_MOVE, req);
  }

  getMovementSummary(
    query: TableQueryParams = {},
  ): Observable<RbacResponse<MovementDayGroup[]>> {
    return this.get<MovementDayGroup[]>(
      this.EP.AIS_DEVICE_MOVEMENT_SUMMARY,
      toQueryRecord(query),
    );
  }

  getDevicesByStatus(status: string): Observable<RbacResponse<DeviceByStatus[]>> {
    return this.get<DeviceByStatus[]>(this.EP.AIS_DEVICE_BY_STATUS, { status });
  }

  activateDevices(req: DeviceActivateRequest): Observable<RbacResponse<unknown>> {
    return this.http.post<RbacResponse<unknown>>(this.EP.AIS_DEVICE_ACTIVATE, req);
  }

  private get<T>(path: string, params?: Record<string, string>): Observable<RbacResponse<T>> {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => (httpParams = httpParams.set(k, v)));
    }
    return this.http.get<RbacResponse<T>>(path, { params: httpParams });
  }
}
