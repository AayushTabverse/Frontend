import { Routes } from '@angular/router';
import { authGuard, adminGuard } from './guards/auth.guard';

export const routes: Routes = [
  // ── Landing Page ──
  {
    path: '',
    loadComponent: () => import('./landing/landing.component').then(m => m.LandingComponent),
    pathMatch: 'full'
  },

  // ── Customer Routes (public, no auth) ──
  {
    path: 'menu/:tenantId/:tableId',
    loadComponent: () => import('./customer/menu/menu.component').then(m => m.MenuComponent)
  },
  {
    path: 'cart',
    loadComponent: () => import('./customer/cart/cart.component').then(m => m.CartComponent)
  },
  {
    path: 'checkout',
    loadComponent: () => import('./customer/checkout/checkout.component').then(m => m.CheckoutComponent)
  },
  {
    path: 'order-tracking/:orderId',
    loadComponent: () => import('./customer/order-tracking/order-tracking.component').then(m => m.OrderTrackingComponent)
  },
  {
    path: 'table-orders/:tableId',
    loadComponent: () => import('./customer/table-orders/table-orders.component').then(m => m.TableOrdersComponent)
  },
  {
    path: 'ar/:itemId',
    loadComponent: () => import('./customer/ar-view/ar-view.component').then(m => m.ArViewComponent)
  },

  // ── Tenant Public Website (subdomain or path-based) ──
  {
    path: 'website/:tenantId',
    loadComponent: () => import('./customer/tenant-website/tenant-website.component').then(m => m.TenantWebsiteComponent)
  },

  // ── Admin Routes (auth required) ──
  {
    path: 'admin/login',
    loadComponent: () => import('./admin/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'admin/register',
    loadComponent: () => import('./admin/register/register.component').then(m => m.RegisterComponent)
  },
  {
    path: 'admin/dashboard',
    loadComponent: () => import('./admin/dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [adminGuard]
  },
  {
    path: 'admin/menu',
    loadComponent: () => import('./admin/menu-management/menu-management.component').then(m => m.MenuManagementComponent),
    canActivate: [adminGuard]
  },
  {
    path: 'admin/orders',
    loadComponent: () => import('./admin/orders/orders.component').then(m => m.OrdersComponent),
    canActivate: [authGuard]
  },
  {
    path: 'admin/tables',
    loadComponent: () => import('./admin/tables/tables.component').then(m => m.TablesComponent),
    canActivate: [adminGuard]
  },
  {
    path: 'admin/website',
    loadComponent: () => import('./admin/website-editor/website-editor.component').then(m => m.WebsiteEditorComponent),
    canActivate: [adminGuard]
  },
  {
    path: 'admin/settings',
    loadComponent: () => import('./admin/settings/settings.component').then(m => m.SettingsComponent),
    canActivate: [adminGuard]
  },
  {
    path: 'admin/bills',
    loadComponent: () => import('./admin/bills/bills.component').then(m => m.BillsComponent),
    canActivate: [adminGuard]
  },
  {
    path: 'admin/dues',
    loadComponent: () => import('./admin/dues/dues.component').then(m => m.DuesComponent),
    canActivate: [adminGuard]
  },
  {
    path: 'admin/staff',
    loadComponent: () => import('./admin/staff/staff.component').then(m => m.StaffComponent),
    canActivate: [adminGuard]
  },
  {
    path: 'admin/analytics',
    loadComponent: () => import('./admin/analytics/analytics.component').then(m => m.AnalyticsComponent),
    canActivate: [adminGuard]
  },
  {
    path: 'admin/ai-marketing',
    loadComponent: () => import('./admin/ai-marketing/ai-marketing.component').then(m => m.AiMarketingComponent),
    canActivate: [adminGuard]
  },
  {
    path: 'admin/reviews',
    loadComponent: () => import('./admin/reviews/reviews.component').then(m => m.ReviewsComponent),
    canActivate: [adminGuard]
  },

  // ── Waiter Dashboard ──
  {
    path: 'waiter',
    loadComponent: () => import('./waiter/waiter-dashboard.component').then(m => m.WaiterDashboardComponent),
    canActivate: [authGuard]
  },

  // ── Kitchen Display ──
  {
    path: 'kitchen',
    loadComponent: () => import('./kitchen/kitchen.component').then(m => m.KitchenComponent),
    canActivate: [authGuard]
  },

  // ── Default ──
  { path: '**', redirectTo: '' }
];
