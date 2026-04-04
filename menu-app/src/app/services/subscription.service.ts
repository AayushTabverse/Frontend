import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, map } from 'rxjs';
import {
  ApiResponse,
  SubscriptionStatusResponse,
  SubscriptionPlanDto,
  CreateRazorpaySubscriptionRequest,
  CreateRazorpaySubscriptionResponse,
  VerifyPaymentRequest
} from '../models/api.models';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  private readonly apiUrl = `${environment.apiUrl}/subscription`;
  private statusSubject = new BehaviorSubject<SubscriptionStatusResponse | null>(null);
  status$ = this.statusSubject.asObservable();

  constructor(private http: HttpClient) {}

  getStatus(): Observable<SubscriptionStatusResponse> {
    return this.http.get<ApiResponse<SubscriptionStatusResponse>>(`${this.apiUrl}/status`).pipe(
      map(res => res.data!),
      tap(status => this.statusSubject.next(status))
    );
  }

  getPlans(): Observable<SubscriptionPlanDto[]> {
    return this.http.get<ApiResponse<SubscriptionPlanDto[]>>(`${this.apiUrl}/plans`).pipe(
      map(res => res.data!)
    );
  }

  createSubscription(request: CreateRazorpaySubscriptionRequest): Observable<CreateRazorpaySubscriptionResponse> {
    return this.http.post<ApiResponse<CreateRazorpaySubscriptionResponse>>(`${this.apiUrl}/create-subscription`, request).pipe(
      map(res => res.data!)
    );
  }

  verifyPayment(request: VerifyPaymentRequest): Observable<SubscriptionStatusResponse> {
    return this.http.post<ApiResponse<SubscriptionStatusResponse>>(`${this.apiUrl}/verify-payment`, request).pipe(
      map(res => res.data!),
      tap(status => this.statusSubject.next(status))
    );
  }

  getCachedStatus(): SubscriptionStatusResponse | null {
    return this.statusSubject.value;
  }

  hasFeature(feature: string): boolean {
    const status = this.statusSubject.value;
    if (!status) return true; // Allow until status is loaded
    if (status.isTrialActive) return true; // Full access during trial
    return status.availableFeatures.includes(feature);
  }

  requiresSubscription(): boolean {
    const status = this.statusSubject.value;
    if (!status) return false;
    return status.requiresSubscription;
  }
}
