import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { SubscriptionService } from '../../services/subscription.service';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { SubscriptionStatusResponse, SubscriptionPlanDto } from '../../models/api.models';

declare var Razorpay: any;

@Component({
  selector: 'app-subscription',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './subscription.component.html',
  styleUrl: './subscription.component.scss'
})
export class SubscriptionComponent implements OnInit {
  status: SubscriptionStatusResponse | null = null;
  plans: SubscriptionPlanDto[] = [];
  loading = true;
  processing = false;
  error = '';
  success = '';
  selectedCycle: 'Monthly' | 'Yearly' = 'Monthly';
  isUpgrade = false;
  userName = '';

  constructor(
    private subscriptionService: SubscriptionService,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    public themeService: ThemeService
  ) {
    this.authService.currentUser$.subscribe(u => this.userName = u?.fullName || '');
  }

  ngOnInit(): void {
    this.isUpgrade = this.route.snapshot.queryParams['upgrade'] === 'true';
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    this.subscriptionService.getStatus().subscribe({
      next: (status) => {
        this.status = status;
        this.subscriptionService.getPlans().subscribe({
          next: (plans) => {
            this.plans = plans;
            this.loading = false;
          },
          error: () => this.loading = false
        });
      },
      error: () => this.loading = false
    });
  }

  get filteredPlans(): SubscriptionPlanDto[] {
    return this.plans.filter(p => p.cycle === this.selectedCycle);
  }

  get standardPlan(): SubscriptionPlanDto | undefined {
    return this.filteredPlans.find(p => p.plan === 'Standard');
  }

  get premiumPlan(): SubscriptionPlanDto | undefined {
    return this.filteredPlans.find(p => p.plan === 'Premium');
  }

  selectCycle(cycle: 'Monthly' | 'Yearly'): void {
    this.selectedCycle = cycle;
  }

  subscribe(plan: SubscriptionPlanDto): void {
    this.processing = true;
    this.error = '';
    this.success = '';

    this.subscriptionService.createSubscription({ plan: plan.plan, cycle: plan.cycle }).subscribe({
      next: (sub) => {
        const options = {
          key: sub.razorpayKeyId,
          subscription_id: sub.subscriptionId,
          name: 'TabVerse',
          description: `${plan.displayName} Subscription`,
          handler: (response: any) => {
            this.verifyPayment(
              response.razorpay_subscription_id,
              response.razorpay_payment_id,
              response.razorpay_signature
            );
          },
          prefill: {
            name: this.userName
          },
          theme: { color: '#6366f1' },
          modal: {
            ondismiss: () => {
              this.processing = false;
            }
          }
        };

        const rzp = new Razorpay(options);
        rzp.open();
      },
      error: (err) => {
        this.error = err?.error?.message || 'Failed to create order. Please try again.';
        this.processing = false;
      }
    });
  }

  private verifyPayment(subscriptionId: string, paymentId: string, signature: string): void {
    this.subscriptionService.verifyPayment({
      razorpaySubscriptionId: subscriptionId,
      razorpayPaymentId: paymentId,
      razorpaySignature: signature
    }).subscribe({
      next: (status) => {
        this.status = status;
        this.success = 'Subscription activated successfully!';
        this.processing = false;
        setTimeout(() => this.router.navigate(['/admin/dashboard']), 2000);
      },
      error: (err) => {
        this.error = err?.error?.message || 'Payment verification failed. Please contact support.';
        this.processing = false;
      }
    });
  }

  goToDashboard(): void {
    this.router.navigate(['/admin/dashboard']);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/admin/login']);
  }

  isPremiumExclusive(feature: string): boolean {
    return ['AI Marketing', 'Google Reviews', 'Inventory Management'].includes(feature);
  }
}
