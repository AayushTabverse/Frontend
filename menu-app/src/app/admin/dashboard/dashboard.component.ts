import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AnalyticsService } from '../../services/analytics.service';
import { DueService } from '../../services/due.service';
import { DashboardSummary, CustomerDue } from '../../models/api.models';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  summary?: DashboardSummary;
  loading = true;
  unsettledDues: CustomerDue[] = [];

  constructor(
    private analyticsService: AnalyticsService,
    private dueService: DueService
  ) {}

  ngOnInit(): void {
    this.analyticsService.getDashboard().subscribe({
      next: (data) => {
        this.summary = data;
        this.loading = false;
      },
      error: () => this.loading = false
    });

    this.dueService.getDues().subscribe({
      next: (dues) => this.unsettledDues = dues.slice(0, 10)
    });
  }
}
