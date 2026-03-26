import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ApiResponse } from '../models/api.models';
import { environment } from '../../environments/environment';

export interface CustomerSearchResult {
  customerName: string;
  customerMobile: string;
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
}
