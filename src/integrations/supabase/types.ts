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
          relatorio_diario_ativo: boolean
          relatorio_diario_email: string | null
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
          relatorio_diario_ativo?: boolean
          relatorio_diario_email?: string | null
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
          relatorio_diario_ativo?: boolean
          relatorio_diario_email?: string | null
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
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      ganhos_extras: {
        Row: {
          aplicar_comissao: boolean
          created_at: string
          data: string
          descricao: string
          id: string
          imovel_id: string
          regime_comissao: string | null
          reserva_id: string | null
          tipo: string
          updated_at: string
          valor: number
        }
        Insert: {
          aplicar_comissao?: boolean
          created_at?: string
          data?: string
          descricao: string
          id?: string
          imovel_id: string
          regime_comissao?: string | null
          reserva_id?: string | null
          tipo?: string
          updated_at?: string
          valor?: number
        }
        Update: {
          aplicar_comissao?: boolean
          created_at?: string
          data?: string
          descricao?: string
          id?: string
          imovel_id?: string
          regime_comissao?: string | null
          reserva_id?: string | null
          tipo?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "ganhos_extras_imovel_id_fkey"
            columns: ["imovel_id"]
            isOneToOne: false
            referencedRelation: "imoveis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ganhos_extras_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: false
            referencedRelation: "reservas"
            referencedColumns: ["id"]
          },
        ]
      }
      historico_auditoria: {
        Row: {
          created_at: string
          data_auditoria: string
          id: string
          reserva_id: string
          usuario_id: string
          valores_anteriores: Json | null
          valores_congelados: Json | null
        }
        Insert: {
          created_at?: string
          data_auditoria?: string
          id?: string
          reserva_id: string
          usuario_id: string
          valores_anteriores?: Json | null
          valores_congelados?: Json | null
        }
        Update: {
          created_at?: string
          data_auditoria?: string
          id?: string
          reserva_id?: string
          usuario_id?: string
          valores_anteriores?: Json | null
          valores_congelados?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "historico_auditoria_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: false
            referencedRelation: "reservas"
            referencedColumns: ["id"]
          },
        ]
      }
      ical_sync_alerts: {
        Row: {
          created_at: string
          id: string
          imovel_id: string
          mensagem_erro: string | null
          plataforma: string
          reserva_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          imovel_id: string
          mensagem_erro?: string | null
          plataforma: string
          reserva_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          imovel_id?: string
          mensagem_erro?: string | null
          plataforma?: string
          reserva_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ical_sync_alerts_imovel_id_fkey"
            columns: ["imovel_id"]
            isOneToOne: false
            referencedRelation: "imoveis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ical_sync_alerts_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: false
            referencedRelation: "reservas"
            referencedColumns: ["id"]
          },
        ]
      }
      imoveis: {
        Row: {
          admin_id: string | null
          airbnb_image_url: string | null
          airbnb_link: string | null
          airbnb_title: string | null
          created_at: string | null
          endereco: string | null
          hora_checkin: string | null
          hora_checkout: string | null
          ical_last_sync: string | null
          ical_url_airbnb: string | null
          ical_url_booking: string | null
          id: string
          last_airbnb_sync: string | null
          max_hospedes: number | null
          nome_imovel: string
          observacoes_operacionais: string | null
          proprietario_id: string | null
          proprietario_id_2: string | null
          taxa_comissao: number | null
          tempo_limpeza_min: number | null
        }
        Insert: {
          admin_id?: string | null
          airbnb_image_url?: string | null
          airbnb_link?: string | null
          airbnb_title?: string | null
          created_at?: string | null
          endereco?: string | null
          hora_checkin?: string | null
          hora_checkout?: string | null
          ical_last_sync?: string | null
          ical_url_airbnb?: string | null
          ical_url_booking?: string | null
          id?: string
          last_airbnb_sync?: string | null
          max_hospedes?: number | null
          nome_imovel: string
          observacoes_operacionais?: string | null
          proprietario_id?: string | null
          proprietario_id_2?: string | null
          taxa_comissao?: number | null
          tempo_limpeza_min?: number | null
        }
        Update: {
          admin_id?: string | null
          airbnb_image_url?: string | null
          airbnb_link?: string | null
          airbnb_title?: string | null
          created_at?: string | null
          endereco?: string | null
          hora_checkin?: string | null
          hora_checkout?: string | null
          ical_last_sync?: string | null
          ical_url_airbnb?: string | null
          ical_url_booking?: string | null
          id?: string
          last_airbnb_sync?: string | null
          max_hospedes?: number | null
          nome_imovel?: string
          observacoes_operacionais?: string | null
          proprietario_id?: string | null
          proprietario_id_2?: string | null
          taxa_comissao?: number | null
          tempo_limpeza_min?: number | null
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
      limpezas: {
        Row: {
          concluida_em: string | null
          created_at: string
          data_limpeza: string
          id: string
          imovel_id: string
          observacoes: string | null
          reserva_id: string
          responsavel: string | null
          status: string
          updated_at: string
        }
        Insert: {
          concluida_em?: string | null
          created_at?: string
          data_limpeza: string
          id?: string
          imovel_id: string
          observacoes?: string | null
          reserva_id: string
          responsavel?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          concluida_em?: string | null
          created_at?: string
          data_limpeza?: string
          id?: string
          imovel_id?: string
          observacoes?: string | null
          reserva_id?: string
          responsavel?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          comissao_percentual: number | null
          created_at: string | null
          email: string | null
          id: string
          nome: string | null
        }
        Insert: {
          comissao_percentual?: number | null
          created_at?: string | null
          email?: string | null
          id: string
          nome?: string | null
        }
        Update: {
          comissao_percentual?: number | null
          created_at?: string | null
          email?: string | null
          id?: string
          nome?: string | null
        }
        Relationships: []
      }
      reservas: {
        Row: {
          auditada: boolean | null
          auditada_em: string | null
          auditada_por: string | null
          codigo_reserva: string | null
          comissao_plataforma: number | null
          created_at: string | null
          data_fim: string
          data_inicio: string
          hora_checkin_override: string | null
          hora_checkout_override: string | null
          ical_uid: string | null
          id: string
          imovel_id: string
          nome_hospede: string | null
          num_hospedes: number | null
          observacoes: string | null
          plataforma_origem: string | null
          reserva_url: string | null
          status_reserva: string | null
          taxa_comissao_reserva: number | null
          taxa_limpeza: number | null
          validada_financeiramente: boolean
          valor_base_comissao: number | null
          valor_bruto: number | null
          valor_comissao_admin: number | null
          valor_liquido_proprietario: number | null
        }
        Insert: {
          auditada?: boolean | null
          auditada_em?: string | null
          auditada_por?: string | null
          codigo_reserva?: string | null
          comissao_plataforma?: number | null
          created_at?: string | null
          data_fim: string
          data_inicio: string
          hora_checkin_override?: string | null
          hora_checkout_override?: string | null
          ical_uid?: string | null
          id?: string
          imovel_id: string
          nome_hospede?: string | null
          num_hospedes?: number | null
          observacoes?: string | null
          plataforma_origem?: string | null
          reserva_url?: string | null
          status_reserva?: string | null
          taxa_comissao_reserva?: number | null
          taxa_limpeza?: number | null
          validada_financeiramente?: boolean
          valor_base_comissao?: number | null
          valor_bruto?: number | null
          valor_comissao_admin?: number | null
          valor_liquido_proprietario?: number | null
        }
        Update: {
          auditada?: boolean | null
          auditada_em?: string | null
          auditada_por?: string | null
          codigo_reserva?: string | null
          comissao_plataforma?: number | null
          created_at?: string | null
          data_fim?: string
          data_inicio?: string
          hora_checkin_override?: string | null
          hora_checkout_override?: string | null
          ical_uid?: string | null
          id?: string
          imovel_id?: string
          nome_hospede?: string | null
          num_hospedes?: number | null
          observacoes?: string | null
          plataforma_origem?: string | null
          reserva_url?: string | null
          status_reserva?: string | null
          taxa_comissao_reserva?: number | null
          taxa_limpeza?: number | null
          validada_financeiramente?: boolean
          valor_base_comissao?: number | null
          valor_bruto?: number | null
          valor_comissao_admin?: number | null
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
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
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
      calculate_owner_future_forecast: {
        Args: { p_imovel_id?: string; p_owner_id: string }
        Returns: number
      }
      calculate_reserva_liquido_proprietario: {
        Args: {
          p_comissao_plataforma: number
          p_imovel_id: string
          p_taxa_comissao_reserva?: number
          p_taxa_limpeza: number
          p_valor_bruto: number
        }
        Returns: number
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_active_admin: { Args: { _user_id: string }; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
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
