import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AppNotification } from '../../models/api.models';
import { NotificationService } from '../../services/notification.service';

/** All alerts and reminders for the owner/manager: open ones to deal with, and the history. */
@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.scss'
})
export class NotificationsComponent implements OnInit, OnDestroy {
  private static readonly PAGE_SIZE = 30;

  filter: 'open' | 'all' = 'open';
  items: AppNotification[] = [];
  totalCount = 0;
  page = 1;
  loading = true;
  busy = false;
  errorMessage = '';

  private sub?: Subscription;

  constructor(private notifications: NotificationService, private router: Router) {}

  ngOnInit(): void {
    this.load();
    // The shared summary updates live; reload the list along with it
    this.sub = this.notifications.summary$.subscribe(() => { if (!this.loading) this.load(true); });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  setFilter(filter: 'open' | 'all'): void {
    if (this.filter === filter) return;
    this.filter = filter;
    this.page = 1;
    this.load();
  }

  load(background = false): void {
    if (!background) this.loading = true;
    this.notifications.getNotifications(this.filter, this.page, NotificationsComponent.PAGE_SIZE).subscribe({
      next: (res) => {
        this.items = res.items;
        this.totalCount = res.totalCount;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'Could not load notifications.';
      }
    });
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalCount / NotificationsComponent.PAGE_SIZE));
  }

  goToPage(page: number): void {
    this.page = page;
    this.load();
  }

  acknowledge(n: AppNotification, event?: Event): void {
    event?.stopPropagation();
    this.busy = true;
    this.notifications.acknowledge(n.id).subscribe({
      next: () => this.busy = false,
      error: () => { this.busy = false; this.errorMessage = 'Could not acknowledge. Try again.'; }
    });
  }

  acknowledgeAll(): void {
    this.busy = true;
    this.notifications.acknowledgeAll().subscribe({
      next: () => this.busy = false,
      error: () => { this.busy = false; this.errorMessage = 'Could not acknowledge. Try again.'; }
    });
  }

  open(n: AppNotification): void {
    if (n.link) this.router.navigateByUrl(n.link);
  }

  icon(n: AppNotification): string {
    switch (n.type) {
      case 'OutOfStock': return '⛔';
      case 'LowStock': return '📉';
      case 'StockReminder': return '📦';
      case 'ReservationRequest': return '📅';
      default: return n.severity === 'Critical' ? '🚨' : '🔔';
    }
  }

  /** What happened to a closed notification. */
  closedLabel(n: AppNotification): string {
    if (n.resolvedAt && n.acknowledgedBy && n.acknowledgedAt === n.resolvedAt) return n.acknowledgedBy;
    return n.acknowledgedBy ? `Acknowledged by ${n.acknowledgedBy}` : 'Acknowledged';
  }
}
