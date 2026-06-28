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
      anexos: {
        Row: {
          created_at: string
          entidade: string
          entidade_id: string
          id: string
          mime: string | null
          nome: string
          path: string
          tamanho: number | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          entidade: string
          entidade_id: string
          id?: string
          mime?: string | null
          nome: string
          path: string
          tamanho?: number | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          entidade?: string
          entidade_id?: string
          id?: string
          mime?: string | null
          nome?: string
          path?: string
          tamanho?: number | null
          uploaded_by?: string | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          acao: string
          created_at: string
          dados_antes: Json | null
          dados_depois: Json | null
          entidade: string
          entidade_id: string | null
          id: string
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          dados_antes?: Json | null
          dados_depois?: Json | null
          entidade: string
          entidade_id?: string | null
          id?: string
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          dados_antes?: Json | null
          dados_depois?: Json | null
          entidade?: string
          entidade_id?: string | null
          id?: string
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      clientes: {
        Row: {
          created_at: string
          id: string
          nif: string | null
          nome: string
          telefone: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          nif?: string | null
          nome: string
          telefone?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          nif?: string | null
          nome?: string
          telefone?: string | null
        }
        Relationships: []
      }
      colaboradores: {
        Row: {
          ativo: boolean
          cargo: string | null
          created_at: string
          email: string | null
          id: string
          nome: string
          telefone: string | null
        }
        Insert: {
          ativo?: boolean
          cargo?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nome: string
          telefone?: string | null
        }
        Update: {
          ativo?: boolean
          cargo?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
          telefone?: string | null
        }
        Relationships: []
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
      fornecedores: {
        Row: {
          ativo: boolean
          created_at: string
          email: string | null
          id: string
          morada: string | null
          nif: string | null
          nome: string
          telefone: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          email?: string | null
          id?: string
          morada?: string | null
          nif?: string | null
          nome: string
          telefone?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          email?: string | null
          id?: string
          morada?: string | null
          nif?: string | null
          nome?: string
          telefone?: string | null
        }
        Relationships: []
      }
      lancamentos: {
        Row: {
          adenda_rubrica_id: string | null
          created_at: string
          data: string
          descricao: string
          fornecedor: string | null
          fornecedor_id: string | null
          id: string
          num_documento: string | null
          obra_id: string
          preco_unitario: number | null
          quantidade: number | null
          registado_por: string | null
          rubrica_id: string | null
          rubrica_nome: string | null
          unidade_id: string | null
          valor: number
        }
        Insert: {
          adenda_rubrica_id?: string | null
          created_at?: string
          data?: string
          descricao?: string
          fornecedor?: string | null
          fornecedor_id?: string | null
          id?: string
          num_documento?: string | null
          obra_id: string
          preco_unitario?: number | null
          quantidade?: number | null
          registado_por?: string | null
          rubrica_id?: string | null
          rubrica_nome?: string | null
          unidade_id?: string | null
          valor?: number
        }
        Update: {
          adenda_rubrica_id?: string | null
          created_at?: string
          data?: string
          descricao?: string
          fornecedor?: string | null
          fornecedor_id?: string | null
          id?: string
          num_documento?: string | null
          obra_id?: string
          preco_unitario?: number | null
          quantidade?: number | null
          registado_por?: string | null
          rubrica_id?: string | null
          rubrica_nome?: string | null
          unidade_id?: string | null
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
            foreignKeyName: "lancamentos_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
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
          {
            foreignKeyName: "lancamentos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          chave: string | null
          corpo: string | null
          created_at: string
          id: string
          lida: boolean
          link: string | null
          tipo: string
          titulo: string
          user_id: string
        }
        Insert: {
          chave?: string | null
          corpo?: string | null
          created_at?: string
          id?: string
          lida?: boolean
          link?: string | null
          tipo: string
          titulo: string
          user_id: string
        }
        Update: {
          chave?: string | null
          corpo?: string | null
          created_at?: string
          id?: string
          lida?: boolean
          link?: string | null
          tipo?: string
          titulo?: string
          user_id?: string
        }
        Relationships: []
      }
      obra_estado_log: {
        Row: {
          alterado_em: string
          alterado_por: string | null
          estado_anterior: string | null
          estado_novo: string
          id: string
          obra_id: string
        }
        Insert: {
          alterado_em?: string
          alterado_por?: string | null
          estado_anterior?: string | null
          estado_novo: string
          id?: string
          obra_id: string
        }
        Update: {
          alterado_em?: string
          alterado_por?: string | null
          estado_anterior?: string | null
          estado_novo?: string
          id?: string
          obra_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_estado_log_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_snapshots_mensais: {
        Row: {
          ano: number
          created_at: string
          custo_acumulado: number
          faturado_acumulado: number
          id: string
          margem: number
          margem_pct: number | null
          mes: number
          obra_id: string
          orcamento_total: number
        }
        Insert: {
          ano: number
          created_at?: string
          custo_acumulado?: number
          faturado_acumulado?: number
          id?: string
          margem?: number
          margem_pct?: number | null
          mes: number
          obra_id: string
          orcamento_total?: number
        }
        Update: {
          ano?: number
          created_at?: string
          custo_acumulado?: number
          faturado_acumulado?: number
          id?: string
          margem?: number
          margem_pct?: number | null
          mes?: number
          obra_id?: string
          orcamento_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "obra_snapshots_mensais_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
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
          cliente_id: string | null
          created_at: string
          data_fim_previsto: string | null
          data_inicio: string | null
          estado: Database["public"]["Enums"]["obra_estado"]
          id: string
          localizacao: string | null
          nome: string
          orcamento_cliente: number
          prazo_dias: number | null
          responsavel_cliente: string | null
          responsavel_interno_id: string | null
        }
        Insert: {
          cliente: string
          cliente_id?: string | null
          created_at?: string
          data_fim_previsto?: string | null
          data_inicio?: string | null
          estado?: Database["public"]["Enums"]["obra_estado"]
          id?: string
          localizacao?: string | null
          nome: string
          orcamento_cliente?: number
          prazo_dias?: number | null
          responsavel_cliente?: string | null
          responsavel_interno_id?: string | null
        }
        Update: {
          cliente?: string
          cliente_id?: string | null
          created_at?: string
          data_fim_previsto?: string | null
          data_inicio?: string | null
          estado?: Database["public"]["Enums"]["obra_estado"]
          id?: string
          localizacao?: string | null
          nome?: string
          orcamento_cliente?: number
          prazo_dias?: number | null
          responsavel_cliente?: string | null
          responsavel_interno_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "obras_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obras_responsavel_interno_id_fkey"
            columns: ["responsavel_interno_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
        ]
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
          parent_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          obra_id: string
          orcamento_interno?: number
          parent_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          obra_id?: string
          orcamento_interno?: number
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rubricas_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rubricas_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "rubricas"
            referencedColumns: ["id"]
          },
        ]
      }
      rubricas_padrao: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          ordem: number
          parent_id: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          parent_id?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rubricas_padrao_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "rubricas_padrao"
            referencedColumns: ["id"]
          },
        ]
      }
      unidades: {
        Row: {
          id: string
          nome: string
          ordem: number
          sigla: string
        }
        Insert: {
          id?: string
          nome: string
          ordem?: number
          sigla: string
        }
        Update: {
          id?: string
          nome?: string
          ordem?: number
          sigla?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      gerar_notificacoes: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_gestor: { Args: { _user_id: string }; Returns: boolean }
      pode_ver_anexo: {
        Args: { _entidade: string; _entidade_id: string; _user_id: string }
        Returns: boolean
      }
      snapshot_obras_mes: {
        Args: { _ano: number; _mes: number }
        Returns: number
      }
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
