import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import {
  ApiResponse,
  GeneratePostRequest,
  GeneratedPost,
  MarketingPost,
  PaginatedPostsResponse,
  ContentCalendarItem,
  SocialConnection,
  ApprovePostRequest
} from '../models/api.models';
import { environment } from '../../environments/environment';

export interface OAuthUrlResponse {
  authUrl: string;
}

export interface SocialPostResult {
  success: boolean;
  facebookPostId?: string;
  instagramPostId?: string;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class AiService {
  private readonly apiUrl = `${environment.apiUrl}/ai`;
  private readonly socialUrl = `${environment.apiUrl}/social`;

  constructor(private http: HttpClient) {}

  generatePost(request: GeneratePostRequest): Observable<GeneratedPost> {
    return this.http.post<ApiResponse<GeneratedPost>>(`${this.apiUrl}/generate-post`, request).pipe(
      map(res => res.data!)
    );
  }

  generateImage(prompt: string): Observable<string> {
    return this.http.post<ApiResponse<string>>(`${this.apiUrl}/generate-image`, { prompt }).pipe(
      map(res => res.data!)
    );
  }

  approvePost(postId: string, request: ApprovePostRequest): Observable<MarketingPost> {
    return this.http.put<ApiResponse<MarketingPost>>(`${this.apiUrl}/post/${postId}/approve`, request).pipe(
      map(res => res.data!)
    );
  }

  rejectPost(postId: string): Observable<MarketingPost> {
    return this.http.put<ApiResponse<MarketingPost>>(`${this.apiUrl}/post/${postId}/reject`, {}).pipe(
      map(res => res.data!)
    );
  }

  getPostHistory(page: number = 1, pageSize: number = 20, status?: string): Observable<PaginatedPostsResponse> {
    let url = `${this.apiUrl}/post/history?page=${page}&pageSize=${pageSize}`;
    if (status) url += `&status=${status}`;
    return this.http.get<ApiResponse<PaginatedPostsResponse>>(url).pipe(
      map(res => res.data!)
    );
  }

  getContentCalendar(month: number, year: number): Observable<ContentCalendarItem[]> {
    return this.http.get<ApiResponse<ContentCalendarItem[]>>(`${this.apiUrl}/content-calendar?month=${month}&year=${year}`).pipe(
      map(res => res.data!)
    );
  }

  getSocialConnections(): Observable<SocialConnection[]> {
    return this.http.get<ApiResponse<SocialConnection[]>>(`${this.apiUrl}/social-connections`).pipe(
      map(res => res.data!)
    );
  }

  disconnectSocial(platform: string): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/social/${platform}`).pipe(
      map(() => void 0)
    );
  }

  // ── OAuth ──

  getFacebookAuthUrl(): Observable<string> {
    return this.http.get<ApiResponse<OAuthUrlResponse>>(`${this.socialUrl}/facebook/auth-url`).pipe(
      map(res => res.data!.authUrl)
    );
  }

  facebookCallback(code: string): Observable<SocialConnection> {
    return this.http.post<ApiResponse<SocialConnection>>(`${this.socialUrl}/facebook/callback`, { code }).pipe(
      map(res => res.data!)
    );
  }

  getGoogleAuthUrl(): Observable<string> {
    return this.http.get<ApiResponse<OAuthUrlResponse>>(`${this.socialUrl}/google/auth-url`).pipe(
      map(res => res.data!.authUrl)
    );
  }

  googleCallback(code: string): Observable<SocialConnection> {
    return this.http.post<ApiResponse<SocialConnection>>(`${this.socialUrl}/google/callback`, { code }).pipe(
      map(res => res.data!)
    );
  }

  publishPost(postId: string): Observable<SocialPostResult> {
    return this.http.post<ApiResponse<SocialPostResult>>(`${this.socialUrl}/publish/${postId}`, {}).pipe(
      map(res => res.data!)
    );
  }
}
