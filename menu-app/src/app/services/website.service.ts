import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import {
  ApiResponse, WebsiteContent, UpdateWebsiteContent,
  SubdomainSuggestionsResponse, CheckSubdomainResponse,
  SubdomainResponse, ClaimSubdomainRequest
} from '../models/api.models';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class WebsiteService {
  private readonly apiUrl = `${environment.apiUrl}/website`;
  private readonly subdomainUrl = `${environment.apiUrl}/subdomain`;

  constructor(private http: HttpClient) {}

  /** Get website content for current tenant (admin, authenticated). */
  getWebsiteContent(): Observable<WebsiteContent> {
    return this.http.get<ApiResponse<WebsiteContent>>(this.apiUrl).pipe(
      map(res => res.data!)
    );
  }

  /** Get website content by tenantId (public, no auth). */
  getPublicWebsiteContent(tenantId: string): Observable<WebsiteContent> {
    return this.http.get<ApiResponse<WebsiteContent>>(`${this.apiUrl}/public/${tenantId}`).pipe(
      map(res => res.data!)
    );
  }

  /** Update website content for current tenant (admin). */
  updateWebsiteContent(data: UpdateWebsiteContent): Observable<WebsiteContent> {
    return this.http.put<ApiResponse<WebsiteContent>>(this.apiUrl, data).pipe(
      map(res => res.data!)
    );
  }

  // ── Subdomain Management ──

  /** Get subdomain suggestions based on restaurant name. */
  getSubdomainSuggestions(): Observable<SubdomainSuggestionsResponse> {
    return this.http.get<SubdomainSuggestionsResponse>(`${this.subdomainUrl}/suggestions`);
  }

  /** Check if a subdomain is available. */
  checkSubdomainAvailability(subdomain: string): Observable<CheckSubdomainResponse> {
    return this.http.get<CheckSubdomainResponse>(`${this.subdomainUrl}/check/${subdomain}`);
  }

  /** Claim a subdomain and create DNS record. */
  claimSubdomain(subdomain: string): Observable<SubdomainResponse> {
    const body: ClaimSubdomainRequest = { subdomain };
    return this.http.post<SubdomainResponse>(`${this.subdomainUrl}/claim`, body);
  }

  /** Release the current subdomain. */
  releaseSubdomain(): Observable<SubdomainResponse> {
    return this.http.delete<SubdomainResponse>(`${this.subdomainUrl}/release`);
  }

  /** Get the current tenant's subdomain info. */
  getCurrentSubdomain(): Observable<SubdomainResponse> {
    return this.http.get<SubdomainResponse>(`${this.subdomainUrl}/current`);
  }
}
