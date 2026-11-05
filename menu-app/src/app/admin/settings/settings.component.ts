import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SettingsService } from '../../services/settings.service';
import { UploadService } from '../../services/upload.service';
import { BusinessSettings } from '../../models/api.models';

import { apiError } from '../../shared/api-error';

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
    spinWheelEnabled: false,
    autoPrintKot: false,
    kotPrintTrigger: 'OnOrder',
    kotCopies: 1,
    takeawayEnabled: false,
    takeawayPackingFee: 0,
    qrOrderingHoursEnabled: false,
    lastOrderMinutes: 0,
    geofenceRadiusMeters: 0,
    hotelModeEnabled: false,
    loyaltyEnabled: false,
    loyaltyPointsPer100: 5,
    loyaltyPointValue: 1,
    loyaltyMinRedeemPoints: 100,
    loyaltyMaxRedeemPercent: 20,
    loyaltyExpiryMonths: 12,
    loyaltyWelcomeBonus: 0,
    loyaltyBirthdayBonus: 0,
    loyaltyDailyEarnCap: 0
  };

  /** Effective cashback: what a customer gets back per ₹100, as a %. */
  get loyaltyCashbackPercent(): number {
    return Math.round((this.settings.loyaltyPointsPer100 ?? 0) * (this.settings.loyaltyPointValue ?? 0) * 100) / 100;
  }

  locating = false;
  locationError = '';

  get overrideActive(): boolean {
    return !!this.settings.orderingOpenUntil && new Date(this.settings.orderingOpenUntil) > new Date();
  }

  /** "Open now" for a late party or an early start; 0 goes back to normal hours. */
  setOrderingOverride(minutes: number): void {
    this.settingsService.setOrderingOverride(minutes).subscribe({
      next: (s) => this.settings.orderingOpenUntil = s.orderingOpenUntil,
      error: () => this.errorMessage = 'Could not change QR ordering. Try again.'
    });
  }

  /** Saves this device's position as the restaurant's location (use it from inside the restaurant). */
  useCurrentLocation(): void {
    this.locationError = '';
    if (!navigator.geolocation) {
      this.locationError = 'This browser cannot share its location.';
      return;
    }
    this.locating = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.locating = false;
        this.settings.latitude = +pos.coords.latitude.toFixed(6);
        this.settings.longitude = +pos.coords.longitude.toFixed(6);
        if (!this.settings.geofenceRadiusMeters) this.settings.geofenceRadiusMeters = 200;
        if (pos.coords.accuracy > 100)
          this.locationError = `Location is only accurate to about ${Math.round(pos.coords.accuracy)} m here. Try near a window or on a phone, or enter it from Google Maps.`;
      },
      () => {
        this.locating = false;
        this.locationError = 'Location permission was denied. Allow it for this site and try again.';
      },
      { enableHighAccuracy: true, timeout: 20_000 }
    );
  }

  takeawayQrUrl = '';

  /** Loads the counter QR the first time takeaway is shown. */
  loadTakeawayQr(): void {
    if (this.takeawayQrUrl) return;
    this.settingsService.getTakeawayQrBlob().subscribe({
      next: (blob) => this.takeawayQrUrl = URL.createObjectURL(blob),
      error: () => {}
    });
  }

  printTakeawayQr(): void {
    const w = window.open('', '_blank');
    if (!w) return;
    const name = (this.settings.name || '').replace(/[<>&]/g, '');
    w.document.write(`<html><head><title>Takeaway QR</title><style>body{font-family:sans-serif;text-align:center;padding:40px}img{width:320px}h1{margin:0 0 8px}</style></head>
      <body><h1>🥡 Order takeaway here</h1><p>${name}: scan, order and we'll call your token</p>
      <img src="${this.takeawayQrUrl}" onload="window.print()" /></body></html>`);
    w.document.close();
  }

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
        if (data.takeawayEnabled) this.loadTakeawayQr();
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
        this.errorMessage = apiError(err, 'Failed to save settings.');
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
