import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject, map, tap } from 'rxjs';
import { ApiResponse, AppNotification, NotificationSummary, PaginatedNotifications } from '../models/api.models';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { SignalRService } from './signalr.service';

/**
 * Owner/manager alerts and reminders. Keeps one live summary (bell count + blinking alerts)
 * shared by the admin layout, the sidebar and the notifications page.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private static readonly FALLBACK_REFRESH_MS = 120_000;

  private readonly apiUrl = `${environment.apiUrl}/notification`;
  private summarySubject = new BehaviorSubject<NotificationSummary | null>(null);
  private newAlertSubject = new Subject<AppNotification>();
  private seenAlertIds = new Set<string>();
  private started = false;

  summary$ = this.summarySubject.asObservable();
  /** A Warning/Critical alert that wasn't showing before (for a sound). */
  newAlert$ = this.newAlertSubject.asObservable();

  constructor(private http: HttpClient, private auth: AuthService, private signalR: SignalRService) {}

  /** Starts live updates for this session. Safe to call from several places. */
  async start(): Promise<void> {
    const tenantId = this.auth.getTenantId();
    if (this.started || !tenantId || !this.auth.can('notifications')) return;
    this.started = true;

    this.refresh();
    this.signalR.notificationsChanged$.subscribe(() => this.refresh());
    this.signalR.reconnected$.subscribe(() => this.refresh());
    // In case the live connection is down for a while
    setInterval(() => { if (!document.hidden) this.refresh(); }, NotificationService.FALLBACK_REFRESH_MS);
    await this.signalR.startConnection(tenantId);
  }

  refresh(): void {
    if (!this.auth.can('notifications')) return;
    this.http.get<ApiResponse<NotificationSummary>>(`${this.apiUrl}/summary`).pipe(map(res => res.data!)).subscribe({
      next: (summary) => {
        const firstLoad = this.summarySubject.value === null;
        for (const alert of summary.activeAlerts) {
          if (!this.seenAlertIds.has(alert.id) && !firstLoad) this.newAlertSubject.next(alert);
          this.seenAlertIds.add(alert.id);
        }
        // Forget acknowledged ones so they sound again if they come back
        const active = new Set(summary.activeAlerts.map(a => a.id));
        this.seenAlertIds.forEach(id => { if (!active.has(id)) this.seenAlertIds.delete(id); });
        this.summarySubject.next(summary);
      },
      error: () => {}
    });
  }

  getNotifications(filter: 'open' | 'all', page = 1, pageSize = 30): Observable<PaginatedNotifications> {
    return this.http.get<ApiResponse<PaginatedNotifications>>(`${this.apiUrl}?filter=${filter}&page=${page}&pageSize=${pageSize}`).pipe(
      map(res => res.data!)
    );
  }

  acknowledge(id: string): Observable<void> {
    return this.http.put<ApiResponse<void>>(`${this.apiUrl}/${id}/acknowledge`, {}).pipe(
      map(() => undefined),
      tap(() => this.refresh())
    );
  }

  acknowledgeAll(): Observable<void> {
    return this.http.put<ApiResponse<void>>(`${this.apiUrl}/acknowledge-all`, {}).pipe(
      map(() => undefined),
      tap(() => this.refresh())
    );
  }
}
