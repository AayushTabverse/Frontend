import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { WaitlistService } from '../../services/waitlist.service';
import { SignalRService } from '../../services/signalr.service';
import { PublicWaitlistStatus } from '../../models/api.models';
import { TableBoardComponent } from '../../shared/components/table-board/table-board.component';
import { LanguageSwitcherComponent } from '../../shared/components/language-switcher/language-switcher.component';

/** Customer's live place in line. Opened from the WhatsApp link or right after self check-in. */
@Component({
  selector: 'app-waitlist-status',
  standalone: true,
  imports: [CommonModule, TableBoardComponent, TranslocoDirective, LanguageSwitcherComponent],
  templateUrl: './waitlist-status.component.html',
  styleUrl: './waitlist-status.component.scss'
})
export class WaitlistStatusComponent implements OnInit, OnDestroy {
  entryId = '';
  status: PublicWaitlistStatus | null = null;
  loading = true;
  notFound = false;
  leaving = false;
  confirmLeave = false;
  errorMessage = '';

  private subs: Subscription[] = [];
  private poller?: ReturnType<typeof setInterval>;
  private realtimeStarted = false;

  constructor(
    private route: ActivatedRoute,
    private waitlistService: WaitlistService,
    private signalR: SignalRService,
    private transloco: TranslocoService
  ) {}

  ngOnInit(): void {
    this.entryId = this.route.snapshot.paramMap.get('entryId') || '';
    this.load();
    // Fallback in case the live connection drops (phones sleep a lot in a queue)
    this.poller = setInterval(() => this.load(), 30_000);
    document.addEventListener('visibilitychange', this.onVisible);
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    clearInterval(this.poller);
    document.removeEventListener('visibilitychange', this.onVisible);
  }

  private onVisible = (): void => {
    if (document.visibilityState === 'visible') this.load();
  };

  load(): void {
    this.waitlistService.getPublicStatus(this.entryId).subscribe({
      next: (s) => {
        const wasWaiting = this.status?.status === 'Waiting';
        this.status = s;
        this.loading = false;
        this.remember(s);
        if (wasWaiting && s.status === 'Notified') this.alertTableReady();
        if (!this.isOpen) clearInterval(this.poller);
        this.startRealtime(s.tenantId);
      },
      error: () => { this.loading = false; this.notFound = true; }
    });
  }

  get isOpen(): boolean {
    return this.status?.status === 'Waiting' || this.status?.status === 'Notified';
  }

  get positionLabel(): string {
    const p = this.status?.position ?? 0;
    if (p <= 1) return this.transloco.translate('waitlistStatus.position.next');
    if (this.transloco.getActiveLang() !== 'en') return this.transloco.translate('waitlistStatus.position.inLine', { n: p });
    const s = ['th', 'st', 'nd', 'rd'];
    const v = p % 100;
    return this.transloco.translate('waitlistStatus.position.inLine', { n: `${p}${s[(v - 20) % 10] || s[v] || s[0]}` });
  }

  get waitLabel(): string {
    const m = this.status?.estimatedWaitMinutes ?? 0;
    if (m <= 0) return this.transloco.translate('waitlistStatus.wait.anyMinute');
    if (m < 60) return this.transloco.translate('waitlistStatus.wait.minutes', { minutes: m });
    return m % 60
      ? this.transloco.translate('waitlistStatus.wait.hoursMinutes', { hours: Math.floor(m / 60), minutes: m % 60 })
      : this.transloco.translate('waitlistStatus.wait.hours', { hours: Math.floor(m / 60) });
  }

  leave(): void {
    this.leaving = true;
    this.waitlistService.leave(this.entryId).subscribe({
      next: (s) => { this.status = s; this.leaving = false; this.confirmLeave = false; },
      error: (err) => {
        this.leaving = false;
        this.confirmLeave = false;
        this.errorMessage = err.error?.message || this.transloco.translate('waitlistStatus.errors.leaveFailed');
        this.load();
      }
    });
  }

  private async startRealtime(tenantId: string): Promise<void> {
    if (this.realtimeStarted || !this.isOpen) return;
    this.realtimeStarted = true;
    await this.signalR.connectPublic();
    await this.signalR.followWaitlistEntry(this.entryId, tenantId);
    this.subs.push(
      this.signalR.waitlistEntryUpdated$.subscribe(id => { if (id === this.entryId) this.load(); }),
      this.signalR.waitlistQueueChanged$.subscribe(() => { if (this.isOpen) this.load(); }),
      this.signalR.tableBoardChanged$.subscribe(() => { if (this.isOpen && this.status?.tables) this.load(); }),
      // Updates sent while the phone was offline are lost; catch up once the connection is back
      this.signalR.reconnected$.subscribe(() => { if (this.isOpen) this.load(); })
    );
  }

  private alertTableReady(): void {
    try { navigator.vibrate?.([300, 150, 300, 150, 300]); } catch { /* not supported */ }
    try {
      const ctx = new AudioContext();
      [0, 0.25].forEach(offset => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 880;
        gain.gain.value = 0.2;
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + offset);
        osc.stop(ctx.currentTime + offset + 0.15);
      });
    } catch { /* autoplay blocked */ }
  }

  /** Lets the check-in page send a returning customer straight back here. */
  private remember(s: PublicWaitlistStatus): void {
    try { localStorage.setItem(`waitlist-entry-${s.tenantId}`, s.id); } catch { /* private mode */ }
  }
}
