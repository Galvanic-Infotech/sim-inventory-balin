import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../constants/api.constants';
import { RbacResponse } from '../../shared/models/rbac.model';
import { TableQueryParams } from '../../shared/models/table-query.model';
import { toQueryRecord } from '../../shared/utils/table-query.util';
import {
  BulkUploadJob,
  BulkUploadJobListFilters,
} from '../../shared/models/bulk-upload-job.model';

@Injectable({ providedIn: 'root' })
export class JobService {
  private readonly http = inject(HttpClient);
  private readonly EP = API_ENDPOINTS.RBAC;

  getJobs(
    query: TableQueryParams = {},
    filters: BulkUploadJobListFilters = {},
  ): Observable<RbacResponse<BulkUploadJob[]>> {
    const extra: Record<string, string> = {};
    if (filters.status) extra['status'] = filters.status;
    if (filters.jobType) extra['jobType'] = filters.jobType;
    const params = toQueryRecord(query, extra);
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([k, v]) => (httpParams = httpParams.set(k, v)));
    return this.http.get<RbacResponse<BulkUploadJob[]>>(this.EP.JOBS, { params: httpParams });
  }
}
