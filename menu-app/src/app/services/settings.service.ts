import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ApiResponse, BusinessSettings } from '../models/api.models';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly apiUrl = `${environment.apiUrl}/settings`;

  constructor(private http: HttpClient) {}

  getSettings(): Observable<BusinessSettings> {
    return this.http.get<ApiResponse<BusinessSettings>>(this.apiUrl).pipe(
      map(res => res.data!)
    );
  }

  getPublicSettings(tenantId: string): Observable<BusinessSettings> {
    return this.http.get<ApiResponse<BusinessSettings>>(`${this.apiUrl}/public/${tenantId}`).pipe(
      map(res => res.data!)
    );
  }

  updateSettings(data: Partial<BusinessSettings>): Observable<BusinessSettings> {
    return this.http.put<ApiResponse<BusinessSettings>>(this.apiUrl, data).pipe(
      map(res => res.data!)
    );
  }
}
