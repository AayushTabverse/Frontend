import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { WaitlistService } from '../../services/waitlist.service';
import { PublicWaitlistInfo } from '../../models/api.models';

/** Self check-in: walk-ins scan the entrance QR and add themselves to the waitlist. */
@Component({
  selector: 'app-waitlist-join',
  standalone: true,
  imports: [CommonModule, FormsModule],
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

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private waitlistService: WaitlistService
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
      next: (info) => { this.info = info; this.loading = false; },
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
