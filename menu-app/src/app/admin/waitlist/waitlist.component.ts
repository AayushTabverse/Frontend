import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { WaitlistService } from '../../services/waitlist.service';
import { TableService } from '../../services/table.service';
import { SettingsService } from '../../services/settings.service';
import { SignalRService } from '../../services/signalr.service';
import { AuthService } from '../../services/auth.service';
import { CustomerService, CustomerSearchResult } from '../../services/customer.service';
import {
  TableResponse, WaitlistAnalytics, WaitlistEntryRequest, WaitlistEntryResponse, WaitlistSettings, WaitlistStatsResponse
} from '../../models/api.models';

type WaitlistTab = 'waiting' | 'seated' | 'closed' | 'insights';

interface FreedTableAlert {
  tableNumber: string;
  capacity: number;
  bestMatch?: WaitlistEntryResponse;
}

@Component({
  selector: 'app-waitlist',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './waitlist.component.html',
  styleUrl: './waitlist.component.scss'
})
export class WaitlistComponent implements OnInit, OnDestroy {
  entries: WaitlistEntryResponse[] = [];
  tables: TableResponse[] = [];
  stats: WaitlistStatsResponse | null = null;
  loading = true;
  tab: WaitlistTab = 'waiting';
  restaurantName = 'our restaurant';
  now = Date.now();

  successMessage = '';
  errorMessage = '';
  freedAlert: FreedTableAlert | null = null;
  /** Shown after adding a party, so staff can send the queue confirmation on WhatsApp. */
  justAdded: WaitlistEntryResponse | null = null;

  // Add / edit form
  showForm = false;
  editingId: string | null = null;
  form: WaitlistEntryRequest = this.emptyForm();
  submitted = false;
  saving = false;
  readonly partySizes = [1, 2, 3, 4, 5, 6, 8, 10];
  readonly waitOptions = [5, 10, 15, 20, 30, 45, 60];
  customerSuggestions: CustomerSearchResult[] = [];

  // Settings & entrance QR
  showSettings = false;
  settings: WaitlistSettings | null = null;
  settingsSaving = false;
  readonly noShowOptions = [0, 10, 15, 20, 30];
  qrImageUrl = '';
  qrLoading = false;

  // Insights
  analytics: WaitlistAnalytics | null = null;
  analyticsDays = 30;
  readonly analyticsRanges = [7, 30, 90];
  analyticsLoading = false;

  // Seat dialog
  seatingEntry: WaitlistEntryResponse | null = null;
  selectedTableIds: string[] = [];
  seating = false;

  private subs: Subscription[] = [];
  private ticker?: ReturnType<typeof setInterval>;
  private messageTimer?: ReturnType<typeof setTimeout>;
  private customerSearchTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private waitlistService: WaitlistService,
    private tableService: TableService,
    private settingsService: SettingsService,
    private signalR: SignalRService,
    private authService: AuthService,
    private customerService: CustomerService
  ) {}

  ngOnInit(): void {
    this.loadAll();
    this.settingsService.getSettings().subscribe({
      next: (s) => this.restaurantName = s.name || this.restaurantName
    });
    this.setupRealTime();
    // Keep "waited X min" fresh
    this.ticker = setInterval(() => this.now = Date.now(), 30_000);
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    clearInterval(this.ticker);
    clearTimeout(this.messageTimer);
    clearTimeout(this.customerSearchTimer);
    if (this.qrImageUrl) URL.revokeObjectURL(this.qrImageUrl);
  }

  // ── Loading ──

  loadAll(): void {
    this.loadEntries();
    this.loadTables();
    this.loadStats();
    if (this.tab === 'insights') this.loadAnalytics();
  }

  loadEntries(): void {
    this.waitlistService.getEntries(true).subscribe({
      next: (entries) => { this.entries = entries; this.loading = false; },
      error: () => { this.loading = false; this.showError('Could not load the waitlist.'); }
    });
  }

  loadTables(): void {
    this.tableService.getTables().subscribe({
      next: (tables) => this.tables = tables
    });
  }

  loadStats(): void {
    this.waitlistService.getStats().subscribe({
      next: (stats) => this.stats = stats
    });
  }

  private async setupRealTime(): Promise<void> {
    const tenantId = this.authService.getTenantId();
    if (!tenantId) return;
    await this.signalR.startConnection(tenantId);
    this.subs.push(
      this.signalR.waitlistUpdated$.subscribe(() => {
        this.loadEntries();
        this.loadTables();
        this.loadStats();
      }),
      this.signalR.newOrder$.subscribe(() => this.loadTables()),
      this.signalR.tableCleared$.subscribe((data) => {
        this.tableService.getTables().subscribe(tables => {
          this.tables = tables;
          const table = tables.find(t => t.id === data.tableId);
          if (table) this.showFreedAlert(table);
        });
      })
    );
  }

  // ── Lists ──

  get waitingEntries(): WaitlistEntryResponse[] {
    return this.entries.filter(e => e.status === 'Waiting' || e.status === 'Notified');
  }

  get seatedEntries(): WaitlistEntryResponse[] {
    return this.entries.filter(e => e.status === 'Seated');
  }

  get closedEntries(): WaitlistEntryResponse[] {
    return this.entries
      .filter(e => e.status === 'Completed' || e.status === 'Cancelled' || e.status === 'NoShow')
      .sort((a, b) => (b.closedAt ?? '').localeCompare(a.closedAt ?? ''));
  }

  get visibleEntries(): WaitlistEntryResponse[] {
    switch (this.tab) {
      case 'seated': return this.seatedEntries;
      case 'closed': return this.closedEntries;
      default: return this.waitingEntries;
    }
  }

  /** Tables that can take a new party right now: active, no running orders, not held by another party. */
  get freeTables(): TableResponse[] {
    return this.tables
      .filter(t => t.isActive && !t.isOccupied && !t.waitlistEntryId && !t.mergedIntoTableId)
      .sort((a, b) => a.capacity - b.capacity || a.tableNumber.localeCompare(b.tableNumber, undefined, { numeric: true }));
  }

  /** Free tables sorted for one party: those that fit alone first (tightest fit), then the rest. */
  freeTablesFor(entry: WaitlistEntryResponse): TableResponse[] {
    const fits = this.freeTables.filter(t => t.capacity >= entry.partySize);
    const small = this.freeTables.filter(t => t.capacity < entry.partySize).sort((a, b) => b.capacity - a.capacity);
    return [...fits, ...small];
  }

  /**
   * Suggested tables for a party: the smallest single table that fits, otherwise
   * the fewest free tables (largest first) whose seats add up to the party size.
   */
  suggestTables(partySize: number): TableResponse[] {
    const free = this.freeTables;
    const single = free.find(t => t.capacity >= partySize);
    if (single) return [single];

    const picked: TableResponse[] = [];
    let seats = 0;
    for (const t of [...free].sort((a, b) => b.capacity - a.capacity)) {
      if (seats >= partySize) break;
      picked.push(t);
      seats += t.capacity;
    }
    return seats >= partySize ? picked : [];
  }

  suggestionLabel(entry: WaitlistEntryResponse): string {
    const tables = this.suggestTables(entry.partySize);
    if (tables.length === 0) return '';
    return tables.length === 1
      ? `Table ${tables[0].tableNumber} is free`
      : `Merge ${tables.map(t => t.tableNumber).join(' + ')}`;
  }

  /** Position in the queue (1-based) among waiting parties. */
  position(entry: WaitlistEntryResponse): number {
    return this.waitingEntries.findIndex(e => e.id === entry.id) + 1;
  }

  minutesSince(iso?: string): number {
    if (!iso) return 0;
    return Math.max(0, Math.floor((this.now - new Date(iso).getTime()) / 60_000));
  }

  waitedLabel(entry: WaitlistEntryResponse): string {
    const end = entry.seatedAt ?? entry.closedAt;
    const mins = end
      ? Math.max(0, Math.round((new Date(end).getTime() - new Date(entry.createdAt).getTime()) / 60_000))
      : this.minutesSince(entry.createdAt);
    return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
  }

  isOverdue(entry: WaitlistEntryResponse): boolean {
    return !!entry.quotedWaitMinutes && this.minutesSince(entry.createdAt) > entry.quotedWaitMinutes;
  }

  statusLabel(entry: WaitlistEntryResponse): string {
    switch (entry.status) {
      case 'Waiting': return 'Waiting';
      case 'Notified': return `Called ${this.minutesSince(entry.notifiedAt)}m ago`;
      case 'Seated': return 'Seated';
      case 'Completed': return 'Done';
      case 'Cancelled': return 'Cancelled';
      case 'NoShow': return 'No-show';
    }
  }

  tableNames(entry: WaitlistEntryResponse): string {
    return entry.tables.map(t => t.tableNumber).join(' + ');
  }

  // ── Add / edit ──

  openAdd(): void {
    this.editingId = null;
    this.form = this.emptyForm();
    // Pre-fill the quote with the current estimate, snapped to the nearest option
    const estimate = this.stats?.estimatedWaitForNewParty ?? 0;
    if (estimate > 0) {
      this.form.quotedWaitMinutes = this.waitOptions.reduce((best, m) =>
        Math.abs(m - estimate) < Math.abs(best - estimate) ? m : best, this.waitOptions[0]);
    }
    this.submitted = false;
    this.customerSuggestions = [];
    this.showForm = true;
  }

  openEdit(entry: WaitlistEntryResponse): void {
    this.editingId = entry.id;
    this.form = {
      customerName: entry.customerName,
      customerMobile: entry.customerMobile ?? '',
      partySize: entry.partySize,
      notes: entry.notes ?? '',
      quotedWaitMinutes: entry.quotedWaitMinutes
    };
    this.submitted = false;
    this.customerSuggestions = [];
    this.showForm = true;
  }

  closeForm(): void {
    this.showForm = false;
    this.customerSuggestions = [];
  }

  get mobileInvalid(): boolean {
    const digits = (this.form.customerMobile ?? '').replace(/\D/g, '');
    return digits.length > 0 && (digits.length < 10 || digits.length > 13);
  }

  onMobileInput(): void {
    clearTimeout(this.customerSearchTimer);
    const query = (this.form.customerMobile ?? '').replace(/\D/g, '');
    if (query.length < 4 || this.editingId) {
      this.customerSuggestions = [];
      return;
    }
    this.customerSearchTimer = setTimeout(() => {
      this.customerService.search(query).subscribe({
        next: (results) => this.customerSuggestions = results.slice(0, 5),
        error: () => this.customerSuggestions = []
      });
    }, 300);
  }

  pickCustomer(customer: CustomerSearchResult): void {
    this.form.customerName = customer.customerName;
    this.form.customerMobile = customer.customerMobile;
    this.customerSuggestions = [];
  }

  onlyNumbers(event: KeyboardEvent): void {
    if (!/[0-9+]/.test(event.key)) event.preventDefault();
  }

  save(): void {
    this.submitted = true;
    if (!this.form.customerName.trim() || this.mobileInvalid || !this.form.partySize || this.form.partySize < 1) return;

    const payload: WaitlistEntryRequest = {
      customerName: this.form.customerName.trim(),
      customerMobile: this.form.customerMobile?.trim() || undefined,
      partySize: this.form.partySize,
      notes: this.form.notes?.trim() || undefined,
      quotedWaitMinutes: this.form.quotedWaitMinutes || undefined
    };

    this.saving = true;
    const request = this.editingId
      ? this.waitlistService.updateEntry(this.editingId, { ...payload, notes: payload.notes ?? '' })
      : this.waitlistService.addEntry(payload);

    request.subscribe({
      next: (entry) => {
        this.saving = false;
        this.showForm = false;
        if (!this.editingId) {
          this.justAdded = entry.customerMobile ? entry : null;
          this.showSuccess(`#${entry.tokenNumber} ${entry.customerName} added to the waitlist`);
        } else {
          this.showSuccess('Party updated');
        }
        this.tab = 'waiting';
        this.loadAll();
      },
      error: (err) => {
        this.saving = false;
        this.showError(err.error?.message || 'Could not save. Please try again.');
      }
    });
  }

  // ── Calling the customer ──

  callLink(entry: WaitlistEntryResponse): string {
    return `tel:${entry.customerMobile}`;
  }

  /** Opens WhatsApp with a "your table is ready" message and marks the party as called. */
  sendTableReady(entry: WaitlistEntryResponse): void {
    const text =
      `Hi ${entry.customerName}, your table at ${this.restaurantName} is ready! 🍽️\n` +
      `Please come to the entrance and show token #${entry.tokenNumber}.\n` +
      this.waitlistService.statusLink(entry.id);
    this.openWhatsApp(entry, text);
    this.markCalled(entry);
  }

  /** Opens WhatsApp with the queue confirmation (position and expected wait). */
  sendQueueConfirmation(entry: WaitlistEntryResponse): void {
    const pos = this.position(entry);
    const minutes = entry.quotedWaitMinutes ?? entry.estimatedWaitMinutes;
    const wait = minutes ? ` Expected wait is about ${minutes} minutes.` : '';
    const text =
      `Hi ${entry.customerName}, you're on the waitlist at ${this.restaurantName} 🙏\n` +
      `Token #${entry.tokenNumber} · Party of ${entry.partySize}` + (pos > 0 ? ` · ${this.ordinal(pos)} in line` : '') + `.${wait}\n` +
      `Track your place live: ${this.waitlistService.statusLink(entry.id)}\n` +
      `We'll message you here as soon as your table is ready.`;
    this.openWhatsApp(entry, text);
    this.justAdded = null;
  }

  markCalled(entry: WaitlistEntryResponse): void {
    this.waitlistService.notify(entry.id).subscribe({
      next: () => this.loadEntries(),
      error: (err) => this.showError(err.error?.message || 'Could not update the party.')
    });
  }

  private openWhatsApp(entry: WaitlistEntryResponse, text: string): void {
    const phone = this.whatsAppNumber(entry.customerMobile);
    if (!phone) return;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
  }

  /** wa.me needs the full international number without "+"; bare 10-digit numbers are treated as Indian. */
  private whatsAppNumber(mobile?: string): string {
    const digits = (mobile ?? '').replace(/\D/g, '');
    if (digits.length === 10) return `91${digits}`;
    if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
    return digits;
  }

  private ordinal(n: number): string {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  // ── Seating (one table or merged tables) ──

  openSeat(entry: WaitlistEntryResponse, preselect?: TableResponse[]): void {
    this.seatingEntry = entry;
    this.selectedTableIds = (preselect ?? this.suggestTables(entry.partySize)).map(t => t.id);
  }

  closeSeat(): void {
    this.seatingEntry = null;
    this.selectedTableIds = [];
  }

  toggleTable(table: TableResponse): void {
    const i = this.selectedTableIds.indexOf(table.id);
    if (i >= 0) this.selectedTableIds.splice(i, 1);
    else this.selectedTableIds.push(table.id);
  }

  isPrimary(table: TableResponse): boolean {
    return this.selectedTableIds[0] === table.id;
  }

  get selectedSeats(): number {
    return this.tables
      .filter(t => this.selectedTableIds.includes(t.id))
      .reduce((sum, t) => sum + t.capacity, 0);
  }

  get selectedTableNames(): string {
    return this.selectedTableIds
      .map(id => this.tables.find(t => t.id === id)?.tableNumber)
      .filter(Boolean)
      .join(' + ');
  }

  get seatsShort(): boolean {
    return !!this.seatingEntry && this.selectedSeats < this.seatingEntry.partySize;
  }

  confirmSeat(): void {
    const entry = this.seatingEntry;
    if (!entry || this.selectedTableIds.length === 0) return;

    if (this.seatsShort &&
        !confirm(`${this.selectedTableNames} seats ${this.selectedSeats}, but the party has ${entry.partySize}. Seat them anyway?`)) {
      return;
    }

    this.seating = true;
    this.waitlistService.seat(entry.id, this.selectedTableIds, this.seatsShort).subscribe({
      next: (seated) => {
        this.seating = false;
        this.closeSeat();
        this.showSuccess(`${seated.customerName} seated at ${this.tableNames(seated)}`);
        this.loadAll();
      },
      error: (err) => {
        this.seating = false;
        this.showError(err.error?.message || 'Could not seat the party.');
        this.loadTables();
      }
    });
  }

  release(entry: WaitlistEntryResponse): void {
    if (!confirm(`Free ${this.tableNames(entry)} held for ${entry.customerName}? Use this only if they left without a bill.`)) return;
    this.waitlistService.release(entry.id).subscribe({
      next: () => { this.showSuccess(`${this.tableNames(entry)} freed`); this.loadAll(); },
      error: (err) => this.showError(err.error?.message || 'Could not free the tables.')
    });
  }

  cancel(entry: WaitlistEntryResponse): void {
    if (!confirm(`Remove ${entry.customerName} from the waitlist?`)) return;
    this.waitlistService.cancel(entry.id).subscribe({
      next: () => { this.showSuccess(`${entry.customerName} removed`); this.loadAll(); },
      error: (err) => this.showError(err.error?.message || 'Could not remove the party.')
    });
  }

  noShow(entry: WaitlistEntryResponse): void {
    if (!confirm(`Mark ${entry.customerName} as no-show?`)) return;
    this.waitlistService.markNoShow(entry.id).subscribe({
      next: () => { this.showSuccess(`${entry.customerName} marked as no-show`); this.loadAll(); },
      error: (err) => this.showError(err.error?.message || 'Could not update the party.')
    });
  }

  // ── Table freed alert ──

  private showFreedAlert(table: TableResponse): void {
    if (!table.isActive || table.isOccupied || table.waitlistEntryId) return;
    const waiting = this.waitingEntries;
    if (waiting.length === 0) return;
    // Oldest party that fits this table, else the oldest party overall
    const bestMatch = waiting.find(e => e.partySize <= table.capacity) ?? waiting[0];
    this.freedAlert = { tableNumber: table.tableNumber, capacity: table.capacity, bestMatch };
  }

  seatFromAlert(): void {
    const alert = this.freedAlert;
    if (!alert?.bestMatch) return;
    const table = this.freeTables.find(t => t.tableNumber === alert.tableNumber);
    this.freedAlert = null;
    this.openSeat(alert.bestMatch, table && table.capacity >= alert.bestMatch.partySize ? [table] : undefined);
  }

  // ── Settings & entrance QR ──

  openSettings(): void {
    this.showSettings = true;
    this.waitlistService.getSettings().subscribe({
      next: (s) => this.settings = s,
      error: () => this.showError('Could not load waitlist settings.')
    });
    if (!this.qrImageUrl) {
      this.qrLoading = true;
      this.waitlistService.getCheckInQrBlob().subscribe({
        next: (blob) => { this.qrImageUrl = URL.createObjectURL(blob); this.qrLoading = false; },
        error: () => this.qrLoading = false
      });
    }
  }

  saveSettings(change: Partial<WaitlistSettings>): void {
    if (!this.settings) return;
    const previous = { ...this.settings };
    this.settings = { ...this.settings, ...change };
    this.settingsSaving = true;
    this.waitlistService.updateSettings(change).subscribe({
      next: (s) => { this.settings = s; this.settingsSaving = false; },
      error: () => {
        this.settings = previous;
        this.settingsSaving = false;
        this.showError('Could not save settings.');
      }
    });
  }

  get checkInLink(): string {
    return this.waitlistService.checkInLink(this.authService.getTenantId() ?? '');
  }

  copyCheckInLink(): void {
    navigator.clipboard?.writeText(this.checkInLink).then(
      () => this.showSuccess('Check-in link copied'),
      () => this.showError('Could not copy the link.')
    );
  }

  downloadQr(): void {
    if (!this.qrImageUrl) return;
    const a = document.createElement('a');
    a.href = this.qrImageUrl;
    a.download = 'waitlist-checkin-qr.png';
    a.click();
  }

  printQr(): void {
    if (!this.qrImageUrl) return;
    const win = window.open('', '_blank', 'width=600,height=800');
    if (!win) return;
    const name = this.restaurantName.replace(/[<>&"]/g, '');
    win.document.write(`<!doctype html><html><head><title>Waitlist QR</title>
      <style>body{font-family:system-ui,sans-serif;text-align:center;padding:40px;color:#1a1a2e}
      h1{margin:0 0 4px;font-size:28px}h2{margin:0 0 24px;font-weight:500;color:#555}
      img{width:320px;height:320px}p{font-size:18px;margin-top:20px}</style></head>
      <body><h1>${name}</h1><h2>Waiting for a table?</h2>
      <img src="${this.qrImageUrl}" onload="window.print()" />
      <p>📱 Scan to join the waitlist.<br/>We'll WhatsApp you when your table is ready.</p></body></html>`);
    win.document.close();
  }

  // ── Insights ──

  showInsights(): void {
    this.tab = 'insights';
    this.loadAnalytics();
  }

  setAnalyticsRange(days: number): void {
    this.analyticsDays = days;
    this.loadAnalytics();
  }

  loadAnalytics(): void {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - (this.analyticsDays - 1));
    this.analyticsLoading = true;
    this.waitlistService.getAnalytics(this.isoDate(from), this.isoDate(to)).subscribe({
      next: (a) => { this.analytics = a; this.analyticsLoading = false; },
      error: () => { this.analyticsLoading = false; this.showError('Could not load insights.'); }
    });
  }

  get maxHourParties(): number {
    return Math.max(1, ...(this.analytics?.byHour.map(h => h.parties) ?? [1]));
  }

  get maxDayParties(): number {
    return Math.max(1, ...(this.analytics?.byDay.map(d => d.parties) ?? [1]));
  }

  hourLabel(hour: number): string {
    const h = hour % 12 || 12;
    return `${h}${hour < 12 ? 'am' : 'pm'}`;
  }

  private isoDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // ── Helpers ──

  private emptyForm(): WaitlistEntryRequest {
    return { customerName: '', customerMobile: '', partySize: 2, notes: '', quotedWaitMinutes: undefined };
  }

  private showSuccess(message: string): void {
    this.errorMessage = '';
    this.successMessage = message;
    clearTimeout(this.messageTimer);
    this.messageTimer = setTimeout(() => this.successMessage = '', 4000);
  }

  private showError(message: string): void {
    this.successMessage = '';
    this.errorMessage = message;
    clearTimeout(this.messageTimer);
    this.messageTimer = setTimeout(() => this.errorMessage = '', 6000);
  }
}
