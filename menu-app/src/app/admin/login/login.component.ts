import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="login-page">
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
          <h2 class="brand-title">Your Restaurant,<br/><span class="gradient-text">Reimagined.</span></h2>
          <p class="brand-desc">QR ordering, kitchen sync, analytics, AI marketing, due management — all from one platform.</p>
          <div class="brand-features">
            <div class="bf"><span>📱</span> QR Code Ordering</div>
            <div class="bf"><span>👨‍🍳</span> Kitchen Display</div>
            <div class="bf"><span>📊</span> Smart Analytics</div>
            <div class="bf"><span>🌐</span> Your Own Website</div>
            <div class="bf"><span>🤖</span> AI Marketing</div>
            <div class="bf"><span>📒</span> Due Management</div>
          </div>
          <div class="brand-trial">
            <span class="trial-badge">🎉 1 Month Free Trial — No Credit Card Required</span>
          </div>
        </div>
      </div>

      <!-- Login Form Panel -->
      <div class="form-panel">
        <div class="login-card">
          <h1>Welcome back</h1>
          <p class="subtitle">Sign in to manage your restaurant</p>

          <!-- Login Form -->
          <ng-container *ngIf="!showForgotPassword">
            <div class="form-group">
              <label>Email</label>
              <input type="email" [(ngModel)]="email" placeholder="admin@restaurant.com"
                     [class.invalid]="submitted && (!email || !isValidEmail(email))" />
              <span class="field-error" *ngIf="submitted && !email">Email is required</span>
              <span class="field-error" *ngIf="submitted && email && !isValidEmail(email)">Enter a valid email address</span>
            </div>

            <div class="form-group">
              <label>Password</label>
              <input type="password" [(ngModel)]="password" placeholder="Enter password" (keyup.enter)="login()"
                     [class.invalid]="submitted && !password" />
              <span class="field-error" *ngIf="submitted && !password">Password is required</span>
            </div>

            <div class="error" *ngIf="error">{{ error }}</div>

            <button class="login-btn" (click)="login()" [disabled]="loading">
              {{ loading ? 'Signing in...' : 'Sign In' }}
            </button>

            <button class="forgot-link" (click)="showForgotPassword = true">Forgot Password?</button>

            <div class="register-link">
              New restaurant? <a routerLink="/admin/register">Register here</a>
            </div>
          </ng-container>

          <!-- Forgot Password Form -->
          <ng-container *ngIf="showForgotPassword">
            <div class="forgot-header">
              <button class="back-link" (click)="showForgotPassword = false; forgotError = ''; forgotSuccess = ''">&larr; Back to Login</button>
              <h2>Reset Password</h2>
              <p class="forgot-subtitle">Enter your email to receive a temporary password</p>
            </div>

            <div class="form-group">
              <label>Email</label>
              <input type="email" [(ngModel)]="forgotEmail" placeholder="Enter your email" (keyup.enter)="resetPassword()"
                     [class.invalid]="forgotSubmitted && (!forgotEmail || !isValidEmail(forgotEmail))" />
              <span class="field-error" *ngIf="forgotSubmitted && !forgotEmail">Email is required</span>
              <span class="field-error" *ngIf="forgotSubmitted && forgotEmail && !isValidEmail(forgotEmail)">Enter a valid email address</span>
            </div>

            <div class="error" *ngIf="forgotError">{{ forgotError }}</div>
            <div class="success" *ngIf="forgotSuccess">{{ forgotSuccess }}</div>

            <button class="login-btn" (click)="resetPassword()" [disabled]="forgotLoading">
              {{ forgotLoading ? 'Sending...' : 'Reset Password' }}
            </button>
          </ng-container>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-page {
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

      .logo-icon {
        font-size: 2rem;
        color: #a29bfe;
      }
      .logo-text {
        font-size: 1.8rem;
        font-weight: 800;
        color: white;
        letter-spacing: -0.5px;
        .accent { color: #a29bfe; }
      }
    }

    .brand-title {
      font-size: 2.4rem;
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

    .brand-features {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 28px;
    }

    .bf {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.85rem;
      color: #c0c0d0;
      padding: 8px 12px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 10px;

      span:first-child { font-size: 1rem; }
    }

    .brand-trial {
      .trial-badge {
        display: inline-block;
        padding: 10px 20px;
        background: rgba(108, 92, 231, 0.15);
        border: 1px solid rgba(108, 92, 231, 0.3);
        border-radius: 12px;
        color: #a29bfe;
        font-size: 0.85rem;
        font-weight: 600;
      }
    }

    // ── Form Panel ──
    .form-panel {
      flex: 0 0 480px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: white;
      padding: 48px;
    }

    .login-card {
      width: 100%;
      max-width: 360px;
      text-align: center;
      h1 { margin: 0 0 4px; font-size: 1.6rem; color: #1a1a2e; }
      .subtitle { color: #666; margin: 0 0 28px; font-size: 0.9rem; }
    }

    .form-group {
      margin-bottom: 16px; text-align: left;
      label { display: block; margin-bottom: 4px; font-size: 0.85rem; color: #333; font-weight: 600; }
      input {
        width: 100%; padding: 11px 14px; border: 1.5px solid #e0e0e0; border-radius: 10px;
        font-size: 0.9rem; box-sizing: border-box; background: #fafafa; transition: all 0.2s;
        &:focus { border-color: #6c5ce7; outline: none; background: white; box-shadow: 0 0 0 3px rgba(108,92,231,0.1); }
        &.invalid { border-color: #e94560; }
      }
      .field-error { font-size: 0.75rem; color: #e94560; margin-top: 2px; display: block; }
    }
    .error { background: #ffe0e0; color: #c00; padding: 8px; border-radius: 8px; margin-bottom: 12px; font-size: 0.85rem; }
    .success { background: #d4edda; color: #155724; padding: 8px; border-radius: 8px; margin-bottom: 12px; font-size: 0.85rem; }
    .login-btn {
      width: 100%; padding: 12px; background: linear-gradient(135deg, #6c5ce7, #e94560); color: white; border: none;
      border-radius: 10px; font-size: 1rem; font-weight: 700; cursor: pointer; transition: all 0.3s;
      &:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(108,92,231,0.35); }
      &:disabled { background: #ccc; cursor: not-allowed; transform: none; box-shadow: none; }
    }
    .forgot-link {
      display: block; margin-top: 12px; background: none; border: none; color: #6c5ce7;
      font-size: 0.85rem; cursor: pointer; text-decoration: underline;
      &:hover { color: #5a4bd1; }
    }
    .forgot-header {
      margin-bottom: 16px;
      h2 { margin: 8px 0 4px; font-size: 1.2rem; color: #1a1a2e; }
      .forgot-subtitle { color: #888; font-size: 0.85rem; margin: 0; }
    }
    .back-link {
      background: none; border: none; color: #666; font-size: 0.85rem; cursor: pointer;
      &:hover { color: #333; }
    }
    .register-link {
      margin-top: 16px;
      font-size: 0.85rem;
      color: #888;
      a {
        color: #6c5ce7;
        text-decoration: underline;
        font-weight: 600;
      }
    }

    @media (max-width: 960px) {
      .login-page { flex-direction: column; }
      .brand-panel {
        padding: 32px 24px;
        min-height: auto;
      }
      .brand-title { font-size: 1.8rem; }
      .brand-features { display: none; }
      .brand-trial { display: none; }
      .form-panel { flex: none; padding: 40px 24px; }
    }

    @media (max-width: 640px) {
      .brand-panel { padding: 32px 20px; }
      .brand-title { font-size: 1.5rem; }
      .brand-desc { font-size: 0.9rem; }
      .brand-features { grid-template-columns: 1fr 1fr; gap: 8px; }
      .bf { font-size: 0.8rem; padding: 6px 10px; }
      .form-panel { padding: 32px 20px; }
      .login-card h1 { font-size: 1.3rem; }
    }

    @media (max-width: 400px) {
      .brand-features { grid-template-columns: 1fr; }
    }
  `]
})
export class LoginComponent {
  email = '';
  password = '';
  loading = false;
  error = '';
  submitted = false;

  showForgotPassword = false;
  forgotEmail = '';
  forgotLoading = false;
  forgotError = '';
  forgotSuccess = '';
  forgotSubmitted = false;

  constructor(private authService: AuthService, private router: Router) {
    if (authService.isLoggedIn()) {
      const role = authService.getRole();
      if (role === 'Kitchen') {
        router.navigate(['/kitchen']);
      } else if (role === 'Waiter') {
        router.navigate(['/waiter']);
      } else {
        router.navigate(['/admin/dashboard']);
      }
    }
  }

  login(): void {
    this.submitted = true;
    if (!this.email || !this.isValidEmail(this.email)) {
      this.error = '';
      return;
    }
    if (!this.password) {
      this.error = '';
      return;
    }

    this.loading = true;
    this.error = '';

    this.authService.login({ email: this.email, password: this.password }).subscribe({
      next: () => {
        const role = this.authService.getRole();
        if (role === 'Kitchen') {
          this.router.navigate(['/kitchen']);
        } else if (role === 'Waiter') {
          this.router.navigate(['/waiter']);
        } else {
          this.router.navigate(['/admin/dashboard']);
        }
      },
      error: (err) => {
        this.error = err.error?.message || 'Invalid credentials.';
        this.loading = false;
      }
    });
  }

  resetPassword(): void {
    this.forgotSubmitted = true;
    if (!this.forgotEmail || !this.isValidEmail(this.forgotEmail)) {
      return;
    }

    this.forgotLoading = true;
    this.forgotError = '';
    this.forgotSuccess = '';

    this.authService.forgotPassword(this.forgotEmail).subscribe({
      next: (res) => {
        this.forgotLoading = false;
        this.forgotSuccess = `Temporary password: ${res.tempPassword} — Please change it after login.`;
      },
      error: (err) => {
        this.forgotLoading = false;
        this.forgotError = err.error?.message || 'Failed to reset password. Check your email.';
      }
    });
  }

  isValidEmail(email: string): boolean {
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
  }
}
