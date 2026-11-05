import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { AlertTriangle, BellRing, LucideAngularModule, OctagonAlert } from 'lucide-angular';
import { AppNotification } from '../../../models/api.models';
import { NotificationService } from '../../../services/notification.service';

/**
 * Blinking strip at the top of management screens for unacknowledged Warning/Critical alerts
 * (low/out of stock, restock reminders). Stays until someone acknowledges each alert.
 */
@Component({
  selector: 'app-alert-banner',
  standalone: true,
  imports: [CommonModule, RouterModule, LucideAngularModule],
  templateUrl: './alert-banner.component.html',
  styleUrl: './alert-banner.component.scss'
})
export class AlertBannerComponent implements OnInit, OnDestroy {
  readonly icons = { AlertTriangle, BellRing, OctagonAlert };

  alerts: AppNotification[] = [];
  acknowledging = false;

  private notifications = inject(NotificationService);
  private router = inject(Router);
  private subs: Subscription[] = [];
  private baseTitle = document.title;

  get top(): AppNotification | null {
    return this.alerts[0] ?? null;
  }

  get isCritical(): boolean {
    return this.top?.severity === 'Critical';
  }

  ngOnInit(): void {
    this.notifications.start();
    this.subs.push(
      this.notifications.summary$.subscribe(s => {
        this.alerts = s?.activeAlerts ?? [];
        this.updateTitle();
      }),
      this.notifications.newAlert$.subscribe(a => this.beep(a.severity === 'Critical' ? 3 : 2))
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    document.title = this.baseTitle;
  }

  open(alert: AppNotification): void {
    this.router.navigateByUrl(alert.link || '/admin/notifications');
  }

  acknowledge(alert: AppNotification): void {
    this.acknowledging = true;
    this.notifications.acknowledge(alert.id).subscribe({
      next: () => this.acknowledging = false,
      error: () => this.acknowledging = false
    });
  }

  /** Background tabs still show there is something to look at. */
  private updateTitle(): void {
    document.title = this.alerts.length ? `(${this.alerts.length}) ⚠ ${this.baseTitle}` : this.baseTitle;
  }

  private beep(times: number): void {
    try {
      const ctx = new AudioContext();
      for (let i = 0; i < times; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 740;
        gain.gain.value = 0.15;
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.25);
        osc.stop(ctx.currentTime + i * 0.25 + 0.14);
      }
    } catch { /* autoplay blocked until the user interacts with the page */ }
  }
}
