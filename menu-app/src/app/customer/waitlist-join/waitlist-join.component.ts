import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { WaitlistService } from '../../services/waitlist.service';
import { ReservationService } from '../../services/reservation.service';
import { TableBoardComponent } from '../../shared/components/table-board/table-board.component';
import { PublicWaitlistInfo } from '../../models/api.models';

/**
 * Entrance QR page: walk-ins join the waitlist now, or book a table for later
 * (a booking request the restaurant accepts or declines, same as website bookings).
 */
@Component({
  selector: 'app-waitlist-join',
  standalone: true,
  imports: [CommonModule, FormsModule, TableBoardComponent],
  templateUrl: './waitlist-join.component.html',
  styleUrl: './waitlist-join.component.scss'
})
export class WaitlistJoinComponent implements OnInit {
  tenantId = '';
  info: PublicWaitlistInfo | null = null;
  loading = true;
  notFound = false;

  name = '';
  mobile = '';
  partySize = 2;
  readonly partySizes = [1, 2, 3, 4, 5, 6, 8];
  submitted = false;
  joining = false;
  errorMessage = '';

  /** Which form is showing. */
  mode: 'now' | 'later' = 'now';
  bookingDate = '';
  bookingTime = '19:30';
  bookingNotes = '';
  readonly bookingMinDate = this.isoDate(new Date());
  readonly bookingMaxDate = this.isoDate(new Date(Date.now() + 60 * 24 * 60 * 60_000));

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private waitlistService: WaitlistService,
    private reservationService: ReservationService
  ) {}

  ngOnInit(): void {
    this.tenantId = this.route.snapshot.paramMap.get('tenantId') || '';

    // Already in line here from this phone? Go straight to the status page.
    const existing = this.readSavedEntry();
    if (existing) {
      this.waitlistService.getPublicStatus(existing).subscribe({
        next: (s) => {
          if (s.status === 'Waiting' || s.status === 'Notified') this.router.navigate(['/waitlist/status', s.id]);
          else this.loadInfo();
        },
        error: () => this.loadInfo()
      });
      return;
    }
    this.loadInfo();
  }

  private loadInfo(): void {
    this.waitlistService.getPublicInfo(this.tenantId).subscribe({
      next: (info) => {
        this.info = info;
        this.loading = false;
        // Only booking is open → start on the booking form
        if (!info.selfCheckInEnabled && info.onlineReservationsEnabled) this.mode = 'later';
      },
      error: () => { this.notFound = true; this.loading = false; }
    });
  }

  get mobileDigits(): string {
    return this.mobile.replace(/\D/g, '');
  }

  get mobileInvalid(): boolean {
    return this.mobileDigits.length < 10 || this.mobileDigits.length > 13;
  }

  onlyNumbers(event: KeyboardEvent): void {
    if (!/[0-9+]/.test(event.key)) event.preventDefault();
  }

  join(): void {
    this.submitted = true;
    this.errorMessage = '';
    if (!this.name.trim() || this.mobileInvalid || this.partySize < 1) return;

    this.joining = true;
    this.waitlistService.join(this.tenantId, {
      customerName: this.name.trim(),
      customerMobile: this.mobile.trim(),
      partySize: this.partySize
    }).subscribe({
      next: (status) => {
        this.saveEntry(status.id);
        this.router.navigate(['/waitlist/status', status.id]);
      },
      error: (err) => {
        this.joining = false;
        this.errorMessage = err.error?.message || 'Something went wrong. Please ask the staff at the entrance.';
      }
    });
  }

  /** Can the customer choose between joining now and booking for later? */
  get showModeSwitch(): boolean {
    return !!this.info?.selfCheckInEnabled && !!this.info?.onlineReservationsEnabled;
  }

  private get bookingWhen(): Date | null {
    if (!this.bookingDate || !this.bookingTime) return null;
    const d = new Date(`${this.bookingDate}T${this.bookingTime}`);
    return isNaN(d.getTime()) ? null : d;
  }

  get bookingTooSoon(): boolean {
    const when = this.bookingWhen;
    return !!when && when.getTime() < Date.now() + 30 * 60_000;
  }

  setMode(mode: 'now' | 'later'): void {
    this.mode = mode;
    this.submitted = false;
    this.errorMessage = '';
    if (mode === 'later' && !this.bookingDate) this.bookingDate = this.bookingMinDate;
  }

  /** Book a table for later: sends a request; the customer lands on their booking page. */
  reserve(): void {
    this.submitted = true;
    this.errorMessage = '';
    const when = this.bookingWhen;
    if (!this.name.trim() || this.mobileInvalid || !when || this.bookingTooSoon || this.partySize < 1) return;

    this.joining = true;
    this.reservationService.request(this.tenantId, {
      customerName: this.name.trim(),
      customerMobile: this.mobile.trim(),
      partySize: this.partySize,
      reservedFor: when.toISOString(),
      notes: this.bookingNotes.trim() || undefined
    }).subscribe({
      next: (booking) => this.router.navigate(['/reservation', booking.id]),
      error: (err) => {
        this.joining = false;
        this.errorMessage = err.error?.message || 'Could not send your booking. Please ask the staff at the entrance.';
      }
    });
  }

  private isoDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private storageKey(): string {
    return `waitlist-entry-${this.tenantId}`;
  }

  private readSavedEntry(): string | null {
    try { return localStorage.getItem(this.storageKey()); } catch { return null; }
  }

  private saveEntry(id: string): void {
    try { localStorage.setItem(this.storageKey(), id); } catch { /* private mode */ }
  }
}
