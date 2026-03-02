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
          booking_time: string
          breed_id: string | null
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          deposit_paid: number
          dog_name: string
          final_charge: number | null
          id: string
          is_groomers_own_customer: boolean
          notes: string | null
          referral_source: string | null
          service_id: string | null
          staff_id: string | null
          status: string
          total_price: number
        }
        Insert: {
          booking_date: string
          booking_time: string
          breed_id?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          deposit_paid?: number
          dog_name: string
          final_charge?: number | null
          id?: string
          is_groomers_own_customer?: boolean
          notes?: string | null
          referral_source?: string | null
          service_id?: string | null
          staff_id?: string | null
          status?: string
          total_price?: number
        }
        Update: {
          booking_date?: string
          booking_time?: string
          breed_id?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          deposit_paid?: number
          dog_name?: string
          final_charge?: number | null
          id?: string
          is_groomers_own_customer?: boolean
          notes?: string | null
          referral_source?: string | null
          service_id?: string | null
          staff_id?: string | null
          status?: string
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
      customer_pets: {
        Row: {
          breed_id: string | null
          created_at: string
          id: string
          notes: string | null
          pet_name: string
          user_id: string
        }
        Insert: {
          breed_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          pet_name: string
          user_id: string
        }
        Update: {
          breed_id?: string | null
          created_at?: string
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
      staff: {
        Row: {
          auth_user_id: string | null
          contact_number: string | null
          contract_signature_data: string | null
          contract_status: string
          created_at: string
          date_of_birth: string | null
          description: string | null
          email: string | null
          hs_signature_data: string | null
          hs_signed_at: string | null
          hs_signed_ip: string | null
          hs_status: string
          id: string
          is_self_employed: boolean
          name: string
          role: string
          signed_at: string | null
          signed_ip: string | null
          start_date: string | null
        }
        Insert: {
          auth_user_id?: string | null
          contact_number?: string | null
          contract_signature_data?: string | null
          contract_status?: string
          created_at?: string
          date_of_birth?: string | null
          description?: string | null
          email?: string | null
          hs_signature_data?: string | null
          hs_signed_at?: string | null
          hs_signed_ip?: string | null
          hs_status?: string
          id?: string
          is_self_employed?: boolean
          name: string
          role: string
          signed_at?: string | null
          signed_ip?: string | null
          start_date?: string | null
        }
        Update: {
          auth_user_id?: string | null
          contact_number?: string | null
          contract_signature_data?: string | null
          contract_status?: string
          created_at?: string
          date_of_birth?: string | null
          description?: string | null
          email?: string | null
          hs_signature_data?: string | null
          hs_signed_at?: string | null
          hs_signed_ip?: string | null
          hs_status?: string
          id?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
