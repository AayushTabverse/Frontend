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
  showCancelConfirm = false;
  showChangePlan = false;
  cancelling = false;

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
        if (status.cycle) this.selectedCycle = status.cycle as 'Monthly' | 'Yearly';
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

  get currentPlanDetails(): SubscriptionPlanDto | undefined {
    if (!this.status?.plan || !this.status?.cycle) return undefined;
    return this.plans.find(p => p.plan === this.status!.plan && p.cycle === this.status!.cycle);
  }

  get isCurrentPlan(): (plan: SubscriptionPlanDto) => boolean {
    return (plan: SubscriptionPlanDto) =>
      this.status?.isSubscriptionActive === true &&
      this.status?.plan === plan.plan &&
      this.status?.cycle === plan.cycle;
  }

  selectCycle(cycle: 'Monthly' | 'Yearly'): void {
    this.selectedCycle = cycle;
  }

  getPlanAction(plan: SubscriptionPlanDto): string {
    if (!this.status?.isSubscriptionActive) return 'Subscribe';
    if (this.isCurrentPlan(plan)) return 'Current Plan';
    const currentPlan = this.currentPlanDetails;
    if (!currentPlan) return 'Subscribe';
    // Premium > Standard, Yearly > Monthly
    const planRank = (p: SubscriptionPlanDto) => (p.plan === 'Premium' ? 2 : 1) * 10 + (p.cycle === 'Yearly' ? 2 : 1);
    return planRank(plan) > planRank(currentPlan) ? 'Upgrade' : 'Downgrade';
  }

  subscribe(plan: SubscriptionPlanDto): void {
    // If already subscribed, do a plan change instead of new subscription
    if (this.status?.isSubscriptionActive && !this.isCurrentPlan(plan)) {
      this.changePlan(plan);
      return;
    }

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
        this.error = err?.error?.message || 'Failed to create subscription. Please try again.';
        this.processing = false;
      }
    });
  }

  changePlan(plan: SubscriptionPlanDto): void {
    this.processing = true;
    this.error = '';
    this.success = '';

    this.subscriptionService.updateSubscription({
      plan: plan.plan,
      cycle: plan.cycle,
      scheduleAtCycleEnd: false
    }).subscribe({
      next: (result) => {
        if (result.requiresCheckout && result.subscriptionId && result.razorpayKeyId) {
          // UPI fallback: old subscription cancelled, open checkout for new one
          const options = {
            key: result.razorpayKeyId,
            subscription_id: result.subscriptionId,
            name: 'TabVerse',
            description: `${plan.displayName} Subscription`,
            handler: (response: any) => {
              this.verifyPayment(
                response.razorpay_subscription_id,
                response.razorpay_payment_id,
                response.razorpay_signature
              );
            },
            prefill: { name: this.userName },
            theme: { color: '#6366f1' },
            modal: {
              ondismiss: () => { this.processing = false; this.loadData(); }
            }
          };
          const rzp = new Razorpay(options);
          rzp.open();
        } else {
          this.status = result.status!;
          this.success = `Plan changed to ${plan.displayName} successfully!`;
          this.processing = false;
          this.showChangePlan = false;
        }
      },
      error: (err) => {
        this.error = err?.error?.message || 'Failed to change plan. Please try again.';
        this.processing = false;
      }
    });
  }

  confirmCancel(): void {
    this.showCancelConfirm = true;
  }

  dismissCancel(): void {
    this.showCancelConfirm = false;
  }

  cancelSubscription(atCycleEnd: boolean): void {
    this.cancelling = true;
    this.error = '';
    this.success = '';

    this.subscriptionService.cancelSubscription({ cancelAtCycleEnd: atCycleEnd }).subscribe({
      next: (status) => {
        this.status = status;
        this.success = atCycleEnd
          ? 'Subscription will be cancelled at the end of the current billing cycle.'
          : 'Subscription cancelled immediately.';
        this.cancelling = false;
        this.showCancelConfirm = false;
      },
      error: (err) => {
        this.error = err?.error?.message || 'Failed to cancel subscription. Please try again.';
        this.cancelling = false;
      }
    });
  }

  toggleChangePlan(): void {
    this.showChangePlan = !this.showChangePlan;
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
