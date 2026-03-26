import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="register-page">
      <!-- Branding Panel -->
      <div class="brand-panel">
        <div class="brand-bg">
          <div class="orb orb-1"></div>
          <div class="orb orb-2"></div>
          <div class="grid-overlay"></div>
        </div>
        <div class="brand-content">
          <div class="brand-logo">
            <span class="logo-icon">◈</span>
            <span class="logo-text">Tab<span class="accent">Verse</span></span>
          </div>
          <h2 class="brand-title">Launch your restaurant<br/><span class="gradient-text">in minutes.</span></h2>
          <p class="brand-desc">Join TabVerse and get QR ordering, kitchen sync, analytics, your own website, and AI marketing — all in one platform.</p>
          <div class="brand-highlights">
            <div class="bh">
              <span class="bh-icon">⚡</span>
              <div>
                <strong>Go Live Instantly</strong>
                <span>Set up in under 2 minutes</span>
              </div>
            </div>
            <div class="bh">
              <span class="bh-icon">🎁</span>
              <div>
                <strong>1 Month Free Trial</strong>
                <span>No credit card required</span>
              </div>
            </div>
            <div class="bh">
              <span class="bh-icon">♾️</span>
              <div>
                <strong>Unlimited Everything</strong>
                <span>Tables, staff, orders — no limits</span>
              </div>
            </div>
            <div class="bh">
              <span class="bh-icon">🤖</span>
              <div>
                <strong>AI-Powered</strong>
                <span>Marketing posts & promotions</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Form Panel -->
      <div class="form-panel">
        <div class="register-card">
          <!-- Step Indicators -->
          <div class="steps">
            <div class="step" [class.active]="step === 1" [class.done]="step > 1">
              <span class="step-num">{{ step > 1 ? '✓' : '1' }}</span>
              <span class="step-label">Restaurant</span>
            </div>
            <div class="step-line" [class.done]="step > 1"></div>
            <div class="step" [class.active]="step === 2" [class.done]="step > 2">
              <span class="step-num">{{ step > 2 ? '✓' : '2' }}</span>
              <span class="step-label">Admin Account</span>
            </div>
            <div class="step-line" [class.done]="step > 2"></div>
            <div class="step" [class.active]="step === 3">
              <span class="step-num">3</span>
              <span class="step-label">Confirm</span>
            </div>
          </div>

          <!-- Step 1: Restaurant Details -->
          <div class="step-content" *ngIf="step === 1">
            <h1>Register Your Restaurant</h1>
            <p class="subtitle">Let's get your restaurant online in minutes</p>

            <div class="form-group">
              <label>Restaurant Name <span class="required">*</span></label>
              <input type="text" [(ngModel)]="restaurantName" placeholder="e.g. The Spice Kitchen"
                     [class.invalid]="submitted && !restaurantName" />
              <span class="field-error" *ngIf="submitted && !restaurantName">Restaurant name is required</span>
            </div>

            <div class="form-group">
              <label>Address <span class="required">*</span></label>
              <input type="text" [(ngModel)]="address" placeholder="123 Main St, City"
                     [class.invalid]="submitted && !address" />
              <span class="field-error" *ngIf="submitted && !address">Address is required</span>
            </div>

            <div class="form-group">
              <label>Phone <span class="required">*</span></label>
              <input type="tel" [(ngModel)]="phone" placeholder="9876543210" maxlength="10"
                     (keypress)="onlyNumbers($event)"
                     [class.invalid]="submitted && (!phone || phone.length !== 10)" />
              <span class="field-error" *ngIf="submitted && !phone">Phone number is required</span>
              <span class="field-error" *ngIf="submitted && phone && phone.length !== 10">Phone must be exactly 10 digits</span>
            </div>

            <button class="next-btn" (click)="nextStep()">Continue →</button>

            <div class="alt-action">
              Already have an account? <a routerLink="/admin/login">Sign In</a>
            </div>
          </div>

          <!-- Step 2: Admin Account -->
          <div class="step-content" *ngIf="step === 2">
            <h2>Create Admin Account</h2>
            <p class="subtitle">This will be the owner/manager account</p>

            <div class="form-group">
              <label>Full Name <span class="required">*</span></label>
              <input type="text" [(ngModel)]="adminName" placeholder="John Smith"
                     [class.invalid]="submitted && !adminName" />
              <span class="field-error" *ngIf="submitted && !adminName">Required</span>
            </div>

            <div class="form-group">
              <label>Email <span class="required">*</span></label>
              <input type="email" [(ngModel)]="adminEmail" placeholder="owner@restaurant.com"
                     [class.invalid]="submitted && (!adminEmail || !isValidEmail(adminEmail))" />
              <span class="field-error" *ngIf="submitted && !adminEmail">Email is required</span>
              <span class="field-error" *ngIf="submitted && adminEmail && !isValidEmail(adminEmail)">Enter a valid email address</span>
            </div>

            <div class="form-group">
              <label>Password <span class="required">*</span></label>
              <input type="password" [(ngModel)]="adminPassword" placeholder="Min 6 characters"
                     [class.invalid]="submitted && adminPassword.length < 6" />
              <span class="field-error" *ngIf="submitted && adminPassword.length < 6">Min 6 characters</span>
            </div>

            <div class="form-group">
              <label>Confirm Password <span class="required">*</span></label>
              <input type="password" [(ngModel)]="confirmPassword" placeholder="Re-enter password"
                     [class.invalid]="submitted && confirmPassword !== adminPassword"
                     (keyup.enter)="nextStep()" />
              <span class="field-error" *ngIf="submitted && confirmPassword !== adminPassword">Passwords don't match</span>
            </div>

            <div class="btn-row">
              <button class="back-btn" (click)="step = 1; submitted = false">← Back</button>
              <button class="next-btn" (click)="nextStep()">Continue →</button>
            </div>
          </div>

          <!-- Step 3: Review & Confirm -->
          <div class="step-content" *ngIf="step === 3">
            <h2>Review & Confirm</h2>
            <p class="subtitle">Make sure everything looks good</p>

            <div class="review-section">
              <h3>Restaurant</h3>
              <div class="review-row">
                <span class="review-label">Name</span>
                <span class="review-value">{{ restaurantName }}</span>
              </div>
              <div class="review-row" *ngIf="address">
                <span class="review-label">Address</span>
                <span class="review-value">{{ address }}</span>
              </div>
              <div class="review-row" *ngIf="phone">
                <span class="review-label">Phone</span>
                <span class="review-value">{{ phone }}</span>
              </div>
            </div>

            <div class="review-section">
              <h3>Admin Account</h3>
              <div class="review-row">
                <span class="review-label">Name</span>
                <span class="review-value">{{ adminName }}</span>
              </div>
              <div class="review-row">
                <span class="review-label">Email</span>
                <span class="review-value">{{ adminEmail }}</span>
              </div>
            </div>

            <div class="error" *ngIf="error">{{ error }}</div>

            <div class="btn-row">
              <button class="back-btn" (click)="step = 2; submitted = false">← Back</button>
              <button class="submit-btn" (click)="register()" [disabled]="loading">
                {{ loading ? 'Creating...' : '🚀 Launch My Restaurant' }}
              </button>
            </div>
          </div>

          <!-- Step 4: Success -->
          <div class="step-content success-step" *ngIf="step === 4">
            <div class="success-icon">🎉</div>
            <h2>Welcome aboard!</h2>
            <p class="subtitle">Your restaurant <strong>{{ restaurantName }}</strong> is ready.</p>

            <div class="next-steps">
              <h3>What's Next?</h3>
              <div class="next-step-item">
                <span class="step-emoji">📋</span>
                <div>
                  <strong>Set up your menu</strong>
                  <p>Add categories & items with prices and photos</p>
                </div>
              </div>
              <div class="next-step-item">
                <span class="step-emoji">🪑</span>
                <div>
                  <strong>Create tables</strong>
                  <p>Add your tables and generate QR codes</p>
                </div>
              </div>
              <div class="next-step-item">
                <span class="step-emoji">👥</span>
                <div>
                  <strong>Add staff</strong>
                  <p>Create waiter & kitchen accounts</p>
                </div>
              </div>
              <div class="next-step-item">
                <span class="step-emoji">⚙️</span>
                <div>
                  <strong>Business settings</strong>
                  <p>Upload logo, add social links</p>
                </div>
              </div>
            </div>

            <button class="submit-btn" (click)="goToDashboard()">Go to Dashboard →</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .register-page {
      min-height: 100vh;
      display: flex;
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
    }

    // ── Brand Panel ──
    .brand-panel {
      flex: 1;
      background: #0a0a1a;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      padding: 48px;
    }

    .brand-bg {
      position: absolute;
      inset: 0;
      pointer-events: none;

      .orb {
        position: absolute;
        border-radius: 50%;
        filter: blur(80px);
        opacity: 0.4;
      }
      .orb-1 {
        width: 400px; height: 400px;
        background: #6c5ce7;
        top: -10%; left: -10%;
        animation: orbFloat 20s ease-in-out infinite;
      }
      .orb-2 {
        width: 300px; height: 300px;
        background: #fd7272;
        bottom: -5%; right: -5%;
        animation: orbFloat 25s ease-in-out infinite reverse;
      }
      .grid-overlay {
        position: absolute;
        inset: 0;
        background-image:
          linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
        background-size: 50px 50px;
      }
    }

    @keyframes orbFloat {
      0%, 100% { transform: translate(0, 0) scale(1); }
      33% { transform: translate(60px, -40px) scale(1.1); }
      66% { transform: translate(-30px, 30px) scale(0.9); }
    }

    .brand-content {
      position: relative;
      z-index: 1;
      max-width: 420px;
    }

    .brand-logo {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 32px;

      .logo-icon { font-size: 2rem; color: #a29bfe; }
      .logo-text {
        font-size: 1.8rem;
        font-weight: 800;
        color: white;
        letter-spacing: -0.5px;
        .accent { color: #a29bfe; }
      }
    }

    .brand-title {
      font-size: 2.2rem;
      font-weight: 800;
      color: white;
      line-height: 1.15;
      margin: 0 0 16px;
    }

    .gradient-text {
      background: linear-gradient(135deg, #a29bfe, #fd7272, #00cec9);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .brand-desc {
      font-size: 1rem;
      color: #8888aa;
      line-height: 1.6;
      margin: 0 0 28px;
    }

    .brand-highlights {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .bh {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 16px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 12px;

      .bh-icon { font-size: 1.5rem; flex-shrink: 0; }

      div {
        strong {
          display: block;
          color: white;
          font-size: 0.9rem;
          margin-bottom: 2px;
        }
        span {
          font-size: 0.8rem;
          color: #8888aa;
        }
      }
    }

    // ── Form Panel ──
    .form-panel {
      flex: 0 0 520px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: white;
      padding: 48px;
      overflow-y: auto;
    }

    .register-card {
      width: 100%;
      max-width: 440px;
    }

    // ── Steps ──
    .steps {
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 28px;
    }

    .step {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;

      .step-num {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: #eee;
        color: #888;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: 0.85rem;
        transition: all 0.3s;
      }

      .step-label {
        font-size: 0.7rem;
        color: #aaa;
        font-weight: 600;
      }

      &.active .step-num {
        background: linear-gradient(135deg, #6c5ce7, #e94560);
        color: white;
      }
      &.active .step-label { color: #6c5ce7; }

      &.done .step-num {
        background: #27ae60;
        color: white;
      }
      &.done .step-label { color: #27ae60; }
    }

    .step-line {
      width: 40px;
      height: 2px;
      background: #eee;
      margin: 0 8px;
      margin-bottom: 18px;
      transition: background 0.3s;
      &.done { background: #27ae60; }
    }

    // ── Content ──
    .step-content {
      text-align: center;

      h1 { margin: 0 0 4px; font-size: 1.4rem; color: #1a1a2e; }
      h2 { margin: 0 0 4px; font-size: 1.2rem; color: #1a1a2e; }
      .subtitle { color: #888; margin: 0 0 20px; font-size: 0.9rem; }
    }

    .form-group {
      margin-bottom: 14px;
      text-align: left;

      label {
        display: block;
        margin-bottom: 4px;
        font-size: 0.85rem;
        color: #333;
        font-weight: 600;
        .required { color: #e94560; }
      }

      input {
        width: 100%;
        padding: 11px 14px;
        border: 1.5px solid #e0e0e0;
        border-radius: 10px;
        font-size: 0.9rem;
        box-sizing: border-box;
        background: #fafafa;
        transition: all 0.2s;
        &:focus { border-color: #6c5ce7; outline: none; background: white; box-shadow: 0 0 0 3px rgba(108,92,231,0.1); }
        &.invalid { border-color: #e94560; }
      }

      .field-error {
        font-size: 0.75rem;
        color: #e94560;
        margin-top: 2px;
        display: block;
      }
    }

    .error {
      background: #ffe0e0;
      color: #c00;
      padding: 8px;
      border-radius: 8px;
      margin-bottom: 12px;
      font-size: 0.85rem;
    }

    .next-btn, .submit-btn {
      width: 100%;
      padding: 12px;
      background: linear-gradient(135deg, #6c5ce7, #e94560);
      color: white;
      border: none;
      border-radius: 10px;
      font-size: 1rem;
      font-weight: 700;
      cursor: pointer;
      margin-top: 4px;
      transition: all 0.3s;
      &:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(108,92,231,0.35); }
      &:disabled { background: #ccc; cursor: not-allowed; transform: none; box-shadow: none; }
    }

    .submit-btn {
      background: #27ae60;
      &:hover { background: #219a52; box-shadow: 0 4px 16px rgba(39,174,96,0.35); }
    }

    .back-btn {
      padding: 12px 20px;
      background: none;
      border: 1.5px solid #e0e0e0;
      border-radius: 10px;
      font-size: 0.9rem;
      cursor: pointer;
      color: #666;
      transition: all 0.2s;
      &:hover { background: #f5f5f5; border-color: #ccc; }
    }

    .btn-row {
      display: flex;
      gap: 12px;
      margin-top: 8px;
      .next-btn, .submit-btn { flex: 1; }
    }

    .alt-action {
      margin-top: 16px;
      font-size: 0.85rem;
      color: #888;
      a {
        color: #6c5ce7;
        text-decoration: underline;
        font-weight: 600;
      }
    }

    // ── Review ──
    .review-section {
      background: #f8f8fc;
      border: 1px solid #ececf0;
      border-radius: 12px;
      padding: 14px 16px;
      margin-bottom: 12px;
      text-align: left;

      h3 {
        margin: 0 0 8px;
        font-size: 0.85rem;
        color: #888;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
    }

    .review-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      font-size: 0.9rem;
      .review-label { color: #888; }
      .review-value { font-weight: 600; color: #333; }
    }

    // ── Success ──
    .success-step {
      .success-icon { font-size: 3rem; margin-bottom: 8px; }
    }

    .next-steps {
      text-align: left;
      margin: 20px 0;

      h3 {
        font-size: 0.9rem;
        color: #888;
        margin: 0 0 12px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
    }

    .next-step-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 10px 0;
      border-bottom: 1px solid #f0f0f0;

      &:last-child { border-bottom: none; }
      .step-emoji { font-size: 1.4rem; }

      div {
        strong { font-size: 0.9rem; display: block; color: #333; }
        p { margin: 2px 0 0; font-size: 0.8rem; color: #888; }
      }
    }

    @media (max-width: 960px) {
      .register-page { flex-direction: column; }
      .brand-panel {
        padding: 32px 24px;
        min-height: auto;
      }
      .brand-title { font-size: 1.8rem; }
      .brand-highlights { display: none; }
      .form-panel { flex: none; padding: 40px 24px; }
    }

    @media (max-width: 640px) {
      .brand-panel { padding: 32px 20px; }
      .brand-title { font-size: 1.5rem; }
      .brand-desc { font-size: 0.9rem; }
      .brand-highlights { flex-direction: column; }
      .bh { min-width: auto; }
      .form-panel { padding: 28px 20px; }
      .register-card { padding: 0; }
      .step-line { width: 24px; }
      .btn-row { flex-direction: column; }
      .review-row { flex-direction: column; gap: 2px; }
    }
  `]
})
export class RegisterComponent {
  step = 1;
  submitted = false;
  loading = false;
  error = '';

  // Step 1
  restaurantName = '';
  address = '';
  phone = '';

  // Step 2
  adminName = '';
  adminEmail = '';
  adminPassword = '';
  confirmPassword = '';

  constructor(private authService: AuthService, private router: Router) {
    if (authService.isLoggedIn()) {
      router.navigate(['/admin/dashboard']);
    }
  }

  nextStep(): void {
    this.submitted = true;

    if (this.step === 1) {
      if (!this.restaurantName.trim()) return;
      if (!this.address.trim()) return;
      if (!this.phone || this.phone.length !== 10) return;
      this.submitted = false;
      this.step = 2;
    } else if (this.step === 2) {
      if (!this.adminName.trim()) return;
      if (!this.adminEmail.trim() || !this.isValidEmail(this.adminEmail)) return;
      if (this.adminPassword.length < 6) return;
      if (this.confirmPassword !== this.adminPassword) return;
      this.submitted = false;
      this.step = 3;
    }
  }

  isValidEmail(email: string): boolean {
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
  }

  onlyNumbers(event: KeyboardEvent): void {
    const char = event.key;
    if (!/^[0-9]$/.test(char)) {
      event.preventDefault();
    }
  }

  register(): void {
    this.loading = true;
    this.error = '';

    this.authService.registerTenant({
      restaurantName: this.restaurantName.trim(),
      address: this.address.trim() || undefined,
      phone: this.phone.trim() || undefined,
      adminEmail: this.adminEmail.trim(),
      adminPassword: this.adminPassword,
      adminName: this.adminName.trim()
    }).subscribe({
      next: () => {
        this.loading = false;
        this.step = 4;
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.message || 'Registration failed. Please try again.';
      }
    });
  }

  goToDashboard(): void {
    this.router.navigate(['/admin/dashboard']);
  }
}
