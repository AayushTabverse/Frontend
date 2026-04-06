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
}

export interface WaiterAssignmentResponse {
  waiterId: string;
  waiterName: string;
  assignedTableIds: string[];
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
  email: string;
  password: string;
  phone?: string;
  role: string;
  tenantId: string;
}

export interface StaffResponse {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string;
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
