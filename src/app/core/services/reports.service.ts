import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../constants/api.constants';
import { RbacResponse } from '../../shared/models/rbac.model';
import { OutstandingReportRow } from '../../shared/models/reports.model';
import { TableQueryParams } from '../../shared/models/table-query.model';
import { toQueryRecord } from '../../shared/utils/table-query.util';

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private readonly http = inject(HttpClient);
  private readonly EP = API_ENDPOINTS.RBAC;

  getOutstanding(query: TableQueryParams = {}): Observable<RbacResponse<OutstandingReportRow[]>> {
    const record = toQueryRecord(query);
    let params = new HttpParams();
    Object.entries(record).forEach(([k, v]) => (params = params.set(k, v)));
    return this.http.get<RbacResponse<OutstandingReportRow[]>>(this.EP.REPORTS_OUTSTANDING, { params });
  }
}
