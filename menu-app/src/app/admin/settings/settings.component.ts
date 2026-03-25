import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { SettingsService } from '../../services/settings.service';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { BusinessSettings } from '../../models/api.models';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent implements OnInit {
  settings: BusinessSettings = {
    name: '',
    logoUrl: '',
    address: '',
    phone: '',
    instagramUrl: '',
    facebookUrl: '',
    twitterUrl: '',
    websiteUrl: '',
    googleMapsUrl: '',
    upiQrCodeUrl: '',
    printerWidth: 'standard',
    directPrint: false,
    cgstPercent: 2.5,
    sgstPercent: 2.5,
    serviceChargePercent: 0
  };

  printerWidthOptions = [
    { value: 'standard', label: 'Standard (A4 / Letter)' },
    { value: '2inch', label: 'Thermal 2" (58mm)' },
    { value: '3inch', label: 'Thermal 3" (80mm)' },
    { value: '4inch', label: 'Thermal 4" (112mm)' }
  ];

  loading = true;
  saving = false;
  successMessage = '';
  errorMessage = '';
  userName = '';
  sidebarCollapsed = false;
  mobileSidebarOpen = false;

  constructor(
    private settingsService: SettingsService,
    private authService: AuthService,
    private router: Router,
    public themeService: ThemeService
  ) {
    this.authService.currentUser$.subscribe(u => this.userName = u?.fullName || '');
  }

  ngOnInit(): void {
    this.settingsService.getSettings().subscribe({
      next: (data) => {
        this.settings = data;
        this.loading = false;
      },
      error: () => {
        this.errorMessage = 'Failed to load settings.';
        this.loading = false;
      }
    });
  }

  save(): void {
    this.saving = true;
    this.successMessage = '';
    this.errorMessage = '';

    this.settingsService.updateSettings(this.settings).subscribe({
      next: (data) => {
        this.settings = data;
        this.saving = false;
        this.successMessage = 'Settings saved successfully!';
        setTimeout(() => this.successMessage = '', 4000);
      },
      error: (err) => {
        this.saving = false;
        this.errorMessage = err.error?.message || 'Failed to save settings.';
      }
    });
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/admin/login']);
  }
}
