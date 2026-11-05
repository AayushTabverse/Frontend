import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ApiResponse, CustomerList, CustomerListItem, LoyaltyLookup, LoyaltyTransaction } from '../models/api.models';
import { environment } from '../../environments/environment';

export interface CustomerSearchResult {
  customerName: string;
  customerMobile: string;
  pointsBalance?: number;
}

@Injectable({ providedIn: 'root' })
export class CustomerService {
  private readonly apiUrl = `${environment.apiUrl}/customer`;

  constructor(private http: HttpClient) {}

  search(query: string): Observable<CustomerSearchResult[]> {
    return this.http.get<ApiResponse<CustomerSearchResult[]>>(
      `${this.apiUrl}/search?q=${encodeURIComponent(query)}`
    ).pipe(map(res => res.data!));
  }

  /** Bill screen: points and redemption rules for this mobile number. */
  loyalty(mobile: string): Observable<LoyaltyLookup> {
    return this.http.get<ApiResponse<LoyaltyLookup>>(`${this.apiUrl}/loyalty?mobile=${encodeURIComponent(mobile)}`).pipe(map(res => res.data!));
  }

  list(q: string, sort: string, page: number, pageSize = 30): Observable<CustomerList> {
    const params = `q=${encodeURIComponent(q)}&sort=${sort}&page=${page}&pageSize=${pageSize}`;
    return this.http.get<ApiResponse<CustomerList>>(`${this.apiUrl}?${params}`).pipe(map(res => res.data!));
  }

  ledger(id: string): Observable<LoyaltyTransaction[]> {
    return this.http.get<ApiResponse<LoyaltyTransaction[]>>(`${this.apiUrl}/${id}/ledger`).pipe(map(res => res.data!));
  }

  adjustPoints(id: string, points: number, reason: string): Observable<number> {
    return this.http.post<ApiResponse<number>>(`${this.apiUrl}/${id}/adjust-points`, { points, reason }).pipe(map(res => res.data!));
  }

  update(id: string, customerName: string, dateOfBirth?: string): Observable<CustomerListItem> {
    return this.http.put<ApiResponse<CustomerListItem>>(`${this.apiUrl}/${id}`, { customerName, dateOfBirth: dateOfBirth || null }).pipe(map(res => res.data!));
  }

  exportCsv(q: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/export?q=${encodeURIComponent(q)}`, { responseType: 'blob' });
  }
}
