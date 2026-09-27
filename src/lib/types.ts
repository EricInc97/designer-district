/**
 * Hand-written subset of the generated Supabase types. Regenerate the real
 * thing any time with:
 *   npx supabase gen types typescript --project-id <ref> > src/lib/database.types.ts
 */

export type UserRole = "customer" | "admin" | "master_admin";
export type TicketKind = "refund" | "return" | "complaint" | "order_issue" | "general";
export type TicketStatus = "open" | "pending_customer" | "resolved" | "closed";
export type TicketPriority = "low" | "normal" | "high" | "urgent";
export type OrderStatus =
  | "pending" | "paid" | "fulfilled" | "shipped" | "delivered" | "cancelled" | "refunded";

export type Brand = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

export type Category = { id: string; name: string; slug: string; created_at: string };

export type Product = {
  id: string;
  brand_id: string;
  category_id: string | null;
  sku: string;
  name: string;
  slug: string | null;
  description: string | null;
  price: number;
  compare_at_price: number | null;
  image_url: string | null;
  gallery: string[];
  sizes: string[];
  stock_count: number;
  is_published: boolean;
  is_featured: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type BrandMedia = {
  id: string;
  brand_id: string;
  /** hero = top of the brand page; lookbook = editorial band; board = a
 *  hoarding in the 3D district. */
  kind: "hero" | "lookbook" | "board";
  image_url: string;
  headline: string | null;
  subhead: string | null;
  cta_label: string | null;
  cta_href: string | null;
  /** Whether overlaid type should be light or dark on this photograph. */
  ink: "light" | "dark";
  sort_order: number;
  is_published: boolean;
  created_at: string;
};

export type ProductWithBrand = Product & {
  brands: Pick<Brand, "id" | "name" | "slug" | "logo_url"> | null;
};

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  role: UserRole;
  store_credit: number;
  created_at: string;
  updated_at: string;
  personalisation_consent: boolean | null;
  consent_updated_at: string | null;
};

export type AppScope = {
  key: string;
  label: string;
  description: string | null;
  category: string;
  sort_order: number;
};

export type Order = {
  id: string;
  order_number: string;
  user_id: string;
  status: OrderStatus;
  subtotal: number;
  credit_applied: number;
  total: number;
  shipping_address: Record<string, unknown> | null;
  placed_at: string;
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  brand_name: string | null;
  image_url: string | null;
  size: string | null;
  quantity: number;
  unit_price: number;
};

export type OrderWithItems = Order & { order_items: OrderItem[] };

export type Ticket = {
  id: string;
  ticket_number: string;
  user_id: string;
  order_id: string | null;
  order_item_id: string | null;
  kind: TicketKind;
  status: TicketStatus;
  priority: TicketPriority;
  subject: string;
  assigned_to: string | null;
  credit_issued: number;
  created_at: string;
  updated_at: string;
};

export type TicketMessage = {
  id: string;
  ticket_id: string;
  sender_id: string | null;
  is_staff: boolean;
  body: string;
  created_at: string;
};

export type CreditEntry = {
  id: string;
  user_id: string;
  ticket_id: string | null;
  order_id: string | null;
  amount: number;
  reason: string;
  note: string | null;
  created_at: string;
};

export type Recommendation = {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  slug: string | null;
  brand_name: string;
  brand_slug: string;
  score: number;
};

export type Analytics = {
  revenue: number;
  order_count: number;
  avg_order: number;
  new_customers: number;
  open_tickets: number;
  credit_issued: number;
  low_stock: number;
  top_products: { product_name: string; units: number; revenue: number }[];
  top_brands: { brand_name: string; revenue: number }[];
  top_searches: { term: string; n: number }[];
  revenue_series: { day: string; revenue: number }[];
};

export type BuyerProfileRow = {
  user_id: string;
  segment: string;
  segment_confidence: number | string;
  views_90d: number;
  searches_90d: number;
  orders_lifetime: number;
  distinct_brands: number;
  distinct_categories: number;
  top_brand_id: string | null;
  top_brand_share: number | string;
  top_category_id: string | null;
  top_category_share: number | string;
  avg_viewed_price: number | string;
  max_viewed_price: number | string;
  price_band: string;
  sale_affinity: number | string;
  primary_country: string | null;
  primary_region: string | null;
  primary_city: string | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  computed_at: string;
  profiles: { email: string | null; full_name: string | null } | null;
  brands: { name: string; slug: string } | null;
  categories: { name: string } | null;
};

/** Minimal shape so `createClient<Database>()` stays generic-friendly. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
