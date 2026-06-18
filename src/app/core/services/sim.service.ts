import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_ENDPOINTS } from '../constants/api.constants';
import {
  BasketDetails,
  SimDetail,
  SimFilterType,
  SimResponse,
  SmsWhitelisting,
  SmsWhitelistPatch,
  emptySmsWhitelisting,
  parseBasketDetails,
  parseSimDetail,
  parseSmsWhitelisting,
} from '../../shared/models/sim.model';

@Injectable({ providedIn: 'root' })
export class SimService {
  private readonly http = inject(HttpClient);

  fetchBasketDetails(): Observable<BasketDetails> {
    return this.get<Record<string, unknown>>(API_ENDPOINTS.SIM.BASKET).pipe(
      map((res) => parseBasketDetails((res.data ?? {}) as Record<string, unknown>)),
    );
  }

  searchSim(simFilterType: SimFilterType, filterValue: string): Observable<SimDetail> {
    return this.get<Record<string, unknown>>(API_ENDPOINTS.SIM.ACTIVATION, {
      simFilterType,
      filterValue,
    }).pipe(
      map((res) => parseSimDetail((res.data ?? {}) as Record<string, unknown>)),
    );
  }

  activateSim(payload: {
    iccid: string;
    validTill: string;
    imei: string;
    customerName: string;
    remarks: string;
  }): Observable<void> {
    return this.post<void>(API_ENDPOINTS.SIM.ACTIVATION, payload);
  }

  tempDisconnect(iccid: string, mobileNo: string): Observable<void> {
    return this.post<void>(API_ENDPOINTS.SIM.TEMP_DISCONNECT, { iccid, mobileNo });
  }

  resumeTempDisconnect(iccid: string, mobileNo: string): Observable<void> {
    return this.post<void>(API_ENDPOINTS.SIM.RESUME, { iccid, mobileNo });
  }

  fetchSmsWhitelisting(iccid: string): Observable<SmsWhitelisting> {
    const filterType: SimFilterType = iccid.startsWith('899') ? 'SIM_NO' : 'MSISDN';
    return this.get<Record<string, unknown>>(API_ENDPOINTS.SIM.SMS_WHITELIST_FETCH, {
      simFilterType: filterType,
      filterValue: iccid,
    }).pipe(
      map((res) => {
        const data = (res.data ?? {}) as Record<string, unknown>;
        const responseDto = data['responseDto'] as Record<string, unknown> | undefined;
        const raw = responseDto ?? data;
        const list = (raw['smsWTDetailsVO'] as unknown[]) ?? [];
        if (!list.length) return emptySmsWhitelisting();
        return parseSmsWhitelisting(list[0] as Record<string, unknown>);
      }),
    );
  }

  patchSmsWhitelisting(payload: SmsWhitelistPatch): Observable<void> {
    return this.post<void>(API_ENDPOINTS.SIM.SMS_WHITELIST_PATCH, payload);
  }

  private get<T>(path: string, params?: Record<string, string>): Observable<SimResponse<T>> {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => (httpParams = httpParams.set(k, v)));
    }
    return this.http.get<SimResponse<T>>(path, { params: httpParams });
  }

  private post<T>(path: string, body: unknown): Observable<T> {
    return this.http.post<SimResponse<T>>(path, body).pipe(map(() => undefined as T));
  }
}
