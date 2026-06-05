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
      academy_applications: {
        Row: {
          about_me: string | null
          contact_number: string | null
          course_interest: string | null
          email: string
          first_name: string | null
          full_name: string
          id: string
          last_name: string | null
          phone: string | null
          referral_source: string | null
          status: string | null
          submitted_at: string | null
          timing_preference: string | null
        }
        Insert: {
          about_me?: string | null
          contact_number?: string | null
          course_interest?: string | null
          email: string
          first_name?: string | null
          full_name: string
          id?: string
          last_name?: string | null
          phone?: string | null
          referral_source?: string | null
          status?: string | null
          submitted_at?: string | null
          timing_preference?: string | null
        }
        Update: {
          about_me?: string | null
          contact_number?: string | null
          course_interest?: string | null
          email?: string
          first_name?: string | null
          full_name?: string
          id?: string
          last_name?: string | null
          phone?: string | null
          referral_source?: string | null
          status?: string | null
          submitted_at?: string | null
          timing_preference?: string | null
        }
        Relationships: []
      }
      academy_enquiries: {
        Row: {
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string
          message: string | null
          phone: string
          programme_interest: string | null
          referral_source: string | null
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          first_name: string
          id?: string
          last_name: string
          message?: string | null
          phone: string
          programme_interest?: string | null
          referral_source?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          message?: string | null
          phone?: string
          programme_interest?: string | null
          referral_source?: string | null
          status?: string
        }
        Relationships: []
      }
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
      ai_call_logs: {
        Row: {
          booking_id: string | null
          cached_system_prompt: string | null
          call_sid: string | null
          caller_name: string | null
          caller_number: string | null
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          outcome: string | null
          started_at: string | null
          summary: string | null
          transcript: Json | null
          transfer_attempted: boolean
          transfer_successful: boolean
        }
        Insert: {
          booking_id?: string | null
          cached_system_prompt?: string | null
          call_sid?: string | null
          caller_name?: string | null
          caller_number?: string | null
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          outcome?: string | null
          started_at?: string | null
          summary?: string | null
          transcript?: Json | null
          transfer_attempted?: boolean
          transfer_successful?: boolean
        }
        Update: {
          booking_id?: string | null
          cached_system_prompt?: string | null
          call_sid?: string | null
          caller_name?: string | null
          caller_number?: string | null
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          outcome?: string | null
          started_at?: string | null
          summary?: string | null
          transcript?: Json | null
          transfer_attempted?: boolean
          transfer_successful?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ai_call_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_inbox_cases: {
        Row: {
          appointment_time: string | null
          assigned_at: string | null
          assigned_to: string | null
          booking_id: string | null
          call_duration_seconds: number | null
          caller_name: string | null
          caller_number: string | null
          case_type: string
          created_at: string
          dog_name: string | null
          full_transcript: Json | null
          id: string
          minutes_late: number | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          summary: string | null
          updated_at: string
        }
        Insert: {
          appointment_time?: string | null
          assigned_at?: string | null
          assigned_to?: string | null
          booking_id?: string | null
          call_duration_seconds?: number | null
          caller_name?: string | null
          caller_number?: string | null
          case_type: string
          created_at?: string
          dog_name?: string | null
          full_transcript?: Json | null
          id?: string
          minutes_late?: number | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          summary?: string | null
          updated_at?: string
        }
        Update: {
          appointment_time?: string | null
          assigned_at?: string | null
          assigned_to?: string | null
          booking_id?: string | null
          call_duration_seconds?: number | null
          caller_name?: string | null
          caller_number?: string | null
          case_type?: string
          created_at?: string
          dog_name?: string | null
          full_transcript?: Json | null
          id?: string
          minutes_late?: number | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_inbox_cases_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_inbox_cases_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_inbox_cases_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_inbox_notifications: {
        Row: {
          case_id: string | null
          created_at: string
          id: string
          is_read: boolean
          message: string
          staff_id: string
        }
        Insert: {
          case_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          staff_id: string
        }
        Update: {
          case_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_inbox_notifications_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "ai_inbox_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_inbox_notifications_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_receptionist_hours: {
        Row: {
          close_time: string | null
          created_at: string
          day_of_week: number
          id: string
          is_open: boolean
          open_time: string | null
        }
        Insert: {
          close_time?: string | null
          created_at?: string
          day_of_week: number
          id?: string
          is_open?: boolean
          open_time?: string | null
        }
        Update: {
          close_time?: string | null
          created_at?: string
          day_of_week?: number
          id?: string
          is_open?: boolean
          open_time?: string | null
        }
        Relationships: []
      }
      ai_receptionist_knowledge: {
        Row: {
          answer: string
          category: string
          created_at: string
          id: string
          is_active: boolean
          question: string
        }
        Insert: {
          answer: string
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          question: string
        }
        Update: {
          answer?: string
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          question?: string
        }
        Relationships: []
      }
      ai_receptionist_settings: {
        Row: {
          created_at: string
          elevenlabs_agent_id: string | null
          email_summary_to: string
          greeting: string
          id: string
          is_active: boolean
          system_prompt: string | null
          system_prompt_updated_at: string | null
          system_prompt_updated_by: string | null
          transfer_number: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          elevenlabs_agent_id?: string | null
          email_summary_to?: string
          greeting?: string
          id?: string
          is_active?: boolean
          system_prompt?: string | null
          system_prompt_updated_at?: string | null
          system_prompt_updated_by?: string | null
          transfer_number?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          elevenlabs_agent_id?: string | null
          email_summary_to?: string
          greeting?: string
          id?: string
          is_active?: boolean
          system_prompt?: string | null
          system_prompt_updated_at?: string | null
          system_prompt_updated_by?: string | null
          transfer_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_receptionist_settings_system_prompt_updated_by_fkey"
            columns: ["system_prompt_updated_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
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
      bank_balance_snapshots: {
        Row: {
          balance: number
          id: string
          note: string | null
          noted_at: string | null
          noted_by: string
        }
        Insert: {
          balance: number
          id?: string
          note?: string | null
          noted_at?: string | null
          noted_by: string
        }
        Update: {
          balance?: number
          id?: string
          note?: string | null
          noted_at?: string | null
          noted_by?: string
        }
        Relationships: []
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
      booking_flow_events: {
        Row: {
          action: string
          booking_id: string | null
          created_at: string
          customer_email: string | null
          customer_phone: string | null
          id: string
          payload: Json
          referrer: string | null
          session_id: string
          step: string
          user_agent: string | null
        }
        Insert: {
          action: string
          booking_id?: string | null
          created_at?: string
          customer_email?: string | null
          customer_phone?: string | null
          id?: string
          payload?: Json
          referrer?: string | null
          session_id: string
          step: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          booking_id?: string | null
          created_at?: string
          customer_email?: string | null
          customer_phone?: string | null
          id?: string
          payload?: Json
          referrer?: string | null
          session_id?: string
          step?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_flow_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          anomaly_review_note: string | null
          anomaly_reviewed: boolean | null
          anomaly_type: string | null
          attributed_campaign_id: string | null
          attributed_sms_campaign: string | null
          attribution_source: string | null
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
          deposit_link_sent_at: string | null
          deposit_paid: number
          dog_name: string
          duration_minutes: number | null
          extra_stripe_payment_ids: string[]
          final_charge: number | null
          id: string
          is_groomers_own_customer: boolean
          notes: string | null
          payment_anomaly: boolean | null
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
          anomaly_review_note?: string | null
          anomaly_reviewed?: boolean | null
          anomaly_type?: string | null
          attributed_campaign_id?: string | null
          attributed_sms_campaign?: string | null
          attribution_source?: string | null
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
          deposit_link_sent_at?: string | null
          deposit_paid?: number
          dog_name: string
          duration_minutes?: number | null
          extra_stripe_payment_ids?: string[]
          final_charge?: number | null
          id?: string
          is_groomers_own_customer?: boolean
          notes?: string | null
          payment_anomaly?: boolean | null
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
          anomaly_review_note?: string | null
          anomaly_reviewed?: boolean | null
          anomaly_type?: string | null
          attributed_campaign_id?: string | null
          attributed_sms_campaign?: string | null
          attribution_source?: string | null
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
          deposit_link_sent_at?: string | null
          deposit_paid?: number
          dog_name?: string
          duration_minutes?: number | null
          extra_stripe_payment_ids?: string[]
          final_charge?: number | null
          id?: string
          is_groomers_own_customer?: boolean
          notes?: string | null
          payment_anomaly?: boolean | null
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
            foreignKeyName: "bookings_attributed_campaign_id_fkey"
            columns: ["attributed_campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
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
      bulk_sms_log: {
        Row: {
          campaign_name: string | null
          customer_name: string | null
          delivery_status: string | null
          delivery_updated_at: string | null
          error_code: string | null
          error_message: string | null
          id: string
          message: string
          phone: string
          sent_at: string | null
          status: string
          twilio_message_sid: string | null
        }
        Insert: {
          campaign_name?: string | null
          customer_name?: string | null
          delivery_status?: string | null
          delivery_updated_at?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          message: string
          phone: string
          sent_at?: string | null
          status?: string
          twilio_message_sid?: string | null
        }
        Update: {
          campaign_name?: string | null
          customer_name?: string | null
          delivery_status?: string | null
          delivery_updated_at?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          message?: string
          phone?: string
          sent_at?: string | null
          status?: string
          twilio_message_sid?: string | null
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
      campaign_send_log: {
        Row: {
          campaign_id: string | null
          email: string
          error_message: string | null
          id: string
          sent_at: string | null
          status: string
        }
        Insert: {
          campaign_id?: string | null
          email: string
          error_message?: string | null
          id?: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          campaign_id?: string | null
          email?: string
          error_message?: string | null
          id?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_send_log_campaign_id_fkey"
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
          applied_by_staff_id: string | null
          applied_by_staff_name: string | null
          booking_id: string | null
          coupon_id: string
          customer_email: string
          id: string
          migrated_booking_id: string | null
          used_at: string
        }
        Insert: {
          applied_by_staff_id?: string | null
          applied_by_staff_name?: string | null
          booking_id?: string | null
          coupon_id: string
          customer_email: string
          id?: string
          migrated_booking_id?: string | null
          used_at?: string
        }
        Update: {
          applied_by_staff_id?: string | null
          applied_by_staff_name?: string | null
          booking_id?: string | null
          coupon_id?: string
          customer_email?: string
          id?: string
          migrated_booking_id?: string | null
          used_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_usages_applied_by_staff_id_fkey"
            columns: ["applied_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "coupon_usages_migrated_booking_id_fkey"
            columns: ["migrated_booking_id"]
            isOneToOne: false
            referencedRelation: "migrated_bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          attributed_campaign_id: string | null
          attributed_sms_campaign: string | null
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
          attributed_campaign_id?: string | null
          attributed_sms_campaign?: string | null
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
          attributed_campaign_id?: string | null
          attributed_sms_campaign?: string | null
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
        Relationships: [
          {
            foreignKeyName: "coupons_attributed_campaign_id_fkey"
            columns: ["attributed_campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
        ]
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
      email_replies: {
        Row: {
          email_id: string
          id: string
          replied_at: string
          replied_by: string | null
          reply_body: string
        }
        Insert: {
          email_id: string
          id?: string
          replied_at?: string
          replied_by?: string | null
          reply_body: string
        }
        Update: {
          email_id?: string
          id?: string
          replied_at?: string
          replied_by?: string | null
          reply_body?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_replies_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "salon_emails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_replies_replied_by_fkey"
            columns: ["replied_by"]
            isOneToOne: false
            referencedRelation: "staff"
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
      groomer_activity_log: {
        Row: {
          action_summary: string
          action_type: string
          booking_date: string | null
          booking_id: string | null
          booking_time: string | null
          customer_name: string | null
          dog_name: string | null
          extra_details: Json | null
          id: string
          performed_at: string | null
          service_name: string | null
          staff_id: string | null
        }
        Insert: {
          action_summary: string
          action_type: string
          booking_date?: string | null
          booking_id?: string | null
          booking_time?: string | null
          customer_name?: string | null
          dog_name?: string | null
          extra_details?: Json | null
          id?: string
          performed_at?: string | null
          service_name?: string | null
          staff_id?: string | null
        }
        Update: {
          action_summary?: string
          action_type?: string
          booking_date?: string | null
          booking_id?: string | null
          booking_time?: string | null
          customer_name?: string | null
          dog_name?: string | null
          extra_details?: Json | null
          id?: string
          performed_at?: string | null
          service_name?: string | null
          staff_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "groomer_activity_log_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groomer_activity_log_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      groomer_payout_history: {
        Row: {
          anomaly_count: number | null
          anomaly_shortfall: number | null
          commission_rate: number
          groomer_id: string | null
          groomer_name: string
          id: string
          notes: string | null
          paid_at: string | null
          paid_by: string
          payment_method: string | null
          payout_amount: number
          period_end: string
          period_start: string
          total_revenue: number
        }
        Insert: {
          anomaly_count?: number | null
          anomaly_shortfall?: number | null
          commission_rate: number
          groomer_id?: string | null
          groomer_name: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          paid_by: string
          payment_method?: string | null
          payout_amount: number
          period_end: string
          period_start: string
          total_revenue: number
        }
        Update: {
          anomaly_count?: number | null
          anomaly_shortfall?: number | null
          commission_rate?: number
          groomer_id?: string | null
          groomer_name?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          paid_by?: string
          payment_method?: string | null
          payout_amount?: number
          period_end?: string
          period_start?: string
          total_revenue?: number
        }
        Relationships: [
          {
            foreignKeyName: "groomer_payout_history_groomer_id_fkey"
            columns: ["groomer_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
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
      hr_documents: {
        Row: {
          created_at: string
          filename: string
          id: string
          staff_id: string
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          filename: string
          id?: string
          staff_id: string
          storage_path: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          filename?: string
          id?: string
          staff_id?: string
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_documents_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_employment_status: {
        Row: {
          current_status: string
          id: string
          notice_period: string | null
          reason_for_leaving: string | null
          staff_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          current_status?: string
          id?: string
          notice_period?: string | null
          reason_for_leaving?: string | null
          staff_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          current_status?: string
          id?: string
          notice_period?: string | null
          reason_for_leaving?: string | null
          staff_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_employment_status_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: true
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_events: {
        Row: {
          created_at: string
          created_by: string
          event_date: string
          event_type: string
          id: string
          notes: string | null
          staff_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          event_date: string
          event_type: string
          id?: string
          notes?: string | null
          staff_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          event_date?: string
          event_type?: string
          id?: string
          notes?: string | null
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_events_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
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
          sms_24h_sent: boolean
          sms_2h_sent: boolean
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
          sms_24h_sent?: boolean
          sms_2h_sent?: boolean
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
          sms_24h_sent?: boolean
          sms_2h_sent?: boolean
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
          secondary_phone: string | null
          sms_opt_out: boolean | null
          sms_opt_out_at: string | null
          sms_unreachable: boolean | null
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
          secondary_phone?: string | null
          sms_opt_out?: boolean | null
          sms_opt_out_at?: string | null
          sms_unreachable?: boolean | null
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
          secondary_phone?: string | null
          sms_opt_out?: boolean | null
          sms_opt_out_at?: string | null
          sms_unreachable?: boolean | null
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
      monthly_commitments: {
        Row: {
          amount: number
          category: string | null
          created_at: string | null
          due_day: number
          frequency: string | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string | null
          due_day?: number
          frequency?: string | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string | null
          due_day?: number
          frequency?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      package_bookings: {
        Row: {
          cancelled_at: string | null
          created_at: string | null
          customer_email: string
          customer_name: string
          customer_phone: string | null
          dog_name: string | null
          id: string
          notes: string | null
          package_id: string | null
          refund_amount: number | null
          refund_reason: string | null
          sessions_remaining: number | null
          sessions_total: number
          sessions_used: number | null
          status: string | null
          stripe_payment_intent_id: string | null
          stripe_payment_status: string | null
          tc_signed: boolean | null
          tc_signed_at: string | null
          total_paid: number
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string | null
          customer_email: string
          customer_name: string
          customer_phone?: string | null
          dog_name?: string | null
          id?: string
          notes?: string | null
          package_id?: string | null
          refund_amount?: number | null
          refund_reason?: string | null
          sessions_remaining?: number | null
          sessions_total: number
          sessions_used?: number | null
          status?: string | null
          stripe_payment_intent_id?: string | null
          stripe_payment_status?: string | null
          tc_signed?: boolean | null
          tc_signed_at?: string | null
          total_paid: number
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string | null
          customer_email?: string
          customer_name?: string
          customer_phone?: string | null
          dog_name?: string | null
          id?: string
          notes?: string | null
          package_id?: string | null
          refund_amount?: number | null
          refund_reason?: string | null
          sessions_remaining?: number | null
          sessions_total?: number
          sessions_used?: number | null
          status?: string | null
          stripe_payment_intent_id?: string | null
          stripe_payment_status?: string | null
          tc_signed?: boolean | null
          tc_signed_at?: string | null
          total_paid?: number
        }
        Relationships: [
          {
            foreignKeyName: "package_bookings_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      package_checkout_pending: {
        Row: {
          breed_id: string | null
          created_at: string | null
          customer_email: string
          customer_name: string
          customer_phone: string | null
          dog_name: string | null
          id: string
          package_id: string | null
          sessions_json: Json
          total_price: number
        }
        Insert: {
          breed_id?: string | null
          created_at?: string | null
          customer_email: string
          customer_name?: string
          customer_phone?: string | null
          dog_name?: string | null
          id?: string
          package_id?: string | null
          sessions_json?: Json
          total_price?: number
        }
        Update: {
          breed_id?: string | null
          created_at?: string | null
          customer_email?: string
          customer_name?: string
          customer_phone?: string | null
          dog_name?: string | null
          id?: string
          package_id?: string | null
          sessions_json?: Json
          total_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "package_checkout_pending_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      package_payment_audit: {
        Row: {
          amount: number | null
          booking_id: string | null
          created_at: string
          event_type: string
          id: string
          new_date: string | null
          new_status: string | null
          new_time: string | null
          note: string | null
          old_date: string | null
          old_status: string | null
          old_time: string | null
          package_booking_id: string | null
          package_session_id: string | null
          performed_by: string | null
          stripe_payment_intent_id: string | null
        }
        Insert: {
          amount?: number | null
          booking_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          new_date?: string | null
          new_status?: string | null
          new_time?: string | null
          note?: string | null
          old_date?: string | null
          old_status?: string | null
          old_time?: string | null
          package_booking_id?: string | null
          package_session_id?: string | null
          performed_by?: string | null
          stripe_payment_intent_id?: string | null
        }
        Update: {
          amount?: number | null
          booking_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          new_date?: string | null
          new_status?: string | null
          new_time?: string | null
          note?: string | null
          old_date?: string | null
          old_status?: string | null
          old_time?: string | null
          package_booking_id?: string | null
          package_session_id?: string | null
          performed_by?: string | null
          stripe_payment_intent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "package_payment_audit_package_booking_id_fkey"
            columns: ["package_booking_id"]
            isOneToOne: false
            referencedRelation: "package_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_payment_audit_package_session_id_fkey"
            columns: ["package_session_id"]
            isOneToOne: false
            referencedRelation: "package_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      package_sessions: {
        Row: {
          booking_id: string | null
          created_at: string | null
          id: string
          package_booking_id: string | null
          scheduled_date: string | null
          scheduled_time: string | null
          service_type: string | null
          session_number: number
          status: string | null
        }
        Insert: {
          booking_id?: string | null
          created_at?: string | null
          id?: string
          package_booking_id?: string | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          service_type?: string | null
          session_number: number
          status?: string | null
        }
        Update: {
          booking_id?: string | null
          created_at?: string | null
          id?: string
          package_booking_id?: string | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          service_type?: string | null
          session_number?: number
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "package_sessions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_sessions_package_booking_id_fkey"
            columns: ["package_booking_id"]
            isOneToOne: false
            referencedRelation: "package_bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      package_tc_signatures: {
        Row: {
          created_at: string | null
          customer_email: string
          customer_name: string
          email_sent_at: string | null
          id: string
          ip_address: string | null
          manual_note: string | null
          package_booking_id: string | null
          pdf_storage_path: string | null
          performed_by: string | null
          signature_text: string | null
          signed_at: string | null
          signing_token: string | null
          status: string | null
          tc_version: string | null
          token_expires_at: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string | null
          customer_email: string
          customer_name: string
          email_sent_at?: string | null
          id?: string
          ip_address?: string | null
          manual_note?: string | null
          package_booking_id?: string | null
          pdf_storage_path?: string | null
          performed_by?: string | null
          signature_text?: string | null
          signed_at?: string | null
          signing_token?: string | null
          status?: string | null
          tc_version?: string | null
          token_expires_at?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string | null
          customer_email?: string
          customer_name?: string
          email_sent_at?: string | null
          id?: string
          ip_address?: string | null
          manual_note?: string | null
          package_booking_id?: string | null
          pdf_storage_path?: string | null
          performed_by?: string | null
          signature_text?: string | null
          signed_at?: string | null
          signing_token?: string | null
          status?: string | null
          tc_version?: string | null
          token_expires_at?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "package_tc_signatures_package_booking_id_fkey"
            columns: ["package_booking_id"]
            isOneToOne: false
            referencedRelation: "package_bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      packages: {
        Row: {
          created_at: string | null
          description: string | null
          discount_percentage: number
          id: string
          is_active: boolean | null
          name: string
          package_type: string
          price_per_session: number | null
          session_count: number
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          discount_percentage: number
          id?: string
          is_active?: boolean | null
          name: string
          package_type: string
          price_per_session?: number | null
          session_count: number
        }
        Update: {
          created_at?: string | null
          description?: string | null
          discount_percentage?: number
          id?: string
          is_active?: boolean | null
          name?: string
          package_type?: string
          price_per_session?: number | null
          session_count?: number
        }
        Relationships: []
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
      phone_booking_deposit_queue: {
        Row: {
          booking_id: string
          created_at: string
          customer_name: string | null
          customer_phone: string
          id: string
          last_error: string | null
          sent_at: string | null
          status: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          customer_name?: string | null
          customer_phone: string
          id?: string
          last_error?: string | null
          sent_at?: string | null
          status?: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          customer_name?: string | null
          customer_phone?: string
          id?: string
          last_error?: string | null
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "phone_booking_deposit_queue_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      placement_logs: {
        Row: {
          created_at: string
          id: string
          log_entry: string
          placement_id: string
          staff_id: string | null
          staff_name: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          log_entry: string
          placement_id: string
          staff_id?: string | null
          staff_name?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          log_entry?: string
          placement_id?: string
          staff_id?: string | null
          staff_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "placement_logs_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "work_placements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placement_logs_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
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
      purchase_requests: {
        Row: {
          created_at: string | null
          decline_reason: string | null
          description: string | null
          id: string
          image_url: string | null
          priority: string | null
          product_link: string | null
          request_method: string | null
          requested_by: string
          responded_at: string | null
          responded_by: string | null
          status: string | null
          title: string
        }
        Insert: {
          created_at?: string | null
          decline_reason?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          priority?: string | null
          product_link?: string | null
          request_method?: string | null
          requested_by: string
          responded_at?: string | null
          responded_by?: string | null
          status?: string | null
          title: string
        }
        Update: {
          created_at?: string | null
          decline_reason?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          priority?: string | null
          product_link?: string | null
          request_method?: string | null
          requested_by?: string
          responded_at?: string | null
          responded_by?: string | null
          status?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          assigned_to: string | null
          assignment_type: string | null
          description: string | null
          id: string
          image_url: string | null
          is_returned: boolean | null
          notes: string | null
          product_link: string | null
          purchased_at: string | null
          purchased_by: string | null
          quantity: number | null
          request_id: string | null
          request_method: string | null
          requested_by_groomer: string | null
          returned_at: string | null
          supplier: string | null
          title: string
          total_price: number | null
          unit_price: number | null
        }
        Insert: {
          assigned_to?: string | null
          assignment_type?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_returned?: boolean | null
          notes?: string | null
          product_link?: string | null
          purchased_at?: string | null
          purchased_by?: string | null
          quantity?: number | null
          request_id?: string | null
          request_method?: string | null
          requested_by_groomer?: string | null
          returned_at?: string | null
          supplier?: string | null
          title: string
          total_price?: number | null
          unit_price?: number | null
        }
        Update: {
          assigned_to?: string | null
          assignment_type?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_returned?: boolean | null
          notes?: string | null
          product_link?: string | null
          purchased_at?: string | null
          purchased_by?: string | null
          quantity?: number | null
          request_id?: string | null
          request_method?: string | null
          requested_by_groomer?: string | null
          returned_at?: string | null
          supplier?: string | null
          title?: string
          total_price?: number | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "purchases_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "purchase_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_requested_by_groomer_fkey"
            columns: ["requested_by_groomer"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      reconciliation_runs: {
        Row: {
          filename: string | null
          id: string
          matched_count: number | null
          raw_csv: string | null
          total_transactions: number | null
          unmatched_count: number | null
          uploaded_at: string | null
          uploaded_by: string | null
          void_count: number | null
        }
        Insert: {
          filename?: string | null
          id?: string
          matched_count?: number | null
          raw_csv?: string | null
          total_transactions?: number | null
          unmatched_count?: number | null
          uploaded_at?: string | null
          uploaded_by?: string | null
          void_count?: number | null
        }
        Update: {
          filename?: string | null
          id?: string
          matched_count?: number | null
          raw_csv?: string | null
          total_transactions?: number | null
          unmatched_count?: number | null
          uploaded_at?: string | null
          uploaded_by?: string | null
          void_count?: number | null
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
      salon_emails: {
        Row: {
          assigned_staff_id: string | null
          body: string | null
          created_at: string
          customer_email: string
          customer_name: string | null
          id: string
          last_reply_body: string | null
          status: string
          subject: string | null
        }
        Insert: {
          assigned_staff_id?: string | null
          body?: string | null
          created_at?: string
          customer_email: string
          customer_name?: string | null
          id?: string
          last_reply_body?: string | null
          status?: string
          subject?: string | null
        }
        Update: {
          assigned_staff_id?: string | null
          body?: string | null
          created_at?: string
          customer_email?: string
          customer_name?: string | null
          id?: string
          last_reply_body?: string | null
          status?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "salon_emails_assigned_staff_id_fkey"
            columns: ["assigned_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
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
      sms_link_clicks: {
        Row: {
          campaign_name: string | null
          clicked_at: string | null
          destination_url: string | null
          id: string
          phone_hash: string | null
        }
        Insert: {
          campaign_name?: string | null
          clicked_at?: string | null
          destination_url?: string | null
          id?: string
          phone_hash?: string | null
        }
        Update: {
          campaign_name?: string | null
          clicked_at?: string | null
          destination_url?: string | null
          id?: string
          phone_hash?: string | null
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
          full_calendar_access: boolean
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
          full_calendar_access?: boolean
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
          full_calendar_access?: boolean
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
      work_placements: {
        Row: {
          added_by: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          education_place: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          end_date: string | null
          first_name: string
          id: string
          last_name: string
          notes: string | null
          phone: string | null
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          added_by?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          education_place?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          end_date?: string | null
          first_name: string
          id?: string
          last_name: string
          notes?: string | null
          phone?: string | null
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          added_by?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          education_place?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          end_date?: string | null
          first_name?: string
          id?: string
          last_name?: string
          notes?: string | null
          phone?: string | null
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_placements_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_placements_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_staff_id: { Args: never; Returns: string }
      get_user_id_by_email: { Args: { _email: string }; Returns: string }
      groomer_can_access_customer: {
        Args: { _customer_user_id: string }
        Returns: boolean
      }
      has_full_calendar_access: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hash_phone_for_sms: { Args: { phone: string }; Returns: string }
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
