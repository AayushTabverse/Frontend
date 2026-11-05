import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, Subject, tap } from 'rxjs';
import { ApiResponse, BusinessSettings } from '../models/api.models';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly apiUrl = `${environment.apiUrl}/settings`;

  constructor(private http: HttpClient) {}

  getSettings(): Observable<BusinessSettings> {
    return this.http.get<ApiResponse<BusinessSettings>>(this.apiUrl).pipe(
      map(res => res.data!)
    );
  }

  getPublicSettings(tenantId: string): Observable<BusinessSettings> {
    return this.http.get<ApiResponse<BusinessSettings>>(`${this.apiUrl}/public/${tenantId}`).pipe(
      map(res => res.data!)
    );
  }

  /** UPI QR for the restaurant's UPI ID with the amount pre-filled (omit amount for an open QR). */
  /** Take QR orders outside opening hours for a while; 0 = back to normal hours. */
  setOrderingOverride(minutes: number): Observable<BusinessSettings> {
    return this.http.post<ApiResponse<BusinessSettings>>(`${this.apiUrl}/ordering-override?minutes=${minutes}`, {}).pipe(
      map(res => res.data!)
    );
  }

  /** QR for the takeaway counter (opens the takeaway menu). */
  getTakeawayQrBlob(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/takeaway-qr`, { responseType: 'blob' });
  }

  getUpiQrBlob(amount?: number, note?: string): Observable<Blob> {
    const params: Record<string, string> = {};
    if (amount && amount > 0) params['amount'] = amount.toFixed(2);
    if (note) params['note'] = note;
    return this.http.get(`${this.apiUrl}/upi-qr`, { params, responseType: 'blob' });
  }

  /** Saved settings, for screens that depend on them (e.g. the sidebar's hotel entries). */
  readonly saved$ = new Subject<BusinessSettings>();

  updateSettings(data: Partial<BusinessSettings>): Observable<BusinessSettings> {
    return this.http.put<ApiResponse<BusinessSettings>>(this.apiUrl, data).pipe(
      map(res => res.data!),
      tap(s => this.saved$.next(s))
    );
  }
}
