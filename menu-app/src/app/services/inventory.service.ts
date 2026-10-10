import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ApiResponse, ImportResult, InventoryAnalytics, InventoryImportRow, InventoryItem, InventoryLog, InventorySummary } from '../models/api.models';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly apiUrl = `${environment.apiUrl}/inventory`;

  constructor(private http: HttpClient) {}

  getItems(category?: string, lowStockOnly?: boolean): Observable<InventoryItem[]> {
    let params = new HttpParams();
    if (category) params = params.set('category', category);
    if (lowStockOnly) params = params.set('lowStockOnly', 'true');
    return this.http.get<ApiResponse<InventoryItem[]>>(this.apiUrl, { params }).pipe(
      map(res => res.data!)
    );
  }

  getItem(id: string): Observable<InventoryItem> {
    return this.http.get<ApiResponse<InventoryItem>>(`${this.apiUrl}/${id}`).pipe(
      map(res => res.data!)
    );
  }

  createItem(data: any): Observable<InventoryItem> {
    return this.http.post<ApiResponse<InventoryItem>>(this.apiUrl, data).pipe(
      map(res => res.data!)
    );
  }

  updateItem(id: string, data: any): Observable<InventoryItem> {
    return this.http.put<ApiResponse<InventoryItem>>(`${this.apiUrl}/${id}`, data).pipe(
      map(res => res.data!)
    );
  }

  deleteItem(id: string): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/${id}`).pipe(
      map(() => void 0)
    );
  }

  adjustQuantity(id: string, data: { quantity: number; changeType: string; notes?: string }): Observable<InventoryItem> {
    return this.http.post<ApiResponse<InventoryItem>>(`${this.apiUrl}/${id}/adjust`, data).pipe(
      map(res => res.data!)
    );
  }

  getLogs(itemId?: string, days?: number): Observable<InventoryLog[]> {
    let params = new HttpParams();
    if (itemId) params = params.set('itemId', itemId);
    if (days) params = params.set('days', days.toString());
    return this.http.get<ApiResponse<InventoryLog[]>>(`${this.apiUrl}/logs`, { params }).pipe(
      map(res => res.data!)
    );
  }

  getSummary(): Observable<InventorySummary> {
    return this.http.get<ApiResponse<InventorySummary>>(`${this.apiUrl}/summary`).pipe(
      map(res => res.data!)
    );
  }

  getCategories(): Observable<string[]> {
    return this.http.get<ApiResponse<string[]>>(`${this.apiUrl}/categories`).pipe(
      map(res => res.data!)
    );
  }

  // ── Excel import ──

  downloadImportTemplate(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/import/template`, { responseType: 'blob' });
  }

  /** apply = false parses and validates only (preview); apply = true saves valid rows. */
  importItems(file: File, updateExisting: boolean, apply: boolean): Observable<ImportResult<InventoryImportRow>> {
    const form = new FormData();
    form.append('file', file);
    const params = new HttpParams().set('updateExisting', updateExisting).set('apply', apply);
    return this.http.post<ApiResponse<ImportResult<InventoryImportRow>>>(`${this.apiUrl}/import`, form, { params }).pipe(
      map(res => res.data!)
    );
  }

  /** Stock health now + usage, waste and restocks over the last N days. */
  getAnalytics(days: number): Observable<InventoryAnalytics> {
    return this.http.get<ApiResponse<InventoryAnalytics>>(`${this.apiUrl}/analytics`, { params: { days } }).pipe(map(res => res.data!));
  }
}
