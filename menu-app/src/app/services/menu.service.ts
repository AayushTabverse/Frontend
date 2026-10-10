import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ApiResponse, FullMenuResponse, MenuCategory, MenuImportResult, MenuItem, MenuItemIngredient } from '../models/api.models';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class MenuService {
  private readonly apiUrl = `${environment.apiUrl}/menu`;

  constructor(private http: HttpClient) {}

  // ── Public (Customer) ──

  getMenuByTenant(tenantId: string): Observable<FullMenuResponse> {
    return this.http.get<ApiResponse<FullMenuResponse>>(`${this.apiUrl}?tenantId=${tenantId}`).pipe(
      map(res => res.data!)
    );
  }

  getMenuByTable(tableId: string): Observable<FullMenuResponse> {
    return this.http.get<ApiResponse<FullMenuResponse>>(`${this.apiUrl}/by-table/${tableId}`).pipe(
      map(res => res.data!)
    );
  }

  // ── Admin ──

  getCategories(): Observable<MenuCategory[]> {
    return this.http.get<ApiResponse<MenuCategory[]>>(`${this.apiUrl}/categories`).pipe(
      map(res => res.data!)
    );
  }

  createCategory(data: { name: string; description?: string; imageUrl?: string; sortOrder?: number }): Observable<MenuCategory> {
    return this.http.post<ApiResponse<MenuCategory>>(`${this.apiUrl}/category`, data).pipe(
      map(res => res.data!)
    );
  }

  updateCategory(id: string, data: any): Observable<MenuCategory> {
    return this.http.put<ApiResponse<MenuCategory>>(`${this.apiUrl}/category/${id}`, data).pipe(
      map(res => res.data!)
    );
  }

  deleteCategory(id: string): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/category/${id}`).pipe(
      map(() => void 0)
    );
  }

  createItem(data: any): Observable<MenuItem> {
    return this.http.post<ApiResponse<MenuItem>>(`${this.apiUrl}/item`, data).pipe(
      map(res => res.data!)
    );
  }

  updateItem(id: string, data: any): Observable<MenuItem> {
    return this.http.put<ApiResponse<MenuItem>>(`${this.apiUrl}/item/${id}`, data).pipe(
      map(res => res.data!)
    );
  }

  deleteItem(id: string): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/item/${id}`).pipe(
      map(() => void 0)
    );
  }

  // ── Ingredient Mapping ──

  getIngredients(menuItemId: string): Observable<MenuItemIngredient[]> {
    return this.http.get<ApiResponse<MenuItemIngredient[]>>(`${this.apiUrl}/item/${menuItemId}/ingredients`).pipe(
      map(res => res.data!)
    );
  }

  setIngredients(menuItemId: string, ingredients: { inventoryItemId: string; quantityUsed: number }[]): Observable<MenuItemIngredient[]> {
    return this.http.put<ApiResponse<MenuItemIngredient[]>>(`${this.apiUrl}/item/${menuItemId}/ingredients`, { ingredients }).pipe(
      map(res => res.data!)
    );
  }

  // ── Excel import ──

  downloadImportTemplate(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/import/template`, { responseType: 'blob' });
  }

  /** apply = false parses and validates only (preview); apply = true saves valid rows. */
  importMenu(file: File, updateExisting: boolean, apply: boolean): Observable<MenuImportResult> {
    const form = new FormData();
    form.append('file', file);
    const params = new HttpParams().set('updateExisting', updateExisting).set('apply', apply);
    return this.http.post<ApiResponse<MenuImportResult>>(`${this.apiUrl}/import`, form, { params }).pipe(
      map(res => res.data!)
    );
  }
}
