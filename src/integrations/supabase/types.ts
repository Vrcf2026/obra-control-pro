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
      adenda_rubricas: {
        Row: {
          adenda_id: string
          created_at: string
          id: string
          nome: string
          valor: number
        }
        Insert: {
          adenda_id: string
          created_at?: string
          id?: string
          nome: string
          valor?: number
        }
        Update: {
          adenda_id?: string
          created_at?: string
          id?: string
          nome?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "adenda_rubricas_adenda_id_fkey"
            columns: ["adenda_id"]
            isOneToOne: false
            referencedRelation: "adendas"
            referencedColumns: ["id"]
          },
        ]
      }
      adendas: {
        Row: {
          created_at: string
          data: string
          descricao: string
          id: string
          obra_id: string
          tipo: string
          valor_cliente: number
        }
        Insert: {
          created_at?: string
          data?: string
          descricao: string
          id?: string
          obra_id: string
          tipo?: string
          valor_cliente?: number
        }
        Update: {
          created_at?: string
          data?: string
          descricao?: string
          id?: string
          obra_id?: string
          tipo?: string
          valor_cliente?: number
        }
        Relationships: [
          {
            foreignKeyName: "adendas_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      faturas_emitidas: {
        Row: {
          created_at: string
          data: string
          descricao: string | null
          id: string
          num_fatura: string
          obra_id: string
          valor: number
        }
        Insert: {
          created_at?: string
          data?: string
          descricao?: string | null
          id?: string
          num_fatura: string
          obra_id: string
          valor?: number
        }
        Update: {
          created_at?: string
          data?: string
          descricao?: string | null
          id?: string
          num_fatura?: string
          obra_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "faturas_emitidas_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      lancamentos: {
        Row: {
          adenda_rubrica_id: string | null
          created_at: string
          data: string
          descricao: string
          fornecedor: string | null
          id: string
          obra_id: string
          registado_por: string | null
          rubrica_id: string | null
          valor: number
        }
        Insert: {
          adenda_rubrica_id?: string | null
          created_at?: string
          data?: string
          descricao?: string
          fornecedor?: string | null
          id?: string
          obra_id: string
          registado_por?: string | null
          rubrica_id?: string | null
          valor?: number
        }
        Update: {
          adenda_rubrica_id?: string | null
          created_at?: string
          data?: string
          descricao?: string
          fornecedor?: string | null
          id?: string
          obra_id?: string
          registado_por?: string | null
          rubrica_id?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "lancamentos_adenda_rubrica_id_fkey"
            columns: ["adenda_rubrica_id"]
            isOneToOne: false
            referencedRelation: "adenda_rubricas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_rubrica_id_fkey"
            columns: ["rubrica_id"]
            isOneToOne: false
            referencedRelation: "rubricas"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_utilizadores: {
        Row: {
          created_at: string
          id: string
          obra_id: string
          perfil: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          obra_id: string
          perfil?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          obra_id?: string
          perfil?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_utilizadores_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      obras: {
        Row: {
          cliente: string
          created_at: string
          data_fim_previsto: string | null
          data_inicio: string | null
          estado: Database["public"]["Enums"]["obra_estado"]
          id: string
          localizacao: string | null
          nome: string
          orcamento_cliente: number
        }
        Insert: {
          cliente: string
          created_at?: string
          data_fim_previsto?: string | null
          data_inicio?: string | null
          estado?: Database["public"]["Enums"]["obra_estado"]
          id?: string
          localizacao?: string | null
          nome: string
          orcamento_cliente?: number
        }
        Update: {
          cliente?: string
          created_at?: string
          data_fim_previsto?: string | null
          data_inicio?: string | null
          estado?: Database["public"]["Enums"]["obra_estado"]
          id?: string
          localizacao?: string | null
          nome?: string
          orcamento_cliente?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          nome?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      rubricas: {
        Row: {
          created_at: string
          id: string
          nome: string
          obra_id: string
          orcamento_interno: number
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          obra_id: string
          orcamento_interno?: number
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          obra_id?: string
          orcamento_interno?: number
        }
        Relationships: [
          {
            foreignKeyName: "rubricas_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
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
      is_admin_or_gestor: { Args: { _user_id: string }; Returns: boolean }
      user_has_obra: {
        Args: { _obra_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "gestor" | "encarregado"
      obra_estado:
        | "orcamentacao"
        | "adjudicada"
        | "em_curso"
        | "concluida"
        | "faturada"
      rubrica_tipo:
        | "mao_de_obra"
        | "materiais"
        | "subempreitada"
        | "equipamento"
        | "outro"
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
      app_role: ["admin", "gestor", "encarregado"],
      obra_estado: [
        "orcamentacao",
        "adjudicada",
        "em_curso",
        "concluida",
        "faturada",
      ],
      rubrica_tipo: [
        "mao_de_obra",
        "materiais",
        "subempreitada",
        "equipamento",
        "outro",
      ],
    },
  },
} as const
