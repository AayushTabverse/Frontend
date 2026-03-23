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
  grandTotal: number;
  orders: OrderResponse[];
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
}

// ── Analytics ──
export interface DashboardSummary {
  todaySales: number;
  todayOrderCount: number;
  liveOrderCount: number;
  avgOrderValue: number;
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
