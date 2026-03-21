import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, map } from 'rxjs';
import { ApiResponse, AuthResponse, LoginRequest, RegisterTenantRequest, ForgotPasswordResponse, RegisterUserRequest, StaffResponse } from '../models/api.models';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = `${environment.apiUrl}/auth`;
  private currentUserSubject = new BehaviorSubject<AuthResponse | null>(null);
  currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {
    const stored = localStorage.getItem('auth');
    if (stored) {
      const auth: AuthResponse = JSON.parse(stored);
      if (new Date(auth.expiresAt) > new Date()) {
        this.currentUserSubject.next(auth);
      } else {
        localStorage.removeItem('auth');
      }
    }
  }

  login(request: LoginRequest): Observable<AuthResponse> {
    return this.http.post<ApiResponse<AuthResponse>>(`${this.apiUrl}/login`, request).pipe(
      map(res => res.data!),
      tap(auth => this.storeAuth(auth))
    );
  }

  registerTenant(request: RegisterTenantRequest): Observable<AuthResponse> {
    return this.http.post<ApiResponse<AuthResponse>>(`${this.apiUrl}/register-tenant`, request).pipe(
      map(res => res.data!),
      tap(auth => this.storeAuth(auth))
    );
  }

  logout(): void {
    localStorage.removeItem('auth');
    this.currentUserSubject.next(null);
  }

  getToken(): string | null {
    return this.currentUserSubject.value?.token ?? null;
  }

  getTenantId(): string | null {
    return this.currentUserSubject.value?.tenantId ?? null;
  }

  getRole(): string | null {
    return this.currentUserSubject.value?.role ?? null;
  }

  isLoggedIn(): boolean {
    const auth = this.currentUserSubject.value;
    return !!auth && new Date(auth.expiresAt) > new Date();
  }

  isAdmin(): boolean {
    const role = this.getRole();
    return role === 'RestaurantAdmin' || role === 'SuperAdmin';
  }

  forgotPassword(email: string): Observable<ForgotPasswordResponse> {
    return this.http.post<ApiResponse<ForgotPasswordResponse>>(`${this.apiUrl}/forgot-password`, { email }).pipe(
      map(res => res.data!)
    );
  }

  registerUser(request: RegisterUserRequest): Observable<AuthResponse> {
    return this.http.post<ApiResponse<AuthResponse>>(`${this.apiUrl}/register-user`, request).pipe(
      map(res => res.data!)
    );
  }

  getStaff(): Observable<StaffResponse[]> {
    return this.http.get<ApiResponse<StaffResponse[]>>(`${this.apiUrl}/staff`).pipe(
      map(res => res.data!)
    );
  }

  toggleUserActive(userId: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/staff/${userId}/toggle-active`, {});
  }

  deleteUser(userId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/staff/${userId}`);
  }

  private storeAuth(auth: AuthResponse): void {
    localStorage.setItem('auth', JSON.stringify(auth));
    this.currentUserSubject.next(auth);
  }
}
