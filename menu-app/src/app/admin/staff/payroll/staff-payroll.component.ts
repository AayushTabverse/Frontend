import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { StaffService } from '../../../services/staff.service';
import { MonthlySalary, StaffPayment, StaffPaymentMode, StaffPaymentType } from '../../../models/api.models';
import { toDateKey } from '../../../shared/date-utils';
import { roleDisplayName } from '../../../shared/permissions';

@Component({
  selector: 'app-staff-payroll',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './staff-payroll.component.html',
  styleUrls: ['./staff-payroll.component.scss']
})
export class StaffPayrollComponent implements OnInit {
  readonly paymentTypes: { value: StaffPaymentType; label: string }[] = [
    { value: 'Salary', label: '💰 Salary' },
    { value: 'Advance', label: '⏩ Advance' },
    { value: 'Bonus', label: '🎁 Bonus' }
  ];
  readonly paymentModes: { value: StaffPaymentMode; label: string }[] = [
    { value: 'Cash', label: 'Cash' },
    { value: 'Upi', label: 'UPI' },
    { value: 'BankTransfer', label: 'Bank transfer' }
  ];

  readonly currentMonth = toDateKey(new Date()).slice(0, 7);
  month = this.currentMonth; // yyyy-MM
  rows: MonthlySalary[] = [];
  payments: StaffPayment[] = [];
  loading = true;
  successMessage = '';
  errorMessage = '';

  // Inline salary editing
  editingSalaryId: string | null = null;
  salaryDraft = 0;

  // Payment dialog
  payFor: MonthlySalary | null = null;
  payment = { type: 'Salary' as StaffPaymentType, amount: 0, mode: 'Cash' as StaffPaymentMode, paidOn: '', notes: '' };
  paySubmitting = false;
  paySubmitted = false;

  readonly roleName = roleDisplayName;

  constructor(private staffService: StaffService) {}

  ngOnInit(): void {
    this.load();
  }

  get year(): number { return Number(this.month.split('-')[0]); }
  get monthNumber(): number { return Number(this.month.split('-')[1]); }

  get monthLabel(): string {
    return new Date(this.year, this.monthNumber - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  }

  load(): void {
    this.loading = true;
    forkJoin({
      salary: this.staffService.getMonthlySalary(this.year, this.monthNumber),
      payments: this.staffService.getPayments(this.year, this.monthNumber)
    }).subscribe({
      next: ({ salary, payments }) => {
        this.rows = salary;
        this.payments = payments;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.showError('Failed to load salary data.');
      }
    });
  }

  changeMonth(value: string): void {
    if (!value) return;
    this.month = value;
    this.editingSalaryId = null;
    this.load();
  }

  shiftMonth(delta: number): void {
    const d = new Date(this.year, this.monthNumber - 1 + delta, 1);
    this.changeMonth(toDateKey(d).slice(0, 7));
  }

  // ── Totals ──

  get totalEarned(): number { return this.sum(r => r.earned); }
  get totalPaid(): number { return this.sum(r => r.salaryPaid + r.advancePaid); }
  get totalBalance(): number { return this.sum(r => Math.max(r.balance, 0)); }
  get totalBonus(): number { return this.sum(r => r.bonusPaid); }

  private sum(fn: (r: MonthlySalary) => number): number {
    return this.rows.reduce((acc, r) => acc + fn(r), 0);
  }

  // ── Salary editing ──

  startEditSalary(row: MonthlySalary): void {
    this.editingSalaryId = row.userId;
    this.salaryDraft = row.monthlySalary;
  }

  cancelEditSalary(): void {
    this.editingSalaryId = null;
  }

  saveSalary(row: MonthlySalary): void {
    const value = Number(this.salaryDraft);
    if (isNaN(value) || value < 0) {
      this.showError('Enter a valid salary amount.');
      return;
    }
    this.staffService.updateSalary(row.userId, value).subscribe({
      next: () => {
        this.editingSalaryId = null;
        this.showSuccess(`Salary updated for ${row.fullName}.`);
        this.load();
      },
      error: (err) => this.showError(err.error?.message || 'Failed to update salary.')
    });
  }

  // ── Payments ──

  openPayment(row: MonthlySalary, type: StaffPaymentType = 'Salary'): void {
    this.payFor = row;
    this.paySubmitted = false;
    this.payment = {
      type,
      amount: type === 'Salary' ? Math.max(Math.round(row.balance * 100) / 100, 0) : 0,
      mode: 'Cash',
      paidOn: toDateKey(new Date()),
      notes: ''
    };
  }

  @HostListener('document:keydown.escape')
  closePayment(): void {
    this.payFor = null;
  }

  submitPayment(): void {
    this.paySubmitted = true;
    if (!this.payFor || !this.payment.amount || this.payment.amount <= 0) return;

    this.paySubmitting = true;
    const name = this.payFor.fullName;
    this.staffService.createPayment({
      userId: this.payFor.userId,
      year: this.year,
      month: this.monthNumber,
      type: this.payment.type,
      amount: this.payment.amount,
      mode: this.payment.mode,
      paidOn: this.payment.paidOn || undefined,
      notes: this.payment.notes || undefined
    }).subscribe({
      next: () => {
        this.paySubmitting = false;
        this.payFor = null;
        this.showSuccess(`${this.payment.type} of ₹${this.payment.amount} recorded for ${name}.`);
        this.load();
      },
      error: (err) => {
        this.paySubmitting = false;
        this.showError(err.error?.message || 'Failed to record payment.');
      }
    });
  }

  deletePayment(p: StaffPayment): void {
    if (!confirm(`Delete this ${p.type.toLowerCase()} of ₹${p.amount} for ${p.fullName}?`)) return;
    this.staffService.deletePayment(p.id).subscribe({
      next: () => {
        this.showSuccess('Payment deleted.');
        this.load();
      },
      error: (err) => this.showError(err.error?.message || 'Failed to delete payment.')
    });
  }

  modeLabel(mode: StaffPaymentMode): string {
    return this.paymentModes.find(m => m.value === mode)?.label ?? mode;
  }

  onlyNumbers(event: KeyboardEvent): void {
    if (!/^[0-9.]$/.test(event.key)) {
      event.preventDefault();
    }
  }

  private showSuccess(msg: string): void {
    this.successMessage = msg;
    setTimeout(() => this.successMessage = '', 3000);
  }

  private showError(msg: string): void {
    this.errorMessage = msg;
    setTimeout(() => this.errorMessage = '', 4000);
  }
}
