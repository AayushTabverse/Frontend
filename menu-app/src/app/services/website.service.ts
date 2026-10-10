import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import {
  ApiResponse, WebsiteContent, UpdateWebsiteContent,
  SubdomainSuggestionsResponse, CheckSubdomainResponse,
  SubdomainResponse, ClaimSubdomainRequest, WebsiteStatus, CustomDomainStatus
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

  /** Website status from facts (DNS outcome, address resolves, site responds). refresh skips the ~15s cache. */
  getWebsiteStatus(refresh = false): Observable<WebsiteStatus> {
    return this.http.get<WebsiteStatus>(`${this.subdomainUrl}/status`, { params: { refresh } });
  }

  /** Choose the subdomain and publish the website in one step. */
  publishWebsite(subdomain: string): Observable<WebsiteStatus> {
    return this.http.post<WebsiteStatus>(`${this.subdomainUrl}/publish`, { subdomain });
  }

  /** Re-run the DNS step after a failure. */
  retryDns(): Observable<WebsiteStatus> {
    return this.http.post<WebsiteStatus>(`${this.subdomainUrl}/retry-dns`, {});
  }

  /** Release the current subdomain. */
  releaseSubdomain(): Observable<SubdomainResponse> {
    return this.http.delete<SubdomainResponse>(`${this.subdomainUrl}/release`);
  }

  /** Get the current tenant's subdomain info. */
  getCurrentSubdomain(): Observable<SubdomainResponse> {
    return this.http.get<SubdomainResponse>(`${this.subdomainUrl}/current`);
  }

  /** Resolve a restaurant website host (name.tabverse.in or a verified own domain) to its tenantId (public). */
  resolveHost(host: string): Observable<{ tenantId: string; host: string }> {
    return this.http.get<{ tenantId: string; host: string }>(`${this.apiUrl}/resolve-host/${encodeURIComponent(host)}`);
  }

  // ── Bring-your-own domain ──

  getCustomDomainStatus(refresh = false): Observable<CustomDomainStatus> {
    return this.http.get<CustomDomainStatus>(`${environment.apiUrl}/custom-domain/status`, { params: { refresh } });
  }

  connectCustomDomain(domain: string): Observable<CustomDomainStatus> {
    return this.http.put<CustomDomainStatus>(`${environment.apiUrl}/custom-domain`, { domain });
  }

  removeCustomDomain(): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${environment.apiUrl}/custom-domain`);
  }

  /** Resolve a subdomain to a tenantId (public). */
  resolveSubdomain(subdomain: string): Observable<{ tenantId: string; subdomain: string; fullDomain: string }> {
    return this.http.get<{ tenantId: string; subdomain: string; fullDomain: string }>(
      `${this.subdomainUrl}/resolve/${subdomain}`
    );
  }
}
