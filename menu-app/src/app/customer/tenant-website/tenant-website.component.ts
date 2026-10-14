import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { WebsiteService } from '../../services/website.service';
import { ReservationService } from '../../services/reservation.service';
import { WebsiteContent } from '../../models/api.models';
import { isTenantHost } from '../../shared/site-host';

@Component({
  selector: 'app-tenant-website',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tenant-website.component.html',
  styleUrl: './tenant-website.component.scss'
})
export class TenantWebsiteComponent implements OnInit {
  content: WebsiteContent | null = null;
  loading = true;
  error = '';
  /** The site exists but its owner hasn't published it. */
  notPublished = false;
  tenantId = '';
  navScrolled = false;
  mobileMenuOpen = false;
  activeSection = 'home';

  // Table booking
  bookingEnabled = false;
  booking = { name: '', mobile: '', email: '', partySize: 2, date: '', time: '19:30', notes: '' };
  readonly bookingSizes = [1, 2, 3, 4, 5, 6, 8];
  bookingSubmitted = false;
  bookingSending = false;
  bookingError = '';
  readonly bookingMinDate = this.isoDate(new Date());
  readonly bookingMaxDate = this.isoDate(new Date(Date.now() + 60 * 24 * 60 * 60_000));

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private websiteService: WebsiteService,
    private reservationService: ReservationService
  ) {}

  private isSubdomainAccess = false;

  ngOnInit(): void {
    // On a restaurant's own host (name.tabverse.in or its own domain) resolve the host;
    // on the main site fall back to /website/:tenantId
    if (isTenantHost()) {
      this.isSubdomainAccess = true;
      this.tenantId = window.location.hostname; // a host, resolved to the tenantId below
    } else {
      // Fallback to route param
      this.tenantId = this.route.snapshot.paramMap.get('tenantId') || '';
    }

    if (this.tenantId) {
      if (this.isSubdomainAccess) {
        // Resolve subdomain → tenantId, then load content
        this.websiteService.resolveHost(this.tenantId).subscribe({
          next: (result) => {
            this.tenantId = result.tenantId;
            this.loadContent();
          },
          error: () => {
            this.error = 'This restaurant website is not available.';
            this.loading = false;
          }
        });
      } else {
        this.loadContent();
      }
    } else {
      this.error = 'Restaurant not found.';
      this.loading = false;
    }
  }

  @HostListener('window:scroll')
  onScroll(): void {
    this.navScrolled = window.scrollY > 60;
    this.detectActiveSection();
  }

  private detectActiveSection(): void {
    const sections = ['home', 'about', 'specialties', 'menu', 'gallery', 'testimonials', 'hours', 'reserve', 'contact'];
    for (const s of sections.reverse()) {
      const el = document.getElementById(s);
      if (el && el.getBoundingClientRect().top <= 120) {
        this.activeSection = s;
        break;
      }
    }
  }

  loadContent(): void {
    this.websiteService.getPublicWebsiteContent(this.tenantId).subscribe({
      next: (data) => {
        this.content = data;
        this.loading = false;
        this.loadBookingInfo();
        // Apply theme colors as CSS variables
        setTimeout(() => this.applyTheme(), 0);
      },
      error: (err) => {
        this.notPublished = err.status === 404 && (err.error?.errors ?? []).includes('not_published');
        this.error = this.notPublished
          ? "This restaurant's website isn't published yet. Please check back soon."
          : 'This restaurant website is not available.';
        this.loading = false;
      }
    });
  }

  private applyTheme(): void {
    if (!this.content) return;
    const root = document.documentElement;
    if (this.content.primaryColor) root.style.setProperty('--tw-primary', this.content.primaryColor);
    if (this.content.secondaryColor) root.style.setProperty('--tw-secondary', this.content.secondaryColor);
    if (this.content.accentColor) root.style.setProperty('--tw-accent', this.content.accentColor);
    if (this.content.fontFamily) root.style.setProperty('--tw-font', `'${this.content.fontFamily}', serif`);
  }

  // ── Table booking ──

  private loadBookingInfo(): void {
    this.booking.date = this.bookingMinDate;
    this.reservationService.getPublicInfo(this.tenantId).subscribe({
      next: (info) => this.bookingEnabled = info.onlineReservationsEnabled,
      error: () => this.bookingEnabled = false
    });
  }

  get bookingMobileInvalid(): boolean {
    const d = this.booking.mobile.replace(/\D/g, '');
    return d.length < 10 || d.length > 13;
  }

  /** The chosen date + time, or null if incomplete. */
  private get bookingWhen(): Date | null {
    if (!this.booking.date || !this.booking.time) return null;
    const d = new Date(`${this.booking.date}T${this.booking.time}`);
    return isNaN(d.getTime()) ? null : d;
  }

  get bookingTooSoon(): boolean {
    const when = this.bookingWhen;
    return !!when && when.getTime() < Date.now() + 30 * 60_000;
  }

  onlyNumbers(event: KeyboardEvent): void {
    if (!/[0-9+]/.test(event.key)) event.preventDefault();
  }

  requestBooking(): void {
    this.bookingSubmitted = true;
    this.bookingError = '';
    const b = this.booking;
    const when = this.bookingWhen;
    if (!b.name.trim() || this.bookingMobileInvalid || !when || this.bookingTooSoon || b.partySize < 1) return;

    this.bookingSending = true;
    this.reservationService.request(this.tenantId, {
      customerName: b.name.trim(),
      customerMobile: b.mobile.trim(),
      customerEmail: b.email.trim() || undefined,
      partySize: b.partySize,
      reservedFor: when.toISOString(),
      notes: b.notes.trim() || undefined
    }).subscribe({
      next: (status) => this.router.navigate(['/reservation', status.id]),
      error: (err) => {
        this.bookingSending = false;
        this.bookingError = err.error?.message || 'Could not send your request. Please call us.';
      }
    });
  }

  private isoDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  scrollTo(sectionId: string): void {
    this.mobileMenuOpen = false;
    const el = document.getElementById(sectionId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  getStarArray(rating: number): number[] {
    return Array(Math.min(rating, 5)).fill(0);
  }

  getEmptyStarArray(rating: number): number[] {
    return Array(Math.max(5 - rating, 0)).fill(0);
  }
}
