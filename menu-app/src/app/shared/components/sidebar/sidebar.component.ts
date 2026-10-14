import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import {
  Armchair, CalendarDays, ChartLine, ChevronsLeft, ChevronsRight, ClipboardPen, CreditCard, Globe, Hourglass,
  LayoutDashboard, LogOut, LucideAngularModule, LucideIconData, Moon, NotebookPen, Package, ReceiptText,
  Settings, Sparkles, Star, Sun, UtensilsCrossed, Users, X
} from 'lucide-angular';
import { AuthService } from '../../../services/auth.service';
import { SubscriptionService } from '../../../services/subscription.service';
import { SettingsService } from '../../../services/settings.service';
import { ThemeService } from '../../../services/theme.service';
import { ReservationService } from '../../../services/reservation.service';
import { WaitlistService } from '../../../services/waitlist.service';
import { NAV_GROUPS, NavGroup, NavIcon, NavItem, can, navItemsFor, roleDisplayName } from '../../permissions';

const NAV_ICONS: Record<NavIcon, LucideIconData> = {
  dashboard: LayoutDashboard,
  analytics: ChartLine,
  takeOrder: ClipboardPen,
  tables: Armchair,
  waitlist: Hourglass,
  reservations: CalendarDays,
  bills: ReceiptText,
  udhaar: NotebookPen,
  menu: UtensilsCrossed,
  inventory: Package,
  website: Globe,
  aiMarketing: Sparkles,
  reviews: Star,
  staff: Users,
  settings: Settings,
  billing: CreditCard
};

const COLLAPSED_KEY = 'tabverse.sidebarCollapsed';

interface NavSection {
  group: NavGroup;
  items: NavItem[];
}

/**
 * Admin-panel sidebar (glass style): restaurant brand, grouped navigation with live badges,
 * and the account area (theme, logout). Used by the admin layout and the Take Order screen.
 */
@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, LucideAngularModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent implements OnInit, OnDestroy {
  /** Desktop: icon-only rail. */
  @Input() collapsed = false;
  @Output() collapsedChange = new EventEmitter<boolean>();

  /** Mobile: drawer open. */
  @Input() mobileOpen = false;
  @Output() mobileOpenChange = new EventEmitter<boolean>();

  readonly icons = { ChevronsLeft, ChevronsRight, LogOut, Moon, Sun, X };

  sections: NavSection[] = [];
  restaurantName = '';
  logoUrl = '';
  userName = '';
  roleLabel = '';
  /** Badge counts by path. */
  badges: Record<string, number> = {};

  /** Collapsed rail: label shown next to the hovered icon (fixed-position, so the scroll area can't clip it). */
  tooltip: { text: string; top: number } | null = null;

  themeService = inject(ThemeService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private subscriptions = inject(SubscriptionService);
  private settings = inject(SettingsService);
  private reservations = inject(ReservationService);
  private waitlist = inject(WaitlistService);

  private subs: Subscription[] = [];
  private badgeTimer?: ReturnType<typeof setInterval>;

  /** Saved collapsed state, for layouts to start with. */
  static savedCollapsed(): boolean {
    try { return localStorage.getItem(COLLAPSED_KEY) === '1'; } catch { return false; }
  }

  ngOnInit(): void {
    const role = this.auth.getRole();
    this.roleLabel = roleDisplayName(role ?? '');
    this.buildSections(navItemsFor(role, true));

    this.subs.push(this.auth.currentUser$.subscribe(u => this.userName = u?.fullName || ''));
    this.subscriptions.getStatus().subscribe(s => {
      this.buildSections(navItemsFor(role, s.isTrialActive || s.plan === 'Premium'));
    });
    this.settings.getSettings().subscribe({
      next: (s) => {
        this.restaurantName = s.name || '';
        this.logoUrl = s.logoUrl || '';
      }
    });

    this.refreshBadges();
    this.badgeTimer = setInterval(() => this.refreshBadges(), 60_000);
    this.subs.push(this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => this.refreshBadges()));
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    clearInterval(this.badgeTimer);
  }

  iconFor(item: NavItem): LucideIconData {
    return NAV_ICONS[item.icon];
  }

  get initials(): string {
    return this.initialsOf(this.restaurantName || 'TabVerse');
  }

  get userInitials(): string {
    return this.initialsOf(this.userName || this.roleLabel || 'U');
  }

  toggleCollapsed(): void {
    this.collapsed = !this.collapsed;
    this.tooltip = null;
    try { localStorage.setItem(COLLAPSED_KEY, this.collapsed ? '1' : '0'); } catch { /* private mode */ }
    this.collapsedChange.emit(this.collapsed);
  }

  closeMobile(): void {
    if (!this.mobileOpen) return;
    this.mobileOpen = false;
    this.mobileOpenChange.emit(false);
  }

  showTooltip(event: MouseEvent, text: string): void {
    if (!this.collapsed) return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.tooltip = { text, top: rect.top + rect.height / 2 };
  }

  hideTooltip(): void {
    this.tooltip = null;
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/admin/login']);
  }

  private buildSections(items: NavItem[]): void {
    this.sections = NAV_GROUPS
      .map(group => ({ group, items: items.filter(i => i.group === group) }))
      .filter(s => s.items.length > 0);
  }

  private refreshBadges(): void {
    const role = this.auth.getRole();
    if (can(role, 'reservations')) {
      this.reservations.getPendingCount().subscribe({
        next: (n) => this.badges = { ...this.badges, '/admin/reservations': n },
        error: () => {}
      });
    }
    if (can(role, 'waitlist')) {
      this.waitlist.getStats().subscribe({
        next: (s) => this.badges = { ...this.badges, '/admin/waitlist': s.waiting },
        error: () => {}
      });
    }
  }

  private initialsOf(text: string): string {
    const words = text.trim().split(/\s+/).filter(Boolean);
    return ((words[0]?.[0] ?? '') + (words[1]?.[0] ?? '')).toUpperCase() || '?';
  }
}
