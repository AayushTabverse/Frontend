import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import {
  ApiResponse,
  GoogleReview,
  PaginatedReviewsResponse,
  ReviewAnalytics
} from '../models/api.models';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ReviewService {
  private readonly apiUrl = `${environment.apiUrl}/reviews`;

  constructor(private http: HttpClient) {}

  getReviews(page: number = 1, pageSize: number = 20, sentiment?: string): Observable<PaginatedReviewsResponse> {
    let url = `${this.apiUrl}?page=${page}&pageSize=${pageSize}`;
    if (sentiment) url += `&sentiment=${sentiment}`;
    return this.http.get<ApiResponse<PaginatedReviewsResponse>>(url).pipe(
      map(res => res.data!)
    );
  }

  getReviewAnalytics(): Observable<ReviewAnalytics> {
    return this.http.get<ApiResponse<ReviewAnalytics>>(`${this.apiUrl}/analytics`).pipe(
      map(res => res.data!)
    );
  }

  generateReply(reviewId: string): Observable<string> {
    return this.http.post<ApiResponse<{ replyText: string }>>(`${this.apiUrl}/${reviewId}/generate-reply`, {}).pipe(
      map(res => res.data!.replyText)
    );
  }

  postReply(reviewId: string, replyText: string): Observable<GoogleReview> {
    return this.http.post<ApiResponse<GoogleReview>>(`${this.apiUrl}/${reviewId}/reply`, { replyText }).pipe(
      map(res => res.data!)
    );
  }
}
