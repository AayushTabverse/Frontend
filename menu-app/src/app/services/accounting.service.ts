import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, shareReplay } from 'rxjs';
import {
  AccountingSettings, AccountingSummary, ApiResponse, PaymentAccount, PurchaseBill, PurchaseBillRequest
} from '../models/api.models';
import { environment } from '../../environments/environment';

/** Accounting for the CA: payment accounts, purchase bills, summaries, CSV reports and Tally export. */
@Injectable({ providedIn: 'root' })
export class AccountingService {
  private readonly apiUrl = `${environment.apiUrl}/accounting`;
  private accounts$?: Observable<PaymentAccount[]>;

  constructor(private http: HttpClient) {}

  /** Payment accounts for bill screens (cached for the session; refresh after editing settings). */
  paymentAccounts(refresh = false): Observable<PaymentAccount[]> {
    if (!this.accounts$ || refresh) {
      this.accounts$ = this.http.get<ApiResponse<PaymentAccount[]>>(`${this.apiUrl}/payment-accounts`).pipe(
        map(res => res.data ?? []),
        shareReplay(1)
      );
    }
    return this.accounts$;
  }

  getSettings(): Observable<AccountingSettings> {
    return this.http.get<ApiResponse<AccountingSettings>>(`${this.apiUrl}/settings`).pipe(map(res => res.data!));
  }

  saveSettings(settings: AccountingSettings): Observable<AccountingSettings> {
    return this.http.put<ApiResponse<AccountingSettings>>(`${this.apiUrl}/settings`, settings).pipe(map(res => res.data!));
  }

  /** from/to: yyyy-MM-dd (restaurant-local days, inclusive). */
  summary(from: string, to: string): Observable<AccountingSummary> {
    return this.http.get<ApiResponse<AccountingSummary>>(`${this.apiUrl}/summary?from=${from}&to=${to}`).pipe(map(res => res.data!));
  }

  /** kind: 'masters' (ledgers, import once) or 'vouchers'. */
  tallyXml(kind: 'masters' | 'vouchers', from: string, to: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/tally/${kind}?from=${from}&to=${to}`, { responseType: 'blob' });
  }

  /** report: daily, gst, udhaar, purchases. */
  reportCsv(report: 'daily' | 'gst' | 'udhaar' | 'purchases', from: string, to: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/report/${report}?from=${from}&to=${to}`, { responseType: 'blob' });
  }

  purchases(from: string, to: string): Observable<PurchaseBill[]> {
    return this.http.get<ApiResponse<PurchaseBill[]>>(`${this.apiUrl}/purchases?from=${from}&to=${to}`).pipe(map(res => res.data ?? []));
  }

  addPurchase(data: PurchaseBillRequest): Observable<PurchaseBill> {
    return this.http.post<ApiResponse<PurchaseBill>>(`${this.apiUrl}/purchases`, data).pipe(map(res => res.data!));
  }

  updatePurchase(id: string, data: PurchaseBillRequest): Observable<PurchaseBill> {
    return this.http.put<ApiResponse<PurchaseBill>>(`${this.apiUrl}/purchases/${id}`, data).pipe(map(res => res.data!));
  }

  /** paidOn: yyyy-MM-dd (default today). */
  payPurchase(id: string, accountKey: string, paidOn?: string): Observable<PurchaseBill> {
    return this.http.post<ApiResponse<PurchaseBill>>(`${this.apiUrl}/purchases/${id}/pay`, { accountKey, paidOn }).pipe(map(res => res.data!));
  }

  deletePurchase(id: string): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/purchases/${id}`).pipe(map(() => void 0));
  }
}
