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
      <div class="login-card">
        <h1>🍽️ Restaurant Admin</h1>
        <p class="subtitle">Sign in to manage your restaurant</p>

        <!-- Login Form -->
        <ng-container *ngIf="!showForgotPassword">
          <div class="form-group">
            <label>Email</label>
            <input type="email" [(ngModel)]="email" placeholder="admin@restaurant.com" />
          </div>

          <div class="form-group">
            <label>Password</label>
            <input type="password" [(ngModel)]="password" placeholder="Enter password" (keyup.enter)="login()" />
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
            <input type="email" [(ngModel)]="forgotEmail" placeholder="Enter your email" (keyup.enter)="resetPassword()" />
          </div>

          <div class="error" *ngIf="forgotError">{{ forgotError }}</div>
          <div class="success" *ngIf="forgotSuccess">{{ forgotSuccess }}</div>

          <button class="login-btn" (click)="resetPassword()" [disabled]="forgotLoading">
            {{ forgotLoading ? 'Sending...' : 'Reset Password' }}
          </button>
        </ng-container>
      </div>
    </div>
  `,
  styles: [`
    .login-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #1a1a2e, #16213e);
      font-family: 'Segoe UI', sans-serif;
    }
    .login-card {
      background: white;
      padding: 40px;
      border-radius: 16px;
      width: 100%;
      max-width: 400px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      text-align: center;
      h1 { margin: 0 0 4px; font-size: 1.5rem; }
      .subtitle { color: #666; margin: 0 0 24px; font-size: 0.9rem; }
    }
    .form-group {
      margin-bottom: 16px; text-align: left;
      label { display: block; margin-bottom: 4px; font-size: 0.85rem; color: #333; font-weight: 600; }
      input {
        width: 100%; padding: 10px 12px; border: 1px solid #ddd; border-radius: 8px;
        font-size: 0.9rem; box-sizing: border-box;
        &:focus { border-color: #1a1a2e; outline: none; }
      }
    }
    .error { background: #ffe0e0; color: #c00; padding: 8px; border-radius: 6px; margin-bottom: 12px; font-size: 0.85rem; }
    .success { background: #d4edda; color: #155724; padding: 8px; border-radius: 6px; margin-bottom: 12px; font-size: 0.85rem; }
    .login-btn {
      width: 100%; padding: 12px; background: #e94560; color: white; border: none;
      border-radius: 8px; font-size: 1rem; font-weight: 700; cursor: pointer;
      &:disabled { background: #ccc; cursor: not-allowed; }
    }
    .forgot-link {
      display: block; margin-top: 12px; background: none; border: none; color: #e94560;
      font-size: 0.85rem; cursor: pointer; text-decoration: underline;
      &:hover { color: #d63851; }
    }
    .forgot-header {
      margin-bottom: 16px;
      h2 { margin: 8px 0 4px; font-size: 1.2rem; }
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
        color: #e94560;
        text-decoration: underline;
        font-weight: 600;
      }
    }

    @media (max-width: 480px) {
      .login-card {
        padding: 28px 20px;
        margin: 0 16px;
        border-radius: 12px;
      }
    }
  `]
})
export class LoginComponent {
  email = '';
  password = '';
  loading = false;
  error = '';

  showForgotPassword = false;
  forgotEmail = '';
  forgotLoading = false;
  forgotError = '';
  forgotSuccess = '';

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
    if (!this.email || !this.password) {
      this.error = 'Please enter email and password.';
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
    if (!this.forgotEmail) {
      this.forgotError = 'Please enter your email.';
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
}
