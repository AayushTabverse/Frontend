import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import {
  ApiResponse, AttendanceStatus, CreateStaffPaymentRequest, DailyAttendance, MonthlySalary, StaffPayment
} from '../models/api.models';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class StaffService {
  private readonly apiUrl = `${environment.apiUrl}/staff`;

  constructor(private http: HttpClient) {}

  // ── Attendance ──

  getAttendance(date: string): Observable<DailyAttendance[]> {
    const params = new HttpParams().set('date', date);
    return this.http.get<ApiResponse<DailyAttendance[]>>(`${this.apiUrl}/attendance`, { params }).pipe(
      map(res => res.data!)
    );
  }

  saveAttendance(date: string, entries: { userId: string; status: AttendanceStatus | null; notes?: string }[]): Observable<DailyAttendance[]> {
    return this.http.put<ApiResponse<DailyAttendance[]>>(`${this.apiUrl}/attendance`, { date, entries }).pipe(
      map(res => res.data!)
    );
  }

  // ── Salary ──

  getMonthlySalary(year: number, month: number): Observable<MonthlySalary[]> {
    const params = new HttpParams().set('year', year).set('month', month);
    return this.http.get<ApiResponse<MonthlySalary[]>>(`${this.apiUrl}/salary`, { params }).pipe(
      map(res => res.data!)
    );
  }

  updateSalary(userId: string, monthlySalary: number): Observable<void> {
    return this.http.put<ApiResponse<void>>(`${this.apiUrl}/${userId}/salary`, { monthlySalary }).pipe(
      map(() => void 0)
    );
  }

  // ── Payments ──

  getPayments(year: number, month: number): Observable<StaffPayment[]> {
    const params = new HttpParams().set('year', year).set('month', month);
    return this.http.get<ApiResponse<StaffPayment[]>>(`${this.apiUrl}/payments`, { params }).pipe(
      map(res => res.data!)
    );
  }

  createPayment(data: CreateStaffPaymentRequest): Observable<StaffPayment> {
    return this.http.post<ApiResponse<StaffPayment>>(`${this.apiUrl}/payments`, data).pipe(
      map(res => res.data!)
    );
  }

  deletePayment(id: string): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/payments/${id}`).pipe(
      map(() => void 0)
    );
  }
}
