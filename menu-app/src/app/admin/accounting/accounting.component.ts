import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Observable } from 'rxjs';
import {
  AccountingLedgers, AccountingSettings, AccountingSummary, PaymentAccount, PaymentAccountKind
} from '../../models/api.models';
import { AccountingService } from '../../services/accounting.service';
import { toDateKey } from '../../shared/date-utils';

/** Account row being edited; `isNew` rows get their key generated from the label. */
interface AccountRow extends PaymentAccount { isNew: boolean; /** Ledger name auto-filled from the label (until the user edits it). */ autoLedger?: string; }

type ReportKind = 'daily' | 'gst' | 'udhaar' | 'purchases';

/** For the CA: period summary, Tally XML export, CSV reports and accounting setup. */
import { apiError } from '../../shared/api-error';

@Component({
  selector: 'app-accounting',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './accounting.component.html',
  styleUrl: './accounting.component.scss'
})
export class AccountingComponent implements OnInit {
  tab: 'summary' | 'setup' = 'summary';

  // ── Summary & Tally ──
  from = '';
  to = '';
  summary: AccountingSummary | null = null;
  loading = false;
  errorMessage = '';
  downloading = '';
  /** Account labels that appear in `received` for the period (column order). */
  receivedLabels: string[] = [];

  readonly reports: { kind: ReportKind; label: string }[] = [
    { kind: 'daily', label: 'Daily summary' },
    { kind: 'gst', label: 'GST summary' },
    { kind: 'udhaar', label: 'Udhaar ageing' },
    { kind: 'purchases', label: 'Purchase register' }
  ];

  // ── Setup ──
  settings: AccountingSettings | null = null;
  accounts: AccountRow[] = [];
  settingsLoading = false;
  saving = false;
  setupMessage = '';
  setupError = '';

  readonly kinds: { value: PaymentAccountKind; label: string }[] = [
    { value: 'Cash', label: 'Cash' },
    { value: 'Upi', label: 'UPI' },
    { value: 'Card', label: 'Card' },
    { value: 'Bank', label: 'Bank' }
  ];

  readonly ledgerFields: { key: keyof AccountingLedgers; label: string; hint?: string }[] = [
    { key: 'sales', label: 'Food sales' },
    { key: 'packing', label: 'Packing charges' },
    { key: 'serviceCharge', label: 'Service charge' },
    { key: 'cgst', label: 'Output CGST' },
    { key: 'sgst', label: 'Output SGST' },
    { key: 'discount', label: 'Discount' },
    { key: 'loyaltyDiscount', label: 'Loyalty points discount' },
    { key: 'roundOff', label: 'Round off' },
    { key: 'salary', label: 'Salaries' },
    { key: 'purchases', label: 'Purchases', hint: 'Default for supplier bills' },
    { key: 'inputCgst', label: 'Input CGST' },
    { key: 'inputSgst', label: 'Input SGST' },
    { key: 'inputIgst', label: 'Input IGST' }
  ];

  constructor(private accounting: AccountingService) {}

  ngOnInit(): void {
    this.thisMonth();
  }

  // ── Tabs ──

  showSetup(): void {
    this.tab = 'setup';
    if (!this.settings && !this.settingsLoading) this.loadSettings();
  }

  // ── Date range ──

  today(): void {
    const d = toDateKey(new Date());
    this.setRange(d, d);
  }

  thisMonth(): void {
    const now = new Date();
    this.setRange(toDateKey(new Date(now.getFullYear(), now.getMonth(), 1)), toDateKey(now));
  }

  lastMonth(): void {
    const now = new Date();
    this.setRange(
      toDateKey(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      toDateKey(new Date(now.getFullYear(), now.getMonth(), 0))
    );
  }

  private setRange(from: string, to: string): void {
    this.from = from;
    this.to = to;
    this.load();
  }

  get rangeValid(): boolean {
    return !!this.from && !!this.to && this.from <= this.to;
  }

  load(): void {
    if (!this.rangeValid) {
      this.errorMessage = 'Choose a valid date range (From must be on or before To).';
      return;
    }
    this.loading = true;
    this.errorMessage = '';
    this.accounting.summary(this.from, this.to).subscribe({
      next: (s) => {
        this.summary = s;
        const labels = new Set<string>(Object.keys(s.total?.received ?? {}));
        s.days.forEach(d => Object.keys(d.received ?? {}).forEach(k => labels.add(k)));
        this.receivedLabels = [...labels];
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.summary = null;
        this.errorMessage = err.error?.message || 'Could not load the summary.';
      }
    });
  }

  gst(d: { cgst: number; sgst: number }): number {
    return (d.cgst || 0) + (d.sgst || 0);
  }

  received(d: { received: Record<string, number> }, label: string): number {
    return d.received?.[label] ?? 0;
  }

  // ── Downloads ──

  downloadTally(kind: 'masters' | 'vouchers'): void {
    const name = kind === 'masters' ? 'ledgers' : 'vouchers';
    this.download(`tally-${kind}`, this.accounting.tallyXml(kind, this.from, this.to), `tally-${name}-${this.from}-${this.to}.xml`);
  }

  downloadReport(kind: ReportKind): void {
    this.download(`csv-${kind}`, this.accounting.reportCsv(kind, this.from, this.to), `${kind}-${this.from}-${this.to}.csv`);
  }

  private download(id: string, source: Observable<Blob>, fileName: string): void {
    if (!this.rangeValid || this.downloading) return;
    this.downloading = id;
    this.errorMessage = '';
    source.subscribe({
      next: (blob) => {
        this.downloading = '';
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      error: async (err) => {
        this.downloading = '';
        this.errorMessage = (await this.blobErrorMessage(err)) || 'Download failed.';
      }
    });
  }

  /** Blob responses carry the server's JSON error as a Blob. */
  private async blobErrorMessage(err: any): Promise<string> {
    try {
      if (err?.error instanceof Blob) {
        const parsed = JSON.parse(await err.error.text());
        return parsed?.message || '';
      }
      return err?.error?.message || '';
    } catch {
      return '';
    }
  }

  // ── Setup ──

  loadSettings(): void {
    this.settingsLoading = true;
    this.setupError = '';
    this.accounting.getSettings().subscribe({
      next: (s) => { this.applySettings(s); this.settingsLoading = false; },
      error: (err) => { this.settingsLoading = false; this.setupError = err.error?.message || 'Could not load settings.'; }
    });
  }

  private applySettings(s: AccountingSettings): void {
    this.settings = {
      ...s,
      ledgers: { ...s.ledgers },
      paymentAccounts: s.paymentAccounts ?? []
    };
    this.accounts = (s.paymentAccounts ?? []).map(a => ({ ...a, isNew: false }));
  }

  addAccount(): void {
    this.accounts.push({ key: '', label: '', kind: 'Upi', ledger: '', isNew: true });
  }

  removeAccount(i: number): void {
    const row = this.accounts[i];
    if (!row.isNew && !confirm(`Remove "${row.label}"? Past payments to it keep their history, but it can't be chosen for new bills.`)) return;
    this.accounts.splice(i, 1);
    if (this.settings && this.settings.salaryBankAccountKey === row.key) this.settings.salaryBankAccountKey = '';
  }

  /** Regenerates keys for new rows from their labels (unique, never touching existing keys). */
  onLabelChange(row: AccountRow): void {
    if (!row.isNew) return;
    const taken = new Set(this.accounts.filter(a => a !== row).map(a => a.key));
    const base = this.slug(row.label) || row.kind.toLowerCase();
    let key = base;
    for (let n = 2; taken.has(key); n++) key = `${base}-${n}`;
    row.key = key;
    if (!row.ledger || row.ledger === row.autoLedger) {
      row.ledger = row.label.trim();
      row.autoLedger = row.ledger;
    }
  }

  onKindChange(row: AccountRow): void {
    if (row.isNew && !row.label.trim()) this.onLabelChange(row);
    if (row.kind === 'Cash' && this.settings?.salaryBankAccountKey === row.key) this.settings.salaryBankAccountKey = '';
  }

  private slug(text: string): string {
    return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  }

  get nonCashAccounts(): AccountRow[] {
    return this.accounts.filter(a => a.kind !== 'Cash' && a.key);
  }

  private validateSetup(): string {
    if (!this.settings) return 'Settings not loaded.';
    const gstin = (this.settings.gstin ?? '').trim();
    if (gstin && gstin.length !== 15) return 'GSTIN must be exactly 15 characters.';
    if (!this.accounts.length) return 'Add at least one payment account.';
    if (!this.accounts.some(a => a.kind === 'Cash')) return 'At least one Cash account is required.';
    for (const a of this.accounts) {
      if (!a.label.trim()) return 'Every payment account needs a label.';
      if (!a.ledger.trim()) return `Enter the Tally ledger name for "${a.label}".`;
      if (!a.key) return `Could not make a key for "${a.label}".`;
    }
    const keys = this.accounts.map(a => a.key);
    if (new Set(keys).size !== keys.length) return 'Two payment accounts have the same key — change one of the labels.';
    const labels = this.accounts.map(a => a.label.trim().toLowerCase());
    if (new Set(labels).size !== labels.length) return 'Two payment accounts have the same label.';
    const missing = this.ledgerFields.find(f => !(this.settings!.ledgers[f.key] ?? '').trim());
    if (missing) return `Enter the ledger name for "${missing.label}".`;
    return '';
  }

  saveSetup(): void {
    this.setupMessage = '';
    this.setupError = this.validateSetup();
    if (this.setupError || !this.settings) return;

    const ledgers = { ...this.settings.ledgers };
    (Object.keys(ledgers) as (keyof AccountingLedgers)[]).forEach(k => ledgers[k] = (ledgers[k] ?? '').trim());
    const salaryKey = this.settings.salaryBankAccountKey;
    const payload: AccountingSettings = {
      gstin: (this.settings.gstin ?? '').trim().toUpperCase() || undefined,
      stateName: (this.settings.stateName ?? '').trim() || undefined,
      paymentAccounts: this.accounts.map(a => ({ key: a.key, label: a.label.trim(), kind: a.kind, ledger: a.ledger.trim() })),
      ledgers,
      salaryBankAccountKey: salaryKey && this.nonCashAccounts.some(a => a.key === salaryKey) ? salaryKey : undefined
    };

    this.saving = true;
    this.accounting.saveSettings(payload).subscribe({
      next: (s) => {
        this.saving = false;
        this.applySettings(s);
        this.setupMessage = 'Settings saved.';
        this.accounting.paymentAccounts(true).subscribe();
      },
      error: (err) => {
        this.saving = false;
        this.setupError = apiError(err, 'Could not save settings.');
      }
    });
  }

  uppercaseGstin(): void {
    if (this.settings) this.settings.gstin = (this.settings.gstin ?? '').toUpperCase();
  }
}
