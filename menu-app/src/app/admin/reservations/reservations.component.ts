import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ReservationService } from '../../services/reservation.service';
import { TableService } from '../../services/table.service';
import { SettingsService } from '../../services/settings.service';
import { SignalRService } from '../../services/signalr.service';
import { AuthService } from '../../services/auth.service';
import { CustomerService, CustomerSearchResult } from '../../services/customer.service';
import { ReservationResponse, ReservationSettings, TableResponse } from '../../models/api.models';

interface DayGroup {
  date: string;
  label: string;
  reservations: ReservationResponse[];
  guests: number;
}

interface BookingForm {
  customerName: string;
  customerMobile: string;
  customerEmail: string;
  partySize: number;
  date: string;
  time: string;
  durationMinutes: number;
  notes: string;
  tableIds: string[];
}

type TablePickerMode = 'accept' | 'seat';

@Component({
  selector: 'app-reservations',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reservations.component.html',
  styleUrl: './reservations.component.scss'
})
export class ReservationsComponent implements OnInit, OnDestroy {
  reservations: ReservationResponse[] = [];
  tables: TableResponse[] = [];
  loading = true;
  restaurantName = 'our restaurant';
  restaurantPhone = '';

  /** First day of the 7-day window (yyyy-MM-dd, local). */
  startDate = this.isoDate(new Date());
  readonly windowDays = 7;
  showClosed = false;

  successMessage = '';
  errorMessage = '';
  /** After accepting/rejecting/creating: offer to tell the customer on WhatsApp. */
  notifyPrompt: { reservation: ReservationResponse; kind: 'confirmed' | 'rejected' } | null = null;

  // New / edit
  showForm = false;
  editingId: string | null = null;
  form: BookingForm = this.emptyForm();
  submitted = false;
  saving = false;
  readonly partySizes = [1, 2, 3, 4, 5, 6, 8, 10, 12];
  readonly durations = [60, 90, 120, 180];
  customerSuggestions: CustomerSearchResult[] = [];

  // Accept / seat (table picker)
  pickerMode: TablePickerMode | null = null;
  pickerReservation: ReservationResponse | null = null;
  pickerTableIds: string[] = [];
  pickerMessage = '';
  pickerSaving = false;

  // Reject
  rejecting: ReservationResponse | null = null;
  rejectReason = '';
  readonly rejectReasons = ['Fully booked at that time', "We're closed that day", "We can't seat a group that size"];

  // Settings
  showSettings = false;
  settings: ReservationSettings | null = null;
  settingsSaving = false;
  readonly graceOptions = [0, 15, 30, 45, 60];

  private subs: Subscription[] = [];
  private messageTimer?: ReturnType<typeof setTimeout>;
  private customerSearchTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private reservationService: ReservationService,
    private tableService: TableService,
    private settingsService: SettingsService,
    private signalR: SignalRService,
    private authService: AuthService,
    private customerService: CustomerService
  ) {}

  ngOnInit(): void {
    this.load();
    this.loadTables();
    this.settingsService.getSettings().subscribe({
      next: (s) => {
        this.restaurantName = s.name || this.restaurantName;
        this.restaurantPhone = s.phone || '';
      }
    });
    this.setupRealTime();
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    clearTimeout(this.messageTimer);
    clearTimeout(this.customerSearchTimer);
  }

  // ── Loading ──

  load(): void {
    const end = this.addDays(this.startDate, this.windowDays - 1);
    this.reservationService.getReservations(this.startDate, end).subscribe({
      next: (list) => { this.reservations = list; this.loading = false; },
      error: () => { this.loading = false; this.showError('Could not load reservations.'); }
    });
  }

  loadTables(): void {
    this.tableService.getTables().subscribe({ next: (t) => this.tables = t });
  }

  private async setupRealTime(): Promise<void> {
    const tenantId = this.authService.getTenantId();
    if (!tenantId) return;
    await this.signalR.startConnection(tenantId);
    this.subs.push(
      this.signalR.reservationsUpdated$.subscribe(() => this.load()),
      this.signalR.tablesChanged$.subscribe(() => this.loadTables()),
      this.signalR.reservationRequested$.subscribe((r) => {
        this.playChime();
        this.showSuccess(`New booking request: ${r.customerName}, ${r.partySize} people`);
      })
    );
  }

  // ── Lists ──

  get pending(): ReservationResponse[] {
    return this.reservations.filter(r => r.status === 'Pending');
  }

  get dayGroups(): DayGroup[] {
    const visible = this.reservations.filter(r =>
      r.status !== 'Pending' && (this.showClosed || ['Confirmed', 'Seated'].includes(r.status)));
    const groups: DayGroup[] = [];
    for (let i = 0; i < this.windowDays; i++) {
      const date = this.addDays(this.startDate, i);
      const list = visible.filter(r => this.isoDate(new Date(r.reservedFor)) === date);
      groups.push({
        date,
        label: this.dayLabel(date),
        reservations: list,
        guests: list.filter(r => r.status === 'Confirmed' || r.status === 'Seated').reduce((n, r) => n + r.partySize, 0)
      });
    }
    return groups;
  }

  get hasAnyInWindow(): boolean {
    return this.dayGroups.some(g => g.reservations.length > 0);
  }

  shiftWindow(days: number): void {
    this.startDate = this.addDays(this.startDate, days);
    this.load();
  }

  goToday(): void {
    this.startDate = this.isoDate(new Date());
    this.load();
  }

  onStartDateChange(): void {
    if (this.startDate) this.load();
  }

  isLate(r: ReservationResponse): boolean {
    return r.status === 'Confirmed' && new Date(r.reservedFor).getTime() < Date.now();
  }

  isSoon(r: ReservationResponse): boolean {
    const diff = new Date(r.reservedFor).getTime() - Date.now();
    return r.status === 'Confirmed' && diff >= 0 && diff <= 60 * 60_000;
  }

  tableNames(r: ReservationResponse): string {
    return r.tables.map(t => t.tableNumber).join(' + ');
  }

  statusLabel(r: ReservationResponse): string {
    switch (r.status) {
      case 'Pending': return 'Request';
      case 'Confirmed': return this.isLate(r) ? 'Late' : 'Confirmed';
      case 'Seated': return 'Seated';
      case 'Completed': return 'Done';
      case 'Rejected': return 'Declined';
      case 'Cancelled': return 'Cancelled';
      case 'NoShow': return 'No-show';
    }
  }

  // ── New / edit ──

  openNew(): void {
    this.editingId = null;
    this.form = this.emptyForm();
    this.submitted = false;
    this.customerSuggestions = [];
    this.showForm = true;
  }

  openEdit(r: ReservationResponse): void {
    const when = new Date(r.reservedFor);
    this.editingId = r.id;
    this.form = {
      customerName: r.customerName,
      customerMobile: r.customerMobile,
      customerEmail: r.customerEmail ?? '',
      partySize: r.partySize,
      date: this.isoDate(when),
      time: `${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}`,
      durationMinutes: r.durationMinutes,
      notes: r.notes ?? '',
      tableIds: r.tables.map(t => t.tableId)
    };
    this.submitted = false;
    this.customerSuggestions = [];
    this.showForm = true;
  }

  get mobileInvalid(): boolean {
    const d = this.form.customerMobile.replace(/\D/g, '');
    return d.length < 10 || d.length > 13;
  }

  get formTables(): TableResponse[] {
    return this.tables.filter(t => t.isActive);
  }

  get formSeats(): number {
    return this.tables.filter(t => this.form.tableIds.includes(t.id)).reduce((n, t) => n + t.capacity, 0);
  }

  toggleFormTable(id: string): void {
    const i = this.form.tableIds.indexOf(id);
    if (i >= 0) this.form.tableIds.splice(i, 1);
    else this.form.tableIds.push(id);
  }

  onMobileInput(): void {
    clearTimeout(this.customerSearchTimer);
    const q = this.form.customerMobile.replace(/\D/g, '');
    if (q.length < 4 || this.editingId) { this.customerSuggestions = []; return; }
    this.customerSearchTimer = setTimeout(() => {
      this.customerService.search(q).subscribe({
        next: (r) => this.customerSuggestions = r.slice(0, 5),
        error: () => this.customerSuggestions = []
      });
    }, 300);
  }

  pickCustomer(c: CustomerSearchResult): void {
    this.form.customerName = c.customerName;
    this.form.customerMobile = c.customerMobile;
    this.customerSuggestions = [];
  }

  onlyNumbers(event: KeyboardEvent): void {
    if (!/[0-9+]/.test(event.key)) event.preventDefault();
  }

  save(): void {
    this.submitted = true;
    const f = this.form;
    if (!f.customerName.trim() || this.mobileInvalid || !f.date || !f.time || f.partySize < 1) return;

    const payload = {
      customerName: f.customerName.trim(),
      customerMobile: f.customerMobile.trim(),
      customerEmail: f.customerEmail.trim() || undefined,
      partySize: f.partySize,
      reservedFor: new Date(`${f.date}T${f.time}`).toISOString(),
      durationMinutes: f.durationMinutes,
      notes: f.notes.trim(),
      tableIds: f.tableIds
    };

    this.saving = true;
    const isNew = !this.editingId;
    const req = this.editingId
      ? this.reservationService.update(this.editingId, payload)
      : this.reservationService.create({ ...payload, notes: payload.notes || undefined });
    req.subscribe({
      next: (r) => {
        this.saving = false;
        this.showForm = false;
        this.showSuccess(isNew ? `Booked ${r.customerName} for ${this.formatWhen(r)}` : 'Reservation updated');
        if (isNew) this.notifyPrompt = { reservation: r, kind: 'confirmed' };
        // Jump to the booking's week so it's visible
        const day = this.isoDate(new Date(r.reservedFor));
        if (day < this.startDate || day > this.addDays(this.startDate, this.windowDays - 1)) this.startDate = day;
        this.load();
      },
      error: (err) => {
        this.saving = false;
        this.showError(err.error?.message || 'Could not save the reservation.');
      }
    });
  }

  // ── Accept / seat (table picker) ──

  openAccept(r: ReservationResponse): void {
    this.pickerMode = 'accept';
    this.pickerReservation = r;
    this.pickerTableIds = r.tables.map(t => t.tableId);
    this.pickerMessage = '';
  }

  openSeat(r: ReservationResponse): void {
    this.pickerMode = 'seat';
    this.pickerReservation = r;
    // Pre-select the booked tables that are free right now
    const free = new Set(this.freeTablesNow.map(t => t.id));
    this.pickerTableIds = r.tables.map(t => t.tableId).filter(id => free.has(id));
  }

  closePicker(): void {
    this.pickerMode = null;
    this.pickerReservation = null;
  }

  /** Tables that can take a party right now. */
  get freeTablesNow(): TableResponse[] {
    return this.tables.filter(t => t.isActive && !t.isOccupied && !t.waitlistEntryId && !t.mergedIntoTableId);
  }

  get pickerTables(): TableResponse[] {
    return this.pickerMode === 'seat' ? this.freeTablesNow : this.tables.filter(t => t.isActive);
  }

  get pickerSeats(): number {
    return this.tables.filter(t => this.pickerTableIds.includes(t.id)).reduce((n, t) => n + t.capacity, 0);
  }

  togglePickerTable(id: string): void {
    const i = this.pickerTableIds.indexOf(id);
    if (i >= 0) this.pickerTableIds.splice(i, 1);
    else this.pickerTableIds.push(id);
  }

  confirmPicker(): void {
    const r = this.pickerReservation;
    if (!r) return;
    if (this.pickerMode === 'accept') {
      this.pickerSaving = true;
      this.reservationService.accept(r.id, this.pickerTableIds, this.pickerMessage.trim() || undefined).subscribe({
        next: (res) => {
          this.pickerSaving = false;
          this.closePicker();
          this.showSuccess(`Confirmed ${res.customerName}`);
          this.notifyPrompt = { reservation: res, kind: 'confirmed' };
          this.load();
        },
        error: (err) => { this.pickerSaving = false; this.showError(err.error?.message || 'Could not confirm.'); }
      });
      return;
    }

    if (this.pickerTableIds.length === 0) return;
    const short = this.pickerSeats < r.partySize;
    if (short && !confirm(`Selected tables seat ${this.pickerSeats}, but the party has ${r.partySize}. Seat them anyway?`)) return;
    this.pickerSaving = true;
    this.reservationService.seat(r.id, this.pickerTableIds, short).subscribe({
      next: (res) => {
        this.pickerSaving = false;
        this.closePicker();
        this.showSuccess(`${res.customerName} seated at ${this.tableNames(res)}`);
        this.load();
        this.loadTables();
      },
      error: (err) => { this.pickerSaving = false; this.showError(err.error?.message || 'Could not seat the party.'); this.loadTables(); }
    });
  }

  // ── Reject / cancel / no-show ──

  openReject(r: ReservationResponse): void {
    this.rejecting = r;
    this.rejectReason = this.rejectReasons[0];
  }

  confirmReject(): void {
    const r = this.rejecting;
    if (!r) return;
    this.reservationService.reject(r.id, this.rejectReason.trim() || undefined).subscribe({
      next: (res) => {
        this.rejecting = null;
        this.showSuccess(`Declined ${res.customerName}'s request`);
        this.notifyPrompt = { reservation: res, kind: 'rejected' };
        this.load();
      },
      error: (err) => this.showError(err.error?.message || 'Could not decline.')
    });
  }

  cancel(r: ReservationResponse): void {
    if (!confirm(`Cancel ${r.customerName}'s booking for ${this.formatWhen(r)}?`)) return;
    this.reservationService.cancel(r.id).subscribe({
      next: () => { this.showSuccess('Reservation cancelled'); this.load(); },
      error: (err) => this.showError(err.error?.message || 'Could not cancel.')
    });
  }

  noShow(r: ReservationResponse): void {
    if (!confirm(`Mark ${r.customerName} as no-show?`)) return;
    this.reservationService.markNoShow(r.id).subscribe({
      next: () => { this.showSuccess('Marked as no-show'); this.load(); },
      error: (err) => this.showError(err.error?.message || 'Could not update.')
    });
  }

  // ── Telling the customer (WhatsApp / call) ──

  sendWhatsApp(r: ReservationResponse, kind: 'confirmed' | 'rejected' | 'reminder'): void {
    const when = this.formatWhen(r);
    const link = this.reservationService.bookingLink(r.id);
    let text: string;
    if (kind === 'rejected') {
      text = `Hi ${r.customerName}, sorry, we can't take your booking at ${this.restaurantName} for ${when}.` +
        (r.responseMessage ? `\n${r.responseMessage}` : '') +
        (this.restaurantPhone ? `\nPlease call us on ${this.restaurantPhone} to find another time.` : '');
    } else {
      text = (kind === 'reminder'
        ? `Hi ${r.customerName}, a reminder of your table at ${this.restaurantName}`
        : `Hi ${r.customerName}, your table at ${this.restaurantName} is confirmed ✅`) +
        `\n📅 ${when} · ${r.partySize} ${r.partySize === 1 ? 'person' : 'people'}` +
        (r.responseMessage ? `\n${r.responseMessage}` : '') +
        `\nView or cancel your booking: ${link}`;
    }
    const phone = this.whatsAppNumber(r.customerMobile);
    if (phone) window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
    this.notifyPrompt = null;
  }

  callLink(r: ReservationResponse): string {
    return `tel:${r.customerMobile}`;
  }

  /** wa.me needs the full international number without "+"; bare 10-digit numbers are treated as Indian. */
  private whatsAppNumber(mobile?: string): string {
    const digits = (mobile ?? '').replace(/\D/g, '');
    if (digits.length === 10) return `91${digits}`;
    if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
    return digits;
  }

  // ── Settings ──

  openSettings(): void {
    this.showSettings = true;
    this.reservationService.getSettings().subscribe({
      next: (s) => this.settings = s,
      error: () => this.showError('Could not load settings.')
    });
  }

  saveSettings(change: Partial<ReservationSettings>): void {
    if (!this.settings) return;
    const previous = { ...this.settings };
    this.settings = { ...this.settings, ...change };
    this.settingsSaving = true;
    this.reservationService.updateSettings(change).subscribe({
      next: (s) => { this.settings = s; this.settingsSaving = false; },
      error: () => { this.settings = previous; this.settingsSaving = false; this.showError('Could not save settings.'); }
    });
  }

  // ── Helpers ──

  formatWhen(r: ReservationResponse): string {
    const d = new Date(r.reservedFor);
    return d.toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  }

  private dayLabel(date: string): string {
    const today = this.isoDate(new Date());
    if (date === today) return 'Today';
    if (date === this.addDays(today, 1)) return 'Tomorrow';
    return new Date(`${date}T00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });
  }

  private emptyForm(): BookingForm {
    // Default: today, next half hour
    const d = new Date(Date.now() + 60 * 60_000);
    d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
    return {
      customerName: '', customerMobile: '', customerEmail: '', partySize: 2,
      date: this.isoDate(d), time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
      durationMinutes: 90, notes: '', tableIds: []
    };
  }

  private isoDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private addDays(date: string, days: number): string {
    const d = new Date(`${date}T00:00`);
    d.setDate(d.getDate() + days);
    return this.isoDate(d);
  }

  private playChime(): void {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 660;
      gain.gain.value = 0.15;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch { /* autoplay blocked */ }
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
