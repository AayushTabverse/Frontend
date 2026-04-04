import { inject } from '@angular/core';
import { CanActivateFn, CanMatchFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { SubscriptionService } from '../services/subscription.service';
import { map, catchError, of } from 'rxjs';

/** Returns true if the current hostname has a tenant subdomain. */
function hasSubdomain(): boolean {
  const parts = window.location.hostname.split('.');
  const isLocalDev = parts.length === 2 && parts[1] === 'localhost';
  const isProd = parts.length >= 3 && !['www', 'app'].includes(parts[0]);
  return (isLocalDev || isProd) && parts[0] !== 'localhost';
}

/** canMatch guard — route only matches when on a subdomain. */
export const subdomainMatch: CanMatchFn = () => hasSubdomain();

/** canMatch guard — route only matches when NOT on a subdomain. */
export const mainDomainMatch: CanMatchFn = () => !hasSubdomain();

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isLoggedIn()) {
    return true;
  }

  router.navigate(['/admin/login']);
  return false;
};

export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isLoggedIn() && authService.isAdmin()) {
    return true;
  }

  router.navigate(['/admin/login']);
  return false;
};

export const subscriptionGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const subscriptionService = inject(SubscriptionService);
  const router = inject(Router);

  if (!authService.isLoggedIn() || !authService.isAdmin()) {
    router.navigate(['/admin/login']);
    return false;
  }

  const cached = subscriptionService.getCachedStatus();
  if (cached) {
    if (cached.requiresSubscription) {
      router.navigate(['/admin/subscription']);
      return false;
    }
    return true;
  }

  return subscriptionService.getStatus().pipe(
    map(status => {
      if (status.requiresSubscription) {
        router.navigate(['/admin/subscription']);
        return false;
      }
      return true;
    }),
    catchError(() => of(true))
  );
};

export const premiumGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const subscriptionService = inject(SubscriptionService);
  const router = inject(Router);

  if (!authService.isLoggedIn() || !authService.isAdmin()) {
    router.navigate(['/admin/login']);
    return false;
  }

  const cached = subscriptionService.getCachedStatus();
  if (cached) {
    if (cached.requiresSubscription) {
      router.navigate(['/admin/subscription']);
      return false;
    }
    if (cached.plan !== 'Premium' && !cached.isTrialActive) {
      router.navigate(['/admin/subscription'], { queryParams: { upgrade: true } });
      return false;
    }
    return true;
  }

  return subscriptionService.getStatus().pipe(
    map(status => {
      if (status.requiresSubscription) {
        router.navigate(['/admin/subscription']);
        return false;
      }
      if (status.plan !== 'Premium' && !status.isTrialActive) {
        router.navigate(['/admin/subscription'], { queryParams: { upgrade: true } });
        return false;
      }
      return true;
    }),
    catchError(() => of(true))
  );
};
