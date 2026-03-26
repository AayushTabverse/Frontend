import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { DueService } from '../../services/due.service';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { CustomerDue } from '../../models/api.models';

@Component({
  selector: 'app-dues',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './dues.component.html',
  styleUrl: './dues.component.scss'
})
export class DuesComponent implements OnInit {
  dues: CustomerDue[] = [];
  loading = true;
  searchQuery = '';
  showSettled = false;
  successMessage = '';
  errorMessage = '';
  sidebarCollapsed = false;
  mobileSidebarOpen = false;
  totalOutstanding = 0;

  settleAmounts: { [id: string]: number } = {};
  settling: { [id: string]: boolean } = {};

  private searchTimeout: any;

  constructor(
    private dueService: DueService,
    private authService: AuthService,
    private router: Router,
    public themeService: ThemeService
  ) {}

  ngOnInit(): void {
    this.loadDues();
  }

  loadDues(): void {
    this.loading = true;
    this.dueService.getDues(this.showSettled).subscribe({
      next: (dues) => {
        this.dues = dues;
        this.totalOutstanding = dues.filter(d => !d.isSettled).reduce((sum, d) => sum + d.dueAmount, 0);
        this.loading = false;
      },
      error: () => {
        this.errorMessage = 'Failed to load dues.';
        this.loading = false;
      }
    });
  }

  onSearch(): void {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      if (this.searchQuery.trim()) {
        this.loading = true;
        this.dueService.searchDues(this.searchQuery).subscribe({
          next: (dues) => {
            this.dues = dues;
            this.totalOutstanding = dues.filter(d => !d.isSettled).reduce((sum, d) => sum + d.dueAmount, 0);
            this.loading = false;
          },
          error: () => this.loading = false
        });
      } else {
        this.loadDues();
      }
    }, 400);
  }

  capSettleAmount(event: Event, due: CustomerDue): void {
    const input = event.target as HTMLInputElement;
    const val = +input.value;
    if (val > due.dueAmount) {
      input.value = String(due.dueAmount);
      this.settleAmounts[due.id] = due.dueAmount;
    }
  }

  settleDue(due: CustomerDue): void {
    const amount = this.settleAmounts[due.id];
    if (!amount || amount <= 0 || amount > due.dueAmount) return;

    this.settling[due.id] = true;
    this.dueService.settleDue(due.id, amount).subscribe({
      next: (updated) => {
        // Update the due in the list
        const index = this.dues.findIndex(d => d.id === due.id);
        if (index >= 0) {
          this.dues[index] = updated;
        }
        this.totalOutstanding = this.dues.filter(d => !d.isSettled).reduce((sum, d) => sum + d.dueAmount, 0);
        this.settling[due.id] = false;
        this.settleAmounts[due.id] = 0;
        this.successMessage = updated.isSettled
          ? `Due from ${due.customerName} fully settled!`
          : `₹${amount} received from ${due.customerName}. Remaining: ₹${updated.dueAmount}`;
        setTimeout(() => this.successMessage = '', 5000);
      },
      error: (err) => {
        this.settling[due.id] = false;
        this.errorMessage = err.error?.message || 'Failed to settle due.';
        setTimeout(() => this.errorMessage = '', 5000);
      }
    });
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/admin/login']);
  }
}
