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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      add_on_services: {
        Row: {
          add_on_id: string
          created_at: string
          id: string
          service_id: string
        }
        Insert: {
          add_on_id: string
          created_at?: string
          id?: string
          service_id: string
        }
        Update: {
          add_on_id?: string
          created_at?: string
          id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "add_on_services_add_on_id_fkey"
            columns: ["add_on_id"]
            isOneToOne: false
            referencedRelation: "add_ons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "add_on_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      add_ons: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          name: string
          price: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          price?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          price?: number
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: string | null
          id: string
          ip_address: string | null
          staff_id: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: string | null
          id?: string
          ip_address?: string | null
          staff_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: string | null
          id?: string
          ip_address?: string | null
          staff_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rules: {
        Row: {
          created_at: string
          created_by: string
          email_html: string
          email_subject: string
          id: string
          is_active: boolean
          name: string
          trigger_config: Json
          trigger_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          email_html: string
          email_subject: string
          id?: string
          is_active?: boolean
          name: string
          trigger_config?: Json
          trigger_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          email_html?: string
          email_subject?: string
          id?: string
          is_active?: boolean
          name?: string
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      automation_sends: {
        Row: {
          customer_email: string
          id: string
          rule_id: string
          sent_at: string
        }
        Insert: {
          customer_email: string
          id?: string
          rule_id: string
          sent_at?: string
        }
        Update: {
          customer_email?: string
          id?: string
          rule_id?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_sends_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_addons: {
        Row: {
          added_at: string | null
          added_by_staff: boolean | null
          addon_id: string
          booking_id: string
          id: string
        }
        Insert: {
          added_at?: string | null
          added_by_staff?: boolean | null
          addon_id: string
          booking_id: string
          id?: string
        }
        Update: {
          added_at?: string | null
          added_by_staff?: boolean | null
          addon_id?: string
          booking_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_addons_addon_id_fkey"
            columns: ["addon_id"]
            isOneToOne: false
            referencedRelation: "add_ons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_addons_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_audit_log: {
        Row: {
          booking_id: string
          event_type: string
          id: string
          new_date: string | null
          new_time: string | null
          note: string | null
          old_date: string | null
          old_time: string | null
          performed_at: string | null
          performed_by: string | null
        }
        Insert: {
          booking_id: string
          event_type: string
          id?: string
          new_date?: string | null
          new_time?: string | null
          note?: string | null
          old_date?: string | null
          old_time?: string | null
          performed_at?: string | null
          performed_by?: string | null
        }
        Update: {
          booking_id?: string
          event_type?: string
          id?: string
          new_date?: string | null
          new_time?: string | null
          note?: string | null
          old_date?: string | null
          old_time?: string | null
          performed_at?: string | null
          performed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_audit_log_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_emails: {
        Row: {
          booking_id: string
          email_type: string
          id: string
          resend_id: string | null
          sent_at: string
        }
        Insert: {
          booking_id: string
          email_type: string
          id?: string
          resend_id?: string | null
          sent_at?: string
        }
        Update: {
          booking_id?: string
          email_type?: string
          id?: string
          resend_id?: string | null
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_emails_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          booking_date: string
          booking_source: string | null
          booking_time: string
          breed_id: string | null
          campaign_id: string | null
          created_at: string
          created_by_staff: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          deposit_paid: number
          dog_name: string
          duration_minutes: number | null
          final_charge: number | null
          id: string
          is_groomers_own_customer: boolean
          notes: string | null
          referral_source: string | null
          service_id: string | null
          sms_24h_sent: boolean
          sms_2h_sent: boolean
          staff_id: string | null
          status: string
          stripe_payment_id: string | null
          total_price: number
        }
        Insert: {
          booking_date: string
          booking_source?: string | null
          booking_time: string
          breed_id?: string | null
          campaign_id?: string | null
          created_at?: string
          created_by_staff?: string | null
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          deposit_paid?: number
          dog_name: string
          duration_minutes?: number | null
          final_charge?: number | null
          id?: string
          is_groomers_own_customer?: boolean
          notes?: string | null
          referral_source?: string | null
          service_id?: string | null
          sms_24h_sent?: boolean
          sms_2h_sent?: boolean
          staff_id?: string | null
          status?: string
          stripe_payment_id?: string | null
          total_price?: number
        }
        Update: {
          booking_date?: string
          booking_source?: string | null
          booking_time?: string
          breed_id?: string | null
          campaign_id?: string | null
          created_at?: string
          created_by_staff?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          deposit_paid?: number
          dog_name?: string
          duration_minutes?: number | null
          final_charge?: number | null
          id?: string
          is_groomers_own_customer?: boolean
          notes?: string | null
          referral_source?: string | null
          service_id?: string | null
          sms_24h_sent?: boolean
          sms_2h_sent?: boolean
          staff_id?: string | null
          status?: string
          stripe_payment_id?: string | null
          total_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "bookings_breed_id_fkey"
            columns: ["breed_id"]
            isOneToOne: false
            referencedRelation: "breeds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      breed_advice_cache: {
        Row: {
          breed_id: string
          expires_at: string
          generated_at: string
          id: string
          topics: Json
        }
        Insert: {
          breed_id: string
          expires_at?: string
          generated_at?: string
          id?: string
          topics?: Json
        }
        Update: {
          breed_id?: string
          expires_at?: string
          generated_at?: string
          id?: string
          topics?: Json
        }
        Relationships: [
          {
            foreignKeyName: "breed_advice_cache_breed_id_fkey"
            columns: ["breed_id"]
            isOneToOne: false
            referencedRelation: "breeds"
            referencedColumns: ["id"]
          },
        ]
      }
      breeds: {
        Row: {
          base_notes: string | null
          created_at: string
          duration_minutes: number
          id: string
          name: string
          price_bath_brush: number
          price_full_groom: number
          size_category: string
        }
        Insert: {
          base_notes?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          name: string
          price_bath_brush?: number
          price_full_groom?: number
          size_category: string
        }
        Update: {
          base_notes?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          name?: string
          price_bath_brush?: number
          price_full_groom?: number
          size_category?: string
        }
        Relationships: []
      }
      campaign_attributions: {
        Row: {
          attribution_type: string
          booking_id: string
          campaign_id: string
          created_at: string
          id: string
          revenue: number
        }
        Insert: {
          attribution_type?: string
          booking_id: string
          campaign_id: string
          created_at?: string
          id?: string
          revenue?: number
        }
        Update: {
          attribution_type?: string
          booking_id?: string
          campaign_id?: string
          created_at?: string
          id?: string
          revenue?: number
        }
        Relationships: [
          {
            foreignKeyName: "campaign_attributions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_attributions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_records: {
        Row: {
          booking_id: string | null
          booking_source: string
          commission_rate: number
          commission_type: string
          created_at: string
          deposit_paid: number
          final_charge: number | null
          groomer_pay: number
          id: string
          migrated_booking_id: string | null
          staff_id: string
          studio_share: number
          total_price: number
        }
        Insert: {
          booking_id?: string | null
          booking_source?: string
          commission_rate?: number
          commission_type?: string
          created_at?: string
          deposit_paid?: number
          final_charge?: number | null
          groomer_pay?: number
          id?: string
          migrated_booking_id?: string | null
          staff_id: string
          studio_share?: number
          total_price?: number
        }
        Update: {
          booking_id?: string | null
          booking_source?: string
          commission_rate?: number
          commission_type?: string
          created_at?: string
          deposit_paid?: number
          final_charge?: number | null
          groomer_pay?: number
          id?: string
          migrated_booking_id?: string | null
          staff_id?: string
          studio_share?: number
          total_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "commission_records_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_records_migrated_booking_id_fkey"
            columns: ["migrated_booking_id"]
            isOneToOne: false
            referencedRelation: "migrated_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_records_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_usages: {
        Row: {
          booking_id: string | null
          coupon_id: string
          customer_email: string
          id: string
          used_at: string
        }
        Insert: {
          booking_id?: string | null
          coupon_id: string
          customer_email: string
          id?: string
          used_at?: string
        }
        Update: {
          booking_id?: string | null
          coupon_id?: string
          customer_email?: string
          id?: string
          used_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_usages_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_usages_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          description: string | null
          discount_type: string
          discount_value: number
          end_date: string | null
          id: string
          is_active: boolean
          max_uses: number | null
          max_uses_per_customer: number | null
          min_order_amount: number | null
          start_date: string | null
          times_used: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          end_date?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          max_uses_per_customer?: number | null
          min_order_amount?: number | null
          start_date?: string | null
          times_used?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          end_date?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          max_uses_per_customer?: number | null
          min_order_amount?: number | null
          start_date?: string | null
          times_used?: number
          updated_at?: string
        }
        Relationships: []
      }
      customer_communications: {
        Row: {
          body: string
          created_at: string
          customer_email: string
          direction: string
          id: string
          sent_by: string | null
          subject: string | null
          type: string
        }
        Insert: {
          body: string
          created_at?: string
          customer_email: string
          direction?: string
          id?: string
          sent_by?: string | null
          subject?: string | null
          type?: string
        }
        Update: {
          body?: string
          created_at?: string
          customer_email?: string
          direction?: string
          id?: string
          sent_by?: string | null
          subject?: string | null
          type?: string
        }
        Relationships: []
      }
      customer_messages: {
        Row: {
          body: string | null
          booking_id: string | null
          created_at: string
          from_email: string
          from_name: string | null
          id: string
          is_read: boolean
          subject: string | null
        }
        Insert: {
          body?: string | null
          booking_id?: string | null
          created_at?: string
          from_email: string
          from_name?: string | null
          id?: string
          is_read?: boolean
          subject?: string | null
        }
        Update: {
          body?: string | null
          booking_id?: string | null
          created_at?: string
          from_email?: string
          from_name?: string | null
          id?: string
          is_read?: boolean
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_messages_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_notes: {
        Row: {
          created_at: string
          created_by: string
          customer_email: string
          id: string
          note: string
        }
        Insert: {
          created_at?: string
          created_by: string
          customer_email: string
          id?: string
          note: string
        }
        Update: {
          created_at?: string
          created_by?: string
          customer_email?: string
          id?: string
          note?: string
        }
        Relationships: []
      }
      customer_pay_links: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string | null
          customer_email: string
          customer_name: string | null
          id: string
          notes: string | null
          paid_at: string | null
          status: string
          stripe_payment_link_id: string | null
          stripe_url: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          created_by?: string | null
          customer_email: string
          customer_name?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          status?: string
          stripe_payment_link_id?: string | null
          stripe_url?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          customer_email?: string
          customer_name?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          status?: string
          stripe_payment_link_id?: string | null
          stripe_url?: string | null
        }
        Relationships: []
      }
      customer_pets: {
        Row: {
          breed_id: string | null
          created_at: string
          dog_age_months: number | null
          dog_age_years: number | null
          id: string
          notes: string | null
          pet_name: string
          user_id: string
        }
        Insert: {
          breed_id?: string | null
          created_at?: string
          dog_age_months?: number | null
          dog_age_years?: number | null
          id?: string
          notes?: string | null
          pet_name: string
          user_id: string
        }
        Update: {
          breed_id?: string | null
          created_at?: string
          dog_age_months?: number | null
          dog_age_years?: number | null
          id?: string
          notes?: string | null
          pet_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_pets_breed_id_fkey"
            columns: ["breed_id"]
            isOneToOne: false
            referencedRelation: "breeds"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaigns: {
        Row: {
          ab_test_percentage: number | null
          ab_winner: string | null
          clicks: number
          created_at: string
          created_by: string
          emails_sent: number
          html_body: string
          id: string
          opens: number
          prompt: string | null
          scheduled_at: string | null
          segment: string
          sent_at: string | null
          status: string
          subject: string
          unique_clicks: number
          unique_opens: number
          updated_at: string
          variant_a_opens: number | null
          variant_a_sent: number | null
          variant_b_opens: number | null
          variant_b_sent: number | null
          variant_b_subject: string | null
        }
        Insert: {
          ab_test_percentage?: number | null
          ab_winner?: string | null
          clicks?: number
          created_at?: string
          created_by: string
          emails_sent?: number
          html_body: string
          id?: string
          opens?: number
          prompt?: string | null
          scheduled_at?: string | null
          segment?: string
          sent_at?: string | null
          status?: string
          subject: string
          unique_clicks?: number
          unique_opens?: number
          updated_at?: string
          variant_a_opens?: number | null
          variant_a_sent?: number | null
          variant_b_opens?: number | null
          variant_b_sent?: number | null
          variant_b_subject?: string | null
        }
        Update: {
          ab_test_percentage?: number | null
          ab_winner?: string | null
          clicks?: number
          created_at?: string
          created_by?: string
          emails_sent?: number
          html_body?: string
          id?: string
          opens?: number
          prompt?: string | null
          scheduled_at?: string | null
          segment?: string
          sent_at?: string | null
          status?: string
          subject?: string
          unique_clicks?: number
          unique_opens?: number
          updated_at?: string
          variant_a_opens?: number | null
          variant_a_sent?: number | null
          variant_b_opens?: number | null
          variant_b_sent?: number | null
          variant_b_subject?: string | null
        }
        Relationships: []
      }
      email_events: {
        Row: {
          campaign_id: string
          created_at: string
          email: string
          event_type: string
          id: string
          sg_event_id: string | null
          url: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          email: string
          event_type: string
          id?: string
          sg_event_id?: string | null
          url?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          email?: string
          event_type?: string
          id?: string
          sg_event_id?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      email_unsubscribes: {
        Row: {
          email: string
          id: string
          unsubscribed_at: string
        }
        Insert: {
          email: string
          id?: string
          unsubscribed_at?: string
        }
        Update: {
          email?: string
          id?: string
          unsubscribed_at?: string
        }
        Relationships: []
      }
      error_reports: {
        Row: {
          admin_notes: string | null
          analysed_at: string | null
          browser_info: string | null
          created_at: string
          customer_email: string | null
          customer_name: string | null
          device_info: string | null
          error_description: string
          fix_instruction: string | null
          id: string
          impact: string | null
          lovable_prompt: string | null
          page_url: string
          plain_english: string | null
          resolution_method: string | null
          screenshot_url: string | null
          severity: string | null
          status: string
          steps_to_reproduce: string
          user_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          analysed_at?: string | null
          browser_info?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          device_info?: string | null
          error_description: string
          fix_instruction?: string | null
          id?: string
          impact?: string | null
          lovable_prompt?: string | null
          page_url: string
          plain_english?: string | null
          resolution_method?: string | null
          screenshot_url?: string | null
          severity?: string | null
          status?: string
          steps_to_reproduce: string
          user_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          analysed_at?: string | null
          browser_info?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          device_info?: string | null
          error_description?: string
          fix_instruction?: string | null
          id?: string
          impact?: string | null
          lovable_prompt?: string | null
          page_url?: string
          plain_english?: string | null
          resolution_method?: string | null
          screenshot_url?: string | null
          severity?: string | null
          status?: string
          steps_to_reproduce?: string
          user_id?: string | null
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string
          expense_date: string | null
          expense_type: string
          frequency: string | null
          id: string
          name: string
          notes: string | null
          recurring_end_date: string | null
          recurring_start_date: string | null
        }
        Insert: {
          amount?: number
          category?: string
          created_at?: string
          created_by: string
          expense_date?: string | null
          expense_type?: string
          frequency?: string | null
          id?: string
          name: string
          notes?: string | null
          recurring_end_date?: string | null
          recurring_start_date?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string
          expense_date?: string | null
          expense_type?: string
          frequency?: string | null
          id?: string
          name?: string
          notes?: string | null
          recurring_end_date?: string | null
          recurring_start_date?: string | null
        }
        Relationships: []
      }
      groomer_recommendations: {
        Row: {
          created_at: string
          id: string
          pet_id: string
          recommendation: string
          staff_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          pet_id: string
          recommendation: string
          staff_id: string
        }
        Update: {
          created_at?: string
          id?: string
          pet_id?: string
          recommendation?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "groomer_recommendations_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "customer_pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groomer_recommendations_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      groomer_visibility_settings: {
        Row: {
          groomer_name: string
          hidden: boolean | null
          hidden_at: string | null
          id: string
        }
        Insert: {
          groomer_name: string
          hidden?: boolean | null
          hidden_at?: string | null
          id?: string
        }
        Update: {
          groomer_name?: string
          hidden?: boolean | null
          hidden_at?: string | null
          id?: string
        }
        Relationships: []
      }
      incident_report_recipients: {
        Row: {
          created_at: string
          has_read: boolean
          id: string
          notes: string | null
          recipient_type: string
          report_id: string
          signed_at: string | null
          signed_name: string | null
          staff_id: string
        }
        Insert: {
          created_at?: string
          has_read?: boolean
          id?: string
          notes?: string | null
          recipient_type?: string
          report_id: string
          signed_at?: string | null
          signed_name?: string | null
          staff_id: string
        }
        Update: {
          created_at?: string
          has_read?: boolean
          id?: string
          notes?: string | null
          recipient_type?: string
          report_id?: string
          signed_at?: string | null
          signed_name?: string | null
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_report_recipients_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "incident_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_report_recipients_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_reports: {
        Row: {
          accident_date: string
          accident_description: string
          accident_location: string | null
          accident_time: string | null
          created_at: string
          created_by: string
          employer_signed_at: string | null
          employer_signed_by: string | null
          id: string
          injury_description: string | null
          person_address: string | null
          person_name: string
          person_occupation: string | null
          reporter_name: string
          reporter_occupation: string | null
          riddor_reference: string | null
          riddor_reportable: boolean
          status: string
          updated_at: string
        }
        Insert: {
          accident_date: string
          accident_description: string
          accident_location?: string | null
          accident_time?: string | null
          created_at?: string
          created_by: string
          employer_signed_at?: string | null
          employer_signed_by?: string | null
          id?: string
          injury_description?: string | null
          person_address?: string | null
          person_name: string
          person_occupation?: string | null
          reporter_name: string
          reporter_occupation?: string | null
          riddor_reference?: string | null
          riddor_reportable?: boolean
          status?: string
          updated_at?: string
        }
        Update: {
          accident_date?: string
          accident_description?: string
          accident_location?: string | null
          accident_time?: string | null
          created_at?: string
          created_by?: string
          employer_signed_at?: string | null
          employer_signed_by?: string | null
          id?: string
          injury_description?: string | null
          person_address?: string | null
          person_name?: string
          person_occupation?: string | null
          reporter_name?: string
          reporter_occupation?: string | null
          riddor_reference?: string | null
          riddor_reportable?: boolean
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      migrated_bookings: {
        Row: {
          amount_due: number | null
          booking_date: string
          booking_time: string | null
          deposit_paid: number | null
          dog_age: string | null
          dog_breed: string | null
          dog_name: string | null
          duration_minutes: number | null
          id: string
          imported_at: string
          is_future_booking: boolean
          migrated_customer_id: string
          notes: string | null
          payment_status: string | null
          service_name: string
          staff_name: string | null
          supabase_booking_id: string | null
          total_price: number | null
        }
        Insert: {
          amount_due?: number | null
          booking_date: string
          booking_time?: string | null
          deposit_paid?: number | null
          dog_age?: string | null
          dog_breed?: string | null
          dog_name?: string | null
          duration_minutes?: number | null
          id?: string
          imported_at?: string
          is_future_booking?: boolean
          migrated_customer_id: string
          notes?: string | null
          payment_status?: string | null
          service_name: string
          staff_name?: string | null
          supabase_booking_id?: string | null
          total_price?: number | null
        }
        Update: {
          amount_due?: number | null
          booking_date?: string
          booking_time?: string | null
          deposit_paid?: number | null
          dog_age?: string | null
          dog_breed?: string | null
          dog_name?: string | null
          duration_minutes?: number | null
          id?: string
          imported_at?: string
          is_future_booking?: boolean
          migrated_customer_id?: string
          notes?: string | null
          payment_status?: string | null
          service_name?: string
          staff_name?: string | null
          supabase_booking_id?: string | null
          total_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "migrated_bookings_migrated_customer_id_fkey"
            columns: ["migrated_customer_id"]
            isOneToOne: false
            referencedRelation: "migrated_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      migrated_customers: {
        Row: {
          activated_at: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          invited_at: string | null
          phone: string | null
          profile_id: string | null
          status: string
          supabase_user_id: string | null
        }
        Insert: {
          activated_at?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          invited_at?: string | null
          phone?: string | null
          profile_id?: string | null
          status?: string
          supabase_user_id?: string | null
        }
        Update: {
          activated_at?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          invited_at?: string | null
          phone?: string | null
          profile_id?: string | null
          status?: string
          supabase_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "migrated_customers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_records: {
        Row: {
          amount: number
          created_at: string
          id: string
          notes: string | null
          payment_method: string
          period_end: string
          period_start: string
          processed_by: string
          staff_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          payment_method?: string
          period_end: string
          period_start: string
          processed_by: string
          staff_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          payment_method?: string
          period_end?: string
          period_start?: string
          processed_by?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_records_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_photos: {
        Row: {
          caption: string | null
          created_at: string
          groomer_name: string | null
          id: string
          pet_id: string
          photo_url: string
          uploaded_by_role: string
          user_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          groomer_name?: string | null
          id?: string
          pet_id: string
          photo_url: string
          uploaded_by_role?: string
          user_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          groomer_name?: string | null
          id?: string
          pet_id?: string
          photo_url?: string
          uploaded_by_role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pet_photos_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "customer_pets"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      risk_assessment_items: {
        Row: {
          additional_actions: string | null
          assessment_id: string
          created_at: string
          existing_controls: string
          from_when: string | null
          hazard: string
          id: string
          item_number: number
          who_harmed: string
          who_responsible: string | null
        }
        Insert: {
          additional_actions?: string | null
          assessment_id: string
          created_at?: string
          existing_controls: string
          from_when?: string | null
          hazard: string
          id?: string
          item_number: number
          who_harmed: string
          who_responsible?: string | null
        }
        Update: {
          additional_actions?: string | null
          assessment_id?: string
          created_at?: string
          existing_controls?: string
          from_when?: string | null
          hazard?: string
          id?: string
          item_number?: number
          who_harmed?: string
          who_responsible?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "risk_assessment_items_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "risk_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_assessments: {
        Row: {
          assessed_by: string
          assessment_date: string
          company_name: string
          created_at: string
          created_by: string
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          assessed_by: string
          assessment_date: string
          company_name?: string
          created_at?: string
          created_by: string
          id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          assessed_by?: string
          assessment_date?: string
          company_name?: string
          created_at?: string
          created_by?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      saved_advice: {
        Row: {
          breed_name: string
          content: string
          created_at: string
          icon: string | null
          id: string
          title: string
          user_id: string
        }
        Insert: {
          breed_name: string
          content: string
          created_at?: string
          icon?: string | null
          id?: string
          title: string
          user_id: string
        }
        Update: {
          breed_name?: string
          content?: string
          created_at?: string
          icon?: string | null
          id?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      scruff_conversations: {
        Row: {
          customer_email: string | null
          customer_name: string | null
          device_type: string | null
          ended_at: string | null
          escalated_at: string | null
          id: string
          message_count: number | null
          page_started_from: string | null
          session_id: string
          started_at: string | null
          visitor_id: string | null
          was_escalated: boolean | null
        }
        Insert: {
          customer_email?: string | null
          customer_name?: string | null
          device_type?: string | null
          ended_at?: string | null
          escalated_at?: string | null
          id?: string
          message_count?: number | null
          page_started_from?: string | null
          session_id: string
          started_at?: string | null
          visitor_id?: string | null
          was_escalated?: boolean | null
        }
        Update: {
          customer_email?: string | null
          customer_name?: string | null
          device_type?: string | null
          ended_at?: string | null
          escalated_at?: string | null
          id?: string
          message_count?: number | null
          page_started_from?: string | null
          session_id?: string
          started_at?: string | null
          visitor_id?: string | null
          was_escalated?: boolean | null
        }
        Relationships: []
      }
      scruff_handoffs: {
        Row: {
          assigned_at: string | null
          assigned_to: string | null
          conversation_id: string
          created_at: string | null
          customer_contact: string | null
          customer_message: string | null
          customer_name: string | null
          id: string
          resolution_notes: string | null
          resolved_at: string | null
          status: string | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_to?: string | null
          conversation_id: string
          created_at?: string | null
          customer_contact?: string | null
          customer_message?: string | null
          customer_name?: string | null
          id?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          status?: string | null
        }
        Update: {
          assigned_at?: string | null
          assigned_to?: string | null
          conversation_id?: string
          created_at?: string | null
          customer_contact?: string | null
          customer_message?: string | null
          customer_name?: string | null
          id?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scruff_handoffs_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scruff_handoffs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "scruff_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      scruff_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          response_time_ms: number | null
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          response_time_ms?: number | null
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          response_time_ms?: number | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "scruff_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "scruff_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      service_prices: {
        Row: {
          breed_id: string
          created_at: string
          id: string
          price: number
          service_id: string
        }
        Insert: {
          breed_id: string
          created_at?: string
          id?: string
          price?: number
          service_id: string
        }
        Update: {
          breed_id?: string
          created_at?: string
          id?: string
          price?: number
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_prices_breed_id_fkey"
            columns: ["breed_id"]
            isOneToOne: false
            referencedRelation: "breeds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_prices_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          created_at: string
          description: string | null
          duration_minutes: number | null
          fixed_price: number | null
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          fixed_price?: number | null
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          fixed_price?: number | null
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      site_config: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      sms_messages: {
        Row: {
          body: string
          booking_id: string | null
          created_at: string
          direction: string
          id: string
          is_read: boolean
          phone_number: string
          sent_by_name: string | null
          status: string
          twilio_sid: string | null
        }
        Insert: {
          body: string
          booking_id?: string | null
          created_at?: string
          direction?: string
          id?: string
          is_read?: boolean
          phone_number: string
          sent_by_name?: string | null
          status?: string
          twilio_sid?: string | null
        }
        Update: {
          body?: string
          booking_id?: string | null
          created_at?: string
          direction?: string
          id?: string
          is_read?: boolean
          phone_number?: string
          sent_by_name?: string | null
          status?: string
          twilio_sid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_messages_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          account_blocked: boolean | null
          auth_user_id: string | null
          block_new_bookings: boolean
          booking_priority: number | null
          contact_number: string | null
          contract_signature_data: string | null
          contract_status: string
          created_at: string
          date_of_birth: string | null
          description: string | null
          email: string | null
          employment_end_date: string | null
          hs_signature_data: string | null
          hs_signed_at: string | null
          hs_signed_ip: string | null
          hs_status: string
          id: string
          is_accepting_bookings: boolean | null
          is_self_employed: boolean
          name: string
          role: string
          signed_at: string | null
          signed_ip: string | null
          start_date: string | null
        }
        Insert: {
          account_blocked?: boolean | null
          auth_user_id?: string | null
          block_new_bookings?: boolean
          booking_priority?: number | null
          contact_number?: string | null
          contract_signature_data?: string | null
          contract_status?: string
          created_at?: string
          date_of_birth?: string | null
          description?: string | null
          email?: string | null
          employment_end_date?: string | null
          hs_signature_data?: string | null
          hs_signed_at?: string | null
          hs_signed_ip?: string | null
          hs_status?: string
          id?: string
          is_accepting_bookings?: boolean | null
          is_self_employed?: boolean
          name: string
          role: string
          signed_at?: string | null
          signed_ip?: string | null
          start_date?: string | null
        }
        Update: {
          account_blocked?: boolean | null
          auth_user_id?: string | null
          block_new_bookings?: boolean
          booking_priority?: number | null
          contact_number?: string | null
          contract_signature_data?: string | null
          contract_status?: string
          created_at?: string
          date_of_birth?: string | null
          description?: string | null
          email?: string | null
          employment_end_date?: string | null
          hs_signature_data?: string | null
          hs_signed_at?: string | null
          hs_signed_ip?: string | null
          hs_status?: string
          id?: string
          is_accepting_bookings?: boolean | null
          is_self_employed?: boolean
          name?: string
          role?: string
          signed_at?: string | null
          signed_ip?: string | null
          start_date?: string | null
        }
        Relationships: []
      }
      staff_availability: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          is_available: boolean
          staff_id: string
          start_time: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time?: string
          id?: string
          is_available?: boolean
          staff_id: string
          start_time?: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          is_available?: boolean
          staff_id?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_availability_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_notes: {
        Row: {
          created_at: string
          created_by: string
          id: string
          note: string
          staff_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          note: string
          staff_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          note?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_notes_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_schedule_overrides: {
        Row: {
          created_at: string
          end_time: string | null
          id: string
          is_working: boolean
          note: string | null
          override_date: string
          staff_id: string
          start_time: string | null
        }
        Insert: {
          created_at?: string
          end_time?: string | null
          id?: string
          is_working?: boolean
          note?: string | null
          override_date: string
          staff_id: string
          start_time?: string | null
        }
        Update: {
          created_at?: string
          end_time?: string | null
          id?: string
          is_working?: boolean
          note?: string | null
          override_date?: string
          staff_id?: string
          start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_schedule_overrides_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_services: {
        Row: {
          created_at: string
          id: string
          service_id: string
          staff_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          service_id: string
          staff_id: string
        }
        Update: {
          created_at?: string
          id?: string
          service_id?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_services_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wix_historical_bookings: {
        Row: {
          appointment_date: string
          appointment_end: string | null
          booking_status: string
          created_month: number | null
          created_year: number | null
          customer_email: string | null
          customer_message: string | null
          customer_name: string
          customer_phone: string | null
          dog_age: string | null
          dog_breed: string | null
          dog_name: string | null
          duration_text: string | null
          excluded_from_revenue: boolean
          groomer_name: string | null
          id: string
          imported_at: string
          migrated_to_main: boolean
          payment_status: string
          price_charged: number
          price_option: string | null
          referral_source: string | null
          registration_date: string | null
          revenue_recognised: boolean
          service_name: string
          service_type: string | null
          source: string | null
          wix_order_number: string | null
        }
        Insert: {
          appointment_date: string
          appointment_end?: string | null
          booking_status?: string
          created_month?: number | null
          created_year?: number | null
          customer_email?: string | null
          customer_message?: string | null
          customer_name: string
          customer_phone?: string | null
          dog_age?: string | null
          dog_breed?: string | null
          dog_name?: string | null
          duration_text?: string | null
          excluded_from_revenue?: boolean
          groomer_name?: string | null
          id?: string
          imported_at?: string
          migrated_to_main?: boolean
          payment_status?: string
          price_charged?: number
          price_option?: string | null
          referral_source?: string | null
          registration_date?: string | null
          revenue_recognised?: boolean
          service_name: string
          service_type?: string | null
          source?: string | null
          wix_order_number?: string | null
        }
        Update: {
          appointment_date?: string
          appointment_end?: string | null
          booking_status?: string
          created_month?: number | null
          created_year?: number | null
          customer_email?: string | null
          customer_message?: string | null
          customer_name?: string
          customer_phone?: string | null
          dog_age?: string | null
          dog_breed?: string | null
          dog_name?: string | null
          duration_text?: string | null
          excluded_from_revenue?: boolean
          groomer_name?: string | null
          id?: string
          imported_at?: string
          migrated_to_main?: boolean
          payment_status?: string
          price_charged?: number
          price_option?: string | null
          referral_source?: string | null
          registration_date?: string | null
          revenue_recognised?: boolean
          service_name?: string
          service_type?: string | null
          source?: string | null
          wix_order_number?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_id_by_email: { Args: { _email: string }; Returns: string }
      groomer_can_access_customer: {
        Args: { _customer_user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "manager"
        | "groomer"
        | "customer"
        | "director"
        | "volunteer"
        | "work_placement"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: [
        "manager",
        "groomer",
        "customer",
        "director",
        "volunteer",
        "work_placement",
      ],
    },
  },
} as const
