import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import {
  ApiResponse, CheckInRequest, CheckOutResponse, ClearTableRequest, FolioResponse, OrderResponse,
  PublicRoomResponse, RoomRequest, RoomResponse, StayResponse, TableSessionSummary
} from '../models/api.models';
import { environment } from '../../environments/environment';

/** Hotel rooms, guest stays (check-in/out, room bills) and room service delivery. */
@Injectable({ providedIn: 'root' })
export class HotelService {
  private readonly apiUrl = `${environment.apiUrl}/room`;

  constructor(private http: HttpClient) {}

  getRooms(): Observable<RoomResponse[]> {
    return this.http.get<ApiResponse<RoomResponse[]>>(this.apiUrl).pipe(map(res => res.data!));
  }

  createRoom(data: RoomRequest): Observable<RoomResponse> {
    return this.http.post<ApiResponse<RoomResponse>>(this.apiUrl, data).pipe(map(res => res.data!));
  }

  updateRoom(id: string, data: RoomRequest): Observable<RoomResponse> {
    return this.http.put<ApiResponse<RoomResponse>>(`${this.apiUrl}/${id}`, data).pipe(map(res => res.data!));
  }

  deleteRoom(id: string): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/${id}`).pipe(map(() => void 0));
  }

  getRoomQrBlob(id: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${id}/qr`, { responseType: 'blob' });
  }

  checkIn(roomId: string, data: CheckInRequest): Observable<StayResponse> {
    return this.http.post<ApiResponse<StayResponse>>(`${this.apiUrl}/${roomId}/check-in`, data).pipe(map(res => res.data!));
  }

  getFolio(stayId: string): Observable<FolioResponse> {
    return this.http.get<ApiResponse<FolioResponse>>(`${this.apiUrl}/stays/${stayId}/folio`).pipe(map(res => res.data!));
  }

  checkOut(stayId: string, data: ClearTableRequest): Observable<CheckOutResponse> {
    return this.http.post<ApiResponse<CheckOutResponse>>(`${this.apiUrl}/stays/${stayId}/check-out`, data).pipe(map(res => res.data!));
  }

  getPublicRoom(roomId: string): Observable<PublicRoomResponse> {
    return this.http.get<ApiResponse<PublicRoomResponse>>(`${this.apiUrl}/public/${roomId}`).pipe(map(res => res.data!));
  }

  getServiceQueue(): Observable<OrderResponse[]> {
    return this.http.get<ApiResponse<OrderResponse[]>>(`${this.apiUrl}/service-queue`).pipe(map(res => res.data!));
  }

  dispatch(orderId: string): Observable<OrderResponse> {
    return this.http.post<ApiResponse<OrderResponse>>(`${this.apiUrl}/orders/${orderId}/dispatch`, {}).pipe(map(res => res.data!));
  }

  deliver(orderId: string): Observable<OrderResponse> {
    return this.http.post<ApiResponse<OrderResponse>>(`${this.apiUrl}/orders/${orderId}/deliver`, {}).pipe(map(res => res.data!));
  }

  /** Attendant collected payment on delivery. */
  /** accountKey: where the money went (cash, upi, card…); empty = cash. */
  settleOnDelivery(orderId: string, amount: number, accountKey: string): Observable<TableSessionSummary> {
    const request: ClearTableRequest = {
      orderIds: [orderId], discountAmount: 0, paidAmount: amount,
      payments: accountKey ? [{ accountKey, amount }] : undefined
    };
    return this.http.post<ApiResponse<TableSessionSummary>>(`${this.apiUrl}/orders/settle`, request).pipe(map(res => res.data!));
  }
}
