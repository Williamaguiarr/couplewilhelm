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
      admin_configs: {
        Row: {
          admin_id: string
          ativo: boolean
          comissao_cw: number
          cor_primaria: string
          cor_secundaria: string
          cor_texto: string
          created_at: string
          id: string
          logo_url: string | null
          nome_empresa: string | null
          slug: string
          ultimo_pagamento: string | null
          updated_at: string
        }
        Insert: {
          admin_id: string
          ativo?: boolean
          comissao_cw?: number
          cor_primaria?: string
          cor_secundaria?: string
          cor_texto?: string
          created_at?: string
          id?: string
          logo_url?: string | null
          nome_empresa?: string | null
          slug: string
          ultimo_pagamento?: string | null
          updated_at?: string
        }
        Update: {
          admin_id?: string
          ativo?: boolean
          comissao_cw?: number
          cor_primaria?: string
          cor_secundaria?: string
          cor_texto?: string
          created_at?: string
          id?: string
          logo_url?: string | null
          nome_empresa?: string | null
          slug?: string
          ultimo_pagamento?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      admin_proprietarios: {
        Row: {
          admin_id: string
          created_at: string
          id: string
          proprietario_id: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          id?: string
          proprietario_id: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          id?: string
          proprietario_id?: string
        }
        Relationships: []
      }
      custos_fixos_proprietario: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          imovel_id: string
          label: string | null
          proprietario_id: string
          tipo: string
          updated_at: string
          valor: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          imovel_id: string
          label?: string | null
          proprietario_id: string
          tipo: string
          updated_at?: string
          valor?: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          imovel_id?: string
          label?: string | null
          proprietario_id?: string
          tipo?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "custos_fixos_proprietario_imovel_id_fkey"
            columns: ["imovel_id"]
            isOneToOne: false
            referencedRelation: "imoveis"
            referencedColumns: ["id"]
          },
        ]
      }
      despesas_extras: {
        Row: {
          created_at: string
          data: string
          descricao: string
          id: string
          imovel_id: string
          tipo: string
          valor: number
        }
        Insert: {
          created_at?: string
          data?: string
          descricao: string
          id?: string
          imovel_id: string
          tipo?: string
          valor?: number
        }
        Update: {
          created_at?: string
          data?: string
          descricao?: string
          id?: string
          imovel_id?: string
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "despesas_extras_imovel_id_fkey"
            columns: ["imovel_id"]
            isOneToOne: false
            referencedRelation: "imoveis"
            referencedColumns: ["id"]
          },
        ]
      }
      imoveis: {
        Row: {
          admin_id: string | null
          created_at: string | null
          endereco: string | null
          ical_last_sync: string | null
          ical_url_airbnb: string | null
          ical_url_booking: string | null
          id: string
          nome_imovel: string
          proprietario_id: string | null
          proprietario_id_2: string | null
        }
        Insert: {
          admin_id?: string | null
          created_at?: string | null
          endereco?: string | null
          ical_last_sync?: string | null
          ical_url_airbnb?: string | null
          ical_url_booking?: string | null
          id?: string
          nome_imovel: string
          proprietario_id?: string | null
          proprietario_id_2?: string | null
        }
        Update: {
          admin_id?: string | null
          created_at?: string | null
          endereco?: string | null
          ical_last_sync?: string | null
          ical_url_airbnb?: string | null
          ical_url_booking?: string | null
          id?: string
          nome_imovel?: string
          proprietario_id?: string | null
          proprietario_id_2?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "imoveis_proprietario_id_2_fkey"
            columns: ["proprietario_id_2"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imoveis_proprietario_id_fkey"
            columns: ["proprietario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          comissao_percentual: number
          created_at: string | null
          email: string | null
          id: string
          nome: string | null
        }
        Insert: {
          comissao_percentual?: number
          created_at?: string | null
          email?: string | null
          id: string
          nome?: string | null
        }
        Update: {
          comissao_percentual?: number
          created_at?: string | null
          email?: string | null
          id?: string
          nome?: string | null
        }
        Relationships: []
      }
      reservas: {
        Row: {
          comissao_plataforma: number | null
          created_at: string | null
          data_fim: string
          data_inicio: string
          id: string
          imovel_id: string
          nome_hospede: string | null
          num_hospedes: number | null
          observacoes: string | null
          plataforma_origem: string | null
          taxa_limpeza: number | null
          valor_bruto: number | null
          valor_liquido_proprietario: number | null
        }
        Insert: {
          comissao_plataforma?: number | null
          created_at?: string | null
          data_fim: string
          data_inicio: string
          id?: string
          imovel_id: string
          nome_hospede?: string | null
          num_hospedes?: number | null
          observacoes?: string | null
          plataforma_origem?: string | null
          taxa_limpeza?: number | null
          valor_bruto?: number | null
          valor_liquido_proprietario?: number | null
        }
        Update: {
          comissao_plataforma?: number | null
          created_at?: string | null
          data_fim?: string
          data_inicio?: string
          id?: string
          imovel_id?: string
          nome_hospede?: string | null
          num_hospedes?: number | null
          observacoes?: string | null
          plataforma_origem?: string | null
          taxa_limpeza?: number | null
          valor_bruto?: number | null
          valor_liquido_proprietario?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reservas_imovel_id_fkey"
            columns: ["imovel_id"]
            isOneToOne: false
            referencedRelation: "imoveis"
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
      is_active_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "proprietario" | "master"
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
      app_role: ["admin", "proprietario", "master"],
    },
  },
} as const
