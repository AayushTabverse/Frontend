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
  waitlist: MANAGEMENT,
  reservations: MANAGEMENT,
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

/** Sidebar sections, in display order. */
export const NAV_GROUPS = ['Overview', 'Floor', 'Sales', 'Menu & Stock', 'Grow', 'Manage'] as const;
export type NavGroup = typeof NAV_GROUPS[number];

/** Icon names map to Lucide icons in shared/components/sidebar. */
export type NavIcon =
  | 'dashboard' | 'analytics' | 'takeOrder' | 'tables' | 'waitlist' | 'reservations'
  | 'bills' | 'udhaar' | 'menu' | 'inventory' | 'website' | 'aiMarketing' | 'reviews'
  | 'staff' | 'settings' | 'billing';

export interface NavItem {
  path: string;
  icon: NavIcon;
  label: string;
  group: NavGroup;
  permission: Permission;
  premium?: boolean;
}

/** Sidebar entries, in display order within each group. Filtered by role (and plan, for premium ones). */
export const NAV_ITEMS: NavItem[] = [
  { path: '/admin/dashboard', icon: 'dashboard', label: 'Dashboard', group: 'Overview', permission: 'dashboard' },
  { path: '/admin/analytics', icon: 'analytics', label: 'Analytics', group: 'Overview', permission: 'analytics' },
  { path: '/waiter', icon: 'takeOrder', label: 'Take Order', group: 'Floor', permission: 'takeOrder' },
  { path: '/admin/tables', icon: 'tables', label: 'Tables', group: 'Floor', permission: 'tables' },
  { path: '/admin/waitlist', icon: 'waitlist', label: 'Waitlist', group: 'Floor', permission: 'waitlist' },
  { path: '/admin/reservations', icon: 'reservations', label: 'Reservations', group: 'Floor', permission: 'reservations' },
  { path: '/admin/bills', icon: 'bills', label: 'Bills', group: 'Sales', permission: 'bills' },
  { path: '/admin/dues', icon: 'udhaar', label: 'Udhaar', group: 'Sales', permission: 'dues' },
  { path: '/admin/menu', icon: 'menu', label: 'Menu', group: 'Menu & Stock', permission: 'menu' },
  { path: '/admin/inventory', icon: 'inventory', label: 'Inventory', group: 'Menu & Stock', permission: 'inventory', premium: true },
  { path: '/admin/website', icon: 'website', label: 'Website', group: 'Grow', permission: 'website' },
  { path: '/admin/ai-marketing', icon: 'aiMarketing', label: 'AI Marketing', group: 'Grow', permission: 'aiMarketing', premium: true },
  { path: '/admin/reviews', icon: 'reviews', label: 'Reviews', group: 'Grow', permission: 'reviews', premium: true },
  { path: '/admin/staff', icon: 'staff', label: 'Staff', group: 'Manage', permission: 'staff' },
  { path: '/admin/settings', icon: 'settings', label: 'Settings', group: 'Manage', permission: 'settings' },
  { path: '/admin/subscription', icon: 'billing', label: 'Billing', group: 'Manage', permission: 'subscription' }
];

export function navItemsFor(role: string | null | undefined, hasPremium: boolean): NavItem[] {
  return NAV_ITEMS.filter(i => can(role, i.permission) && (!i.premium || hasPremium));
}
