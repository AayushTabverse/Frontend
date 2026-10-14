import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import {
  ApiResponse, PublicWaitlistInfo, PublicWaitlistStatus, WaitlistAnalytics, WaitlistEntryRequest,
  WaitlistEntryResponse, WaitlistSettings, WaitlistStatsResponse
} from '../models/api.models';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class WaitlistService {
  private readonly apiUrl = `${environment.apiUrl}/waitlist`;

  constructor(private http: HttpClient) {}

  /** Open parties (waiting, called, seated); with includeClosed, also those closed today. */
  getEntries(includeClosed = false): Observable<WaitlistEntryResponse[]> {
    return this.http.get<ApiResponse<WaitlistEntryResponse[]>>(`${this.apiUrl}?includeClosed=${includeClosed}`).pipe(
      map(res => res.data!)
    );
  }

  getStats(): Observable<WaitlistStatsResponse> {
    return this.http.get<ApiResponse<WaitlistStatsResponse>>(`${this.apiUrl}/stats`).pipe(
      map(res => res.data!)
    );
  }

  addEntry(data: WaitlistEntryRequest): Observable<WaitlistEntryResponse> {
    return this.http.post<ApiResponse<WaitlistEntryResponse>>(this.apiUrl, data).pipe(
      map(res => res.data!)
    );
  }

  updateEntry(id: string, data: Partial<WaitlistEntryRequest>): Observable<WaitlistEntryResponse> {
    return this.http.put<ApiResponse<WaitlistEntryResponse>>(`${this.apiUrl}/${id}`, data).pipe(
      map(res => res.data!)
    );
  }

  notify(id: string): Observable<WaitlistEntryResponse> {
    return this.action(id, 'notify');
  }

  /** Seat at one table, or several merged tables (first one is primary). */
  seat(id: string, tableIds: string[], force = false): Observable<WaitlistEntryResponse> {
    return this.http.post<ApiResponse<WaitlistEntryResponse>>(`${this.apiUrl}/${id}/seat`, { tableIds, force }).pipe(
      map(res => res.data!)
    );
  }

  release(id: string): Observable<WaitlistEntryResponse> {
    return this.action(id, 'release');
  }

  cancel(id: string): Observable<WaitlistEntryResponse> {
    return this.action(id, 'cancel');
  }

  markNoShow(id: string): Observable<WaitlistEntryResponse> {
    return this.action(id, 'no-show');
  }

  private action(id: string, name: string): Observable<WaitlistEntryResponse> {
    return this.http.post<ApiResponse<WaitlistEntryResponse>>(`${this.apiUrl}/${id}/${name}`, {}).pipe(
      map(res => res.data!)
    );
  }

  // ── Settings, QR, analytics ──

  getSettings(): Observable<WaitlistSettings> {
    return this.http.get<ApiResponse<WaitlistSettings>>(`${this.apiUrl}/settings`).pipe(map(res => res.data!));
  }

  updateSettings(data: Partial<WaitlistSettings>): Observable<WaitlistSettings> {
    return this.http.put<ApiResponse<WaitlistSettings>>(`${this.apiUrl}/settings`, data).pipe(map(res => res.data!));
  }

  getCheckInQrBlob(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/qr`, { responseType: 'blob' });
  }

  /** from/to are yyyy-MM-dd restaurant-local days (inclusive). */
  getAnalytics(from: string, to: string): Observable<WaitlistAnalytics> {
    return this.http.get<ApiResponse<WaitlistAnalytics>>(`${this.apiUrl}/analytics?from=${from}&to=${to}`).pipe(
      map(res => res.data!)
    );
  }

  // ── Public (customer-facing, no login) ──

  getPublicInfo(tenantId: string): Observable<PublicWaitlistInfo> {
    return this.http.get<ApiResponse<PublicWaitlistInfo>>(`${this.apiUrl}/public/${tenantId}/info`).pipe(map(res => res.data!));
  }

  join(tenantId: string, data: { customerName: string; customerMobile: string; partySize: number }): Observable<PublicWaitlistStatus> {
    return this.http.post<ApiResponse<PublicWaitlistStatus>>(`${this.apiUrl}/public/${tenantId}/join`, data).pipe(
      map(res => res.data!)
    );
  }

  getPublicStatus(entryId: string): Observable<PublicWaitlistStatus> {
    return this.http.get<ApiResponse<PublicWaitlistStatus>>(`${this.apiUrl}/public/entry/${entryId}`).pipe(map(res => res.data!));
  }

  leave(entryId: string): Observable<PublicWaitlistStatus> {
    return this.http.post<ApiResponse<PublicWaitlistStatus>>(`${this.apiUrl}/public/entry/${entryId}/leave`, {}).pipe(
      map(res => res.data!)
    );
  }

  /** Customer's live status page link, sent on WhatsApp. */
  statusLink(entryId: string): string {
    return `${window.location.origin}/waitlist/status/${entryId}`;
  }

  /** Self check-in page link (what the entrance QR opens). */
  checkInLink(tenantId: string): string {
    return `${window.location.origin}/waitlist/join/${tenantId}`;
  }
}
