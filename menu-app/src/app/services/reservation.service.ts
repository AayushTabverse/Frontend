import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import {
  ApiResponse, PublicReservationInfo, PublicReservationStatus, ReservationRequest, ReservationResponse, ReservationSettings
} from '../models/api.models';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ReservationService {
  private readonly apiUrl = `${environment.apiUrl}/reservation`;

  constructor(private http: HttpClient) {}

  /** Bookings on local days from..to (yyyy-MM-dd, inclusive), plus every pending request. */
  getReservations(from: string, to: string): Observable<ReservationResponse[]> {
    return this.http.get<ApiResponse<ReservationResponse[]>>(`${this.apiUrl}?from=${from}&to=${to}`).pipe(map(res => res.data!));
  }

  getPendingCount(): Observable<number> {
    return this.http.get<ApiResponse<number>>(`${this.apiUrl}/pending-count`).pipe(map(res => res.data ?? 0));
  }

  create(data: ReservationRequest): Observable<ReservationResponse> {
    return this.http.post<ApiResponse<ReservationResponse>>(this.apiUrl, data).pipe(map(res => res.data!));
  }

  update(id: string, data: Partial<ReservationRequest>): Observable<ReservationResponse> {
    return this.http.put<ApiResponse<ReservationResponse>>(`${this.apiUrl}/${id}`, data).pipe(map(res => res.data!));
  }

  accept(id: string, tableIds: string[], message?: string): Observable<ReservationResponse> {
    return this.http.post<ApiResponse<ReservationResponse>>(`${this.apiUrl}/${id}/accept`, { tableIds, message }).pipe(map(res => res.data!));
  }

  reject(id: string, message?: string): Observable<ReservationResponse> {
    return this.http.post<ApiResponse<ReservationResponse>>(`${this.apiUrl}/${id}/reject`, { message }).pipe(map(res => res.data!));
  }

  cancel(id: string): Observable<ReservationResponse> {
    return this.http.post<ApiResponse<ReservationResponse>>(`${this.apiUrl}/${id}/cancel`, {}).pipe(map(res => res.data!));
  }

  markNoShow(id: string): Observable<ReservationResponse> {
    return this.http.post<ApiResponse<ReservationResponse>>(`${this.apiUrl}/${id}/no-show`, {}).pipe(map(res => res.data!));
  }

  /** Party arrived: seat at one table or several (merged; first is the main table). */
  seat(id: string, tableIds: string[], force = false): Observable<ReservationResponse> {
    return this.http.post<ApiResponse<ReservationResponse>>(`${this.apiUrl}/${id}/seat`, { tableIds, force }).pipe(map(res => res.data!));
  }

  getSettings(): Observable<ReservationSettings> {
    return this.http.get<ApiResponse<ReservationSettings>>(`${this.apiUrl}/settings`).pipe(map(res => res.data!));
  }

  updateSettings(data: Partial<ReservationSettings>): Observable<ReservationSettings> {
    return this.http.put<ApiResponse<ReservationSettings>>(`${this.apiUrl}/settings`, data).pipe(map(res => res.data!));
  }

  // ── Public (restaurant website, no login) ──

  getPublicInfo(tenantId: string): Observable<PublicReservationInfo> {
    return this.http.get<ApiResponse<PublicReservationInfo>>(`${this.apiUrl}/public/${tenantId}/info`).pipe(map(res => res.data!));
  }

  request(tenantId: string, data: { customerName: string; customerMobile: string; customerEmail?: string; partySize: number; reservedFor: string; notes?: string }): Observable<PublicReservationStatus> {
    return this.http.post<ApiResponse<PublicReservationStatus>>(`${this.apiUrl}/public/${tenantId}/request`, data).pipe(map(res => res.data!));
  }

  getPublicStatus(id: string): Observable<PublicReservationStatus> {
    return this.http.get<ApiResponse<PublicReservationStatus>>(`${this.apiUrl}/public/booking/${id}`).pipe(map(res => res.data!));
  }

  cancelByCustomer(id: string): Observable<PublicReservationStatus> {
    return this.http.post<ApiResponse<PublicReservationStatus>>(`${this.apiUrl}/public/booking/${id}/cancel`, {}).pipe(map(res => res.data!));
  }

  /** Customer's booking page link (sent on WhatsApp). */
  bookingLink(id: string): string {
    return `${window.location.origin}/reservation/${id}`;
  }
}
