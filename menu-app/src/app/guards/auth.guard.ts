import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, CanMatchFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { SubscriptionService } from '../services/subscription.service';
import { Permission } from '../shared/permissions';
import { isTenantHost } from '../shared/site-host';
import { map, catchError, of } from 'rxjs';

/** canMatch guard — route only matches on a restaurant website host (subdomain or own domain). */
export const subdomainMatch: CanMatchFn = () => isTenantHost();

/** canMatch guard — route only matches on the main Tabverse host. */
export const mainDomainMatch: CanMatchFn = () => !isTenantHost();

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isLoggedIn()) {
    return true;
  }

  router.navigate(['/admin/login']);
  return false;
};

/** Admin panel (sidebar layout): owners, managers and cashiers. */
export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isLoggedIn()) {
    router.navigate(['/admin/login']);
    return false;
  }
  if (authService.isPanelUser()) {
    return true;
  }

  router.navigate([authService.homeRoute()]);
  return false;
};

/**
 * Role check for a single screen. Reads the screen's permission from route data:
 * `{ canActivate: [permissionGuard], data: { permission: 'staff' } }`.
 * Users without access are sent to their own home screen.
 */
export const permissionGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const permission = route.data['permission'] as Permission | undefined;

  if (!authService.isLoggedIn()) {
    router.navigate(['/admin/login']);
    return false;
  }
  if (!permission || authService.can(permission)) {
    return true;
  }

  router.navigate([authService.homeRoute()]);
  return false;
};

export const subscriptionGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const subscriptionService = inject(SubscriptionService);
  const router = inject(Router);

  if (!authService.isLoggedIn() || !authService.isPanelUser()) {
    router.navigate(['/admin/login']);
    return false;
  }

  // Only owners can act on an expired subscription; other staff keep working as before
  if (!authService.isAdmin()) {
    return true;
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

  if (!authService.isLoggedIn() || !authService.isPanelUser()) {
    router.navigate(['/admin/login']);
    return false;
  }

  // Non-owners can't upgrade, so send them home instead of to the billing page
  const upgradeRoute = authService.isAdmin() ? ['/admin/subscription'] : [authService.homeRoute()];

  const cached = subscriptionService.getCachedStatus();
  if (cached) {
    if (cached.requiresSubscription) {
      router.navigate(upgradeRoute);
      return false;
    }
    if (cached.plan !== 'Premium' && !cached.isTrialActive) {
      router.navigate(upgradeRoute, { queryParams: authService.isAdmin() ? { upgrade: true } : {} });
      return false;
    }
    return true;
  }

  return subscriptionService.getStatus().pipe(
    map(status => {
      if (status.requiresSubscription) {
        router.navigate(upgradeRoute);
        return false;
      }
      if (status.plan !== 'Premium' && !status.isTrialActive) {
        router.navigate(upgradeRoute, { queryParams: authService.isAdmin() ? { upgrade: true } : {} });
        return false;
      }
      return true;
    }),
    catchError(() => of(true))
  );
};
