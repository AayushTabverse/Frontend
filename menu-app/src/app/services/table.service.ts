import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ApiResponse, TableResponse } from '../models/api.models';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class TableService {
  private readonly apiUrl = `${environment.apiUrl}/table`;

  constructor(private http: HttpClient) {}

  getTables(): Observable<TableResponse[]> {
    return this.http.get<ApiResponse<TableResponse[]>>(this.apiUrl).pipe(
      map(res => res.data!)
    );
  }

  createTable(data: { tableNumber: string; label?: string; capacity?: number }): Observable<TableResponse> {
    return this.http.post<ApiResponse<TableResponse>>(this.apiUrl, data).pipe(
      map(res => res.data!)
    );
  }

  updateTable(id: string, data: any): Observable<TableResponse> {
    return this.http.put<ApiResponse<TableResponse>>(`${this.apiUrl}/${id}`, data).pipe(
      map(res => res.data!)
    );
  }

  deleteTable(id: string): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/${id}`).pipe(
      map(() => void 0)
    );
  }

  getQrCode(id: string): string {
    return `${this.apiUrl}/${id}/qr`;
  }

  getQrCodeBlob(id: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${id}/qr`, { responseType: 'blob' });
  }

  callWaiter(tableId: string): Observable<TableResponse> {
    return this.http.post<ApiResponse<TableResponse>>(`${this.apiUrl}/${tableId}/call-waiter`, {}).pipe(
      map(res => res.data!)
    );
  }

  dismissCall(tableId: string): Observable<void> {
    return this.http.post<ApiResponse<void>>(`${this.apiUrl}/${tableId}/dismiss-call`, {}).pipe(
      map(() => void 0)
    );
  }
}
