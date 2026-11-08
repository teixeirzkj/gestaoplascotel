/**
 * Tipos de domínio derivados de src/types/supabase.ts (gerado do banco real:
 *   npx supabase gen types typescript --project-id <ref> --schema public > src/types/supabase.ts).
 * Views do Postgres geram todas as colunas como nullable; aqui marcamos como obrigatórias
 * as colunas que o banco sempre preenche.
 */
import type { Database } from "./supabase";

export type { Database };
type Tables = Database["public"]["Tables"];
type Views = Database["public"]["Views"];
type Enums = Database["public"]["Enums"];

type Strict<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: NonNullable<T[P]> };

export type AppRole = Enums["app_role"];
export type PaymentMethod = Enums["payment_method"];
export type SaleStatus = Enums["sale_status"];
export type PaymentStatus = Enums["payment_status"];
export type PromiseStatus = Enums["promise_status"];
export type VisitStatus = Enums["visit_status"];
export type VisitCustomerStatus = Enums["visit_customer_status"];
export type NoteKind = Enums["note_kind"];
export type CashMovementKind = Enums["cash_movement_kind"];

export type Profile = Tables["profiles"]["Row"];
export type City = Tables["cities"]["Row"];
export type Customer = Tables["customers"]["Row"];
export type Product = Tables["products"]["Row"];
export type Sale = Tables["sales"]["Row"];
export type SaleItem = Tables["sale_items"]["Row"];
export type Installment = Tables["installments"]["Row"];
export type Payment = Tables["payments"]["Row"];
export type PaymentReceipt = Tables["payment_receipts"]["Row"];
export type PaymentPostponement = Tables["payment_postponements"]["Row"];
export type PaymentPromise = Tables["payment_promises"]["Row"];
export type Visit = Tables["visits"]["Row"];
export type VisitCustomer = Tables["visit_customers"]["Row"];
export type CustomerNote = Tables["customer_notes"]["Row"];
export type CashMovement = Tables["cash_movements"]["Row"];
export type CashClosing = Tables["cash_closings"]["Row"];
export type ActivityLog = Tables["activity_logs"]["Row"];
export type AppSetting = Tables["app_settings"]["Row"];

/** Situação da parcela calculada no banco */
export type InstallmentStatus = "upcoming" | "due_today" | "overdue" | "postponed" | "paid" | "cancelled";
/** Situação financeira do cliente calculada no banco */
export type CustomerFinancialStatus = "up_to_date" | "pending" | "overdue" | "postponed" | "paid_off" | "no_sales";

export type InstallmentView = Strict<
  Views["v_installments"]["Row"],
  | "id" | "sale_id" | "sale_code" | "customer_id" | "customer_name" | "number" | "amount" | "paid_amount"
  | "remaining" | "pending_confirmation_amount" | "original_due_date" | "collection_date" | "needs_visit"
  | "postponed_count" | "is_postponed" | "days_overdue" | "is_partial" | "customer_archived"
> & { status: InstallmentStatus };

export type SaleView = Strict<
  Views["v_sales"]["Row"],
  | "id" | "code" | "customer_id" | "customer_name" | "sale_date" | "subtotal" | "discount" | "total"
  | "down_payment" | "installments_count" | "status" | "paid_total" | "balance" | "open_installments" | "created_at"
>;

export type CustomerView = Strict<
  Views["v_customers"]["Row"],
  | "id" | "full_name" | "created_at" | "total_purchased" | "sales_count" | "total_paid" | "balance"
  | "overdue_amount" | "open_installments"
> & { financial_status: CustomerFinancialStatus };

export type PromiseView = Strict<
  Views["v_promises"]["Row"],
  "id" | "customer_id" | "customer_name" | "promised_on" | "amount" | "due_date" | "status" | "effective_status" | "created_at"
>;

export type PaymentView = Strict<
  Views["v_payments"]["Row"],
  | "id" | "installment_id" | "sale_id" | "customer_id" | "customer_name" | "amount" | "paid_on" | "method"
  | "status" | "created_at" | "sale_code" | "installment_number" | "receipts_count"
>;

export type ActivityView = Strict<Views["v_activity"]["Row"], "id" | "occurred_at" | "action" | "entity_type" | "summary">;
export type CashMovementView = Strict<Views["v_cash_movements"]["Row"], "id" | "kind" | "amount" | "method" | "occurred_on" | "description" | "created_at">;

export type NotificationItem = Database["public"]["Functions"]["get_notifications"]["Returns"][number];
export type SearchResult = Database["public"]["Functions"]["global_search"]["Returns"][number];

export type DashboardSummary = {
  today: string;
  total_receivable: number;
  overdue_amount: number;
  overdue_count: number;
  overdue_customers: number;
  received_today: number;
  received_today_count: number;
  due_today_amount: number;
  due_today_count: number;
  active_customers: number;
  customers_with_balance: number;
  pending_confirmations: number;
  broken_promises: number;
  sold_month: number;
  received_month: number;
};

export type ReportSummary = {
  from: string;
  to: string;
  total_sold: number;
  sales_count: number;
  paid_sales_count: number;
  total_received: number;
  received_by_method: { pix: number; cash: number; transfer: number; other: number };
  total_pending: number;
  total_overdue: number;
  delinquent_customers: number;
};

export type CashDaySummary = {
  date: string;
  total: number;
  pix: number;
  cash: number;
  transfer: number;
  other: number;
  payments_count: number;
  payments_total: number;
  reversals_total: number;
  adjustments_total: number;
  by_user: { user_id: string | null; name: string | null; total: number; count: number }[];
  closing: CashClosing | null;
};
