import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ApiResponse, DashboardSummary, TopItem, SalesData, PeakHour } from '../models/api.models';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly apiUrl = `${environment.apiUrl}/analytics`;

  constructor(private http: HttpClient) {}

  getDashboard(): Observable<DashboardSummary> {
    return this.http.get<ApiResponse<DashboardSummary>>(`${this.apiUrl}/dashboard`).pipe(
      map(res => res.data!)
    );
  }

  getTopItems(count: number = 10, days: number = 30): Observable<TopItem[]> {
    return this.http.get<ApiResponse<TopItem[]>>(`${this.apiUrl}/top-items?count=${count}&days=${days}`).pipe(
      map(res => res.data!)
    );
  }

  getSales(from: string, to: string): Observable<SalesData[]> {
    return this.http.get<ApiResponse<SalesData[]>>(`${this.apiUrl}/sales?from=${from}&to=${to}`).pipe(
      map(res => res.data!)
    );
  }

  getPeakHours(days: number = 7): Observable<PeakHour[]> {
    return this.http.get<ApiResponse<PeakHour[]>>(`${this.apiUrl}/peak-hours?days=${days}`).pipe(
      map(res => res.data!)
    );
  }
}
