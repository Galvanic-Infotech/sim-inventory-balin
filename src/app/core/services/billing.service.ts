import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
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

export interface AddCreditPayload {
  amount: number;
  notes: string;
}

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

  updateConfig(
    entityId: string,
    payload: {
      yearlyAmount: number;
      yearInDays: number;
      taxRate: number;
      creditLimit: number;
    },
  ): Observable<BillingConfig> {
    return this.http
      .put<RbacResponse<Record<string, unknown>>>(
        `${API_ENDPOINTS.SIM.BILLING_CONFIG}/${entityId}/config`,
        payload,
      )
      .pipe(map((res) => parseBillingConfig(res.data ?? {})));
  }

  addCredit(entityId: string, payload: AddCreditPayload): Observable<BillingTransaction> {
    return this.http
      .post<RbacResponse<Record<string, unknown>>>(
        `${API_ENDPOINTS.SIM.BILLING_CREDIT}/${entityId}/credit`,
        payload,
      )
      .pipe(map((res) => parseBillingTransaction(res.data ?? {})));
  }

  /**
   * POST /SimBilling/generate?date=YYYY-MM-DD
   * X-Entity-ID is set per-request when entityId is passed, so the active
   * entity context is untouched. Auth interceptor preserves explicit headers.
   */
  generateBill(date: string, entityId?: string): Observable<string> {
    const params = new HttpParams().set('date', date);
    const headers = entityId ? new HttpHeaders({ 'X-Entity-ID': entityId }) : undefined;
    return this.http
      .post<RbacResponse<{ message?: string } | Record<string, unknown>>>(
        API_ENDPOINTS.SIM.BILLING_GENERATE,
        null,
        { params, headers },
      )
      .pipe(
        map((res) => {
          const data = (res.data ?? {}) as { message?: string };
          return data.message ?? res.message ?? 'Billing generated';
        }),
      );
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
