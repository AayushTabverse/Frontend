import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
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
  getUpiQrBlob(amount?: number, note?: string): Observable<Blob> {
    const params: Record<string, string> = {};
    if (amount && amount > 0) params['amount'] = amount.toFixed(2);
    if (note) params['note'] = note;
    return this.http.get(`${this.apiUrl}/upi-qr`, { params, responseType: 'blob' });
  }

  updateSettings(data: Partial<BusinessSettings>): Observable<BusinessSettings> {
    return this.http.put<ApiResponse<BusinessSettings>>(this.apiUrl, data).pipe(
      map(res => res.data!)
    );
  }
}
