import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subject, Subscription, debounceTime } from 'rxjs';
import { CustomerList, CustomerListItem, LoyaltyTransaction } from '../../models/api.models';
import { CustomerService } from '../../services/customer.service';

/** Owner/manager: customers, their visits and loyalty points, with the points ledger. */
@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './customers.component.html',
  styleUrl: './customers.component.scss'
})
export class CustomersComponent implements OnInit, OnDestroy {
  private static readonly PAGE_SIZE = 30;

  data: CustomerList | null = null;
  loading = true;
  query = '';
  sort: 'recent' | 'points' | 'spend' | 'visits' = 'recent';
  page = 1;
  errorMessage = '';

  // Detail panel
  selected: CustomerListItem | null = null;
  ledger: LoyaltyTransaction[] = [];
  editName = '';
  editDob = '';
  adjustPoints: number | null = null;
  adjustReason = '';
  busy = false;
  panelMessage = '';

  private search$ = new Subject<void>();
  private sub?: Subscription;

  constructor(private customers: CustomerService) {}

  ngOnInit(): void {
    this.sub = this.search$.pipe(debounceTime(300)).subscribe(() => { this.page = 1; this.load(); });
    this.load();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  onSearch(): void {
    this.search$.next();
  }

  setSort(sort: CustomersComponent['sort']): void {
    this.sort = sort;
    this.page = 1;
    this.load();
  }

  load(): void {
    this.loading = !this.data;
    this.customers.list(this.query, this.sort, this.page, CustomersComponent.PAGE_SIZE).subscribe({
      next: (d) => { this.data = d; this.loading = false; },
      error: () => { this.loading = false; this.errorMessage = 'Could not load customers.'; }
    });
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil((this.data?.totalCount ?? 0) / CustomersComponent.PAGE_SIZE));
  }

  goToPage(page: number): void {
    this.page = page;
    this.load();
  }

  open(c: CustomerListItem): void {
    this.selected = c;
    this.editName = c.customerName;
    this.editDob = c.dateOfBirth ?? '';
    this.adjustPoints = null;
    this.adjustReason = '';
    this.panelMessage = '';
    this.ledger = [];
    this.customers.ledger(c.id).subscribe(rows => this.ledger = rows);
  }

  close(): void {
    this.selected = null;
  }

  saveDetails(): void {
    if (!this.selected || !this.editName.trim()) return;
    this.busy = true;
    this.customers.update(this.selected.id, this.editName.trim(), this.editDob || undefined).subscribe({
      next: (c) => { this.busy = false; Object.assign(this.selected!, c); this.panelMessage = 'Saved.'; },
      error: (err) => { this.busy = false; this.panelMessage = err.error?.message || 'Could not save.'; }
    });
  }

  applyAdjustment(): void {
    if (!this.selected || !this.adjustPoints || !this.adjustReason.trim()) return;
    this.busy = true;
    this.customers.adjustPoints(this.selected.id, this.adjustPoints, this.adjustReason.trim()).subscribe({
      next: (balance) => {
        this.busy = false;
        this.selected!.pointsBalance = balance;
        this.adjustPoints = null;
        this.adjustReason = '';
        this.panelMessage = 'Points updated.';
        this.customers.ledger(this.selected!.id).subscribe(rows => this.ledger = rows);
        this.load();
      },
      error: (err) => { this.busy = false; this.panelMessage = err.error?.message || 'Could not update points.'; }
    });
  }

  exportCsv(): void {
    this.customers.exportCsv(this.query).subscribe(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'customers.csv';
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  typeLabel(type: string): string {
    return { Earn: 'Earned', Redeem: 'Used', Expire: 'Expired', Bonus: 'Bonus', Adjust: 'Adjusted', Reverse: 'Taken back' }[type] ?? type;
  }
}
