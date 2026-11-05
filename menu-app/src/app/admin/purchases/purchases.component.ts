import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { PaymentAccount, PurchaseBill, PurchaseBillRequest } from '../../models/api.models';
import { AccountingService } from '../../services/accounting.service';
import { toDateKey } from '../../shared/date-utils';

/** Purchase form state (amounts nullable while typing). */
interface PurchaseForm {
  supplierName: string;
  supplierGstin: string;
  invoiceNumber: string;
  invoiceDate: string;
  description: string;
  expenseLedger: string;
  taxableAmount: number | null;
  taxMode: 'intra' | 'inter';
  cgst: number | null;
  sgst: number | null;
  igst: number | null;
  paidAccountKey: string;
}

/** Supplier bills (purchase register) for the CA / Tally export. */
import { apiError } from '../../shared/api-error';

@Component({
  selector: 'app-purchases',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './purchases.component.html',
  styleUrl: './purchases.component.scss'
})
export class PurchasesComponent implements OnInit {
  from = '';
  to = '';
  bills: PurchaseBill[] = [];
  accounts: PaymentAccount[] = [];
  loading = false;
  errorMessage = '';
  successMessage = '';

  // Add / edit modal
  editing: PurchaseBill | null = null;
  form: PurchaseForm | null = null;
  formError = '';
  saving = false;
  readonly gstRates = [5, 12, 18, 28];

  // Mark-paid modal
  paying: PurchaseBill | null = null;
  payAccountKey = '';
  payDate = '';
  payError = '';

  constructor(private accounting: AccountingService) {}

  ngOnInit(): void {
    this.accounting.paymentAccounts().subscribe({
      next: (a) => this.accounts = a,
      error: () => this.accounts = []
    });
    this.thisMonth();
  }

  // ── Range ──

  thisMonth(): void {
    const now = new Date();
    this.from = toDateKey(new Date(now.getFullYear(), now.getMonth(), 1));
    this.to = toDateKey(now);
    this.load();
  }

  lastMonth(): void {
    const now = new Date();
    this.from = toDateKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    this.to = toDateKey(new Date(now.getFullYear(), now.getMonth(), 0));
    this.load();
  }

  load(): void {
    if (!this.from || !this.to || this.from > this.to) {
      this.errorMessage = 'Choose a valid date range (From must be on or before To).';
      return;
    }
    this.loading = true;
    this.errorMessage = '';
    this.accounting.purchases(this.from, this.to).subscribe({
      next: (b) => {
        this.bills = [...b].sort((x, y) => x.invoiceDate.localeCompare(y.invoiceDate) || x.supplierName.localeCompare(y.supplierName));
        this.loading = false;
      },
      error: (err) => { this.loading = false; this.errorMessage = err.error?.message || 'Could not load purchases.'; }
    });
  }

  // ── Display helpers ──

  gst(b: { cgst: number; sgst: number; igst: number }): number {
    return (b.cgst || 0) + (b.sgst || 0) + (b.igst || 0);
  }

  accountLabel(key?: string): string {
    if (!key) return '';
    return this.accounts.find(a => a.key === key)?.label ?? key;
  }

  get totals(): { taxable: number; gst: number; total: number; unpaid: number } {
    return this.bills.reduce((t, b) => ({
      taxable: t.taxable + (b.taxableAmount || 0),
      gst: t.gst + this.gst(b),
      total: t.total + (b.totalAmount || 0),
      unpaid: t.unpaid + (b.paidAccountKey ? 0 : (b.totalAmount || 0))
    }), { taxable: 0, gst: 0, total: 0, unpaid: 0 });
  }

  // ── Add / edit ──

  openAdd(): void {
    this.editing = null;
    this.formError = '';
    this.form = {
      supplierName: '', supplierGstin: '', invoiceNumber: '', invoiceDate: toDateKey(new Date()),
      description: '', expenseLedger: '', taxableAmount: null, taxMode: 'intra',
      cgst: null, sgst: null, igst: null, paidAccountKey: ''
    };
  }

  openEdit(b: PurchaseBill): void {
    this.editing = b;
    this.formError = '';
    this.form = {
      supplierName: b.supplierName, supplierGstin: b.supplierGstin ?? '', invoiceNumber: b.invoiceNumber,
      invoiceDate: b.invoiceDate.slice(0, 10), description: b.description ?? '', expenseLedger: b.expenseLedger ?? '',
      taxableAmount: b.taxableAmount, taxMode: b.igst > 0 ? 'inter' : 'intra',
      cgst: b.cgst || null, sgst: b.sgst || null, igst: b.igst || null, paidAccountKey: b.paidAccountKey ?? ''
    };
  }

  closeForm(): void {
    this.form = null;
    this.editing = null;
  }

  private round2(n: number): number {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  /** CGST/SGST are always equal; typing one fills the other. */
  syncSgst(): void {
    if (this.form) this.form.sgst = this.form.cgst;
  }

  applyRate(rate: number): void {
    const f = this.form;
    if (!f || !f.taxableAmount) return;
    const tax = this.round2(f.taxableAmount * rate / 100);
    if (f.taxMode === 'inter') {
      f.igst = tax;
    } else {
      // Split the rounded total so CGST + SGST add up to it exactly
      f.cgst = this.round2(tax / 2);
      f.sgst = this.round2(tax - f.cgst);
    }
  }

  get formTotal(): number {
    const f = this.form;
    if (!f) return 0;
    const tax = f.taxMode === 'inter' ? (f.igst || 0) : (f.cgst || 0) + (f.sgst || 0);
    return this.round2((f.taxableAmount || 0) + tax);
  }

  saveForm(): void {
    const f = this.form;
    if (!f) return;
    this.formError = '';
    const gstin = f.supplierGstin.trim().toUpperCase();
    if (!f.supplierName.trim()) { this.formError = 'Enter the supplier name.'; return; }
    if (!f.invoiceNumber.trim()) { this.formError = 'Enter the invoice number.'; return; }
    if (!f.invoiceDate) { this.formError = 'Enter the invoice date.'; return; }
    if (gstin && gstin.length !== 15) { this.formError = 'Supplier GSTIN must be 15 characters (or leave it blank).'; return; }
    if (!f.taxableAmount || f.taxableAmount <= 0) { this.formError = 'Enter the taxable amount.'; return; }
    const inter = f.taxMode === 'inter';
    const cgst = inter ? 0 : this.round2(f.cgst || 0);
    const sgst = inter ? 0 : this.round2(f.sgst || 0);
    const igst = inter ? this.round2(f.igst || 0) : 0;
    if (cgst < 0 || sgst < 0 || igst < 0) { this.formError = 'Tax amounts cannot be negative.'; return; }

    const req: PurchaseBillRequest = {
      supplierName: f.supplierName.trim(),
      supplierGstin: gstin || undefined,
      invoiceNumber: f.invoiceNumber.trim(),
      invoiceDate: f.invoiceDate,
      description: f.description.trim() || undefined,
      expenseLedger: f.expenseLedger.trim() || undefined,
      taxableAmount: this.round2(f.taxableAmount),
      cgst, sgst, igst,
      paidAccountKey: f.paidAccountKey || undefined
    };

    this.saving = true;
    const call = this.editing ? this.accounting.updatePurchase(this.editing.id, req) : this.accounting.addPurchase(req);
    const wasEdit = !!this.editing;
    call.subscribe({
      next: () => {
        this.saving = false;
        this.closeForm();
        this.flash(wasEdit ? 'Purchase updated.' : 'Purchase added.');
        this.load();
      },
      error: (err) => { this.saving = false; this.formError = apiError(err, 'Could not save the purchase.'); }
    });
  }

  // ── Mark paid ──

  openPay(b: PurchaseBill): void {
    this.paying = b;
    this.payError = '';
    this.payDate = toDateKey(new Date());
    const nonCash = this.accounts.find(a => a.kind !== 'Cash');
    this.payAccountKey = (nonCash ?? this.accounts[0])?.key ?? '';
  }

  confirmPay(): void {
    if (!this.paying || !this.payAccountKey) { this.payError = 'Choose the account it was paid from.'; return; }
    this.saving = true;
    this.accounting.payPurchase(this.paying.id, this.payAccountKey, this.payDate || undefined).subscribe({
      next: () => {
        this.saving = false;
        this.paying = null;
        this.flash('Marked as paid.');
        this.load();
      },
      error: (err) => { this.saving = false; this.payError = err.error?.message || 'Could not mark as paid.'; }
    });
  }

  // ── Delete ──

  remove(b: PurchaseBill): void {
    if (!confirm(`Delete invoice ${b.invoiceNumber} from ${b.supplierName} (₹${b.totalAmount})? This cannot be undone.`)) return;
    this.accounting.deletePurchase(b.id).subscribe({
      next: () => { this.flash('Purchase deleted.'); this.load(); },
      error: (err) => this.errorMessage = err.error?.message || 'Could not delete the purchase.'
    });
  }

  private flash(text: string): void {
    this.successMessage = text;
    setTimeout(() => { if (this.successMessage === text) this.successMessage = ''; }, 3000);
  }
}
