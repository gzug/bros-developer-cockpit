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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ideas: {
        Row: {
          block_reason: string | null
          body: string
          created_at: string
          error_message: string | null
          github_issue_number: number | null
          github_issue_url: string | null
          github_pr_number: number | null
          github_pr_url: string | null
          id: string
          intent: Database["public"]["Enums"]["contribution_intent"] | null
          last_polled_at: string | null
          req_id: string | null
          screen: string | null
          should: string | null
          status: Database["public"]["Enums"]["idea_status"]
          title: string
          updated_at: string
          user_id: string
          wrong: string | null
        }
        Insert: {
          block_reason?: string | null
          body: string
          created_at?: string
          error_message?: string | null
          github_issue_number?: number | null
          github_issue_url?: string | null
          github_pr_number?: number | null
          github_pr_url?: string | null
          id?: string
          intent?: Database["public"]["Enums"]["contribution_intent"] | null
          last_polled_at?: string | null
          req_id?: string | null
          screen?: string | null
          should?: string | null
          status?: Database["public"]["Enums"]["idea_status"]
          title: string
          updated_at?: string
          user_id: string
          wrong?: string | null
        }
        Update: {
          block_reason?: string | null
          body?: string
          created_at?: string
          error_message?: string | null
          github_issue_number?: number | null
          github_issue_url?: string | null
          github_pr_number?: number | null
          github_pr_url?: string | null
          id?: string
          intent?: Database["public"]["Enums"]["contribution_intent"] | null
          last_polled_at?: string | null
          req_id?: string | null
          screen?: string | null
          should?: string | null
          status?: Database["public"]["Enums"]["idea_status"]
          title?: string
          updated_at?: string
          user_id?: string
          wrong?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      app_config: {
        Row: {
          allowed_paths: string[]
          bdc_paused: boolean
          forbidden_paths: string[]
          id: boolean
          pause_reason: string | null
          prompt_template: string
          routing_map: Json
          template_version: string
          updated_at: string
        }
        Insert: {
          allowed_paths?: string[]
          bdc_paused?: boolean
          forbidden_paths?: string[]
          id?: boolean
          pause_reason?: string | null
          prompt_template?: string
          routing_map?: Json
          template_version?: string
          updated_at?: string
        }
        Update: {
          allowed_paths?: string[]
          bdc_paused?: boolean
          forbidden_paths?: string[]
          id?: boolean
          pause_reason?: string | null
          prompt_template?: string
          routing_map?: Json
          template_version?: string
          updated_at?: string
        }
        Relationships: []
      }
      task_log: {
        Row: {
          attempt_number: number
          base_sha: string | null
          blocked_reason: string | null
          created_at: string
          escalated_from: string | null
          id: string
          idea_id: string | null
          intent: Database["public"]["Enums"]["contribution_intent"] | null
          model_requested: string | null
          model_served: string | null
          pr_number: number | null
          pr_url: string | null
          provider: string | null
          req_id: string | null
          template_version: string | null
          tier: string | null
          tokens_completion: number | null
          tokens_prompt: number | null
          validate_result: string | null
        }
        Insert: {
          attempt_number?: number
          base_sha?: string | null
          blocked_reason?: string | null
          created_at?: string
          escalated_from?: string | null
          id?: string
          idea_id?: string | null
          intent?: Database["public"]["Enums"]["contribution_intent"] | null
          model_requested?: string | null
          model_served?: string | null
          pr_number?: number | null
          pr_url?: string | null
          provider?: string | null
          req_id?: string | null
          template_version?: string | null
          tier?: string | null
          tokens_completion?: number | null
          tokens_prompt?: number | null
          validate_result?: string | null
        }
        Update: {
          attempt_number?: number
          base_sha?: string | null
          blocked_reason?: string | null
          created_at?: string
          escalated_from?: string | null
          id?: string
          idea_id?: string | null
          intent?: Database["public"]["Enums"]["contribution_intent"] | null
          model_requested?: string | null
          model_served?: string | null
          pr_number?: number | null
          pr_url?: string | null
          provider?: string | null
          req_id?: string | null
          template_version?: string | null
          tier?: string | null
          tokens_completion?: number | null
          tokens_prompt?: number | null
          validate_result?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_log_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
        ]
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
      app_role: "owner" | "reviewer"
      contribution_intent: "wording" | "look" | "wrong" | "idea"
      idea_status:
        | "draft"
        | "generating"
        | "ready"
        | "shipping"
        | "shipped"
        | "failed"
        | "blocked_native"
        | "saved"
        | "sent"
        | "reviewing"
        | "live"
        | "reverted"
        | "blocked"
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
      app_role: ["owner", "reviewer"],
      contribution_intent: ["wording", "look", "wrong", "idea"],
      idea_status: [
        "draft",
        "generating",
        "ready",
        "shipping",
        "shipped",
        "failed",
        "blocked_native",
        "saved",
        "sent",
        "reviewing",
        "live",
        "reverted",
        "blocked",
      ],
    },
  },
} as const
