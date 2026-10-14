// ── API Response Wrapper ──
export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: string[];
}

// ── Auth ──
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterTenantRequest {
  restaurantName: string;
  address?: string;
  phone?: string;
  adminEmail: string;
  adminPassword: string;
  adminName: string;
}

export interface AuthResponse {
  token: string;
  userId: string;
  tenantId: string;
  email: string;
  fullName: string;
  role: string;
  expiresAt: string;
}

// ── Menu ──
export interface MenuCategory {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  sortOrder: number;
  isActive: boolean;
  items: MenuItem[];
}

// ── Excel import (menu, staff, inventory) ──
export type ImportAction = 'Create' | 'Update' | 'Unchanged' | 'Skip' | 'Error';

export interface ImportRow {
  rowNumber: number;
  action: ImportAction;
  errors: string[];
  changes: string[];
}

export interface ImportResult<T extends ImportRow> {
  rows: T[];
  createCount: number;
  updateCount: number;
  unchangedCount: number;
  skipCount: number;
  errorCount: number;
  applied: boolean;
}

export interface MenuImportRow extends ImportRow {
  category: string;
  name: string;
  price?: number;
  description?: string;
  isVeg: boolean;
  isAvailable: boolean;
  preparationTimeMinutes: number;
  imageUrl?: string;
}

export interface MenuImportResult extends ImportResult<MenuImportRow> {
  newCategories: string[];
}

export interface StaffImportRow extends ImportRow {
  fullName: string;
  role?: string;
  email?: string;
  phone?: string;
  jobTitle?: string;
  monthlySalary?: number;
  hasPassword: boolean;
}

export interface InventoryImportRow extends ImportRow {
  name: string;
  unit?: string;
  currentQuantity?: number;
  minimumQuantity?: number;
  costPerUnit?: number;
  category?: string;
  supplier?: string;
  supplierContact?: string;
  description?: string;
}

export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  isAvailable: boolean;
  isVeg: boolean;
  sortOrder: number;
  arModelUrl?: string;
  preparationTimeMinutes: number;
  categoryId: string;
  categoryName?: string;
  modifiers: MenuModifier[];
}

export interface MenuModifier {
  id: string;
  name: string;
  additionalPrice: number;
  isAvailable: boolean;
}

export interface FullMenuResponse {
  tenantId: string;
  restaurantName: string;
  logoUrl?: string;
  instagramUrl?: string;
  facebookUrl?: string;
  twitterUrl?: string;
  websiteUrl?: string;
  googleMapsUrl?: string;
  categories: MenuCategory[];
}

// ── Cart ──
export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  modifiers?: string;
  notes?: string;
}

// ── Order ──
export interface CreateOrderRequest {
  tableId: string;
  specialInstructions?: string;
  items: CreateOrderItemRequest[];
}

export interface CreateOrderItemRequest {
  menuItemId: string;
  quantity: number;
  modifiers?: string;
  notes?: string;
}

export interface OrderResponse {
  id: string;
  orderNumber: string;
  tableNumber: string;
  tableId: string;
  status: string;
  type: string;
  subTotal: number;
  tax: number;
  discountAmount: number;
  totalAmount: number;
  specialInstructions?: string;
  estimatedMinutes: number;
  createdAt: string;
  acceptedAt?: string;
  preparedAt?: string;
  servedAt?: string;
  completedAt?: string;
  items: OrderItemResponse[];
  payment?: PaymentSummary;
}

export interface OrderItemResponse {
  id: string;
  menuItemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  modifiers?: string;
  notes?: string;
}

export interface PaymentSummary {
  method: string;
  status: string;
  paidAt?: string;
}

export interface LiveOrdersResponse {
  totalPending: number;
  totalPreparing: number;
  totalReady: number;
  orders: OrderResponse[];
}

export interface TableSessionSummary {
  tableId: string;
  tableNumber: string;
  tableLabel?: string;
  activeOrderCount: number;
  grandSubTotal: number;
  grandTax: number;
  grandDiscount: number;
  grandTotal: number;
  paidAmount: number;
  dueAmount: number;
  orders: OrderResponse[];
}

// ── Bills ──
export interface BillResponse {
  billNumber: string;
  tableNumber: string;
  tableLabel?: string;
  orderCount: number;
  totalItems: number;
  subTotal: number;
  tax: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  customerName?: string;
  customerMobile?: string;
  completedAt: string;
  orders: OrderResponse[];
}

export interface PaginatedBillsResponse {
  bills: BillResponse[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  totalRevenue: number;
}

// ── Table ──
export interface TableResponse {
  id: string;
  tableNumber: string;
  label?: string;
  capacity: number;
  isActive: boolean;
  isOccupied: boolean;
  activeOrderCount: number;
  isCallingWaiter: boolean;
  waiterCalledAt?: string;
  qrCodeUrl?: string;
  qrData?: string;
  assignedWaiterIds?: string[];
  assignedWaiterNames?: string[];
  // Set while a waitlist party is seated here
  waitlistEntryId?: string;
  waitlistCustomerName?: string;
  waitlistCustomerMobile?: string;
  waitlistPartySize?: number;
  isPrimaryWaitlistTable?: boolean;
  mergedWithTableNumbers?: string[];
  /** Set when merged into another table (the main table holds the bill). */
  mergedIntoTableId?: string;
  mergedIntoTableNumber?: string;
  /** On a main table: tables merged into it. */
  mergedTableNumbers?: string[];
  /** Seats including merged tables. */
  combinedCapacity: number;
  /** Confirmed booking starting within the hour (or running late). */
  reservationId?: string;
  reservationCustomerName?: string;
  reservationPartySize?: number;
  reservationTime?: string;
}

export interface WaiterAssignmentResponse {
  waiterId: string;
  waiterName: string;
  assignedTableIds: string[];
}

// ── Waitlist ──
export type WaitlistStatus = 'Waiting' | 'Notified' | 'Seated' | 'Completed' | 'Cancelled' | 'NoShow';

export interface WaitlistTableInfo {
  tableId: string;
  tableNumber: string;
  capacity: number;
  isPrimary: boolean;
}

export interface WaitlistEntryResponse {
  id: string;
  tokenNumber: number;
  customerName: string;
  customerMobile?: string;
  partySize: number;
  notes?: string;
  quotedWaitMinutes?: number;
  status: WaitlistStatus;
  source: 'Staff' | 'SelfCheckIn' | 'Reservation';
  /** Estimated minutes until a table, for parties still waiting. */
  estimatedWaitMinutes?: number;
  createdAt: string;
  notifiedAt?: string;
  seatedAt?: string;
  closedAt?: string;
  tables: WaitlistTableInfo[];
}

export interface WaitlistEntryRequest {
  customerName: string;
  customerMobile?: string;
  partySize: number;
  notes?: string;
  quotedWaitMinutes?: number;
}

export interface WaitlistStatsResponse {
  waiting: number;
  peopleWaiting: number;
  seatedToday: number;
  cancelledToday: number;
  noShowToday: number;
  averageWaitMinutesToday?: number;
  estimatedWaitForNewParty: number;
}

export interface WaitlistSettings {
  selfCheckInEnabled: boolean;
  noShowMinutes: number;
}

export interface WaitlistAnalytics {
  from: string;
  to: string;
  totalParties: number;
  totalGuests: number;
  seated: number;
  cancelled: number;
  noShows: number;
  selfCheckIns: number;
  averageWaitMinutes?: number;
  medianWaitMinutes?: number;
  noShowRate: number;
  walkAwayRate: number;
  busiestHour?: number;
  byHour: { hour: number; parties: number; averageWaitMinutes?: number }[];
  byPartySize: { label: string; parties: number; seated: number; averageWaitMinutes?: number }[];
  byDay: { date: string; parties: number; seated: number; averageWaitMinutes?: number }[];
}

export interface PublicWaitlistInfo {
  restaurantName: string;
  logoUrl?: string;
  selfCheckInEnabled: boolean;
  partiesWaiting: number;
  estimatedWaitMinutes: number;
}

export interface PublicWaitlistStatus {
  id: string;
  tenantId: string;
  restaurantName: string;
  logoUrl?: string;
  tokenNumber: number;
  customerName: string;
  partySize: number;
  status: WaitlistStatus;
  position?: number;
  estimatedWaitMinutes?: number;
  createdAt: string;
  notifiedAt?: string;
  tableNumbers: string[];
}

// ── Reservations ──
export type ReservationStatus = 'Pending' | 'Confirmed' | 'Rejected' | 'Cancelled' | 'Seated' | 'Completed' | 'NoShow';

export interface ReservationResponse {
  id: string;
  customerName: string;
  customerMobile: string;
  customerEmail?: string;
  partySize: number;
  reservedFor: string;
  durationMinutes: number;
  notes?: string;
  status: ReservationStatus;
  source: 'Staff' | 'Website';
  responseMessage?: string;
  createdAt: string;
  respondedAt?: string;
  seatedAt?: string;
  closedAt?: string;
  tables: { tableId: string; tableNumber: string; capacity: number }[];
}

export interface ReservationRequest {
  customerName: string;
  customerMobile: string;
  customerEmail?: string;
  partySize: number;
  /** ISO 8601 (UTC). */
  reservedFor: string;
  durationMinutes: number;
  notes?: string;
  tableIds?: string[];
}

export interface ReservationSettings {
  onlineReservationsEnabled: boolean;
  graceMinutes: number;
}

export interface PublicReservationInfo {
  restaurantName: string;
  logoUrl?: string;
  onlineReservationsEnabled: boolean;
  phone?: string;
}

export interface PublicReservationStatus {
  id: string;
  tenantId: string;
  restaurantName: string;
  logoUrl?: string;
  restaurantPhone?: string;
  customerName: string;
  partySize: number;
  reservedFor: string;
  status: ReservationStatus;
  responseMessage?: string;
  canCancel: boolean;
}

// ── Analytics ──
export interface DashboardSummary {
  todaySales: number;
  todayOrderCount: number;
  liveOrderCount: number;
  avgOrderValue: number;
  totalUnsettledDues: number;
  unsettledDueCount: number;
  todayDiscountGiven: number;
  topItems: TopItem[];
}

export interface TopItem {
  menuItemId: string;
  itemName: string;
  totalQuantity: number;
  totalRevenue: number;
}

export interface SalesData {
  date: string;
  orderCount: number;
  totalSales: number;
}

export interface PeakHour {
  hour: number;
  orderCount: number;
  totalSales: number;
}

// ── Business Settings ──
export interface BusinessSettings {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
  instagramUrl?: string;
  facebookUrl?: string;
  twitterUrl?: string;
  websiteUrl?: string;
  googleMapsUrl?: string;
  currencyCode?: string;
  upiQrCodeUrl?: string;
  /** UPI ID (VPA). When set, bills print a QR with the bill amount filled in. */
  upiId?: string;
  upiPayeeName?: string;
  printerWidth?: string;
  directPrint?: boolean;
  cgstPercent?: number;
  sgstPercent?: number;
  serviceChargePercent?: number;
  maxDiscountPercent?: number;
  spinWheelEnabled?: boolean;
}

// ── Website Content ──
export interface GalleryImage {
  url: string;
  caption?: string;
}

export interface Testimonial {
  name: string;
  text?: string;
  rating: number;
  avatarUrl?: string;
}

export interface OperatingHour {
  day: string;
  openTime?: string;
  closeTime?: string;
  isClosed: boolean;
}

export interface Specialty {
  title?: string;
  description?: string;
  icon?: string;
}

export interface MenuCategoryWeb {
  id: string;
  name: string;
  imageUrl?: string;
  items: MenuItemWeb[];
}

export interface MenuItemWeb {
  id: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  isVeg: boolean;
  isAvailable: boolean;
}

export interface WebsiteContent {
  restaurantName: string;
  logoUrl?: string;
  phone?: string;
  email?: string;
  address?: string;
  instagramUrl?: string;
  facebookUrl?: string;
  twitterUrl?: string;
  websiteUrl?: string;
  googleMapsUrl?: string;
  currencyCode?: string;

  heroTitle?: string;
  heroSubtitle?: string;
  heroImageUrl?: string;
  heroCtaText?: string;
  heroCtaLink?: string;

  aboutTitle?: string;
  aboutDescription?: string;
  aboutImageUrl?: string;
  chefName?: string;
  chefImageUrl?: string;
  chefQuote?: string;

  specialties: Specialty[];
  galleryImages: GalleryImage[];
  testimonials: Testimonial[];
  operatingHours: OperatingHour[];

  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  fontFamily?: string;

  metaTitle?: string;
  metaDescription?: string;
  announcementText?: string;
  showAnnouncement: boolean;
  isPublished: boolean;

  menuHighlights?: MenuCategoryWeb[];
}

export interface UpdateWebsiteContent {
  heroTitle?: string;
  heroSubtitle?: string;
  heroImageUrl?: string;
  heroCtaText?: string;
  heroCtaLink?: string;
  aboutTitle?: string;
  aboutDescription?: string;
  aboutImageUrl?: string;
  chefName?: string;
  chefImageUrl?: string;
  chefQuote?: string;
  specialties?: Specialty[];
  galleryImages?: GalleryImage[];
  testimonials?: Testimonial[];
  operatingHours?: OperatingHour[];
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  fontFamily?: string;
  metaTitle?: string;
  metaDescription?: string;
  announcementText?: string;
  showAnnouncement?: boolean;
  isPublished?: boolean;
}

// ── Forgot Password ──
export interface ForgotPasswordResponse {
  message: string;
  tempPassword?: string;
}

// ── Staff Management ──
export interface RegisterUserRequest {
  fullName: string;
  email?: string;      // not needed for payroll-only staff (role 'Helper')
  password?: string;   // not needed for payroll-only staff (role 'Helper')
  phone?: string;
  jobTitle?: string;
  role: string;
  tenantId: string;
}

export interface StaffResponse {
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
  role: string;
  jobTitle?: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

// ── Staff Attendance & Payroll ──
export type AttendanceStatus = 'Present' | 'Absent' | 'HalfDay' | 'Leave';

export interface DailyAttendance {
  userId: string;
  fullName: string;
  role: string;
  jobTitle?: string;
  status?: AttendanceStatus;
  notes?: string;
  markedBy?: string;
}

export interface MonthlySalary {
  userId: string;
  fullName: string;
  role: string;
  jobTitle?: string;
  isActive: boolean;
  monthlySalary: number;
  daysInMonth: number;
  presentDays: number;
  absentDays: number;
  halfDays: number;
  leaveDays: number;
  unmarkedDays: number;
  deduction: number;
  earned: number;
  advancePaid: number;
  salaryPaid: number;
  bonusPaid: number;
  balance: number;
}

export type StaffPaymentType = 'Salary' | 'Advance' | 'Bonus';
export type StaffPaymentMode = 'Cash' | 'Upi' | 'BankTransfer';

export interface StaffPayment {
  id: string;
  userId: string;
  fullName: string;
  year: number;
  month: number;
  type: StaffPaymentType;
  amount: number;
  mode: StaffPaymentMode;
  paidOn: string;
  notes?: string;
  recordedBy?: string;
  createdAt: string;
}

export interface CreateStaffPaymentRequest {
  userId: string;
  year: number;
  month: number;
  type: StaffPaymentType;
  amount: number;
  mode: StaffPaymentMode;
  paidOn?: string;
  notes?: string;
}

// ── Subdomain Management ──
export interface SubdomainSuggestion {
  subdomain: string;
  fullDomain: string;
  isAvailable: boolean;
}

export interface SubdomainSuggestionsResponse {
  suggestions: SubdomainSuggestion[];
}

export interface CheckSubdomainResponse {
  subdomain: string;
  fullDomain: string;
  isAvailable: boolean;
  message: string;
}

export interface SubdomainResponse {
  subdomain?: string;
  fullDomain?: string;
  isActive: boolean;
  dnsStatus?: string;
  message?: string;
}

export type WebsiteState =
  'not_started' | 'published_no_domain' | 'unpublished' | 'dns_not_configured' |
  'dns_failed' | 'connecting' | 'unreachable' | 'live';

export interface WebsiteStatusStep {
  key: 'address' | 'dns' | 'reachable' | 'published';
  label: string;
  status: 'done' | 'pending' | 'failed' | 'todo';
  detail?: string;
}

/** Honest website status from the server: stored DNS outcome + live checks. */
export interface WebsiteStatus {
  state: WebsiteState;
  title: string;
  message: string;
  subdomain?: string;
  url?: string;
  previewPath: string;
  isPublished: boolean;
  steps: WebsiteStatusStep[];
  canRetryDns: boolean;
  shouldRecheck: boolean;
  checkedAt: string;
}

/** A DNS record the owner adds at their registrar, with its live check. */
export interface DnsRecordInstruction {
  purpose: 'ownership' | 'pointing' | 'hosting';
  type: 'TXT' | 'CNAME' | 'A';
  host: string;
  fullName: string;
  value: string;
  status: 'ok' | 'missing' | 'wrong';
  found?: string;
  description: string;
}

export interface CustomDomainStatus {
  state: 'none' | 'dns_pending' | 'activating' | 'unpublished' | 'live';
  title: string;
  message: string;
  domain?: string;
  url?: string;
  isApex: boolean;
  rootDomain?: string;
  records: DnsRecordInstruction[];
  steps: WebsiteStatusStep[];
  shouldRecheck: boolean;
  checkedAt: string;
}

export interface ClaimSubdomainRequest {
  subdomain: string;
}

// ── Clear Table / Discount / Dues ──
export interface ClearTableRequest {
  discountAmount: number;
  paidAmount: number;
  customerName?: string;
  customerMobile?: string;
  notes?: string;
}

export interface CreatePastBillRequest {
  billDate: string;
  tableId: string;
  items: PastBillItem[];
  discountAmount: number;
  paidAmount: number;
  customerName?: string;
  customerMobile?: string;
  notes?: string;
}

export interface PastBillItem {
  menuItemId: string;
  quantity: number;
}

export interface CustomerDue {
  id: string;
  customerName: string;
  customerMobile?: string;
  billNumber?: string;
  billAmount: number;
  paidAmount: number;
  dueAmount: number;
  isSettled: boolean;
  settledAt?: string;
  notes?: string;
  createdAt: string;
}

export interface CustomerDueSearchResult {
  dues: CustomerDue[];
  totalDue: number;
}

// ── AI Marketing ──
export interface GeneratePostRequest {
  contentType: string; // social, festival, menu-highlight, testimonial, weekly-special
  platform: string; // instagram, facebook, both
  customPrompt?: string;
}

export interface GeneratedPost {
  id: string;
  contentText: string;
  hashtags: string[];
  imageUrl?: string;
  suggestedCaption: string;
  platform: string;
  contentType: string;
  status: string;
  createdAt: string;
}

export interface MarketingPost {
  id: string;
  platform: string;
  contentType: string;
  contentText: string;
  hashtags: string[];
  imageUrl?: string;
  suggestedCaption?: string;
  status: string;
  scheduledAt?: string;
  postedAt?: string;
  createdAt: string;
  failureReason?: string;
}

export interface PaginatedPostsResponse {
  posts: MarketingPost[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ContentCalendarItem {
  date: string;
  posts: MarketingPost[];
}

export interface SocialConnection {
  platform: string;
  isConnected: boolean;
  pageName?: string;
  pageId?: string;
  expiresAt?: string;
}

export interface ApprovePostRequest {
  editedText?: string;
  editedCaption?: string;
  scheduledAt?: string;
}

// ── Google Reviews ──
export interface GoogleReview {
  id: string;
  googleReviewId: string;
  authorName: string;
  rating: number;
  reviewText?: string;
  reviewCreateTime: string;
  replyText?: string;
  repliedAt?: string;
  sentiment?: string;
  sentimentThemes: string[];
  authorProfileUrl?: string;
}

export interface PaginatedReviewsResponse {
  reviews: GoogleReview[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ReviewAnalytics {
  avgRating: number;
  totalReviews: number;
  sentiment: SentimentBreakdown;
  ratingDistribution: { [key: number]: number };
  commonThemes: string[];
  trend: ReviewTrend[];
}

export interface SentimentBreakdown {
  positive: number;
  neutral: number;
  negative: number;
}

export interface ReviewTrend {
  period: string;
  avgRating: number;
  reviewCount: number;
}

// ── Inventory ──
export interface InventoryItem {
  id: string;
  name: string;
  description?: string;
  category?: string;
  currentQuantity: number;
  unit: string;
  minimumQuantity: number;
  costPerUnit: number;
  supplier?: string;
  supplierContact?: string;
  lastRestockedAt?: string;
  isActive: boolean;
  isLowStock: boolean;
  totalValue: number;
  createdAt: string;
}

export interface InventoryLog {
  id: string;
  inventoryItemId: string;
  itemName: string;
  quantityChange: number;
  quantityAfter: number;
  changeType: string;
  notes?: string;
  changedBy?: string;
  createdAt: string;
}

export interface MenuItemIngredient {
  id: string;
  inventoryItemId: string;
  inventoryItemName: string;
  unit: string;
  quantityUsed: number;
  currentStock: number;
}

export interface InventorySummary {
  totalItems: number;
  lowStockItems: number;
  outOfStockItems: number;
  totalInventoryValue: number;
  lowStockAlerts: InventoryItem[];
  categoryBreakdown: CategorySummary[];
}

export interface CategorySummary {
  category: string;
  itemCount: number;
  totalValue: number;
}

// ── Subscription ──
export interface SubscriptionStatusResponse {
  isTrialActive: boolean;
  isSubscriptionActive: boolean;
  requiresSubscription: boolean;
  trialDaysRemaining: number;
  plan?: string;
  cycle?: string;
  status?: string;
  expiresAt?: string;
  availableFeatures: string[];
}

export interface SubscriptionPlanDto {
  plan: string;
  cycle: string;
  price: number;
  displayName: string;
  features: string[];
}

export interface CreateRazorpaySubscriptionRequest {
  plan: string;
  cycle: string;
}

export interface CreateRazorpaySubscriptionResponse {
  subscriptionId: string;
  razorpayKeyId: string;
}

export interface VerifyPaymentRequest {
  razorpaySubscriptionId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export interface CancelSubscriptionRequest {
  cancelAtCycleEnd: boolean;
}

export interface UpdateSubscriptionRequest {
  plan: string;
  cycle: string;
  scheduleAtCycleEnd: boolean;
}

export interface UpdateSubscriptionResponse {
  requiresCheckout: boolean;
  subscriptionId?: string;
  razorpayKeyId?: string;
  status?: SubscriptionStatusResponse;
}

// ── Analytics overview & today dashboard ──
export interface Metric { value: number; previous: number; changePct?: number | null; }

export interface DailyPoint { date: string; revenue: number; orders: number; prevDate?: string; prevRevenue?: number; prevOrders?: number; }
export interface HeatCell { weekday: number; hour: number; orders: number; revenue: number; }
export interface HourPoint { hour: number; orders: number; revenue: number; }
export interface CategoryShare { name: string; revenue: number; quantity: number; sharePct: number; }
export interface ItemPerformance {
  menuItemId: string; name: string; category?: string; quantity: number; revenue: number;
  sharePct: number; prevQuantity: number; changePct?: number | null;
}
export interface KitchenPerformance { medianPrepMinutes: Metric; medianServeMinutes: Metric; onTimePct: Metric; measured: number; }
export interface OrderSources { qrOrders: number; qrRevenue: number; staffOrders: number; staffRevenue: number; }
export interface TablePerformance { table: string; orders: number; revenue: number; avgOrderValue: number; }
export interface DueBucket { label: string; count: number; amount: number; }
export interface Insight { icon: string; text: string; tone: 'good' | 'bad' | 'neutral'; }

export interface AnalyticsOverview {
  from: string; to: string; previousFrom: string; previousTo: string; days: number;
  revenue: Metric; orders: Metric; avgOrderValue: Metric; itemsPerOrder: Metric;
  discounts: Metric; discountRate: Metric; cancelledOrders: Metric; cancelRate: Metric; tax: Metric;
  daily: DailyPoint[]; heatmap: HeatCell[]; hourly: HourPoint[];
  categories: CategoryShare[]; topItems: ItemPerformance[]; rising: ItemPerformance[]; falling: ItemPerformance[];
  notSelling: string[]; notSellingCount: number;
  kitchen: KitchenPerformance; sources: OrderSources; tables: TablePerformance[]; duesAging: DueBucket[];
  insights: Insight[];
}

export interface CumulativePoint { hour: number; today?: number | null; lastWeek: number; }
export interface LiveStatus { pending: number; preparing: number; ready: number; served: number; occupiedTables: number; totalTables: number; oldestWaitMinutes: number; }
export interface RecentOrderRow { id: string; orderNumber: string; table: string; status: string; total: number; items: number; createdAt: string; }

export interface TodayDashboard {
  now: string; date: string; compareDate: string;
  revenue: Metric; orders: Metric; avgOrderValue: Metric; discounts: Metric;
  cumulative: CumulativePoint[]; last7Days: DailyPoint[]; last7Total: number;
  live: LiveStatus; topItems: ItemPerformance[]; recentOrders: RecentOrderRow[];
  lowStockCount: number; outOfStockCount: number; unsettledDues: number; unsettledDueCount: number; oldestDueDays: number;
  insights: Insight[];
}

// ── Inventory analytics ──
export interface InventoryDailyPoint { date: string; usedValue: number; wastedValue: number; restockedValue: number; }
export interface StockRunway { id: string; name: string; unit: string; currentQuantity: number; avgDailyUse: number; daysLeft: number; suggestedOrder: number; supplier?: string; }
export interface InventoryItemMovement { id: string; name: string; category?: string; unit: string; quantity: number; value: number; sharePct: number; }
export interface InventoryAnalytics {
  days: number; from: string; to: string;
  totalItems: number; inStock: number; lowStock: number; outOfStock: number; stockValue: number;
  itemsWithoutCost: number; itemsWithoutMinimum: number;
  usedValue: Metric; wastedValue: Metric; restockedValue: Metric; wasteRate: Metric; autoDeductions: number;
  daily: InventoryDailyPoint[]; runningOut: StockRunway[];
  topUsed: InventoryItemMovement[]; topWasted: InventoryItemMovement[]; topValue: InventoryItemMovement[];
  deadStock: InventoryItemMovement[]; deadStockValue: number;
  valueByCategory: { category: string; itemCount: number; totalValue: number }[];
  insights: Insight[];
}
