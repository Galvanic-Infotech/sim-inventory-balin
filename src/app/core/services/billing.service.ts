import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_ENDPOINTS } from '../constants/api.constants';
import { PaginationMeta, RbacResponse } from '../../shared/models/rbac.model';
import { TableQueryParams } from '../../shared/models/table-query.model';
import { toQueryRecord } from '../../shared/utils/table-query.util';
import {
  BillingConfig,
  BillingTransaction,
  parseBillingConfig,
  parseBillingTransaction,
} from '../../shared/models/billing.model';

export interface BillingTransactionsResult {
  items: BillingTransaction[];
  pagination: PaginationMeta | null;
}

@Injectable({ providedIn: 'root' })
export class BillingService {
  private readonly http = inject(HttpClient);

  fetchConfig(entityId: string): Observable<BillingConfig> {
    return this.http
      .get<RbacResponse<Record<string, unknown>>>(
        `${API_ENDPOINTS.SIM.BILLING_CONFIG}/${entityId}/config`,
      )
      .pipe(map((res) => parseBillingConfig(res.data ?? {})));
  }

  fetchTransactions(query: TableQueryParams = {}): Observable<BillingTransactionsResult> {
    const record = toQueryRecord({
      pageNumber: query.pageNumber ?? 1,
      pageSize: query.pageSize ?? 10,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      searchTerm: query.searchTerm,
    });
    let params = new HttpParams();
    Object.entries(record).forEach(([k, v]) => (params = params.set(k, v)));
    return this.http
      .get<RbacResponse<Record<string, unknown>[]>>(API_ENDPOINTS.SIM.BILLING_TRANSACTIONS, {
        params,
      })
      .pipe(
        map((res) => ({
          items: (res.data ?? []).map(parseBillingTransaction),
          pagination: res.metadata?.pagination ?? null,
        })),
      );
  }
}
