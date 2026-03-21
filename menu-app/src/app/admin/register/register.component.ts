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
          <h1>🍽️ Register Your Restaurant</h1>
          <p class="subtitle">Let's get your restaurant online in minutes</p>

          <div class="form-group">
            <label>Restaurant Name <span class="required">*</span></label>
            <input type="text" [(ngModel)]="restaurantName" placeholder="e.g. The Spice Kitchen"
                   [class.invalid]="submitted && !restaurantName" />
            <span class="field-error" *ngIf="submitted && !restaurantName">Required</span>
          </div>

          <div class="form-group">
            <label>Address</label>
            <input type="text" [(ngModel)]="address" placeholder="123 Main St, City" />
          </div>

          <div class="form-group">
            <label>Phone</label>
            <input type="tel" [(ngModel)]="phone" placeholder="+91-9876543210" />
          </div>

          <button class="next-btn" (click)="nextStep()">Continue →</button>

          <div class="alt-action">
            Already have an account? <a routerLink="/admin/login">Sign In</a>
          </div>
        </div>

        <!-- Step 2: Admin Account -->
        <div class="step-content" *ngIf="step === 2">
          <h2>👤 Create Admin Account</h2>
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
                   [class.invalid]="submitted && !adminEmail" />
            <span class="field-error" *ngIf="submitted && !adminEmail">Required</span>
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
          <h2>✅ Review & Confirm</h2>
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
  `,
  styles: [`
    .register-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #1a1a2e, #16213e);
      font-family: 'Segoe UI', sans-serif;
      padding: 20px;
    }

    .register-card {
      background: white;
      padding: 36px 40px;
      border-radius: 16px;
      width: 100%;
      max-width: 480px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
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
        background: #e94560;
        color: white;
      }
      &.active .step-label { color: #e94560; }

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

      h1 { margin: 0 0 4px; font-size: 1.4rem; }
      h2 { margin: 0 0 4px; font-size: 1.2rem; }
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
        padding: 10px 12px;
        border: 1px solid #ddd;
        border-radius: 8px;
        font-size: 0.9rem;
        box-sizing: border-box;
        transition: border-color 0.2s;

        &:focus { border-color: #1a1a2e; outline: none; }
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
      border-radius: 6px;
      margin-bottom: 12px;
      font-size: 0.85rem;
    }

    .next-btn, .submit-btn {
      width: 100%;
      padding: 12px;
      background: #e94560;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 700;
      cursor: pointer;
      margin-top: 4px;
      transition: background 0.2s;
      &:hover { background: #d63851; }
      &:disabled { background: #ccc; cursor: not-allowed; }
    }

    .submit-btn {
      background: #27ae60;
      &:hover { background: #219a52; }
    }

    .back-btn {
      padding: 12px 20px;
      background: none;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-size: 0.9rem;
      cursor: pointer;
      color: #666;
      &:hover { background: #f5f5f5; }
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
        color: #e94560;
        text-decoration: underline;
        font-weight: 600;
      }
    }

    // ── Review ──
    .review-section {
      background: #fafafa;
      border-radius: 10px;
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

    @media (max-width: 520px) {
      .register-card { padding: 24px 20px; }
      .step-line { width: 24px; }
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
      this.submitted = false;
      this.step = 2;
    } else if (this.step === 2) {
      if (!this.adminName.trim() || !this.adminEmail.trim()) return;
      if (this.adminPassword.length < 6) return;
      if (this.confirmPassword !== this.adminPassword) return;
      this.submitted = false;
      this.step = 3;
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
