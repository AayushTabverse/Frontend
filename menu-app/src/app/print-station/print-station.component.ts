import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subscription, firstValueFrom, merge, map } from 'rxjs';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { ApiResponse, KotTicket } from '../models/api.models';
import { environment } from '../../environments/environment';
import { AuthService } from '../services/auth.service';
import { SettingsService } from '../services/settings.service';
import { SignalRService } from '../services/signalr.service';
import { LanguageSwitcherComponent } from '../shared/components/language-switcher/language-switcher.component';

interface PrintedEntry {
  orderNumber: string;
  destination: string;
  orderType: string;
  at: Date;
  ok: boolean;
  error?: string;
}

/**
 * Counter PC page that prints KOTs as they arrive. Open it in Chrome started with
 * --kiosk-printing so each ticket prints without a dialog. Several stations can stay open:
 * each job is claimed by exactly one.
 */
@Component({
  selector: 'app-print-station',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslocoDirective, LanguageSwitcherComponent],
  templateUrl: './print-station.component.html',
  styleUrl: './print-station.component.scss'
})
export class PrintStationComponent implements OnInit, OnDestroy {
  private static readonly POLL_MS = 20_000;
  private readonly apiUrl = `${environment.apiUrl}/print`;

  paused = false;
  connected = false;
  autoPrintEnabled = true;
  printerWidth = '3inch';
  restaurantName = '';
  printed: PrintedEntry[] = [];

  private busy = false;
  private again = false;
  private sub?: Subscription;
  private poller?: ReturnType<typeof setInterval>;
  private wakeLock: { release(): Promise<void> } | null = null;

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private settings: SettingsService,
    private signalR: SignalRService,
    private transloco: TranslocoService
  ) {}

  async ngOnInit(): Promise<void> {
    this.settings.getSettings().subscribe(s => {
      this.restaurantName = s.name || '';
      this.autoPrintEnabled = !!s.autoPrintKot;
      // Bills on A4 still want a narrow ticket for the kitchen
      this.printerWidth = s.printerWidth && s.printerWidth !== 'standard' ? s.printerWidth : '3inch';
    });

    this.poller = setInterval(() => this.processQueue(), PrintStationComponent.POLL_MS);
    document.addEventListener('visibilitychange', this.onVisible);
    this.keepScreenOn();

    const tenantId = this.auth.getTenantId();
    if (tenantId) {
      await this.signalR.startConnection(tenantId);
      this.connected = true;
      this.sub = merge(this.signalR.printJobCreated$, this.signalR.reconnected$)
        .subscribe(() => this.processQueue());
    }
    this.processQueue();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    clearInterval(this.poller);
    document.removeEventListener('visibilitychange', this.onVisible);
    this.wakeLock?.release().catch(() => {});
  }

  togglePause(): void {
    this.paused = !this.paused;
    if (!this.paused) this.processQueue();
  }

  async testPrint(): Promise<void> {
    await this.printHtml(this.renderKot({
      jobId: '', orderId: '', orderNumber: 'TEST', orderType: 'DineIn', destination: '1',
      createdAt: new Date().toISOString(), copies: 1, isReprint: false,
      specialInstructions: 'Test ticket from the Print Station',
      items: [{ name: 'Paneer Tikka', quantity: 2 }, { name: 'Butter Naan', quantity: 4, notes: 'Extra butter' }]
    }));
  }

  private onVisible = (): void => {
    if (document.visibilityState === 'visible') {
      this.keepScreenOn();
      this.processQueue();
    }
  };

  /** Prints every waiting KOT, one at a time. Calls made meanwhile run once more afterwards. */
  async processQueue(): Promise<void> {
    if (this.paused) return;
    if (this.busy) { this.again = true; return; }
    this.busy = true;
    try {
      do {
        this.again = false;
        const tickets = await firstValueFrom(
          this.http.get<ApiResponse<KotTicket[]>>(`${this.apiUrl}/pending`).pipe(map(r => r.data ?? []))
        );
        for (const ticket of tickets) {
          if (this.paused) break;
          await this.printTicket(ticket);
        }
      } while (this.again && !this.paused);
    } catch {
      // Offline or logged out; the next event or poll tries again
    } finally {
      this.busy = false;
    }
  }

  private async printTicket(ticket: KotTicket): Promise<void> {
    try {
      await firstValueFrom(this.http.put(`${this.apiUrl}/${ticket.jobId}/claim`, {}));
    } catch {
      return; // another station has it
    }

    const entry: PrintedEntry = {
      orderNumber: ticket.orderNumber, destination: ticket.destination, orderType: ticket.orderType,
      at: new Date(), ok: true
    };
    try {
      const html = this.renderKot(ticket);
      for (let i = 0; i < Math.max(1, ticket.copies); i++) await this.printHtml(html);
      await firstValueFrom(this.http.put(`${this.apiUrl}/${ticket.jobId}/printed`, {}));
    } catch (err) {
      entry.ok = false;
      entry.error = err instanceof Error ? err.message : this.transloco.translate<string>('printStation.printFailed');
      // The server's reason goes into the owner's alert: keep it in English
      const reason = err instanceof Error && err.message !== this.transloco.translate('printStation.printFrameError')
        ? err.message : 'Print failed';
      this.http.put(`${this.apiUrl}/${ticket.jobId}/failed?error=${encodeURIComponent(reason)}`, {}).subscribe({ error: () => {} });
    }
    this.printed = [entry, ...this.printed].slice(0, 50);
  }

  /** Hidden-iframe print: silent with --kiosk-printing, otherwise shows the print dialog. */
  private printHtml(html: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;top:-10000px;left:-10000px;width:0;height:0;border:0';
      document.body.appendChild(iframe);
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) { iframe.remove(); reject(new Error(this.transloco.translate('printStation.printFrameError'))); return; }
      iframe.onload = () => {
        try {
          iframe.contentWindow?.print();
          // Give the spooler a moment before the next ticket
          setTimeout(() => { iframe.remove(); resolve(); }, 1200);
        } catch (e) {
          iframe.remove();
          reject(e);
        }
      };
      doc.open();
      doc.write(html);
      doc.close();
    });
  }

  private renderKot(t: KotTicket): string {
    const widths: Record<string, string> = { '2inch': '200px', '3inch': '280px', '4inch': '400px' };
    const width = widths[this.printerWidth] || widths['3inch'];
    const where = t.orderType === 'Takeaway' ? `TAKEAWAY ${esc(t.destination)}`
      : t.orderType === 'RoomService' ? `ROOM ${esc(t.destination)}`
      : `TABLE ${esc(t.destination)}`;
    const time = new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const items = t.items.map(i => `
      <tr><td class="q">${i.quantity}×</td><td><b>${esc(i.name)}</b>${i.isParcel ? ' <span class="tag">PARCEL</span>' : ''}
        ${i.modifiers ? `<div class="sub">${esc(i.modifiers)}</div>` : ''}
        ${i.notes ? `<div class="sub">» ${esc(i.notes)}</div>` : ''}</td></tr>`).join('');

    return `<!doctype html><html><head><meta charset="utf-8"><title>KOT ${esc(t.orderNumber)}</title><style>
      @page { margin: 0; }
      body { font-family: 'Courier New', monospace; width: ${width}; margin: 0; padding: 6px; color: #000; font-size: 13px; }
      .head { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 6px; margin-bottom: 6px; }
      .where { font-size: 22px; font-weight: 800; }
      .meta { font-size: 11px; }
      table { width: 100%; border-collapse: collapse; }
      td { vertical-align: top; padding: 3px 0; font-size: 14px; }
      .q { width: 32px; font-weight: 800; }
      .sub { font-size: 11px; }
      .tag { border: 1px solid #000; font-size: 10px; padding: 0 3px; }
      .note { border-top: 2px dashed #000; margin-top: 6px; padding-top: 6px; font-weight: 700; }
    </style></head><body>
      <div class="head">
        <div class="meta">${esc(this.restaurantName)} · KOT${t.isReprint ? ' (REPRINT)' : ''}</div>
        <div class="where">${where}</div>
        <div class="meta">#${esc(t.orderNumber)} · ${time}</div>
      </div>
      <table>${items}</table>
      ${t.specialInstructions ? `<div class="note">NOTE: ${esc(t.specialInstructions)}</div>` : ''}
    </body></html>`;
  }

  /** Counter PCs go to sleep; an asleep screen stops printing. */
  private async keepScreenOn(): Promise<void> {
    try {
      const nav = navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<{ release(): Promise<void> }> } };
      this.wakeLock = (await nav.wakeLock?.request('screen')) ?? null;
    } catch { /* not supported or not allowed */ }
  }
}

function esc(text: string): string {
  return text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
