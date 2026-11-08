export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          actor_id: string | null
          customer_id: string | null
          entity_id: string | null
          entity_type: string
          id: number
          new_data: Json | null
          occurred_at: string
          old_data: Json | null
          summary: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          customer_id?: string | null
          entity_id?: string | null
          entity_type: string
          id?: never
          new_data?: Json | null
          occurred_at?: string
          old_data?: Json | null
          summary: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          customer_id?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: never
          new_data?: Json | null
          occurred_at?: string
          old_data?: Json | null
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_closings: {
        Row: {
          closed_by: string | null
          closing_date: string
          counted_cash: number | null
          created_at: string
          divergence: number
          expected_cash: number
          expected_other: number
          expected_pix: number
          expected_total: number
          expected_transfer: number
          id: string
          notes: string | null
        }
        Insert: {
          closed_by?: string | null
          closing_date: string
          counted_cash?: number | null
          created_at?: string
          divergence?: number
          expected_cash: number
          expected_other: number
          expected_pix: number
          expected_total: number
          expected_transfer: number
          id?: string
          notes?: string | null
        }
        Update: {
          closed_by?: string | null
          closing_date?: string
          counted_cash?: number | null
          created_at?: string
          divergence?: number
          expected_cash?: number
          expected_other?: number
          expected_pix?: number
          expected_total?: number
          expected_transfer?: number
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_closings_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_movements: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          description: string
          id: string
          kind: Database["public"]["Enums"]["cash_movement_kind"]
          method: Database["public"]["Enums"]["payment_method"]
          occurred_on: string
          payment_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          kind: Database["public"]["Enums"]["cash_movement_kind"]
          method: Database["public"]["Enums"]["payment_method"]
          occurred_on: string
          payment_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          kind?: Database["public"]["Enums"]["cash_movement_kind"]
          method?: Database["public"]["Enums"]["payment_method"]
          occurred_on?: string
          payment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "v_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      cities: {
        Row: {
          archived: boolean
          created_at: string
          created_by: string | null
          id: string
          last_visit_date: string | null
          latitude: number | null
          longitude: number | null
          name: string
          next_visit_date: string | null
          notes: string | null
          state: string
          updated_at: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          last_visit_date?: string | null
          latitude?: number | null
          longitude?: number | null
          name: string
          next_visit_date?: string | null
          notes?: string | null
          state?: string
          updated_at?: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          last_visit_date?: string | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          next_visit_date?: string | null
          notes?: string | null
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_notes: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          kind: Database["public"]["Enums"]["note_kind"]
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          kind?: Database["public"]["Enums"]["note_kind"]
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["note_kind"]
        }
        Relationships: [
          {
            foreignKeyName: "customer_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          archived_at: string | null
          city_id: string | null
          created_at: string
          created_by: string | null
          full_name: string
          id: string
          last_contact_at: string | null
          latitude: number | null
          longitude: number | null
          neighborhood: string | null
          notes: string | null
          phone: string | null
          reference: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          archived_at?: string | null
          city_id?: string | null
          created_at?: string
          created_by?: string | null
          full_name: string
          id?: string
          last_contact_at?: string | null
          latitude?: number | null
          longitude?: number | null
          neighborhood?: string | null
          notes?: string | null
          phone?: string | null
          reference?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          archived_at?: string | null
          city_id?: string | null
          created_at?: string
          created_by?: string | null
          full_name?: string
          id?: string
          last_contact_at?: string | null
          latitude?: number | null
          longitude?: number | null
          neighborhood?: string | null
          notes?: string | null
          phone?: string | null
          reference?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      installments: {
        Row: {
          amount: number
          cancelled: boolean
          collection_date: string
          created_at: string
          customer_id: string
          expected_channel: Database["public"]["Enums"]["payment_method"] | null
          id: string
          needs_visit: boolean
          notes: string | null
          number: number
          original_due_date: string
          paid_amount: number
          paid_at: string | null
          postponed_count: number
          sale_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          cancelled?: boolean
          collection_date: string
          created_at?: string
          customer_id: string
          expected_channel?:
            | Database["public"]["Enums"]["payment_method"]
            | null
          id?: string
          needs_visit?: boolean
          notes?: string | null
          number: number
          original_due_date: string
          paid_amount?: number
          paid_at?: string | null
          postponed_count?: number
          sale_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          cancelled?: boolean
          collection_date?: string
          created_at?: string
          customer_id?: string
          expected_channel?:
            | Database["public"]["Enums"]["payment_method"]
            | null
          id?: string
          needs_visit?: boolean
          notes?: string | null
          number?: number
          original_due_date?: string
          paid_amount?: number
          paid_at?: string | null
          postponed_count?: number
          sale_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "installments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "v_sales"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_reads: {
        Row: {
          notification_key: string
          read_at: string
          user_id: string
        }
        Insert: {
          notification_key: string
          read_at?: string
          user_id: string
        }
        Update: {
          notification_key?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_postponements: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          expected_channel: Database["public"]["Enums"]["payment_method"] | null
          id: string
          installment_id: string
          needs_visit: boolean
          new_date: string
          notes: string | null
          previous_date: string
          reason: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          expected_channel?:
            | Database["public"]["Enums"]["payment_method"]
            | null
          id?: string
          installment_id: string
          needs_visit?: boolean
          new_date: string
          notes?: string | null
          previous_date: string
          reason: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          expected_channel?:
            | Database["public"]["Enums"]["payment_method"]
            | null
          id?: string
          installment_id?: string
          needs_visit?: boolean
          new_date?: string
          notes?: string | null
          previous_date?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_postponements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_postponements_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_postponements_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_postponements_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_postponements_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "v_installments"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_promises: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          customer_id: string
          due_date: string
          expected_method: Database["public"]["Enums"]["payment_method"] | null
          id: string
          installment_id: string | null
          notes: string | null
          promised_on: string
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["promise_status"]
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          customer_id: string
          due_date: string
          expected_method?: Database["public"]["Enums"]["payment_method"] | null
          id?: string
          installment_id?: string | null
          notes?: string | null
          promised_on?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["promise_status"]
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          customer_id?: string
          due_date?: string
          expected_method?: Database["public"]["Enums"]["payment_method"] | null
          id?: string
          installment_id?: string | null
          notes?: string | null
          promised_on?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["promise_status"]
        }
        Relationships: [
          {
            foreignKeyName: "payment_promises_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_promises_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_promises_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_promises_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_promises_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "v_installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_promises_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_receipts: {
        Row: {
          created_at: string
          file_name: string
          id: string
          mime_type: string
          payment_id: string
          size_bytes: number
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          mime_type: string
          payment_id: string
          size_bytes: number
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string
          payment_id?: string
          size_bytes?: number
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_receipts_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_receipts_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "v_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_receipts_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          idempotency_key: string
          installment_id: string
          method: Database["public"]["Enums"]["payment_method"]
          notes: string | null
          paid_on: string
          rejected_at: string | null
          rejected_by: string | null
          reversed_at: string | null
          reversed_by: string | null
          sale_id: string
          status: Database["public"]["Enums"]["payment_status"]
          status_reason: string | null
        }
        Insert: {
          amount: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          idempotency_key: string
          installment_id: string
          method: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          paid_on?: string
          rejected_at?: string | null
          rejected_by?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          sale_id: string
          status?: Database["public"]["Enums"]["payment_status"]
          status_reason?: string | null
        }
        Update: {
          amount?: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          idempotency_key?: string
          installment_id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          paid_on?: string
          rejected_at?: string | null
          rejected_by?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          sale_id?: string
          status?: Database["public"]["Enums"]["payment_status"]
          status_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "v_installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_reversed_by_fkey"
            columns: ["reversed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "v_sales"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          price: number
          sku: string | null
          stock_quantity: number | null
          track_stock: boolean
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          price?: number
          sku?: string | null
          stock_quantity?: number | null
          track_stock?: boolean
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          price?: number
          sku?: string | null
          stock_quantity?: number | null
          track_stock?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          email: string | null
          full_name: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      promise_allocations: {
        Row: {
          amount: number
          created_at: string
          payment_id: string
          promise_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          payment_id: string
          promise_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          payment_id?: string
          promise_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promise_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promise_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "v_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promise_allocations_promise_id_fkey"
            columns: ["promise_id"]
            isOneToOne: false
            referencedRelation: "payment_promises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promise_allocations_promise_id_fkey"
            columns: ["promise_id"]
            isOneToOne: false
            referencedRelation: "v_promises"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          created_at: string
          description: string
          discount: number
          id: string
          product_id: string | null
          quantity: number
          sale_id: string
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          discount?: number
          id?: string
          product_id?: string | null
          quantity: number
          sale_id: string
          total: number
          unit_price: number
        }
        Update: {
          created_at?: string
          description?: string
          discount?: number
          id?: string
          product_id?: string | null
          quantity?: number
          sale_id?: string
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "v_sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          city_id: string | null
          code: number
          conditions: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          discount: number
          down_payment: number
          id: string
          idempotency_key: string | null
          installments_count: number
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          sale_date: string
          status: Database["public"]["Enums"]["sale_status"]
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          city_id?: string | null
          code?: never
          conditions?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          discount?: number
          down_payment?: number
          id?: string
          idempotency_key?: string | null
          installments_count?: number
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          sale_date?: string
          status?: Database["public"]["Enums"]["sale_status"]
          subtotal: number
          total: number
          updated_at?: string
        }
        Update: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          city_id?: string | null
          code?: never
          conditions?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          discount?: number
          down_payment?: number
          id?: string
          idempotency_key?: string | null
          installments_count?: number
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          sale_date?: string
          status?: Database["public"]["Enums"]["sale_status"]
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      visit_customers: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["visit_customer_status"]
          stop_order: number | null
          updated_at: string
          updated_by: string | null
          visit_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["visit_customer_status"]
          stop_order?: number | null
          updated_at?: string
          updated_by?: string | null
          visit_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["visit_customer_status"]
          stop_order?: number | null
          updated_at?: string
          updated_by?: string | null
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visit_customers_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_customers_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_customers_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_customers_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      visits: {
        Row: {
          city_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          route_order: number | null
          status: Database["public"]["Enums"]["visit_status"]
          updated_at: string
          visit_date: string
          visit_time: string | null
        }
        Insert: {
          city_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          route_order?: number | null
          status?: Database["public"]["Enums"]["visit_status"]
          updated_at?: string
          visit_date: string
          visit_time?: string | null
        }
        Update: {
          city_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          route_order?: number | null
          status?: Database["public"]["Enums"]["visit_status"]
          updated_at?: string
          visit_date?: string
          visit_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visits_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_activity: {
        Row: {
          action: string | null
          actor_id: string | null
          actor_name: string | null
          customer_id: string | null
          customer_name: string | null
          entity_id: string | null
          entity_type: string | null
          id: number | null
          new_data: Json | null
          occurred_at: string | null
          old_data: Json | null
          summary: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      v_cash_movements: {
        Row: {
          amount: number | null
          created_at: string | null
          created_by: string | null
          created_by_name: string | null
          customer_id: string | null
          customer_name: string | null
          description: string | null
          id: string | null
          kind: Database["public"]["Enums"]["cash_movement_kind"] | null
          method: Database["public"]["Enums"]["payment_method"] | null
          occurred_on: string | null
          payment_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "v_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      v_customers: {
        Row: {
          address: string | null
          archived_at: string | null
          balance: number | null
          city_id: string | null
          city_name: string | null
          city_state: string | null
          created_at: string | null
          created_by: string | null
          financial_status: string | null
          full_name: string | null
          id: string | null
          last_contact_at: string | null
          last_payment_at: string | null
          last_payment_date: string | null
          latitude: number | null
          longitude: number | null
          neighborhood: string | null
          next_collection_date: string | null
          notes: string | null
          open_installments: number | null
          overdue_amount: number | null
          phone: string | null
          reference: string | null
          sales_count: number | null
          total_paid: number | null
          total_purchased: number | null
          updated_at: string | null
          whatsapp: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v_installments: {
        Row: {
          amount: number | null
          city_id: string | null
          city_name: string | null
          collection_date: string | null
          customer_archived: boolean | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          customer_whatsapp: string | null
          days_overdue: number | null
          expected_channel: Database["public"]["Enums"]["payment_method"] | null
          id: string | null
          is_partial: boolean | null
          is_postponed: boolean | null
          needs_visit: boolean | null
          notes: string | null
          number: number | null
          original_due_date: string | null
          paid_amount: number | null
          paid_at: string | null
          pending_confirmation_amount: number | null
          postponed_count: number | null
          remaining: number | null
          sale_code: number | null
          sale_id: string | null
          status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "v_sales"
            referencedColumns: ["id"]
          },
        ]
      }
      v_payments: {
        Row: {
          amount: number | null
          city_id: string | null
          city_name: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          confirmed_by_name: string | null
          created_at: string | null
          created_by: string | null
          created_by_name: string | null
          customer_id: string | null
          customer_name: string | null
          id: string | null
          idempotency_key: string | null
          installment_id: string | null
          installment_number: number | null
          method: Database["public"]["Enums"]["payment_method"] | null
          notes: string | null
          paid_on: string | null
          receipts_count: number | null
          rejected_at: string | null
          rejected_by: string | null
          reversed_at: string | null
          reversed_by: string | null
          sale_code: number | null
          sale_id: string | null
          status: Database["public"]["Enums"]["payment_status"] | null
          status_reason: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "v_installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_reversed_by_fkey"
            columns: ["reversed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "v_sales"
            referencedColumns: ["id"]
          },
        ]
      }
      v_promises: {
        Row: {
          amount: number | null
          city_name: string | null
          created_at: string | null
          created_by: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          due_date: string | null
          effective_status: string | null
          expected_method: Database["public"]["Enums"]["payment_method"] | null
          id: string | null
          installment_id: string | null
          notes: string | null
          promised_on: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["promise_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_promises_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_promises_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_promises_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_promises_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_promises_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "v_installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_promises_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v_sales: {
        Row: {
          balance: number | null
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          city_id: string | null
          city_name: string | null
          code: number | null
          conditions: string | null
          created_at: string | null
          created_by: string | null
          customer_id: string | null
          customer_name: string | null
          discount: number | null
          down_payment: number | null
          id: string | null
          idempotency_key: string | null
          installments_count: number | null
          next_collection_date: string | null
          notes: string | null
          open_installments: number | null
          paid_total: number | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          sale_date: string | null
          status: Database["public"]["Enums"]["sale_status"] | null
          subtotal: number | null
          total: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_customers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _apply_payment_confirmation: {
        Args: { p_payment: string }
        Returns: undefined
      }
      _refresh_sale_status: { Args: { p_sale: string }; Returns: undefined }
      app_today: { Args: never; Returns: string }
      assert_active: { Args: never; Returns: undefined }
      assert_owner: { Args: never; Returns: undefined }
      cancel_sale: {
        Args: { p_reason: string; p_sale_id: string }
        Returns: undefined
      }
      cash_adjustment: {
        Args: {
          p_amount: number
          p_date: string
          p_justification: string
          p_method: Database["public"]["Enums"]["payment_method"]
        }
        Returns: string
      }
      cash_day_summary: { Args: { p_date: string }; Returns: Json }
      city_totals: {
        Args: { p_city_ids: string[] }
        Returns: {
          city_id: string
          customers_count: number
          overdue: number
          overdue_customers: number
          pending: number
        }[]
      }
      close_cash_day: {
        Args: { p_counted_cash: number; p_date: string; p_notes: string }
        Returns: string
      }
      collections_overview: {
        Args: { p_city?: string; p_q?: string }
        Returns: Json
      }
      confirm_payment: { Args: { p_payment_id: string }; Returns: undefined }
      create_promise: {
        Args: {
          p_amount: number
          p_customer_id: string
          p_due_date: string
          p_expected_method: Database["public"]["Enums"]["payment_method"]
          p_installment_id: string
          p_notes: string
        }
        Returns: string
      }
      create_sale: { Args: { p: Json }; Returns: string }
      current_role_name: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      customers_open_balance: {
        Args: {
          p_archived?: boolean
          p_city?: string
          p_q?: string
          p_status?: string
        }
        Returns: Json
      }
      customers_to_visit: {
        Args: { p_city_id: string }
        Returns: {
          address: string
          balance: number
          customer_id: string
          full_name: string
          has_broken_promise: boolean
          has_postponement: boolean
          needs_visit: boolean
          neighborhood: string
          next_collection_date: string
          overdue_amount: number
          phone: string
          reason: string
          reference: string
        }[]
      }
      dashboard_summary: { Args: never; Returns: Json }
      delinquency_aging: {
        Args: never
        Returns: {
          amount: number
          bucket: string
          customers_count: number
          installments_count: number
          sort_order: number
        }[]
      }
      fmt_brl: { Args: { v: number }; Returns: string }
      fmt_date: { Args: { d: string }; Returns: string }
      get_notifications: {
        Args: never
        Returns: {
          body: string
          customer_id: string
          is_read: boolean
          key: string
          kind: string
          link: string
          ref_date: string
          severity: string
          title: string
        }[]
      }
      global_search: {
        Args: { p_query: string }
        Returns: {
          id: string
          kind: string
          link: string
          subtitle: string
          title: string
        }[]
      }
      is_active_user: { Args: never; Returns: boolean }
      is_owner: { Args: never; Returns: boolean }
      jsonb_diff: {
        Args: { p_new: Json; p_old: Json }
        Returns: Record<string, unknown>
      }
      log_activity: {
        Args: {
          p_action: string
          p_customer_id: string
          p_entity_id: string
          p_entity_type: string
          p_new?: Json
          p_old?: Json
          p_summary: string
        }
        Returns: undefined
      }
      method_label: {
        Args: { m: Database["public"]["Enums"]["payment_method"] }
        Returns: string
      }
      monthly_series: {
        Args: { p_months?: number }
        Returns: {
          due: number
          month: string
          received: number
          sold: number
        }[]
      }
      postpone_installment: {
        Args: {
          p_expected_channel: Database["public"]["Enums"]["payment_method"]
          p_installment_id: string
          p_needs_visit: boolean
          p_new_date: string
          p_notes: string
          p_reason: string
        }
        Returns: string
      }
      refresh_all_city_visit_dates: { Args: never; Returns: undefined }
      refresh_city_visit_dates: { Args: { p_city: string }; Returns: undefined }
      register_payment: {
        Args: {
          p_amount: number
          p_confirm: boolean
          p_idempotency_key: string
          p_installment_id: string
          p_method: Database["public"]["Enums"]["payment_method"]
          p_notes: string
          p_paid_on: string
        }
        Returns: string
      }
      reject_payment: {
        Args: { p_payment_id: string; p_reason: string }
        Returns: undefined
      }
      reorder_visit_stops: {
        Args: { p_ids: string[]; p_visit: string }
        Returns: undefined
      }
      report_by_city: {
        Args: { p_from: string; p_to: string }
        Returns: {
          city_id: string
          city_name: string
          customers_count: number
          overdue_customers: number
          state: string
          total_overdue: number
          total_pending: number
          total_received: number
          total_sold: number
        }[]
      }
      report_summary: { Args: { p_from: string; p_to: string }; Returns: Json }
      resolve_promise: {
        Args: {
          p_notes: string
          p_promise_id: string
          p_status: Database["public"]["Enums"]["promise_status"]
        }
        Returns: undefined
      }
      reverse_payment: {
        Args: { p_payment_id: string; p_reason: string }
        Returns: undefined
      }
      sales_totals: {
        Args: {
          p_city?: string
          p_from?: string
          p_q?: string
          p_status?: string
          p_to?: string
        }
        Returns: Json
      }
      set_visit_customer_status: {
        Args: {
          p_notes: string
          p_status: Database["public"]["Enums"]["visit_customer_status"]
          p_visit_customer_id: string
        }
        Returns: undefined
      }
      visit_status_label: {
        Args: { s: Database["public"]["Enums"]["visit_customer_status"] }
        Returns: string
      }
    }
    Enums: {
      app_role: "owner" | "employee"
      cash_movement_kind: "payment" | "reversal" | "adjustment"
      note_kind: "note" | "contact" | "collection"
      payment_method: "pix" | "cash" | "transfer" | "other"
      payment_status:
        | "pending_confirmation"
        | "confirmed"
        | "rejected"
        | "reversed"
      promise_status: "pending" | "kept" | "broken" | "cancelled"
      sale_status: "open" | "paid" | "cancelled"
      visit_customer_status:
        | "to_visit"
        | "visited"
        | "not_found"
        | "payment_received"
        | "rescheduled"
      visit_status: "planned" | "done" | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["owner", "employee"],
      cash_movement_kind: ["payment", "reversal", "adjustment"],
      note_kind: ["note", "contact", "collection"],
      payment_method: ["pix", "cash", "transfer", "other"],
      payment_status: [
        "pending_confirmation",
        "confirmed",
        "rejected",
        "reversed",
      ],
      promise_status: ["pending", "kept", "broken", "cancelled"],
      sale_status: ["open", "paid", "cancelled"],
      visit_customer_status: [
        "to_visit",
        "visited",
        "not_found",
        "payment_received",
        "rescheduled",
      ],
      visit_status: ["planned", "done", "cancelled"],
    },
  },
} as const
