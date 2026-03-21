import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AnalyticsService } from '../../services/analytics.service';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { SettingsService } from '../../services/settings.service';
import { DashboardSummary } from '../../models/api.models';

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
  userName = '';
  logoUrl = '';
  sidebarCollapsed = false;

  constructor(
    private analyticsService: AnalyticsService,
    private authService: AuthService,
    private router: Router,
    public themeService: ThemeService,
    private settingsService: SettingsService
  ) {
    this.userName = this.authService.currentUser$
      ? '' : '';
    this.authService.currentUser$.subscribe(u => this.userName = u?.fullName || '');
  }

  ngOnInit(): void {
    this.analyticsService.getDashboard().subscribe({
      next: (data) => {
        this.summary = data;
        this.loading = false;
      },
      error: () => this.loading = false
    });

    this.settingsService.getSettings().subscribe({
      next: (s) => this.logoUrl = s.logoUrl || ''
    });
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/admin/login']);
  }
}
