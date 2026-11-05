import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { ReservationService } from '../../services/reservation.service';
import { SignalRService } from '../../services/signalr.service';
import { PublicReservationStatus } from '../../models/api.models';
import { LanguageSwitcherComponent } from '../../shared/components/language-switcher/language-switcher.component';

/** Customer's booking page: shows whether the restaurant accepted, and lets them cancel. */
@Component({
  selector: 'app-reservation-status',
  standalone: true,
  imports: [CommonModule, TranslocoDirective, LanguageSwitcherComponent],
  templateUrl: './reservation-status.component.html',
  styleUrl: './reservation-status.component.scss'
})
export class ReservationStatusComponent implements OnInit, OnDestroy {
  id = '';
  booking: PublicReservationStatus | null = null;
  loading = true;
  notFound = false;
  confirmCancel = false;
  cancelling = false;
  errorMessage = '';

  private subs: Subscription[] = [];
  private poller?: ReturnType<typeof setInterval>;
  private realtimeStarted = false;

  constructor(
    private route: ActivatedRoute,
    private reservationService: ReservationService,
    private signalR: SignalRService,
    private transloco: TranslocoService
  ) {}

  ngOnInit(): void {
    this.id = this.route.snapshot.paramMap.get('id') || '';
    this.load();
    // Fallback while waiting for the restaurant to answer
    this.poller = setInterval(() => { if (this.booking?.status === 'Pending') this.load(); }, 30_000);
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    clearInterval(this.poller);
  }

  load(): void {
    this.reservationService.getPublicStatus(this.id).subscribe({
      next: (b) => {
        this.booking = b;
        this.loading = false;
        this.startRealtime(b.tenantId);
      },
      error: () => { this.loading = false; this.notFound = true; }
    });
  }

  cancel(): void {
    this.cancelling = true;
    this.reservationService.cancelByCustomer(this.id).subscribe({
      next: (b) => { this.booking = b; this.cancelling = false; this.confirmCancel = false; },
      error: (err) => {
        this.cancelling = false;
        this.confirmCancel = false;
        this.errorMessage = err.error?.message || this.transloco.translate('reservationStatus.errors.cancelFailed');
      }
    });
  }

  private async startRealtime(tenantId: string): Promise<void> {
    if (this.realtimeStarted || !['Pending', 'Confirmed'].includes(this.booking?.status ?? '')) return;
    this.realtimeStarted = true;
    await this.signalR.connectPublic();
    await this.signalR.followReservation(this.id);
    this.subs.push(
      this.signalR.reservationUpdated$.subscribe(id => { if (id === this.id) this.load(); }),
      this.signalR.reconnected$.subscribe(() => this.load())
    );
  }
}
