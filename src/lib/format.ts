export const eur = (n: number | null | undefined) =>
  new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(Number(n ?? 0));

export const pct = (n: number) =>
  `${(Math.round(n * 10) / 10).toFixed(1)}%`;

export const estadoLabel: Record<string, string> = {
  orcamentacao: "Orçamentação",
  adjudicada: "Adjudicada",
  em_curso: "Em curso",
  concluida: "Concluída",
  faturada: "Faturada",
};

export const estadoColor: Record<string, string> = {
  orcamentacao: "bg-muted text-muted-foreground",
  adjudicada: "bg-accent text-accent-foreground",
  em_curso: "bg-primary text-primary-foreground",
  concluida: "bg-success text-success-foreground",
  faturada: "bg-secondary text-secondary-foreground border border-border",
};

export const tipoLabel: Record<string, string> = {
  mao_de_obra: "Mão de obra",
  materiais: "Materiais",
  subempreitada: "Subempreitada",
  equipamento: "Equipamento",
  outro: "Outro",
};
