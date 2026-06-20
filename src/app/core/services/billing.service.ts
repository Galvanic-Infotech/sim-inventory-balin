import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_ENDPOINTS } from '../constants/api.constants';
import { PaginationMeta, RbacResponse } from '../../shared/models/rbac.model';
import { TableQueryParams } from '../../shared/models/table-query.model';
import { toQueryRecord } from '../../shared/utils/table-query.util';
import {
  BillingConfig,
  BillingProductType,
  BillingTransaction,
  parseBillingConfig,
  parseBillingConfigs,
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

  private productTypeParam(
    params: HttpParams,
    productType: BillingProductType,
  ): HttpParams {
    return params.set('productType', String(productType));
  }

  fetchConfig(entityId: string): Observable<BillingConfig[]> {
    return this.http
      .get<RbacResponse<Record<string, unknown>[] | Record<string, unknown>>>(
        `${API_ENDPOINTS.SIM.BILLING_CONFIG}/${entityId}/config`,
      )
      .pipe(map((res) => parseBillingConfigs(res.data)));
  }

  updateConfig(
    entityId: string,
    payload: {
      productType: BillingProductType;
      yearlyAmount: number;
      yearInDays: number;
      taxRate: number;
      creditLimit: number;
    },
  ): Observable<BillingConfig> {
    const params = this.productTypeParam(new HttpParams(), payload.productType);
    return this.http
      .put<RbacResponse<Record<string, unknown>>>(
        `${API_ENDPOINTS.SIM.BILLING_CONFIG}/${entityId}/config`,
        payload,
        { params },
      )
      .pipe(map((res) => parseBillingConfig(res.data ?? {})));
  }

  addCredit(
    entityId: string,
    payload: AddCreditPayload,
    productType: BillingProductType = BillingProductType.Sim,
  ): Observable<BillingTransaction> {
    const params = this.productTypeParam(new HttpParams(), productType);
    const headers = new HttpHeaders({ 'X-Entity-ID': entityId });
    return this.http
      .post<RbacResponse<Record<string, unknown>>>(
        `${API_ENDPOINTS.SIM.BILLING_CREDIT}/${entityId}/credit`,
        payload,
        { params, headers },
      )
      .pipe(map((res) => parseBillingTransaction(res.data ?? {})));
  }

  /**
   * POST /Billing/generate?date=YYYY-MM-DD&productType=1
   * X-Entity-ID is set per-request when entityId is passed, so the active
   * entity context is untouched. Auth interceptor preserves explicit headers.
   */
  generateBill(
    date: string,
    entityId?: string,
    productType: BillingProductType = BillingProductType.Sim,
  ): Observable<string> {
    const params = this.productTypeParam(new HttpParams().set('date', date), productType);
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

  fetchTransactions(
    query: TableQueryParams = {},
    productType: BillingProductType = BillingProductType.Sim,
  ): Observable<BillingTransactionsResult> {
    const record = toQueryRecord({
      pageNumber: query.pageNumber ?? 1,
      pageSize: query.pageSize ?? 10,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      searchTerm: query.searchTerm,
    });
    let params = this.productTypeParam(new HttpParams(), productType);
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
