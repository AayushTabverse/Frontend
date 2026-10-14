import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SettingsService } from '../../services/settings.service';
import { UploadService } from '../../services/upload.service';
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
    upiId: '',
    upiPayeeName: '',
    printerWidth: 'standard',
    directPrint: false,
    cgstPercent: 2.5,
    sgstPercent: 2.5,
    serviceChargePercent: 0,
    maxDiscountPercent: 0,
    spinWheelEnabled: false
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
  uploading: { [key: string]: boolean } = {};
  settingsSubmitted = false;
  /** Sample dynamic QR (₹1) so the owner can test their UPI ID by scanning. */
  upiTestQrUrl = '';
  upiTestLoading = false;
  upiDetectedMessage = '';

  constructor(
    private settingsService: SettingsService,
    private uploadService: UploadService
  ) {}

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
    this.settingsSubmitted = true;
    if (!this.settings.name?.trim()) {
      this.errorMessage = 'Restaurant name is required.';
      return;
    }
    if (this.settings.phone && this.settings.phone.length !== 10) {
      this.errorMessage = 'Phone number must be exactly 10 digits.';
      return;
    }
    if (this.upiIdInvalid) {
      this.errorMessage = 'Enter a valid UPI ID, like yourshop@okicici.';
      return;
    }

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

  onFileSelected(event: Event, target: 'logo' | 'qr'): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.uploading[target] = true;
    const folder = target === 'logo' ? 'logos' : 'qr-codes';
    this.uploadService.uploadImage(file, folder).subscribe({
      next: (url) => {
        if (target === 'logo') this.settings.logoUrl = url;
        else {
          this.settings.upiQrCodeUrl = url;
          this.readUpiIdFromQr(file);
        }
        this.uploading[target] = false;
      },
      error: () => {
        this.errorMessage = 'Failed to upload image. Please try again.';
        this.uploading[target] = false;
        setTimeout(() => this.errorMessage = '', 5000);
      }
    });
  }

  // ── UPI ID ──

  get upiIdInvalid(): boolean {
    const id = this.settings.upiId?.trim();
    return !!id && !/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z][a-zA-Z0-9.\-]{1,63}$/.test(id);
  }

  /**
   * Fills the UPI ID (and payee name) from an uploaded UPI QR, where the browser can read QR codes.
   * The QR encodes a link like upi://pay?pa=shop@okicici&pn=Shop.
   */
  private async readUpiIdFromQr(file: File): Promise<void> {
    const Detector = (window as any).BarcodeDetector;
    if (!Detector || this.settings.upiId) return;
    try {
      const detector = new Detector({ formats: ['qr_code'] });
      const codes = await detector.detect(await createImageBitmap(file));
      const raw: string | undefined = codes?.[0]?.rawValue;
      if (!raw?.toLowerCase().startsWith('upi://')) return;
      const params = new URLSearchParams(raw.substring(raw.indexOf('?') + 1));
      const pa = params.get('pa');
      if (!pa) return;
      this.settings.upiId = pa;
      if (!this.settings.upiPayeeName && params.get('pn')) this.settings.upiPayeeName = params.get('pn')!;
      this.upiDetectedMessage = `Found UPI ID ${pa} in your QR. Save to use it on bills.`;
    } catch { /* unreadable image; owner can type the ID */ }
  }

  /** Shows a ₹1 test QR for the saved UPI ID. */
  showUpiTestQr(): void {
    this.upiTestLoading = true;
    this.settingsService.getUpiQrBlob(1, 'Test payment').subscribe({
      next: (blob) => {
        if (this.upiTestQrUrl) URL.revokeObjectURL(this.upiTestQrUrl);
        this.upiTestQrUrl = URL.createObjectURL(blob);
        this.upiTestLoading = false;
      },
      error: () => {
        this.upiTestLoading = false;
        this.errorMessage = 'Save your UPI ID first, then try the test QR.';
        setTimeout(() => this.errorMessage = '', 5000);
      }
    });
  }

  onlyNumbers(event: KeyboardEvent): void {
    if (!/^[0-9]$/.test(event.key)) {
      event.preventDefault();
    }
  }
}
