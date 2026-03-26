import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ApiResponse, OrderResponse, LiveOrdersResponse, CreateOrderRequest, ClearTableRequest, TableSessionSummary, PaginatedBillsResponse } from '../models/api.models';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly apiUrl = `${environment.apiUrl}/order`;

  constructor(private http: HttpClient) {}

  createOrder(request: CreateOrderRequest, tenantId: string): Observable<OrderResponse> {
    return this.http.post<ApiResponse<OrderResponse>>(`${this.apiUrl}?tenantId=${tenantId}`, request).pipe(
      map(res => res.data!)
    );
  }

  getOrder(id: string): Observable<OrderResponse> {
    return this.http.get<ApiResponse<OrderResponse>>(`${this.apiUrl}/${id}`).pipe(
      map(res => res.data!)
    );
  }

  getLiveOrders(): Observable<LiveOrdersResponse> {
    return this.http.get<ApiResponse<LiveOrdersResponse>>(`${this.apiUrl}/live`).pipe(
      map(res => res.data!)
    );
  }

  getKitchenOrders(): Observable<LiveOrdersResponse> {
    return this.http.get<ApiResponse<LiveOrdersResponse>>(`${this.apiUrl}/kitchen`).pipe(
      map(res => res.data!)
    );
  }

  updateOrderStatus(id: string, status: string, estimatedMinutes?: number): Observable<OrderResponse> {
    return this.http.put<ApiResponse<OrderResponse>>(`${this.apiUrl}/status/${id}`, {
      status,
      estimatedMinutes
    }).pipe(map(res => res.data!));
  }

  getOrdersByTable(tableId: string): Observable<OrderResponse[]> {
    return this.http.get<ApiResponse<OrderResponse[]>>(`${this.apiUrl}/by-table/${tableId}`).pipe(
      map(res => res.data!)
    );
  }

  trackOrder(orderNumber: string): Observable<OrderResponse> {
    return this.http.get<ApiResponse<OrderResponse>>(`${this.apiUrl}/track/${orderNumber}`).pipe(
      map(res => res.data!)
    );
  }

  getTableSession(tableId: string): Observable<TableSessionSummary> {
    return this.http.get<ApiResponse<TableSessionSummary>>(`${this.apiUrl}/table-session/${tableId}`).pipe(
      map(res => res.data!)
    );
  }

  clearTable(tableId: string, request: ClearTableRequest): Observable<TableSessionSummary> {
    return this.http.post<ApiResponse<TableSessionSummary>>(`${this.apiUrl}/clear-table/${tableId}`, request).pipe(
      map(res => res.data!)
    );
  }

  getOrderHistory(from: string, to: string): Observable<OrderResponse[]> {
    return this.http.get<ApiResponse<OrderResponse[]>>(`${this.apiUrl}/history?from=${from}&to=${to}`).pipe(
      map(res => res.data!)
    );
  }

  getBills(from: string, to: string, page: number, pageSize: number): Observable<PaginatedBillsResponse> {
    return this.http.get<ApiResponse<PaginatedBillsResponse>>(
      `${this.apiUrl}/bills?from=${from}&to=${to}&page=${page}&pageSize=${pageSize}`
    ).pipe(map(res => res.data!));
  }

  cancelOrderItem(orderId: string, itemId: string): Observable<OrderResponse> {
    return this.http.delete<ApiResponse<OrderResponse>>(`${this.apiUrl}/${orderId}/items/${itemId}`).pipe(
      map(res => res.data!)
    );
  }

  getOrderHistoryDownloadUrl(from: string, to: string): string {
    return `${this.apiUrl}/history/download?from=${from}&to=${to}`;
  }
}
