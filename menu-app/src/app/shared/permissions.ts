/**
 * Role-based access for screens and actions. Keep in sync with the backend's Helpers/Roles.cs —
 * the backend enforces these rules; this file only decides what the UI shows.
 */

export type AppRole = 'SuperAdmin' | 'RestaurantAdmin' | 'Manager' | 'Cashier' | 'Captain' | 'Waiter' | 'Kitchen' | 'Helper';

const OWNER: AppRole[] = ['SuperAdmin', 'RestaurantAdmin'];
const MANAGEMENT: AppRole[] = [...OWNER, 'Manager'];
const BILLING: AppRole[] = [...MANAGEMENT, 'Cashier'];
const FLOOR: AppRole[] = [...BILLING, 'Captain', 'Waiter'];

export const PERMISSIONS = {
  // Screens
  dashboard: MANAGEMENT,
  analytics: MANAGEMENT,
  aiMarketing: OWNER,
  reviews: OWNER,
  menu: MANAGEMENT,
  tables: MANAGEMENT,
  staff: MANAGEMENT,
  takeOrder: FLOOR,
  inventory: MANAGEMENT,
  website: OWNER,
  settings: OWNER,
  orders: BILLING,
  bills: BILLING,
  dues: BILLING,
  subscription: OWNER,
  kitchen: [...MANAGEMENT, 'Kitchen'] as AppRole[],

  // Actions within screens
  staffSalary: OWNER,
  settleBill: BILLING,
  createPastBill: MANAGEMENT,
  quickAddMenuItem: MANAGEMENT,
  seeAllTables: [...BILLING, 'Captain'] as AppRole[],
  filterTablesByWaiter: MANAGEMENT
} satisfies Record<string, AppRole[]>;

export type Permission = keyof typeof PERMISSIONS;

/** Roles that work inside the admin panel (sidebar layout). */
export const PANEL_ROLES: AppRole[] = BILLING;

export function can(role: string | null | undefined, permission: Permission): boolean {
  return !!role && (PERMISSIONS[permission] as string[]).includes(role);
}

export function isPanelRole(role: string | null | undefined): boolean {
  return !!role && (PANEL_ROLES as string[]).includes(role);
}

/** Where each role lands after login, or when it opens a screen it can't use. */
export function homeRouteFor(role: string | null | undefined): string {
  switch (role) {
    case 'Kitchen': return '/kitchen';
    case 'Waiter':
    case 'Captain':
    case 'Cashier': return '/waiter';
    case 'SuperAdmin':
    case 'RestaurantAdmin':
    case 'Manager': return '/admin/dashboard';
    default: return '/admin/login';
  }
}

/** Roles each role may add, deactivate or delete. Mirrors Roles.CanManage on the backend. */
export function manageableRoles(role: string | null | undefined): AppRole[] {
  switch (role) {
    case 'SuperAdmin':
    case 'RestaurantAdmin': return ['Manager', 'Cashier', 'Captain', 'Waiter', 'Kitchen', 'Helper'];
    case 'Manager': return ['Cashier', 'Captain', 'Waiter', 'Kitchen', 'Helper'];
    default: return [];
  }
}

export const ROLE_LABELS: Record<AppRole, string> = {
  SuperAdmin: '👑 Super Admin',
  RestaurantAdmin: '👑 Owner',
  Manager: '🧑‍💼 Manager',
  Cashier: '💵 Cashier',
  Captain: '🎖️ Captain',
  Waiter: '🛎️ Waiter',
  Kitchen: '🍳 Kitchen',
  Helper: '🧹 No app access (payroll only)'
};

/** Name shown for a staff member's role in lists: their job title if set, else a short role name. */
export function roleDisplayName(role: string, jobTitle?: string | null): string {
  if (jobTitle) return jobTitle;
  if (role === 'RestaurantAdmin') return 'Owner';
  if (role === 'Helper') return 'Payroll only';
  return role;
}

export interface NavItem {
  path: string;
  icon: string;
  label: string;
  permission: Permission;
  premium?: boolean;
}

/** Sidebar entries, in display order. Filtered by role (and plan, for premium ones). */
export const NAV_ITEMS: NavItem[] = [
  { path: '/admin/dashboard', icon: '📊', label: 'Dashboard', permission: 'dashboard' },
  { path: '/admin/analytics', icon: '📈', label: 'Analytics', permission: 'analytics' },
  { path: '/admin/ai-marketing', icon: '🤖', label: 'AI Marketing', permission: 'aiMarketing', premium: true },
  { path: '/admin/reviews', icon: '⭐', label: 'Reviews', permission: 'reviews', premium: true },
  { path: '/admin/menu', icon: '📋', label: 'Menu', permission: 'menu' },
  { path: '/admin/tables', icon: '🪑', label: 'Tables', permission: 'tables' },
  { path: '/admin/staff', icon: '👥', label: 'Staff', permission: 'staff' },
  { path: '/waiter', icon: '🛎️', label: 'Take Order', permission: 'takeOrder' },
  { path: '/admin/inventory', icon: '📦', label: 'Inventory', permission: 'inventory', premium: true },
  { path: '/admin/website', icon: '🌐', label: 'Website', permission: 'website' },
  { path: '/admin/settings', icon: '⚙️', label: 'Settings', permission: 'settings' },
  { path: '/admin/bills', icon: '🧾', label: 'Bills', permission: 'bills' },
  { path: '/admin/dues', icon: '📒', label: 'Udhaar', permission: 'dues' },
  { path: '/admin/subscription', icon: '💳', label: 'Billing', permission: 'subscription' }
];

export function navItemsFor(role: string | null | undefined, hasPremium: boolean): NavItem[] {
  return NAV_ITEMS.filter(i => can(role, i.permission) && (!i.premium || hasPremium));
}
