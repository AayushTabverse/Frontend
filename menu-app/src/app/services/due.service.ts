import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ApiResponse, CustomerDue, CustomerDueSearchResult } from '../models/api.models';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class DueService {
  private readonly apiUrl = `${environment.apiUrl}/due`;

  constructor(private http: HttpClient) {}

  getDues(includeSettled = false): Observable<CustomerDue[]> {
    return this.http.get<ApiResponse<CustomerDue[]>>(`${this.apiUrl}?includeSettled=${includeSettled}`).pipe(
      map(res => res.data!)
    );
  }

  searchDues(query: string): Observable<CustomerDue[]> {
    return this.http.get<ApiResponse<CustomerDue[]>>(`${this.apiUrl}/search?q=${encodeURIComponent(query)}`).pipe(
      map(res => res.data!)
    );
  }

  getDuesByMobile(mobile: string): Observable<CustomerDueSearchResult> {
    return this.http.get<ApiResponse<CustomerDueSearchResult>>(`${this.apiUrl}/by-mobile/${encodeURIComponent(mobile)}`).pipe(
      map(res => res.data!)
    );
  }

  /** accountKey: where the money went (cash, upi, card…); omitted = cash. */
  settleDue(id: string, amount: number, accountKey?: string): Observable<CustomerDue> {
    return this.http.post<ApiResponse<CustomerDue>>(`${this.apiUrl}/${id}/settle`, { amount, accountKey: accountKey || undefined }).pipe(
      map(res => res.data!)
    );
  }
}
