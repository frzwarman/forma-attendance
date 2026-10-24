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
      forma_approvals: {
        Row: {
          decided_at: string
          decision: string
          employee_id: string
          id: string
          organization_id: string
          reason: string | null
          request_id: string
          reviewer_id: string
        }
        Insert: {
          decided_at?: string
          decision: string
          employee_id: string
          id?: string
          organization_id: string
          reason?: string | null
          request_id: string
          reviewer_id: string
        }
        Update: {
          decided_at?: string
          decision?: string
          employee_id?: string
          id?: string
          organization_id?: string
          reason?: string | null
          request_id?: string
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forma_approvals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "forma_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forma_approvals_organization_id_request_id_employee_id_fkey"
            columns: ["organization_id", "request_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "forma_requests"
            referencedColumns: ["organization_id", "id", "employee_id"]
          },
          {
            foreignKeyName: "forma_approvals_organization_id_reviewer_id_fkey"
            columns: ["organization_id", "reviewer_id"]
            isOneToOne: false
            referencedRelation: "forma_employees"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      forma_attendance_adjustments: {
        Row: {
          applied_at: string
          applied_by: string
          corrected_clock_in: string | null
          corrected_clock_out: string | null
          employee_id: string
          id: string
          organization_id: string
          reason: string
          request_id: string
          session_id: string
        }
        Insert: {
          applied_at?: string
          applied_by: string
          corrected_clock_in?: string | null
          corrected_clock_out?: string | null
          employee_id: string
          id?: string
          organization_id: string
          reason: string
          request_id: string
          session_id: string
        }
        Update: {
          applied_at?: string
          applied_by?: string
          corrected_clock_in?: string | null
          corrected_clock_out?: string | null
          employee_id?: string
          id?: string
          organization_id?: string
          reason?: string
          request_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forma_attendance_adjustments_organization_id_applied_by_fkey"
            columns: ["organization_id", "applied_by"]
            isOneToOne: false
            referencedRelation: "forma_employees"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "forma_attendance_adjustments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "forma_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forma_attendance_adjustments_organization_id_request_id_em_fkey"
            columns: ["organization_id", "request_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "forma_requests"
            referencedColumns: ["organization_id", "id", "employee_id"]
          },
          {
            foreignKeyName: "forma_attendance_adjustments_organization_id_session_id_em_fkey"
            columns: ["organization_id", "session_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "forma_attendance_sessions"
            referencedColumns: ["organization_id", "id", "employee_id"]
          },
        ]
      }
      forma_attendance_events: {
        Row: {
          accuracy_meters: number | null
          employee_id: string
          event_type: string
          geofence: string | null
          id: string
          idempotency_key: string
          latitude: number | null
          longitude: number | null
          organization_id: string
          recorded_at: string
          selfie_path: string | null
          session_id: string
          verification: string
        }
        Insert: {
          accuracy_meters?: number | null
          employee_id: string
          event_type: string
          geofence?: string | null
          id?: string
          idempotency_key: string
          latitude?: number | null
          longitude?: number | null
          organization_id: string
          recorded_at?: string
          selfie_path?: string | null
          session_id: string
          verification: string
        }
        Update: {
          accuracy_meters?: number | null
          employee_id?: string
          event_type?: string
          geofence?: string | null
          id?: string
          idempotency_key?: string
          latitude?: number | null
          longitude?: number | null
          organization_id?: string
          recorded_at?: string
          selfie_path?: string | null
          session_id?: string
          verification?: string
        }
        Relationships: [
          {
            foreignKeyName: "forma_attendance_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "forma_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forma_attendance_events_organization_id_session_id_employe_fkey"
            columns: ["organization_id", "session_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "forma_attendance_sessions"
            referencedColumns: ["organization_id", "id", "employee_id"]
          },
        ]
      }
      forma_attendance_policies: {
        Row: {
          allow_overtime: boolean
          grace_minutes: number
          max_accuracy_meters: number
          organization_id: string
          require_selfie: boolean
        }
        Insert: {
          allow_overtime?: boolean
          grace_minutes?: number
          max_accuracy_meters?: number
          organization_id: string
          require_selfie?: boolean
        }
        Update: {
          allow_overtime?: boolean
          grace_minutes?: number
          max_accuracy_meters?: number
          organization_id?: string
          require_selfie?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "forma_attendance_policies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "forma_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      forma_attendance_sessions: {
        Row: {
          clock_in: string | null
          clock_out: string | null
          duration_minutes: number
          early_departure_minutes: number
          employee_id: string
          id: string
          late_minutes: number
          organization_id: string
          overtime_minutes: number
          schedule_id: string
          status: string
        }
        Insert: {
          clock_in?: string | null
          clock_out?: string | null
          duration_minutes?: number
          early_departure_minutes?: number
          employee_id: string
          id?: string
          late_minutes?: number
          organization_id: string
          overtime_minutes?: number
          schedule_id: string
          status: string
        }
        Update: {
          clock_in?: string | null
          clock_out?: string | null
          duration_minutes?: number
          early_departure_minutes?: number
          employee_id?: string
          id?: string
          late_minutes?: number
          organization_id?: string
          overtime_minutes?: number
          schedule_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "forma_attendance_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "forma_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forma_attendance_sessions_organization_id_schedule_id_empl_fkey"
            columns: ["organization_id", "schedule_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "forma_schedules"
            referencedColumns: ["organization_id", "id", "employee_id"]
          },
        ]
      }
      forma_audit_logs: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          details: Json
          entity_id: string
          id: string
          organization_id: string
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          details?: Json
          entity_id: string
          id?: string
          organization_id: string
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          details?: Json
          entity_id?: string
          id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forma_audit_logs_organization_id_actor_id_fkey"
            columns: ["organization_id", "actor_id"]
            isOneToOne: false
            referencedRelation: "forma_employees"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "forma_audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "forma_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      forma_departments: {
        Row: {
          id: string
          name: string
          organization_id: string
        }
        Insert: {
          id?: string
          name: string
          organization_id: string
        }
        Update: {
          id?: string
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forma_departments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "forma_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      forma_employees: {
        Row: {
          active: boolean
          auth_user_id: string | null
          avatar_path: string | null
          created_at: string
          department_id: string | null
          email: string
          employment_status: string
          id: string
          location_id: string | null
          name: string
          organization_id: string
          role: string
          title: string
        }
        Insert: {
          active?: boolean
          auth_user_id?: string | null
          avatar_path?: string | null
          created_at?: string
          department_id?: string | null
          email: string
          employment_status?: string
          id?: string
          location_id?: string | null
          name: string
          organization_id: string
          role?: string
          title?: string
        }
        Update: {
          active?: boolean
          auth_user_id?: string | null
          avatar_path?: string | null
          created_at?: string
          department_id?: string | null
          email?: string
          employment_status?: string
          id?: string
          location_id?: string | null
          name?: string
          organization_id?: string
          role?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "forma_employees_organization_id_department_id_fkey"
            columns: ["organization_id", "department_id"]
            isOneToOne: false
            referencedRelation: "forma_departments"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "forma_employees_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "forma_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forma_employees_organization_id_location_id_fkey"
            columns: ["organization_id", "location_id"]
            isOneToOne: false
            referencedRelation: "forma_locations"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      forma_leave_entitlements: {
        Row: {
          annual_days: number
          employee_id: string
          id: string
          leave_year: number
          organization_id: string
        }
        Insert: {
          annual_days: number
          employee_id: string
          id?: string
          leave_year: number
          organization_id: string
        }
        Update: {
          annual_days?: number
          employee_id?: string
          id?: string
          leave_year?: number
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forma_leave_entitlements_organization_id_employee_id_fkey"
            columns: ["organization_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "forma_employees"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "forma_leave_entitlements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "forma_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      forma_locations: {
        Row: {
          active: boolean
          address: string
          id: string
          latitude: number
          longitude: number
          name: string
          organization_id: string
          radius_meters: number
        }
        Insert: {
          active?: boolean
          address?: string
          id?: string
          latitude: number
          longitude: number
          name: string
          organization_id: string
          radius_meters: number
        }
        Update: {
          active?: boolean
          address?: string
          id?: string
          latitude?: number
          longitude?: number
          name?: string
          organization_id?: string
          radius_meters?: number
        }
        Relationships: [
          {
            foreignKeyName: "forma_locations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "forma_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      forma_notifications: {
        Row: {
          category: string
          created_at: string
          employee_id: string
          id: string
          message: string
          organization_id: string
          read_at: string | null
          title: string
        }
        Insert: {
          category: string
          created_at?: string
          employee_id: string
          id?: string
          message: string
          organization_id: string
          read_at?: string | null
          title: string
        }
        Update: {
          category?: string
          created_at?: string
          employee_id?: string
          id?: string
          message?: string
          organization_id?: string
          read_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "forma_notifications_organization_id_employee_id_fkey"
            columns: ["organization_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "forma_employees"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "forma_notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "forma_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      forma_organizations: {
        Row: {
          created_at: string
          id: string
          locale: string
          name: string
          timezone: string
          workweek: number[]
        }
        Insert: {
          created_at?: string
          id?: string
          locale?: string
          name: string
          timezone?: string
          workweek?: number[]
        }
        Update: {
          created_at?: string
          id?: string
          locale?: string
          name?: string
          timezone?: string
          workweek?: number[]
        }
        Relationships: []
      }
      forma_requests: {
        Row: {
          attachment_path: string | null
          attendance_date: string | null
          created_at: string
          employee_id: string
          end_date: string | null
          id: string
          kind: string
          organization_id: string
          reason: string
          request_type: string
          requested_time: string | null
          start_date: string | null
          status: string
          working_days: number | null
        }
        Insert: {
          attachment_path?: string | null
          attendance_date?: string | null
          created_at?: string
          employee_id: string
          end_date?: string | null
          id?: string
          kind: string
          organization_id: string
          reason: string
          request_type: string
          requested_time?: string | null
          start_date?: string | null
          status?: string
          working_days?: number | null
        }
        Update: {
          attachment_path?: string | null
          attendance_date?: string | null
          created_at?: string
          employee_id?: string
          end_date?: string | null
          id?: string
          kind?: string
          organization_id?: string
          reason?: string
          request_type?: string
          requested_time?: string | null
          start_date?: string | null
          status?: string
          working_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "forma_requests_organization_id_employee_id_fkey"
            columns: ["organization_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "forma_employees"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "forma_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "forma_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      forma_schedules: {
        Row: {
          arrangement: string
          day_off: boolean
          employee_id: string
          id: string
          location_id: string | null
          organization_id: string
          scheduled_end: string
          scheduled_start: string
          shift_id: string
          work_date: string
        }
        Insert: {
          arrangement?: string
          day_off?: boolean
          employee_id: string
          id?: string
          location_id?: string | null
          organization_id: string
          scheduled_end: string
          scheduled_start: string
          shift_id: string
          work_date: string
        }
        Update: {
          arrangement?: string
          day_off?: boolean
          employee_id?: string
          id?: string
          location_id?: string | null
          organization_id?: string
          scheduled_end?: string
          scheduled_start?: string
          shift_id?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "forma_schedules_organization_id_employee_id_fkey"
            columns: ["organization_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "forma_employees"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "forma_schedules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "forma_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forma_schedules_organization_id_location_id_fkey"
            columns: ["organization_id", "location_id"]
            isOneToOne: false
            referencedRelation: "forma_locations"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "forma_schedules_organization_id_shift_id_fkey"
            columns: ["organization_id", "shift_id"]
            isOneToOne: false
            referencedRelation: "forma_shifts"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      forma_shifts: {
        Row: {
          break_minutes: number
          end_time: string
          grace_minutes: number
          id: string
          location_required: boolean
          name: string
          organization_id: string
          shift_type: string
          start_time: string
        }
        Insert: {
          break_minutes?: number
          end_time: string
          grace_minutes?: number
          id?: string
          location_required?: boolean
          name: string
          organization_id: string
          shift_type?: string
          start_time: string
        }
        Update: {
          break_minutes?: number
          end_time?: string
          grace_minutes?: number
          id?: string
          location_required?: boolean
          name?: string
          organization_id?: string
          shift_type?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "forma_shifts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "forma_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      forma_can_read_employee: {
        Args: { target_employee: string; target_organization: string }
        Returns: boolean
      }
      forma_is_admin: {
        Args: { target_organization: string }
        Returns: boolean
      }
      forma_is_member: {
        Args: { target_organization: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
