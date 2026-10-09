import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { SubscriptionService } from '../../../services/subscription.service';
import { ThemeService } from '../../../services/theme.service';
import { SettingsService } from '../../../services/settings.service';
import { NavItem, navItemsFor } from '../../permissions';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.scss'
})
export class AdminLayoutComponent implements OnInit {
  sidebarCollapsed = false;
  mobileSidebarOpen = false;
  hasPremium = true;
  navItems: NavItem[] = [];
  panelTitle = 'Admin';
  userName = '';
  logoUrl = '';

  private subService = inject(SubscriptionService);

  constructor(
    private authService: AuthService,
    private router: Router,
    private settingsService: SettingsService,
    public themeService: ThemeService
  ) {
    this.authService.currentUser$.subscribe(u => this.userName = u?.fullName || '');
    this.panelTitle = this.authService.isAdmin() ? 'Admin' : (this.authService.getRole() ?? 'Admin');
    this.navItems = navItemsFor(this.authService.getRole(), this.hasPremium);
  }

  ngOnInit(): void {
    this.subService.getStatus().subscribe(s => {
      this.hasPremium = s.isTrialActive || s.plan === 'Premium';
      this.navItems = navItemsFor(this.authService.getRole(), this.hasPremium);
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
