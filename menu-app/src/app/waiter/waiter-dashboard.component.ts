import { Component, OnInit, OnDestroy, ViewChild, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { TableService } from '../services/table.service';
import { MenuService } from '../services/menu.service';
import { OrderService } from '../services/order.service';
import { AuthService } from '../services/auth.service';
import { SignalRService } from '../services/signalr.service';
import { ThemeService } from '../services/theme.service';
import { SettingsService } from '../services/settings.service';
import {
  TableResponse, MenuCategory, MenuItem,
  CreateOrderRequest, CreateOrderItemRequest,
  OrderResponse, OrderItemResponse, LiveOrdersResponse, TableSessionSummary,
  ClearTableRequest, CustomerDue, CustomerDueSearchResult, PaymentAccount, PaymentSplit
} from '../models/api.models';
import { AccountingService } from '../services/accounting.service';
import { DueService } from '../services/due.service';
import { CustomerService, CustomerSearchResult } from '../services/customer.service';
import { Subscription, Subject, merge } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, timeout } from 'rxjs/operators';
import { LucideAngularModule, Menu } from 'lucide-angular';
import { SidebarComponent } from '../shared/components/sidebar/sidebar.component';
import { AlertBannerComponent } from '../shared/components/alert-banner/alert-banner.component';
import { BillEditDialogComponent, BillEditResult } from '../shared/components/bill-edit-dialog/bill-edit-dialog.component';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LanguageSwitcherComponent } from '../shared/components/language-switcher/language-switcher.component';
import { DishNamePipe } from '../shared/dish-name.pipe';
import { WalkieComponent } from '../shared/components/walkie/walkie.component';
import { HotelService } from '../services/hotel.service';
import { LoyaltyLookup } from '../models/api.models';
import { DishNameService } from '../services/dish-name.service';

/** The "Popular" menu tab (top sellers), shown before the real categories. */
const POPULAR = '__popular';
const BIG_TEXT_KEY = 'tv.waiter.bigText';

interface WaiterCartItem {
  menuItem: MenuItem;
  quantity: number;
  notes?: string;
  /** Pack to take away. */
  isParcel?: boolean;
}

/** People sharing one table who pay separately: each phone's QR session, or a waiter-made party. */
interface TableParty {
  id: string;
  /** On screen, in the staff member's language. */
  label: string;
  /** On the printed bill (always English). */
  printLabel: string;
  orders: OrderResponse[];
  total: number;
}

interface MergedBillItem {
  itemName: string;
  /** For the on-screen bill: dish name in the staff member's language, plus a parcel tag. */
  menuItemId: string;
  baseName: string;
  isParcel: boolean;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

@Component({
  selector: 'app-waiter-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, LucideAngularModule, SidebarComponent, AlertBannerComponent, BillEditDialogComponent, TranslocoDirective, LanguageSwitcherComponent, DishNamePipe, WalkieComponent],
  templateUrl: './waiter-dashboard.component.html',
  styleUrl: './waiter-dashboard.component.scss'
})
export class WaiterDashboardComponent implements OnInit, OnDestroy {
  // ── State ──
  activeTab: 'tables' | 'orders' | 'takeaway' = 'tables';

  /** Open takeaway orders (Takeaway tab). */
  takeawayOrders: OrderResponse[] = [];
  /** What the open bill is for: the whole table, one party at it, or takeaway orders. */
  billKind: 'table' | 'party' | 'takeaway' = 'table';
  billOrderIds: string[] | null = null;
  billPartyLabel = '';
  /** Waiter adding to a shared table: '' = no particular party, 'new' = start a new party, else a party id. */
  partyForNewOrder = '';
  /** Shared table: asking whether to bill each party separately or all together. */
  showSplitChoice = false;
  /** Parties still to bill after the current one ("bill each party"). */
  billQueue: { id: string; label: string; printLabel: string }[] = [];

  // Drag a table onto another
  private press: { table: TableResponse; x: number; y: number; armed: boolean; timer?: ReturnType<typeof setTimeout> } | null = null;
  dragSource: TableResponse | null = null;
  dragOverId: string | null = null;
  dragGhost: { x: number; y: number } | null = null;
  /** The dropped pair, while the waiter picks what to do. */
  drop: { source: TableResponse; target: TableResponse } | null = null;
  private suppressTableClick = false;

  // Tables
  tables: TableResponse[] = [];
  selectedTable: TableResponse | null = null;

  // Table Session (existing orders for selected table)
  tableSession: TableSessionSummary | null = null;
  sessionLoading = false;

  // Menu
  categories: MenuCategory[] = [];
  activeCategory: string | null = null;
  showMenu = false;
  readonly POPULAR = POPULAR;
  /** Best sellers of the last 30 days, most sold first. */
  popularItems: MenuItem[] = [];
  /** Menu item id → sales rank (1 = best seller). */
  private popularRank = new Map<string, number>();

  // Order screen layout
  /** Larger text on the order screen (remembered per device). */
  bigText = false;
  /** Phone: the cart sheet is open. */
  cartOpen = false;
  /** Phone: the ⋯ menu with merge / transfer / ready for bill. */
  showTableMenu = false;
  /** "Already ordered" expanded to the full order cards. */
  showExisting = false;
  /** Cart line whose note / parcel is being edited (hold a dish or tap ✎). */
  editingEntry: WaiterCartItem | null = null;
  readonly quickNotes = ['lessSpicy', 'extraSpicy', 'noOnion', 'noGarlic', 'jain', 'lessOil'];
  private tileHold: { timer: ReturnType<typeof setTimeout>; x: number; y: number } | null = null;
  private suppressTileClick = false;

  // Cart (new items to add)
  cart: WaiterCartItem[] = [];
  specialInstructions = '';

  // Orders
  liveOrders?: LiveOrdersResponse;
  ordersLoading = true;

  // Bill / Clear
  showBillSummary = false;
  billSummary: TableSessionSummary | null = null;
  mergedBillItems: MergedBillItem[] = [];
  clearing = false;
  restaurantName = '';
  upiQrCodeUrl = '';
  /** When set, each bill prints a UPI QR with its amount filled in (else the uploaded static QR). */
  upiId = '';
  printerWidth = 'standard';
  directPrint = false;
  cgstPercent = 2.5;
  sgstPercent = 2.5;
  serviceChargePercent = 0;
  billCustomerName = '';
  billCustomerMobile = '';
  /** Loyalty: the customer's points (looked up by mobile) and how many to use on this bill. */
  loyalty: LoyaltyLookup | null = null;
  useLoyaltyPoints = false;
  redeemPoints = 0;
  billCustomerDob = '';
  private loyaltyMobile = '';
  /** Extra discount typed by staff at billing (on top of any Lucky Draw discount already on the orders). */
  billDiscountAmount = 0;
  /** True once the table is billed: billSummary then holds the server's final, already-discounted totals. */
  billFinalized = false;
  /** Editing a printed bill (remove items the customer didn't get). */
  showBillEdit = false;
  billRevised = false;
  billRefundAmount = 0;
  billPaidAmount = 0;
  billPaymentMode: 'full' | 'partial' = 'full';
  /** How the paid part was paid: one account, or split across several (cash/UPI/card…). */
  paymentAccounts: PaymentAccount[] = [];
  billPayAccount = '';
  billPaySplit = false;
  billSplitAmounts: Record<string, number | null> = {};
  /** What was sent with the settled bill, for the printed "Paid by" line. */
  private billPaidBy: PaymentSplit[] = [];
  billNotes = '';
  previousDues: CustomerDue[] = [];
  previousDueTotal = 0;
  loadingDues = false;
  customerSuggestions: CustomerSearchResult[] = [];
  showCustomerSuggestions = false;
  private customerSearch$ = new Subject<string>();

  // General
  loading = false;
  submitting = false;
  successMessage = '';
  errorMessage = '';
  userName = '';
  // Role-based UI (see shared/permissions.ts)
  usesSidebar = false;       // Owner, Manager, Cashier work inside the admin panel
  seesAllTables = false;     // Everyone except waiters, who see their assigned tables
  canFilterByWaiter = false;
  canSettleBill = false;
  requestingBill = false;
  canQuickAdd = false;
  sidebarCollapsed = SidebarComponent.savedCollapsed();
  mobileSidebarOpen = false;
  readonly MenuIcon = Menu;

  // Table assignment
  showAllTables = false;
  assignedTableIds: string[] = [];
  userId = '';

  statusOptions = ['Pending', 'Accepted', 'Preparing', 'Ready', 'Served', 'Completed'];
  confirmCancelItemId: string | null = null;
  cancellingItemId: string | null = null;
  private subs: Subscription[] = [];

  @ViewChild('tableNavScroll') tableNavScroll?: ElementRef<HTMLDivElement>;

  // Merge / transfer
  tableAction: 'merge' | 'transfer' | null = null;
  mergeSelection: string[] = [];
  transferTargetId = '';
  tableActionSaving = false;

  // Quick-add item
  showQuickAdd = false;
  quickAddName = '';
  quickAddPrice: number | null = null;
  quickAddIsVeg = true;
  quickAddCategoryId = '';
  quickAddSaving = false;

  // Menu search
  menuSearchQuery = '';
  menuSearchResults: MenuItem[] = [];
  menuVegFilter: 'all' | 'veg' | 'nonveg' = 'all';

  // Admin waiter filter
  allWaiters: { id: string; fullName: string }[] = [];
  adminFilterWaiterId = '';

  constructor(
    private tableService: TableService,
    private menuService: MenuService,
    private orderService: OrderService,
    private authService: AuthService,
    private signalR: SignalRService,
    private settingsService: SettingsService,
    private dueService: DueService,
    private customerService: CustomerService,
    public themeService: ThemeService,
    private router: Router,
    private transloco: TranslocoService,
    private hotelService: HotelService,
    private accountingService: AccountingService,
    private dishNames: DishNameService
  ) {
    try { this.bigText = localStorage.getItem(BIG_TEXT_KEY) === '1'; } catch { /* storage blocked */ }
  }

  ngOnInit(): void {
    document.addEventListener('touchmove', this.blockTouchScroll, { passive: false });
    this.authService.currentUser$.subscribe(user => {
      this.userName = user?.fullName || 'Staff';
      this.userId = user?.userId || '';
    });
    this.usesSidebar = this.authService.isPanelUser();
    this.seesAllTables = this.authService.can('seeAllTables');
    this.canFilterByWaiter = this.authService.can('filterTablesByWaiter');
    this.canSettleBill = this.authService.can('settleBill');
    this.canQuickAdd = this.authService.can('quickAddMenuItem');
    this.loadTables();
    this.loadTakeaway();
    this.loadOrders();
    this.loadRestaurantName();
    this.loadPaymentAccounts();
    this.setupRealTime();
    if (!this.seesAllTables && this.authService.getUserId()) {
      this.loadAssignedTables();
    }
    if (this.canFilterByWaiter) {
      this.loadWaitersForFilter();
    }

    // Customer autocomplete
    this.subs.push(
      this.customerSearch$.pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap(q => this.customerService.search(q))
      ).subscribe({
        next: (results) => {
          this.customerSuggestions = results;
          this.showCustomerSuggestions = results.length > 0;
        },
        error: () => {
          this.customerSuggestions = [];
          this.showCustomerSuggestions = false;
        }
      })
    );
  }

  // ── Tables ──

  loadAssignedTables(): void {
    const userId = this.authService.getUserId();
    if (!userId) return;
    this.tableService.getWaiterAssignment(userId).subscribe({
      next: (assignment) => {
        this.assignedTableIds = assignment.assignedTableIds || [];
      },
      error: () => {
        this.assignedTableIds = [];
      }
    });
  }

  getVisibleTables(): TableResponse[] {
    // Admin with waiter filter active
    if (this.canFilterByWaiter && this.adminFilterWaiterId) {
      const assignment = this.adminFilterAssignments.find(a => a.waiterId === this.adminFilterWaiterId);
      if (!assignment) return [];
      return this.tables.filter(t => assignment.assignedTableIds.includes(t.id));
    }
    if (this.seesAllTables || this.showAllTables || this.assignedTableIds.length === 0) {
      return this.tables;
    }
    return this.tables.filter(t => this.assignedTableIds.includes(t.id));
  }

  toggleShowAllTables(): void {
    this.showAllTables = !this.showAllTables;
  }

  // Admin waiter filter
  adminFilterAssignments: { waiterId: string; assignedTableIds: string[] }[] = [];

  loadWaitersForFilter(): void {
    this.authService.getStaff().subscribe({
      next: (staff) => {
        this.allWaiters = staff
          .filter(s => s.role === 'Waiter' && s.isActive)
          .map(s => ({ id: s.id, fullName: s.fullName }));
      }
    });
    this.tableService.getAllAssignments().subscribe({
      next: (a) => this.adminFilterAssignments = a.map(x => ({ waiterId: x.waiterId, assignedTableIds: x.assignedTableIds })),
      error: () => this.adminFilterAssignments = []
    });
  }

  loadTables(): void {
    this.loading = true;
    this.tableService.getTables().subscribe({
      next: (tables) => {
        // Natural order: 2 before 10
        this.tables = [...tables].sort((a, b) => a.tableNumber.localeCompare(b.tableNumber, undefined, { numeric: true }));
        this.loading = false;
        // Keep the open table's merge/reservation info current
        if (this.selectedTable) {
          const fresh = tables.find(t => t.id === this.selectedTable!.id);
          if (fresh?.mergedIntoTableId) {
            // It was merged into another table while open → follow the bill
            const main = tables.find(t => t.id === fresh.mergedIntoTableId);
            if (main) this.switchTable(main);
          } else if (fresh) {
            this.selectedTable = fresh;
          }
        }
      },
      error: () => this.loading = false
    });
  }

  /** Parties at the open table, in the order they started ordering. */
  get parties(): TableParty[] {
    if (!this.tableSession) return [];
    const groups = new Map<string, OrderResponse[]>();
    for (const o of this.tableSession.orders) {
      const key = o.customerSessionId ?? '';
      groups.set(key, [...(groups.get(key) ?? []), o]);
    }
    let letter = 0;
    return [...groups.entries()]
      .sort((a, b) => a[1][0].createdAt.localeCompare(b[1][0].createdAt))
      .map(([id, orders]) => ({
        id,
        label: this.transloco.translate('waiter.party.letter', { letter: String.fromCharCode(65 + letter) }),
        printLabel: `Party ${String.fromCharCode(65 + letter++)}`,
        orders,
        total: orders.reduce((sum, o) => sum + o.totalAmount, 0)
      }));
  }

  partyLabelOf(order: OrderResponse): string {
    return this.parties.find(p => p.orders.includes(order))?.label ?? '';
  }

  loadTakeaway(): void {
    this.orderService.getOpenTakeaway().subscribe({
      next: (orders) => this.takeawayOrders = orders,
      error: () => {}
    });
  }

  /** Counter staff take takeaway orders on the same page customers use (the takeaway QR). */
  openTakeawayCounter(): void {
    window.open(`/menu/${this.authService.getTenantId()}/takeaway`, '_blank');
  }

  markPickedUp(order: OrderResponse): void {
    this.orderService.markPickedUp(order.id).subscribe({
      next: () => {
        this.takeawayOrders = this.takeawayOrders.filter(o => o.id !== order.id);
        this.successMessage = this.transloco.translate('waiter.toast.handedOver', { token: order.tokenNumber });
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: (err) => {
        this.errorMessage = err.error?.message || this.transloco.translate('waiter.toast.updateFailed');
        setTimeout(() => this.errorMessage = '', 4000);
      }
    });
  }

  /** Tables the waiters marked done eating, oldest first: the cashier's to-do list. */
  get billRequestedTables(): TableResponse[] {
    return this.tables
      .filter(t => t.billRequestedAt && !t.mergedIntoTableId)
      .sort((a, b) => a.billRequestedAt!.localeCompare(b.billRequestedAt!));
  }

  minutesSince(iso: string): number {
    return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  }

  /** Waiter: the table is done eating. The counter gets an alert to print the bill. */
  requestBill(): void {
    if (!this.selectedTable) return;
    const table = this.selectedTable;
    this.requestingBill = true;
    this.tableService.requestBill(table.id).subscribe({
      next: (t) => {
        table.billRequestedAt = t.billRequestedAt;
        table.billRequestedBy = t.billRequestedBy;
        this.requestingBill = false;
        this.successMessage = this.transloco.translate('waiter.toast.counterNotified', { table: table.tableNumber });
        setTimeout(() => this.successMessage = '', 4000);
      },
      error: (err) => {
        this.requestingBill = false;
        this.errorMessage = err.error?.message || this.transloco.translate('waiter.toast.notifyFailed');
        setTimeout(() => this.errorMessage = '', 4000);
      }
    });
  }

  cancelBillRequest(): void {
    if (!this.selectedTable) return;
    const table = this.selectedTable;
    this.requestingBill = true;
    this.tableService.cancelBillRequest(table.id).subscribe({
      next: () => {
        table.billRequestedAt = undefined;
        table.billRequestedBy = undefined;
        this.requestingBill = false;
      },
      error: () => this.requestingBill = false
    });
  }

  selectTable(table: TableResponse): void {
    table = this.mainTableOf(table);
    this.selectedTable = table;
    this.cart = [];
    this.partyForNewOrder = '';
    this.specialInstructions = '';
    this.showBillSummary = false;
    this.billSummary = null;
    this.resetBuilderLayout();
    this.loadTableSession(table.id);
    this.loadMenu();
  }

  switchTable(table: TableResponse): void {
    table = this.mainTableOf(table);
    if (this.selectedTable?.id === table.id) return;
    this.selectedTable = table;
    this.cart = [];
    this.partyForNewOrder = '';
    this.specialInstructions = '';
    this.showBillSummary = false;
    this.billSummary = null;
    this.tableSession = null;
    this.showQuickAdd = false;
    this.menuSearchQuery = '';
    this.menuSearchResults = [];
    this.resetBuilderLayout();
    this.loadTableSession(table.id);
    if (this.categories.length === 0) {
      this.loadMenu();
    }
  }

  /** A merged table opens its main table, which holds the bill. */
  private mainTableOf(table: TableResponse): TableResponse {
    return (table.mergedIntoTableId && this.tables.find(t => t.id === table.mergedIntoTableId)) || table;
  }

  // ── Merge & transfer ──

  /** Tables that can be merged into the open table (running orders on them move to this bill). */
  get mergeCandidates(): TableResponse[] {
    const sel = this.selectedTable;
    if (!sel) return [];
    return this.tables.filter(t =>
      t.id !== sel.id && t.isActive && !t.mergedIntoTableId && !t.mergedTableNumbers?.length
      && (!t.waitlistEntryId || t.waitlistEntryId === sel.waitlistEntryId));
  }

  /** Free tables the open table's party can move to. */
  get transferCandidates(): TableResponse[] {
    const sel = this.selectedTable;
    if (!sel) return [];
    return this.tables.filter(t =>
      t.id !== sel.id && t.isActive && !t.isOccupied && !t.mergedIntoTableId && !t.mergedTableNumbers?.length && !t.waitlistEntryId);
  }

  get canTransfer(): boolean {
    const sel = this.selectedTable;
    return !!sel && ((this.tableSession?.activeOrderCount ?? 0) > 0 || !!sel.waitlistEntryId || !!sel.mergedTableNumbers?.length);
  }

  get mergeSeats(): number {
    const extra = this.tables.filter(t => this.mergeSelection.includes(t.id)).reduce((sum, t) => sum + t.capacity, 0);
    return (this.selectedTable?.combinedCapacity ?? this.selectedTable?.capacity ?? 0) + extra;
  }

  get mergeMovesOrders(): boolean {
    return this.tables.some(t => this.mergeSelection.includes(t.id) && t.isOccupied);
  }

  openTableAction(action: 'merge' | 'transfer'): void {
    this.tableAction = action;
    this.mergeSelection = [];
    this.transferTargetId = '';
  }

  closeTableAction(): void {
    this.tableAction = null;
  }

  toggleMergeTable(id: string): void {
    const i = this.mergeSelection.indexOf(id);
    if (i >= 0) this.mergeSelection.splice(i, 1);
    else this.mergeSelection.push(id);
  }

  confirmMerge(): void {
    const sel = this.selectedTable;
    if (!sel || this.mergeSelection.length === 0) return;
    this.tableActionSaving = true;
    this.tableService.mergeTables(sel.id, this.mergeSelection).subscribe({
      next: (main) => {
        this.tableActionSaving = false;
        this.tableAction = null;
        this.selectedTable = main;
        this.flashSuccess(this.transloco.translate('waiter.toast.merged', { tables: main.mergedTableNumbers?.join(', '), table: main.tableNumber }));
        this.loadTables();
        this.loadTableSession(main.id);
      },
      error: (err) => {
        this.tableActionSaving = false;
        this.flashError(err.error?.message || this.transloco.translate('waiter.toast.mergeFailed'));
      }
    });
  }

  unmergeAll(): void {
    const sel = this.selectedTable;
    if (!sel?.mergedTableNumbers?.length) return;
    if (!confirm(this.transloco.translate('waiter.toast.unmergeConfirm', { tables: sel.mergedTableNumbers.join(', '), table: sel.tableNumber }))) return;
    this.tableService.unmerge(sel.id).subscribe({
      next: () => { this.flashSuccess(this.transloco.translate('waiter.toast.unmerged')); this.loadTables(); },
      error: (err) => this.flashError(err.error?.message || this.transloco.translate('waiter.toast.unmergeFailed'))
    });
  }

  confirmTransfer(): void {
    const sel = this.selectedTable;
    const target = this.tables.find(t => t.id === this.transferTargetId);
    if (!sel || !target) return;
    this.tableActionSaving = true;
    this.tableService.transfer(sel.id, target.id).subscribe({
      next: (moved) => {
        this.tableActionSaving = false;
        this.tableAction = null;
        this.flashSuccess(this.transloco.translate('waiter.toast.moved', { from: sel.tableNumber, to: moved.tableNumber }));
        this.tables = this.tables.map(t => t.id === moved.id ? moved : t);
        this.switchTable(moved);
        this.loadTables();
      },
      error: (err) => {
        this.tableActionSaving = false;
        this.flashError(err.error?.message || this.transloco.translate('waiter.toast.transferFailed'));
      }
    });
  }

  private flashSuccess(message: string): void {
    this.errorMessage = '';
    this.successMessage = message;
    setTimeout(() => this.successMessage = '', 4000);
  }

  private flashError(message: string): void {
    this.successMessage = '';
    this.errorMessage = message;
    setTimeout(() => this.errorMessage = '', 5000);
  }

  scrollTableNav(direction: 'left' | 'right'): void {
    const el = this.tableNavScroll?.nativeElement;
    if (!el) return;
    const scrollAmount = 200;
    el.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
  }

  private resetBuilderLayout(): void {
    this.cartOpen = false;
    this.showTableMenu = false;
    this.showExisting = false;
    this.editingEntry = null;
  }

  deselectTable(): void {
    this.selectedTable = null;
    this.resetBuilderLayout();
    this.showMenu = false;
    this.cart = [];
    this.categories = [];
    this.specialInstructions = '';
    this.tableSession = null;
    this.showBillSummary = false;
    this.billSummary = null;
    this.loadTables(); // Refresh table statuses
  }

  // ── Table Session ──

  loadTableSession(tableId: string): void {
    this.sessionLoading = true;
    this.orderService.getTableSession(tableId).subscribe({
      next: (session) => {
        this.tableSession = session;
        this.sessionLoading = false;
        // New items go to an existing party unless the waiter picks otherwise
        const ids = this.parties.map(p => p.id);
        if (this.partyForNewOrder !== 'new' && !ids.includes(this.partyForNewOrder)) this.partyForNewOrder = ids[0] ?? '';
      },
      error: () => this.sessionLoading = false
    });
  }

  // ── Menu ──

  loadMenu(): void {
    this.showMenu = true;
    const tenantId = this.authService.getTenantId();
    if (!tenantId) return;

    this.menuService.getMenuByTenant(tenantId).subscribe({
      next: (menu) => {
        this.categories = menu.categories.filter(c => c.items?.length > 0);
        this.buildPopular();
        this.activeCategory = this.popularItems.length ? POPULAR : this.categories[0]?.id ?? null;
      }
    });
    this.menuService.getPopular(30).subscribe({
      next: (rows) => {
        this.popularRank = new Map(rows.map((r, i) => [r.menuItemId, i + 1]));
        this.buildPopular();
        // Open on Popular unless the waiter already picked a category
        if (this.popularItems.length && (!this.activeCategory || this.activeCategory === this.categories[0]?.id)) {
          this.activeCategory = POPULAR;
        }
      },
      error: () => {}
    });
  }

  private buildPopular(): void {
    const items = this.categories.flatMap(c => c.items).filter(i => this.popularRank.has(i.id));
    this.popularItems = items.sort((a, b) => this.popularRank.get(a.id)! - this.popularRank.get(b.id)!);
  }

  /** Sales rank for the top three sellers (shown as a badge on the dish). */
  rankOf(item: MenuItem): number | null {
    const rank = this.popularRank.get(item.id);
    return rank && rank <= 3 ? rank : null;
  }

  setBigText(on: boolean): void {
    this.bigText = on;
    try { localStorage.setItem(BIG_TEXT_KEY, on ? '1' : '0'); } catch { /* storage blocked */ }
  }

  /** Everything already ordered at the table, one line per dish, most ordered first. */
  get orderedSummary(): { menuItemId: string; name: string; quantity: number }[] {
    const lines = new Map<string, { menuItemId: string; name: string; quantity: number }>();
    for (const o of this.tableSession?.orders ?? []) {
      for (const i of o.items) {
        const line = lines.get(i.menuItemId);
        if (line) line.quantity += i.quantity;
        else lines.set(i.menuItemId, { menuItemId: i.menuItemId, name: i.itemName, quantity: i.quantity });
      }
    }
    return [...lines.values()].sort((a, b) => b.quantity - a.quantity);
  }

  /** Dishes this table already had that are still on the menu: one tap orders another. */
  get againItems(): MenuItem[] {
    const byId = new Map(this.categories.flatMap(c => c.items).map(i => [i.id, i]));
    return this.orderedSummary
      .map(l => byId.get(l.menuItemId))
      .filter((i): i is MenuItem => !!i && i.isAvailable)
      .slice(0, 6);
  }

  // ── Dish tiles: tap adds, hold opens note / parcel ──

  onTilePointerDown(event: PointerEvent, item: MenuItem): void {
    if (event.button !== 0) return;
    this.clearTileHold();
    this.tileHold = {
      x: event.clientX,
      y: event.clientY,
      timer: setTimeout(() => {
        this.tileHold = null;
        this.suppressTileClick = true;
        if (!this.getCartEntry(item.id)) this.addToCart(item);
        this.openItemOptions(this.getCartEntry(item.id)!);
        navigator.vibrate?.(30);
      }, 500)
    };
  }

  onTilePointerMove(event: PointerEvent): void {
    // Scrolling the menu, not holding
    if (this.tileHold && Math.hypot(event.clientX - this.tileHold.x, event.clientY - this.tileHold.y) > 10) this.clearTileHold();
  }

  clearTileHold(): void {
    if (this.tileHold) clearTimeout(this.tileHold.timer);
    this.tileHold = null;
  }

  onTileClick(item: MenuItem): void {
    if (this.suppressTileClick) {
      this.suppressTileClick = false;
      return;
    }
    this.addToCart(item);
  }

  changeQty(item: MenuItem, delta: number): void {
    const entry = this.getCartEntry(item.id);
    if (entry) this.updateQty(this.cart.indexOf(entry), delta);
  }

  openItemOptions(entry: WaiterCartItem): void {
    this.editingEntry = entry;
  }

  addQuickNote(key: string): void {
    if (!this.editingEntry) return;
    const note = this.transloco.translate('waiter.notes.' + key);
    const current = this.editingEntry.notes?.trim();
    if (current?.split(', ').includes(note)) return;
    this.editingEntry.notes = current ? `${current}, ${note}` : note;
  }

  removeEditingEntry(): void {
    const index = this.editingEntry ? this.cart.indexOf(this.editingEntry) : -1;
    if (index >= 0) this.removeFromCart(index);
    this.editingEntry = null;
  }

  setCategory(catId: string): void {
    this.activeCategory = catId;
  }

  getActiveItems(): MenuItem[] {
    // If searching, return search results
    if (this.menuSearchQuery.trim()) {
      return this.applyMenuVegFilter(this.menuSearchResults);
    }
    if (this.activeCategory === POPULAR) return this.applyMenuVegFilter(this.popularItems.filter(i => i.isAvailable));
    const cat = this.categories.find(c => c.id === this.activeCategory);
    const items = cat?.items?.filter(i => i.isAvailable) ?? [];
    return this.applyMenuVegFilter(items);
  }

  private applyMenuVegFilter(items: MenuItem[]): MenuItem[] {
    if (this.menuVegFilter === 'veg') return items.filter(i => i.isVeg);
    if (this.menuVegFilter === 'nonveg') return items.filter(i => !i.isVeg);
    return items;
  }

  onMenuSearch(query: string): void {
    this.menuSearchQuery = query;
    if (!query.trim()) {
      this.menuSearchResults = [];
      return;
    }
    const q = query.toLowerCase().trim();
    this.menuSearchResults = [];
    for (const cat of this.categories) {
      for (const item of cat.items) {
        if (item.isAvailable && (item.name.toLowerCase().includes(q) || item.description?.toLowerCase().includes(q)
            || this.dishNames.dish(item.id, item.name).toLowerCase().includes(q))) {
          this.menuSearchResults.push(item);
        }
      }
    }
  }

  clearMenuSearch(): void {
    this.menuSearchQuery = '';
    this.menuSearchResults = [];
  }

  // ── Cart ──

  addToCart(item: MenuItem): void {
    const existing = this.cart.find(c => c.menuItem.id === item.id);
    if (existing) {
      existing.quantity++;
    } else {
      this.cart.push({ menuItem: item, quantity: 1 });
    }
    navigator.vibrate?.(10);
  }

  removeFromCart(index: number): void {
    this.cart.splice(index, 1);
  }

  updateQty(index: number, delta: number): void {
    this.cart[index].quantity += delta;
    if (this.cart[index].quantity <= 0) {
      this.cart.splice(index, 1);
    }
  }

  getCartTotal(): number {
    return this.cart.reduce((sum, c) => sum + (c.menuItem.price + (c.isParcel ? c.menuItem.packagingCharge ?? 0 : 0)) * c.quantity, 0);
  }

  getCartItemCount(): number {
    return this.cart.reduce((sum, c) => sum + c.quantity, 0);
  }

  getCartInItem(itemId: string): number {
    return this.cart.find(c => c.menuItem.id === itemId)?.quantity ?? 0;
  }

  getCartEntry(itemId: string): WaiterCartItem | undefined {
    return this.cart.find(c => c.menuItem.id === itemId);
  }

  // ── Quick Add Item ──

  openQuickAdd(): void {
    this.showQuickAdd = true;
    this.quickAddName = '';
    this.quickAddPrice = null;
    this.quickAddIsVeg = true;
    this.quickAddCategoryId = this.activeCategory && this.activeCategory !== POPULAR ? this.activeCategory : this.categories[0]?.id ?? '';
  }

  cancelQuickAdd(): void {
    this.showQuickAdd = false;
  }

  saveQuickAddItem(): void {
    if (!this.quickAddName.trim() || !this.quickAddPrice || this.quickAddPrice <= 0 || !this.quickAddCategoryId) return;
    this.quickAddSaving = true;

    const body = {
      name: this.quickAddName.trim(),
      price: this.quickAddPrice,
      isVeg: this.quickAddIsVeg,
      categoryId: this.quickAddCategoryId,
      isAvailable: true,
      sortOrder: 999,
      preparationTimeMinutes: 15
    };

    this.menuService.createItem(body).subscribe({
      next: (newItem) => {
        this.quickAddSaving = false;
        this.showQuickAdd = false;
        // Add to local categories list & auto-add to cart
        const cat = this.categories.find(c => c.id === this.quickAddCategoryId);
        if (cat) {
          cat.items.push(newItem);
        }
        this.addToCart(newItem);
        this.successMessage = this.transloco.translate('waiter.toast.quickAdded', { name: newItem.name });
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: () => {
        this.quickAddSaving = false;
        this.errorMessage = this.transloco.translate('waiter.toast.quickAddFailed');
        setTimeout(() => this.errorMessage = '', 3000);
      }
    });
  }

  // ── Place Order (adds new order to table) ──

  placeOrder(): void {
    if (!this.selectedTable || this.cart.length === 0) return;

    this.submitting = true;
    this.errorMessage = '';

    const tenantId = this.authService.getTenantId()!;
    const request: CreateOrderRequest = {
      tableId: this.selectedTable.id,
      specialInstructions: this.specialInstructions || undefined,
      items: this.cart.map(c => ({
        menuItemId: c.menuItem.id,
        quantity: c.quantity,
        notes: c.notes,
        isParcel: !!c.isParcel
      } as CreateOrderItemRequest))
    };

    // Shared table: tag the order with the party paying for it
    const partyId = this.partyForNewOrder === 'new'
      ? `w-${crypto.randomUUID?.() ?? Date.now().toString(36)}`
      : this.partyForNewOrder || undefined;

    this.orderService.createOrder(request, tenantId, partyId).subscribe({
      next: (order) => {
        this.submitting = false;
        this.successMessage = this.transloco.translate('waiter.toast.orderAdded', { number: order.orderNumber, table: this.selectedTable!.tableNumber });
        this.cart = [];
        this.specialInstructions = '';
        this.cartOpen = false;
        // Reload session to show new order in the existing orders list
        this.loadTableSession(this.selectedTable!.id);
        this.loadOrders();
        setTimeout(() => this.successMessage = '', 4000);
      },
      error: (err) => {
        this.submitting = false;
        this.errorMessage = err.error?.message || this.transloco.translate('waiter.toast.placeFailed');
      }
    });
  }

  // ── Clear Table / Bill Paid ──

  loadRestaurantName(): void {
    this.settingsService.getSettings().subscribe({
      next: (s) => {
        this.restaurantName = s.name || 'Restaurant';
        this.upiQrCodeUrl = s.upiQrCodeUrl || '';
        this.upiId = s.upiId || '';
        this.printerWidth = s.printerWidth || 'standard';
        this.directPrint = s.directPrint || false;
        this.cgstPercent = s.cgstPercent ?? 2.5;
        this.sgstPercent = s.sgstPercent ?? 2.5;
        this.serviceChargePercent = s.serviceChargePercent ?? 0;
      },
      error: () => this.restaurantName = 'Restaurant'
    });
  }

  /** Step 1: Show bill preview BEFORE calling the API */
  /** Bill the whole table, or only one party's orders at a shared table. */
  previewBill(party?: TableParty): void {
    if (!this.selectedTable || !this.tableSession) return;
    this.billKind = party ? 'party' : 'table';
    this.billOrderIds = party ? party.orders.map(o => o.id) : null;
    this.billPartyLabel = party?.printLabel ?? '';
    this.billSummary = party ? this.summaryOf(party.orders, this.tableSession.tableNumber) : this.tableSession;
    this.mergedBillItems = this.computeMergedItems(this.billSummary);
    // Pre-fill the customer seated here from the waitlist, if any
    this.billCustomerName = this.selectedTable.waitlistCustomerName || '';
    this.billCustomerMobile = this.selectedTable.waitlistCustomerMobile || '';
    this.billDiscountAmount = 0;
    this.billFinalized = false;
    this.billRevised = false;
    this.billRefundAmount = 0;
    this.billPaidAmount = 0;
    this.billPaymentMode = 'full';
    this.billNotes = '';
    this.previousDues = [];
    this.previousDueTotal = 0;
    this.resetLoyalty();
    this.resetPayment();
    this.showBillSummary = true;
    this.checkLoyalty();
  }

  /** Bill a takeaway order (usually before it's cooked: paid at the counter). */
  previewTakeawayBill(order: OrderResponse): void {
    this.billKind = 'takeaway';
    this.billOrderIds = [order.id];
    this.billPartyLabel = '';
    this.billSummary = this.summaryOf([order], `Takeaway ${order.tokenNumber ?? ''}`.trim());
    this.mergedBillItems = this.computeMergedItems(this.billSummary);
    this.billCustomerName = order.customerName || '';
    this.billCustomerMobile = order.customerMobile || '';
    this.billDiscountAmount = 0;
    this.billFinalized = false;
    this.billRevised = false;
    this.billRefundAmount = 0;
    this.billPaidAmount = 0;
    this.billPaymentMode = 'full';
    this.billNotes = '';
    this.previousDues = [];
    this.previousDueTotal = 0;
    this.resetLoyalty();
    this.resetPayment();
    this.showBillSummary = true;
    this.checkLoyalty();
  }

  private summaryOf(orders: OrderResponse[], tableNumber: string): TableSessionSummary {
    const sum = (f: (o: OrderResponse) => number) => orders.reduce((t, o) => t + f(o), 0);
    return {
      tableNumber,
      activeOrderCount: orders.length,
      grandSubTotal: sum(o => o.subTotal),
      grandPackaging: sum(o => o.packagingCharge ?? 0),
      grandTax: sum(o => o.tax),
      grandDiscount: sum(o => o.discountAmount),
      grandTotal: sum(o => o.totalAmount),
      paidAmount: 0,
      dueAmount: 0,
      orders
    };
  }

  /** Food + packing: tax is charged on both. */
  get billTaxable(): number {
    return (this.billSummary?.grandSubTotal ?? 0) + (this.billSummary?.grandPackaging ?? 0)
      - (this.billSummary?.grandLoyaltyDiscount ?? 0) - this.pendingLoyaltyValue;
  }

  // ── Loyalty points ──

  /** Looks up the customer's points once a full mobile number is entered. */
  checkLoyalty(): void {
    const mobile = this.billCustomerMobile;
    if (mobile?.length !== 10) {
      this.loyalty = null;
      this.loyaltyMobile = '';
      this.useLoyaltyPoints = false;
      return;
    }
    if (mobile === this.loyaltyMobile) return;
    this.loyaltyMobile = mobile;
    this.customerService.loyalty(mobile).subscribe({
      next: (l) => {
        if (mobile !== this.billCustomerMobile) return;
        this.loyalty = l.enabled ? l : null;
        if (l.customerName && !this.billCustomerName) this.billCustomerName = l.customerName;
        this.useLoyaltyPoints = false;
        this.redeemPoints = this.maxRedeemablePoints;
      },
      error: () => this.loyalty = null
    });
  }

  /** Points this bill can take: the balance, capped at the restaurant's share of the pre-tax amount. */
  get maxRedeemablePoints(): number {
    const l = this.loyalty;
    if (!l || l.pointsBalance < l.minRedeemPoints || l.pointValue <= 0 || !this.billSummary) return 0;
    const preTax = this.billSummary.grandSubTotal + (this.billSummary.grandPackaging ?? 0) - (this.billSummary.grandLoyaltyDiscount ?? 0);
    return Math.max(0, Math.min(l.pointsBalance, Math.floor(preTax * l.maxRedeemPercent / 100 / l.pointValue)));
  }

  /** ₹ coming off the bill (before tax) for the points chosen, until the bill is settled. */
  get pendingLoyaltyValue(): number {
    if (this.billFinalized || !this.useLoyaltyPoints || !this.loyalty) return 0;
    const points = Math.max(0, Math.min(this.redeemPoints || 0, this.maxRedeemablePoints));
    return Math.round(points * this.loyalty.pointValue * 100) / 100;
  }

  /** Loyalty discount to show: the server's after settling, else the pending one. */
  get billLoyaltyValue(): number {
    return this.billFinalized ? (this.billSummary?.grandLoyaltyDiscount ?? 0) : this.pendingLoyaltyValue;
  }

  private loadPaymentAccounts(): void {
    this.accountingService.paymentAccounts().subscribe({
      next: accounts => {
        this.paymentAccounts = accounts;
        if (!this.billPayAccount) this.billPayAccount = this.defaultPayAccount;
      },
      error: () => this.paymentAccounts = []
    });
  }

  private get defaultPayAccount(): string {
    return (this.paymentAccounts.find(a => a.kind === 'Cash') ?? this.paymentAccounts[0])?.key ?? '';
  }

  private resetPayment(): void {
    this.billPayAccount = this.defaultPayAccount;
    this.billPaySplit = false;
    this.billSplitAmounts = {};
    this.billPaidBy = [];
  }

  /** This bill's amount (previous udhaar is shown on the total but isn't paid through this bill). */
  get billOwnAmount(): number {
    return Math.max(0, this.getBillFinalTotal() - this.previousDueTotal);
  }

  get billSplitSum(): number {
    return this.paymentAccounts.reduce((sum, a) => sum + (Number(this.billSplitAmounts[a.key]) || 0), 0);
  }

  /** Full payment split: what's still to be assigned to an account (must reach 0). */
  get billSplitRemaining(): number {
    return this.billOwnAmount - this.billSplitSum;
  }

  toggleBillSplit(): void {
    this.billPaySplit = !this.billPaySplit;
    this.billSplitAmounts = {};
    if (this.billPaymentMode === 'partial') this.billPaidAmount = 0;
  }

  onBillSplitInput(): void {
    if (this.billPaymentMode === 'partial') this.billPaidAmount = this.billSplitSum;
  }

  /** Split doesn't add up: full payment must cover the bill exactly; udhaar can't pay more than the bill. */
  get billSplitInvalid(): boolean {
    if (!this.billPaySplit || !this.paymentAccounts.length) return false;
    return this.billPaymentMode === 'full'
      ? Math.abs(this.billSplitRemaining) >= 1
      : this.billSplitSum > this.billOwnAmount + 1;
  }

  /** Payments sent with the bill; empty = the backend treats the paid amount as cash. */
  private buildBillPayments(): PaymentSplit[] {
    if (!this.paymentAccounts.length) return [];
    const own = this.billOwnAmount;
    if (!this.billPaySplit) {
      const amount = this.billPaymentMode === 'full' ? own : Math.min(this.billPaidAmount || 0, own);
      return amount > 0 && this.billPayAccount ? [{ accountKey: this.billPayAccount, amount }] : [];
    }
    const splits = this.paymentAccounts
      .map(a => ({ accountKey: a.key, amount: Number(this.billSplitAmounts[a.key]) || 0 }))
      .filter(p => p.amount > 0);
    // Rupee amounts typed against a bill with paise: put the rounding difference on the largest share
    if (this.billPaymentMode === 'full' && splits.length) {
      const largest = splits.reduce((a, b) => (b.amount > a.amount ? b : a));
      largest.amount = Math.round((largest.amount + this.billSplitRemaining) * 100) / 100;
    }
    return splits;
  }

  /** "Cash ₹200, UPI ₹157" for the printed bill. */
  private get billPaidByText(): string {
    return this.billPaidBy
      .map(p => `${this.paymentAccounts.find(a => a.key === p.accountKey)?.label ?? p.accountKey} ₹${p.amount.toFixed(0)}`)
      .join(', ');
  }

  private resetLoyalty(): void {
    this.loyalty = null;
    this.loyaltyMobile = '';
    this.useLoyaltyPoints = false;
    this.redeemPoints = 0;
    this.billCustomerDob = '';
  }

  get billTitle(): string {
    if (!this.billSummary) return '';
    if (this.billKind === 'takeaway') {
      const token = this.billSummary.orders[0]?.tokenNumber;
      return token ? this.transloco.translate('waiter.takeawayN', { token }) : this.billSummary.tableNumber;
    }
    const party = this.billPartyDisplayLabel;
    return this.transloco.translate('waiter.tableN', { table: this.billSummary.tableNumber }) + (party ? ` · ${party}` : '');
  }

  /** The billed party's name in the staff member's language (billPartyLabel is the English one for print). */
  private get billPartyDisplayLabel(): string {
    if (!this.billPartyLabel) return '';
    return this.parties.find(p => p.printLabel === this.billPartyLabel)?.label ?? this.billPartyLabel;
  }

  /** Merge all order items into a flat list, combining duplicates */
  private computeMergedItems(session: TableSessionSummary): MergedBillItem[] {
    const map = new Map<string, MergedBillItem>();
    for (const order of session.orders) {
      for (const item of order.items) {
        const name = item.isParcel && order.type !== 'Takeaway' ? `${item.itemName} (parcel)` : item.itemName;
        const existing = map.get(name);
        if (existing) {
          existing.quantity += item.quantity;
          existing.totalPrice += item.totalPrice;
        } else {
          map.set(name, {
            itemName: name,
            menuItemId: item.menuItemId,
            baseName: item.itemName,
            isParcel: !!item.isParcel && order.type !== 'Takeaway',
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice
          });
        }
      }
    }
    return Array.from(map.values());
  }

  /** Step 2: Confirm — calls API to clear table, then prints/downloads bill */
  confirmClearTable(): void {
    if (!this.selectedTable && this.billKind !== 'takeaway') return;
    this.clearing = true;

    const finalTotal = this.getBillFinalTotal();
    const request: ClearTableRequest = {
      discountAmount: this.billDiscountAmount || 0,
      paidAmount: this.billPaymentMode === 'full' ? finalTotal : (this.billPaidAmount || 0),
      customerName: this.billCustomerName || undefined,
      customerMobile: this.billCustomerMobile || undefined,
      notes: this.billNotes || undefined,
      orderIds: this.billOrderIds ?? undefined,
      redeemPoints: this.pendingLoyaltyValue > 0 ? Math.min(this.redeemPoints, this.maxRedeemablePoints) : 0,
      customerDateOfBirth: this.billCustomerDob || undefined,
      payments: this.buildBillPayments()
    };
    this.billPaidBy = request.payments ?? [];

    const settle$ = this.billKind === 'takeaway'
      ? this.orderService.settleOrders(request)
      : this.orderService.clearTable(this.selectedTable!.id, request);

    settle$.subscribe({
      next: (summary) => {
        this.clearing = false;
        this.billSummary = summary;
        this.billFinalized = true;
        this.mergedBillItems = this.computeMergedItems(summary);
        if (this.billKind === 'takeaway') {
          this.successMessage = this.transloco.translate('waiter.toast.takeawayBilled', { name: summary.tableNumber, amount: summary.grandTotal });
          this.loadTakeaway();
        } else if (summary.activeOrderCount > 0) {
          // Other parties are still eating
          this.successMessage = this.transloco.translate('waiter.toast.partyBilled', { party: this.billPartyDisplayLabel || this.transloco.translate('waiter.party.generic'), amount: summary.grandTotal, table: this.selectedTable!.tableNumber });
          this.loadTableSession(this.selectedTable!.id);
        } else {
          this.tableSession = null;
          this.successMessage = this.transloco.translate('waiter.toast.tableBilled', { table: this.selectedTable!.tableNumber, amount: summary.grandTotal });
        }
        this.loadOrders();
        this.loadTables();
        setTimeout(() => this.successMessage = '', 5000);

        // Auto-print / download
        this.printBill();
      },
      error: (err) => {
        this.clearing = false;
        this.errorMessage = err.error?.message || this.transloco.translate('waiter.toast.clearFailed');
      }
    });
  }

  /** Cancel preview without clearing */
  /** Shared table: bill everyone, one party at a time, or all together. */
  startClearTable(): void {
    if (this.parties.length > 1) this.showSplitChoice = true;
    else this.previewBill();
  }

  billEachParty(): void {
    this.showSplitChoice = false;
    const [first, ...rest] = this.parties;
    // Keep each party's letter: the list re-letters once a party has paid
    this.billQueue = rest.map(p => ({ id: p.id, label: p.label, printLabel: p.printLabel }));
    this.previewBill(first);
  }

  billAllTogether(): void {
    this.showSplitChoice = false;
    this.billQueue = [];
    this.previewBill();
  }

  private nextQueuedParty(): TableParty | undefined {
    while (this.billQueue.length) {
      const next = this.billQueue.shift()!;
      const party = this.parties.find(p => p.id === next.id);
      if (party) return { ...party, label: next.label, printLabel: next.printLabel };
    }
    return undefined;
  }

  cancelBillPreview(): void {
    this.billQueue = [];
    this.billKind = 'table';
    this.billOrderIds = null;
    this.billPartyLabel = '';
    this.showBillSummary = false;
    this.billFinalized = false;
    this.showBillEdit = false;
    this.billRevised = false;
    this.billRefundAmount = 0;
    this.billSummary = null;
    this.mergedBillItems = [];
    this.billCustomerName = '';
    this.billCustomerMobile = '';
    this.billDiscountAmount = 0;
    this.billPaidAmount = 0;
    this.billPaymentMode = 'full';
    this.billNotes = '';
    this.previousDues = [];
    this.previousDueTotal = 0;
    this.resetLoyalty();
    this.resetPayment();
  }

  closeBillSummary(): void {
    this.showBillSummary = false;
    this.billFinalized = false;
    this.showBillEdit = false;
    this.billRevised = false;
    this.billRefundAmount = 0;
    this.billSummary = null;
    this.mergedBillItems = [];
    this.billCustomerName = '';
    this.billCustomerMobile = '';
    this.billDiscountAmount = 0;
    this.billPaidAmount = 0;
    this.billPaymentMode = 'full';
    this.billNotes = '';
    this.previousDues = [];
    this.previousDueTotal = 0;
    this.resetLoyalty();
    this.resetPayment();
    this.customerSuggestions = [];
    this.showCustomerSuggestions = false;
    const partiesLeft = this.billKind === 'party' && (this.tableSession?.activeOrderCount ?? 0) > 0;
    const nextParty = partiesLeft ? this.nextQueuedParty() : undefined;
    this.billKind = 'table';
    this.billOrderIds = null;
    this.billPartyLabel = '';
    if (nextParty) this.previewBill(nextParty);
    else if (!partiesLeft) this.deselectTable();
  }

  /**
   * Total to pay including previous udhaar. Before billing, grandTotal already has any Lucky Draw
   * discount taken off, so only the extra discount is subtracted. After billing, the server's
   * grandTotal is final (all discounts applied).
   */
  getBillFinalTotal(): number {
    if (!this.billSummary) return 0;
    // Points come off before tax, so the tax on them comes off too
    const taxRate = (this.cgstPercent + this.sgstPercent + this.serviceChargePercent) / 100;
    const billTotal = this.billFinalized
      ? this.billSummary.grandTotal
      : Math.max(0, this.billSummary.grandTotal - (this.billDiscountAmount || 0) - this.pendingLoyaltyValue * (1 + taxRate));
    return billTotal + this.previousDueTotal;
  }

  /** All discounts on the bill (Lucky Draw + extra), for display and print. */
  get billDiscountTotal(): number {
    if (!this.billSummary) return 0;
    return this.billFinalized
      ? this.billSummary.grandDiscount
      : this.billSummary.grandDiscount + (this.billDiscountAmount || 0);
  }

  get billNumber(): string {
    return this.billSummary?.orders.find(o => o.billNumber)?.billNumber ?? '';
  }

  /** After items were removed from the printed bill: show the new totals, and reprint if asked. */
  onBillEdited(result: BillEditResult): void {
    const bill = result.response.bill;
    this.showBillEdit = false;
    this.billRevised = true;
    this.billRefundAmount = result.response.refundAmount;
    this.billSummary = {
      ...this.billSummary!,
      tableNumber: bill.tableNumber,
      tableLabel: bill.tableLabel,
      grandSubTotal: bill.subTotal,
      grandTax: bill.tax,
      grandDiscount: bill.discountAmount,
      grandTotal: bill.totalAmount,
      paidAmount: bill.paidAmount,
      dueAmount: bill.dueAmount,
      orders: bill.orders
    };
    this.mergedBillItems = this.computeMergedItems(this.billSummary);
    if (this.billPaymentMode === 'partial') this.billPaidAmount = bill.paidAmount;
    this.successMessage = this.transloco.translate('waiter.toast.billUpdated', { from: result.response.previousTotal.toFixed(0), to: bill.totalAmount.toFixed(0) });
    setTimeout(() => this.successMessage = '', 5000);
    if (result.print) this.printBill();
  }

  /** Lookup previous dues when mobile is entered */
  lookupPreviousDues(): void {
    const mobile = this.billCustomerMobile?.trim();
    if (!mobile || mobile.length < 10) {
      this.previousDues = [];
      this.previousDueTotal = 0;
      return;
    }
    this.loadingDues = true;
    this.dueService.getDuesByMobile(mobile).subscribe({
      next: (result) => {
        this.previousDues = result.dues;
        this.previousDueTotal = result.totalDue;
        this.loadingDues = false;
      },
      error: () => {
        this.previousDues = [];
        this.previousDueTotal = 0;
        this.loadingDues = false;
      }
    });
  }

  /** Trigger customer autocomplete search */
  onCustomerInput(value: string): void {
    if (value && value.trim().length >= 2) {
      this.customerSearch$.next(value.trim());
    } else {
      this.customerSuggestions = [];
      this.showCustomerSuggestions = false;
    }
  }

  /** Select a customer suggestion */
  selectCustomer(customer: CustomerSearchResult): void {
    this.billCustomerName = customer.customerName;
    this.billCustomerMobile = customer.customerMobile;
    this.showCustomerSuggestions = false;
    this.customerSuggestions = [];
    this.lookupPreviousDues();
    this.checkLoyalty();
  }

  /** Hide customer suggestions */
  hideCustomerSuggestions(): void {
    // Delay to allow click on suggestion
    setTimeout(() => {
      this.showCustomerSuggestions = false;
    }, 200);
  }

  /** Get due amount for this bill */
  getBillDueAmount(): number {
    const finalTotal = this.getBillFinalTotal();
    if (this.billPaymentMode === 'full') return 0;
    return Math.max(0, finalTotal - (this.billPaidAmount || 0));
  }

  /** Amount the customer pays now: the whole bill, or the part paid today when the rest goes on udhaar. */
  private billAmountToPay(): number {
    return this.billPaymentMode === 'full' ? this.getBillFinalTotal() : (this.billPaidAmount || 0);
  }

  /**
   * Print the bill. With a UPI ID set, first fetches a QR for this bill's amount
   * (falls back to the uploaded static QR if that fails, e.g. offline).
   */
  printBill(): void {
    if (!this.billSummary) return;
    const amount = this.billAmountToPay();
    if (!this.upiId) {
      this.renderBill(this.upiQrCodeUrl, 0);
      return;
    }

    const note = `${this.restaurantName} T${this.billSummary.tableNumber}`;
    this.settingsService.getUpiQrBlob(amount, note).pipe(timeout(4000)).subscribe({
      next: (blob) => {
        // Data URL so the QR survives in the print window / iframe
        const reader = new FileReader();
        reader.onload = () => this.renderBill(reader.result as string, amount);
        reader.onerror = () => this.renderBill(this.upiQrCodeUrl, 0);
        reader.readAsDataURL(blob);
      },
      error: () => this.renderBill(this.upiQrCodeUrl, 0)
    });
  }

  /** Build the print-friendly bill and print it. upiAmount > 0 means the QR has that amount filled in. */
  private renderBill(upiQrSrc: string, upiAmount: number): void {
    if (!this.billSummary) return;

    const items = this.mergedBillItems;
    const s = this.billSummary;
    const now = new Date().toLocaleString();
    const pw = this.printerWidth;

    // Width config per printer type
    const widthMap: Record<string, { maxWidth: string; bodyPad: string; fontSize: string; titleSize: string; grandSize: string }> = {
      '2inch': { maxWidth: '220px', bodyPad: '4px', fontSize: '10px', titleSize: '14px', grandSize: '14px' },
      '3inch': { maxWidth: '300px', bodyPad: '8px', fontSize: '11px', titleSize: '16px', grandSize: '16px' },
      '4inch': { maxWidth: '420px', bodyPad: '12px', fontSize: '12px', titleSize: '18px', grandSize: '18px' },
      'standard': { maxWidth: '400px', bodyPad: '24px', fontSize: '13px', titleSize: '22px', grandSize: '20px' }
    };
    const cfg = widthMap[pw] || widthMap['standard'];
    const isThermal = pw !== 'standard';

    const itemRows = items.map(i =>
      `<tr><td>${i.itemName}</td><td style="text-align:center">${i.quantity}</td><td style="text-align:right">₹${i.unitPrice.toFixed(0)}</td><td style="text-align:right">₹${i.totalPrice.toFixed(0)}</td></tr>`
    ).join('');

    const upiSection = upiQrSrc ? `
      <div class="upi-section">
        <div class="upi-divider"></div>
        <p class="upi-label">${upiAmount > 0 ? 'Scan to Pay ₹' + upiAmount.toFixed(0) + ' via UPI' : 'Scan to Pay via UPI'}</p>
        <img src="${upiQrSrc}" alt="UPI QR" class="upi-qr" />
        ${upiAmount > 0 ? `<p class="upi-sub">Amount is filled in automatically</p>` : ''}
      </div>` : '';

    const html = `
      <html><head><title>Bill - ${s.tableNumber}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: ${isThermal ? "'Courier New', monospace" : "'Segoe UI', Arial, sans-serif"}; padding: ${cfg.bodyPad}; max-width: ${cfg.maxWidth}; margin: 0 auto; color: #222; font-size: ${cfg.fontSize}; }
        .header { text-align: center; margin-bottom: ${isThermal ? '8px' : '16px'}; padding-bottom: ${isThermal ? '6px' : '12px'}; border-bottom: 2px dashed #ccc; }
        .restaurant { font-size: ${cfg.titleSize}; font-weight: 800; color: #1a1a2e; }
        .brand { font-size: ${isThermal ? '8px' : '10px'}; color: #aaa; margin-top: 2px; letter-spacing: 1px; }
        .info { text-align: center; font-size: ${cfg.fontSize}; color: #666; margin-bottom: ${isThermal ? '6px' : '12px'}; }
        table { width: 100%; border-collapse: collapse; margin-bottom: ${isThermal ? '6px' : '12px'}; }
        th { text-align: left; font-size: ${isThermal ? '9px' : '11px'}; text-transform: uppercase; color: #888; border-bottom: 1px solid #ddd; padding: ${isThermal ? '3px 2px' : '6px 4px'}; }
        td { padding: ${isThermal ? '3px 2px' : '5px 4px'}; font-size: ${cfg.fontSize}; border-bottom: 1px solid #f0f0f0; }
        .totals { border-top: 2px dashed #ccc; padding-top: ${isThermal ? '6px' : '10px'}; margin-top: 4px; }
        .total-row { display: flex; justify-content: space-between; padding: ${isThermal ? '2px 0' : '3px 0'}; font-size: ${cfg.fontSize}; }
        .total-row.grand { font-size: ${cfg.grandSize}; font-weight: 800; color: #e94560; padding-top: ${isThermal ? '4px' : '8px'}; border-top: 2px solid #1a1a2e; margin-top: ${isThermal ? '4px' : '6px'}; }
        .upi-section { text-align: center; margin-top: ${isThermal ? '8px' : '16px'}; padding-top: ${isThermal ? '6px' : '12px'}; }
        .upi-divider { border-top: 1px dashed #ccc; margin-bottom: ${isThermal ? '6px' : '10px'}; }
        .upi-label { font-size: ${isThermal ? '9px' : '11px'}; font-weight: 700; color: #555; margin-bottom: ${isThermal ? '4px' : '8px'}; text-transform: uppercase; letter-spacing: 0.5px; }
        .upi-sub { font-size: ${isThermal ? '8px' : '10px'}; color: #888; margin-top: ${isThermal ? '2px' : '4px'}; }
        .upi-qr { width: ${isThermal ? '120px' : '160px'}; height: ${isThermal ? '120px' : '160px'}; object-fit: contain; }
        .footer { text-align: center; margin-top: ${isThermal ? '8px' : '20px'}; padding-top: ${isThermal ? '6px' : '12px'}; border-top: 1px dashed #ccc; font-size: ${isThermal ? '8px' : '12px'}; color: #999; }
        .footer .brand-name { font-weight: 700; background: linear-gradient(90deg, #e94560, #0f3460); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        @page { margin: 0; size: auto; }
        @media print { html, body { height: auto !important; min-height: 0 !important; padding: ${isThermal ? '2px' : '8px'}; margin: 0; } }
      </style></head><body>
        <div class="header">
          <div class="restaurant">${this.restaurantName}</div>
          <div class="brand">Powered by TabVerse</div>
        </div>
        <div class="info">
          ${this.billNumber ? 'Bill: <strong>' + this.billNumber + '</strong>' + (this.billRevised ? ' <strong>(Revised)</strong>' : '') + '<br/>' : ''}
          ${this.billKind === 'takeaway' ? 'Order' : 'Table'}: <strong>${s.tableNumber}</strong>${s.tableLabel ? ' — ' + s.tableLabel : ''}${this.billPartyLabel ? ' (' + this.billPartyLabel + ')' : ''}<br/>
          ${now}
          ${this.billCustomerName ? '<br/>Name: <strong>' + this.billCustomerName + '</strong>' : ''}
          ${this.billCustomerMobile ? '<br/>Mobile: <strong>' + this.billCustomerMobile + '</strong>' : ''}
        </div>
        <table>
          <thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Total</th></tr></thead>
          <tbody>${itemRows}</tbody>
        </table>
        <div class="totals">
          <div class="total-row"><span>Subtotal</span><span>₹${s.grandSubTotal.toFixed(0)}</span></div>
          ${s.grandPackaging ? `<div class="total-row"><span>Packing charges</span><span>₹${s.grandPackaging.toFixed(0)}</span></div>` : ''}
          ${this.billLoyaltyValue > 0 ? `<div class="total-row"><span>Loyalty points${s.loyalty?.pointsRedeemed ? ` (${s.loyalty.pointsRedeemed})` : ''}</span><span>- ₹${this.billLoyaltyValue.toFixed(0)}</span></div>` : ''}
          ${this.cgstPercent > 0 ? `<div class="total-row"><span>CGST (${this.cgstPercent}%)</span><span>₹${Math.round(this.billTaxable * this.cgstPercent / 100)}</span></div>` : ''}
          ${this.sgstPercent > 0 ? `<div class="total-row"><span>SGST (${this.sgstPercent}%)</span><span>₹${Math.round(this.billTaxable * this.sgstPercent / 100)}</span></div>` : ''}
          ${this.serviceChargePercent > 0 ? `<div class="total-row"><span>Service Charge (${this.serviceChargePercent}%)</span><span>₹${Math.round(this.billTaxable * this.serviceChargePercent / 100)}</span></div>` : ''}
          ${this.billDiscountTotal > 0 ? `<div class="total-row" style="color:#e94560"><span>Discount</span><span>- ₹${this.billDiscountTotal.toFixed(0)}</span></div>` : ''}
          ${this.previousDueTotal > 0 ? `<div class="total-row" style="color:#ff9800"><span>Previous Udhaar</span><span>+ ₹${this.previousDueTotal.toFixed(0)}</span></div>` : ''}
          <div class="total-row grand"><span>Grand Total</span><span>₹${this.getBillFinalTotal().toFixed(0)}</span></div>
          ${this.billPaymentMode === 'partial' && this.getBillDueAmount() > 0 ? `<div class="total-row" style="color:#e94560;font-weight:700;margin-top:4px"><span>Due (Udhaar)</span><span>₹${this.getBillDueAmount().toFixed(0)}</span></div>` : ''}
          ${this.billPaymentMode === 'partial' && this.billPaidAmount > 0 ? `<div class="total-row" style="color:#4caf50;font-weight:700"><span>Paid</span><span>₹${this.billPaidAmount.toFixed(0)}</span></div>` : ''}
          ${this.billPaidBy.length ? `<div class="total-row"><span>Paid by: ${this.billPaidByText}</span></div>` : ''}
        </div>
        ${s.loyalty ? `<div style="text-align:center;margin-top:8px;font-size:${cfg.fontSize}">Loyalty points earned: ${s.loyalty.pointsEarned + s.loyalty.bonusPoints} · Balance: ${s.loyalty.balance}</div>` : ''}
        ${upiSection}
        <div class="footer">
          Thank you for dining with us!<br/>
          Powered by <span class="brand-name">TabVerse</span>
        </div>
      </body></html>
    `;

    if (this.directPrint) {
      // Silent print via hidden iframe — works with Chrome --kiosk-printing
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.top = '-10000px';
      iframe.style.left = '-10000px';
      iframe.style.width = '0';
      iframe.style.height = '0';
      document.body.appendChild(iframe);
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) return;
      doc.open();
      doc.write(html);
      doc.close();
      iframe.onload = () => {
        iframe.contentWindow?.print();
        setTimeout(() => document.body.removeChild(iframe), 3000);
      };
    } else {
      const printWindow = window.open('', '_blank');
      if (!printWindow) return;
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  }

  // ── AR ──

  viewAR(item: MenuItem): void {
    window.open(item.arModelUrl, '_blank');
  }

  // ── Live Orders ──

  loadOrders(): void {
    this.ordersLoading = true;
    this.orderService.getLiveOrders().subscribe({
      next: (data) => { this.liveOrders = data; this.ordersLoading = false; },
      error: () => this.ordersLoading = false
    });
  }

  dismissCall(table: TableResponse, event: Event): void {
    event.stopPropagation();
    this.tableService.dismissCall(table.id).subscribe({
      next: () => {
        table.isCallingWaiter = false;
        this.successMessage = this.transloco.translate('waiter.toast.callDismissed', { table: table.tableNumber });
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: () => {
        this.errorMessage = this.transloco.translate('waiter.toast.dismissFailed');
      }
    });
  }

  private async setupRealTime(): Promise<void> {
    const tenantId = this.authService.getTenantId();
    if (tenantId) {
      await this.signalR.startConnection(tenantId);
      this.subs.push(
        this.signalR.newOrder$.subscribe(() => {
          this.loadOrders();
          this.loadTables();
          if (this.selectedTable) this.loadTableSession(this.selectedTable.id);
          this.playNotificationSound();
          this.successMessage = '🔔 ' + this.transloco.translate('waiter.toast.newOrder');
          setTimeout(() => this.successMessage = '', 5000);
        }),
        this.signalR.statusUpdate$.subscribe(() => {
          this.loadOrders();
          if (this.selectedTable) this.loadTableSession(this.selectedTable.id);
        }),
        this.signalR.waiterCalled$.subscribe(() => {
          this.loadTables();
          this.playNotificationSound();
          this.successMessage = '🔔 ' + this.transloco.translate('waiter.toast.customerCalling');
          setTimeout(() => this.successMessage = '', 5000);
        }),
        this.signalR.waiterCallDismissed$.subscribe(() => {
          this.loadTables();
        }),
        // Takeaway tab count and list
        merge(this.signalR.newOrder$, this.signalR.statusUpdate$).subscribe(() => this.loadTakeaway()),
        this.signalR.billRequested$.subscribe((data) => {
          this.loadTables();
          if (this.canSettleBill) {
            this.playNotificationSound();
            this.successMessage = '🧾 ' + this.transloco.translate('waiter.toast.tableReadyForBill', { table: data.tableNumber });
            setTimeout(() => this.successMessage = '', 6000);
          }
        }),
        // Catch up on anything missed while the connection was down
        this.signalR.reconnected$.subscribe(() => {
          this.loadOrders();
          this.loadTables();
          if (this.selectedTable) this.loadTableSession(this.selectedTable.id);
        }),
        this.signalR.waitlistUpdated$.subscribe(() => {
          this.loadTables();
        }),
        this.signalR.tablesChanged$.subscribe(() => {
          this.loadTables();
          if (this.selectedTable) this.loadTableSession(this.selectedTable.id);
        }),
        this.signalR.tableCleared$.subscribe((data) => {
          this.loadTables();
          this.loadOrders();
          // If this waiter is viewing the cleared table, reset the view
          if (this.selectedTable && this.selectedTable.id === data.tableId) {
            this.tableSession = null;
            this.cart = [];
            // The cashier who just settled keeps the final bill open (points earned, edit, print).
            // The event can arrive before our own settle request returns, hence `clearing` too.
            if (this.billFinalized || this.clearing) return;
            this.showBillSummary = false;
            this.billSummary = null;
            this.successMessage = this.transloco.translate('waiter.toast.tableCleared', { table: data.tableNumber });
            setTimeout(() => this.successMessage = '', 4000);
          }
        })
      );
    }
  }

  updateStatus(order: OrderResponse, newStatus: string): void {
    this.orderService.updateOrderStatus(order.id, newStatus).subscribe({
      next: () => this.loadOrders()
    });
  }

  private playNotificationSound(): void {
    try {
      const ctx = new AudioContext();
      const playTone = (freq: number, startTime: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.3, startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };
      const now = ctx.currentTime;
      playTone(880, now, 0.15);
      playTone(1100, now + 0.15, 0.15);
      playTone(1320, now + 0.3, 0.3);
    } catch {}
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'Pending': return '#f39c12';
      case 'Accepted': return '#3498db';
      case 'Preparing': return '#e67e22';
      case 'Ready': return '#27ae60';
      case 'Served': return '#2980b9';
      case 'Completed': return '#7f8c8d';
      default: return '#666';
    }
  }

  /** Where an order goes: "Table 4", "Room 101" or "Takeaway T-003". */
  orderPlace(order: OrderResponse): string {
    if (order.type === 'RoomService') return this.transloco.translate('waiter.roomN', { room: order.tableNumber });
    if (order.type === 'Takeaway') return this.transloco.translate('waiter.takeawayN', { token: order.tableNumber });
    return this.transloco.translate('waiter.tableN', { table: order.tableNumber });
  }

  /** Status as the guest sees it: room orders go "On the way" → "Delivered", takeaway ends "Picked up". */
  orderStatusKey(order: OrderResponse): string {
    if (order.type === 'RoomService' && order.deliveredAt) return 'Delivered';
    if (order.type === 'RoomService' && order.dispatchedAt) return 'OnTheWay';
    if (order.type === 'Takeaway' && order.status === 'Completed') return 'PickedUp';
    return order.status;
  }

  /** Kitchen steps apply to every order; after Ready, room and takeaway orders have their own handover. */
  nextKitchenStatus(order: OrderResponse): string | null {
    if (order.type !== 'DineIn' && order.status === 'Ready') return null;
    return this.getNextStatus(order.status);
  }

  /** Room service order collected from the kitchen: it's on its way to the room. */
  dispatchRoomOrder(order: OrderResponse): void {
    this.hotelService.dispatch(order.id).subscribe({
      next: () => this.loadOrders(),
      error: (err) => this.flashError(err.error?.message || this.transloco.translate('waiter.toast.updateFailed'))
    });
  }

  // ── Drag a table onto another ──

  onTablePointerDown(event: PointerEvent, table: TableResponse): void {
    // Only a table with running orders can be moved
    if (!table.isActive || !table.isOccupied || table.mergedIntoTableId || event.button > 0) return;
    const touch = event.pointerType !== 'mouse';
    this.press = { table, x: event.clientX, y: event.clientY, armed: !touch };
    // On touch, hold briefly first so normal scrolling still works
    if (touch) this.press.timer = setTimeout(() => {
      if (!this.press) return;
      this.press.armed = true;
      try { navigator.vibrate?.(25); } catch { /* not supported */ }
    }, 350);
  }

  @HostListener('document:pointermove', ['$event'])
  onPointerMove(event: PointerEvent): void {
    const press = this.press;
    if (!press) return;
    const moved = Math.hypot(event.clientX - press.x, event.clientY - press.y);
    if (!this.dragSource) {
      if (!press.armed) {
        if (moved > 10) this.cancelPress(); // finger is scrolling
        return;
      }
      if (moved < 8) return;
      this.dragSource = press.table;
    }
    this.dragGhost = { x: event.clientX, y: event.clientY };
    const el = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-table-id]');
    const id = el?.getAttribute('data-table-id') ?? null;
    this.dragOverId = id && id !== this.dragSource.id ? id : null;
  }

  @HostListener('document:pointerup')
  onPointerUp(): void {
    const source = this.dragSource;
    const target = this.dragOverId ? this.tables.find(t => t.id === this.dragOverId) : undefined;
    this.cancelPress();
    if (!source) return;
    this.suppressTableClick = true;
    setTimeout(() => this.suppressTableClick = false, 50);
    if (target) this.drop = { source, target };
  }

  @HostListener('document:pointercancel')
  onPointerCancel(): void {
    this.cancelPress();
  }

  /** While dragging on a phone, stop the page from scrolling under the finger. */
  private blockTouchScroll = (event: TouchEvent): void => {
    if (this.dragSource || this.press?.armed) event.preventDefault();
  };

  private cancelPress(): void {
    if (this.press?.timer) clearTimeout(this.press.timer);
    this.press = null;
    this.dragSource = null;
    this.dragOverId = null;
    this.dragGhost = null;
  }

  onTableCardClick(table: TableResponse): void {
    if (this.suppressTableClick || !table.isActive) return;
    this.selectTable(table);
  }

  /** What to do with the dropped table: seat both together, one bill, or a second party. */
  applyDrop(choice: 'mergeTables' | 'sameBill' | 'secondParty'): void {
    const drop = this.drop;
    if (!drop) return;
    const { source, target } = drop;
    this.tableActionSaving = true;
    const request$ = choice === 'mergeTables'
      ? this.tableService.mergeTables(target.id, [source.id])
      : this.tableService.moveOrders(source.id, target.id, choice === 'secondParty');
    request$.subscribe({
      next: (main) => {
        this.tableActionSaving = false;
        this.drop = null;
        const key = choice === 'mergeTables' ? 'waiter.toast.merged' : choice === 'sameBill' ? 'waiter.toast.movedSameBill' : 'waiter.toast.movedSecondParty';
        this.flashSuccess(this.transloco.translate(key, { tables: source.tableNumber, from: source.tableNumber, table: main.tableNumber }));
        this.loadTables();
      },
      error: (err) => {
        this.tableActionSaving = false;
        this.flashError(err.error?.message || this.transloco.translate('waiter.toast.moveFailed'));
      }
    });
  }

  getNextStatus(current: string): string | null {
    const idx = this.statusOptions.indexOf(current);
    return idx < this.statusOptions.length - 1 ? this.statusOptions[idx + 1] : null;
  }

  // ── Cancel Order Item ──

  promptCancelItem(itemId: string): void {
    this.confirmCancelItemId = itemId;
  }

  dismissCancel(): void {
    this.confirmCancelItemId = null;
  }

  cancelOrderItem(order: OrderResponse, item: OrderItemResponse): void {
    this.cancellingItemId = item.id;
    this.orderService.cancelOrderItem(order.id, item.id).subscribe({
      next: () => {
        this.cancellingItemId = null;
        this.confirmCancelItemId = null;
        this.successMessage = this.transloco.translate('waiter.toast.itemCancelled', { name: item.itemName, number: order.orderNumber });
        setTimeout(() => this.successMessage = '', 3000);
        this.loadOrders();
        if (this.selectedTable) this.loadTableSession(this.selectedTable.id);
      },
      error: (err) => {
        this.cancellingItemId = null;
        this.confirmCancelItemId = null;
        this.errorMessage = err.error?.message || this.transloco.translate('waiter.toast.cancelFailed');
        setTimeout(() => this.errorMessage = '', 4000);
      }
    });
  }

  // ── Nav ──

  onlyNumbers(event: KeyboardEvent): void {
    const char = event.key;
    if (!/[0-9]/.test(char) && char !== 'Backspace' && char !== 'Tab' && char !== 'ArrowLeft' && char !== 'ArrowRight' && char !== 'Delete') {
      event.preventDefault();
    }
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/admin/login']);
  }

  ngOnDestroy(): void {
    document.removeEventListener('touchmove', this.blockTouchScroll);
    this.cancelPress();
    this.subs.forEach(s => s.unsubscribe());
  }
}
