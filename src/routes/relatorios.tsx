import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/hooks/use-auth";
import { eur } from "@/lib/format";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, Cell, PieChart, Pie, AreaChart, Area,
} from "recharts";
import { TrendingUp, Percent, Wallet, AlertTriangle } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const Route = createFileRoute("/relatorios")({ component: Page });

function Page() {
  return (
    <Protected allow={["admin", "gestor"]}>
      <Relatorios />
    </Protected>
  );
}

interface Obra { id: string; nome: string; cliente: string; localizacao: string | null; estado: string; data_inicio: string | null; data_fim_previsto: string | null; orcamento_cliente: number; }
interface Rubrica { id: string; obra_id: string; nome: string; orcamento_interno: number; }
interface Lanc { id: string; obra_id: string; rubrica_id: string | null; adenda_rubrica_id: string | null; rubrica_nome: string | null; data: string; descricao: string; fornecedor: string | null; valor: number; }
interface Adenda { id: string; obra_id: string; data: string; descricao: string; valor_cliente: number; valor_interno: number; }
interface AdRub { id: string; adenda_id: string; nome: string; valor: number }

const PALETTE = ["#1a5fa8","#16a34a","#dc2626","#d97706","#7c3aed","#0891b2","#be185d","#65a30d","#ea580c","#6366f1"];
const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const ESTADO_LABEL: Record<string,string> = { orcamentacao:"Em orçamentação", adjudicada:"Adjudicada", em_curso:"Em curso", concluida:"Concluída", faturada:"Faturada" };

function Relatorios() {
  const { nome } = useAuth();
  const [obras, setObras] = useState<Obra[]>([]);
  const [rubricas, setRubricas] = useState<Rubrica[]>([]);
  const [lancamentos, setLancamentos] = useState<Lanc[]>([]);
  const [adendas, setAdendas] = useState<Adenda[]>([]);
  const [adRubs, setAdRubs] = useState<AdRub[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [{ data: o }, { data: r }, { data: l }, { data: a }, { data: ar }] = await Promise.all([
      supabase.from("obras").select("*").order("nome"),
      supabase.from("rubricas").select("*"),
      supabase.from("lancamentos").select("*"),
      supabase.from("adendas").select("*"),
      supabase.from("adenda_rubricas").select("id,adenda_id,nome,valor"),
    ]);
    const intMap = new Map<string, number>();
    ((ar ?? []) as AdRub[]).forEach(x => intMap.set(x.adenda_id, (intMap.get(x.adenda_id) ?? 0) + Number(x.valor)));
    setObras((o ?? []) as Obra[]);
    setRubricas((r ?? []) as Rubrica[]);
    setLancamentos(((l ?? []) as Lanc[]).map(x => ({ ...x, valor: Number(x.valor) })));
    setAdendas(((a ?? []) as any[]).map(x => ({ ...x, valor_cliente: Number(x.valor_cliente), valor_interno: intMap.get(x.id) ?? 0 })) as Adenda[]);
    setAdRubs(((ar ?? []) as any[]).map(x => ({ ...x, valor: Number(x.valor) })));
    setLoading(false);
  }

  const obrasActivas = useMemo(
    () => obras.filter(o => ["adjudicada", "em_curso"].includes(o.estado)),
    [obras]
  );

  if (loading) return (
    <div className="p-8 space-y-4">
      <div className="h-8 w-48 bg-muted animate-pulse rounded" />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[0,1,2,3].map(i => <div key={i} className="h-28 bg-muted animate-pulse rounded-lg" />)}
      </div>
      <div className="h-80 bg-muted animate-pulse rounded-lg" />
    </div>
  );

  return (
    <div className="p-4 md:p-8 space-y-6 bg-background">
      <div>
        <h1 className="text-2xl font-semibold">Relatórios</h1>
        <p className="text-sm text-muted-foreground">Dashboard executivo e exportação</p>
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="pdf">Exportar PDF</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-8">
          <Dashboard obras={obras} obrasActivas={obrasActivas} rubricas={rubricas} lancamentos={lancamentos} adendas={adendas} />
        </TabsContent>

        <TabsContent value="pdf" className="space-y-4">
          <ExportarPDF
            obras={obras} rubricas={rubricas} lancamentos={lancamentos} adendas={adendas} adRubs={adRubs}
            geradoPor={nome || "—"}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
// Helpers de cálculo por obra
// ============================================================
function calcObra(o: Obra, rubricas: Rubrica[], adendas: Adenda[], lancamentos: Lanc[]) {
  const orcInt = rubricas.filter(r => r.obra_id === o.id).reduce((s, r) => s + Number(r.orcamento_interno), 0);
  const adObra = adendas.filter(a => a.obra_id === o.id);
  const adCli = adObra.reduce((s, a) => s + a.valor_cliente, 0);
  const adInt = adObra.reduce((s, a) => s + a.valor_interno, 0);
  const fat = Number(o.orcamento_cliente) + adCli;
  const gasto = lancamentos.filter(l => l.obra_id === o.id).reduce((s, l) => s + l.valor, 0);
  const margem = fat - gasto;
  const pct = fat > 0 ? (margem / fat) * 100 : 0;
  return { orcInt, adCli, adInt, fat, gasto, margem, pct };
}

function rubricaNomeLanc(l: Lanc, rubricas: Rubrica[], adRubs: AdRub[]): string {
  if (l.rubrica_id) return rubricas.find(r => r.id === l.rubrica_id)?.nome ?? "—";
  if (l.adenda_rubrica_id) return adRubs.find(a => (a as any).id === l.adenda_rubrica_id)?.nome ?? "Adenda";
  return l.rubrica_nome ?? "Avulsa";
}

// ============================================================
// Dashboard executivo
// ============================================================
function Dashboard({ obras, obrasActivas, rubricas, lancamentos, adendas }: {
  obras: Obra[]; obrasActivas: Obra[]; rubricas: Rubrica[]; lancamentos: Lanc[]; adendas: Adenda[];
}) {
  const anoActual = new Date().getFullYear();
  const [ano, setAno] = useState<number>(anoActual);

  const anosDisponiveis = useMemo(() => {
    const set = new Set<number>([anoActual]);
    lancamentos.forEach(l => set.add(new Date(l.data).getFullYear()));
    return Array.from(set).sort((a,b) => b-a);
  }, [lancamentos, anoActual]);

  // KPIs
  const kpis = useMemo(() => {
    const calcs = obrasActivas.map(o => calcObra(o, rubricas, adendas, lancamentos));
    const totalFat = calcs.reduce((s,c) => s + c.fat, 0);
    const totalGasto = calcs.reduce((s,c) => s + c.gasto, 0);
    const margem = totalFat - totalGasto;
    const margemPct = totalFat > 0 ? (margem / totalFat) * 100 : 0;
    const risco = calcs.filter(c => c.pct < 0).length;
    const atencao = calcs.filter(c => c.pct >= 0 && c.pct < 10).length;
    const gastoAno = lancamentos.filter(l => new Date(l.data).getFullYear() === anoActual).reduce((s,l) => s + l.valor, 0);
    return { totalFat, totalGasto, margem, margemPct, risco, atencao, gastoAno };
  }, [obrasActivas, rubricas, adendas, lancamentos, anoActual]);

  // Gasto mensal por rubrica (ano seleccionado)
  const { mensaisData, rubricasAnoNomes } = useMemo(() => {
    const lancAno = lancamentos.filter(l => new Date(l.data).getFullYear() === ano);
    const ultimoMes = ano === anoActual ? new Date().getMonth() : 11;
    const rubSet = new Set<string>();
    lancAno.forEach(l => rubSet.add(rubricaNomeLanc(l, rubricas, [])));
    const nomes = Array.from(rubSet);
    const data: any[] = [];
    for (let m = 0; m <= ultimoMes; m++) {
      const linha: any = { mes: MESES[m] };
      nomes.forEach(n => linha[n] = 0);
      lancAno.filter(l => new Date(l.data).getMonth() === m).forEach(l => {
        const n = rubricaNomeLanc(l, rubricas, []);
        linha[n] = (linha[n] || 0) + l.valor;
      });
      data.push(linha);
    }
    return { mensaisData: data, rubricasAnoNomes: nomes };
  }, [lancamentos, rubricas, ano, anoActual]);

  // Distribuição por rubrica (donut) — todo o histórico das obras activas
  const donutData = useMemo(() => {
    const ids = new Set(obrasActivas.map(o => o.id));
    const m = new Map<string, number>();
    lancamentos.filter(l => ids.has(l.obra_id)).forEach(l => {
      const n = rubricaNomeLanc(l, rubricas, []);
      m.set(n, (m.get(n) || 0) + l.valor);
    });
    const total = Array.from(m.values()).reduce((s,v) => s + v, 0);
    return Array.from(m.entries())
      .map(([nome, valor]) => ({ nome, valor, pct: total > 0 ? (valor/total)*100 : 0 }))
      .sort((a,b) => b.valor - a.valor);
  }, [obrasActivas, lancamentos, rubricas]);

  // Margem por obra
  const margemData = useMemo(() => {
    return obrasActivas.map(o => {
      const c = calcObra(o, rubricas, adendas, lancamentos);
      const nome = o.nome.length > 20 ? o.nome.slice(0,20) + "…" : o.nome;
      return { nome, pct: Number(c.pct.toFixed(1)), margem: c.margem };
    });
  }, [obrasActivas, rubricas, adendas, lancamentos]);

  // Evolução acumulada gasto vs orçamento interno (ano actual)
  const evolucaoData = useMemo(() => {
    const lancAno = lancamentos.filter(l => new Date(l.data).getFullYear() === anoActual);
    const ultimoMes = new Date().getMonth();
    const orcInternoTotal = obrasActivas.reduce((s,o) => {
      return s + rubricas.filter(r => r.obra_id === o.id).reduce((ss,r) => ss + Number(r.orcamento_interno), 0)
               + adendas.filter(a => a.obra_id === o.id).reduce((ss,a) => ss + a.valor_interno, 0);
    }, 0);
    const orcMensal = orcInternoTotal / 12;
    let acc = 0, accOrc = 0;
    const data: any[] = [];
    for (let m = 0; m <= ultimoMes; m++) {
      const valorMes = lancAno.filter(l => new Date(l.data).getMonth() === m).reduce((s,l) => s + l.valor, 0);
      acc += valorMes;
      accOrc += orcMensal;
      data.push({ mes: MESES[m], gasto: Math.round(acc), previsto: Math.round(accOrc) });
    }
    return data;
  }, [lancamentos, anoActual, obrasActivas, rubricas, adendas]);

  return (
    <div className="space-y-8">
      {/* KPIs */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<TrendingUp className="w-5 h-5" />}
          color="text-blue-500 bg-blue-500/10"
          label="Volume faturável"
          value={eur(kpis.totalFat)}
          sub={`${obrasActivas.length} obras activas`}
        />
        <KpiCard
          icon={<Percent className="w-5 h-5" />}
          color={kpis.margemPct > 15 ? "text-green-500 bg-green-500/10" : kpis.margemPct >= 0 ? "text-yellow-500 bg-yellow-500/10" : "text-red-500 bg-red-500/10"}
          label="Margem média"
          value={`${kpis.margemPct.toFixed(1)}%`}
          sub={eur(kpis.margem)}
          valueColor={kpis.margemPct > 15 ? "text-green-500" : kpis.margemPct >= 0 ? "text-yellow-500" : "text-red-500"}
        />
        <KpiCard
          icon={<Wallet className="w-5 h-5" />}
          color="text-purple-500 bg-purple-500/10"
          label="Gasto acumulado"
          value={eur(kpis.gastoAno)}
          sub="este ano"
        />
        <KpiCard
          icon={<AlertTriangle className="w-5 h-5" />}
          color="text-red-500 bg-red-500/10"
          label="Obras em risco"
          value={String(kpis.risco)}
          sub={<span className="text-yellow-500">{kpis.atencao} em atenção</span>}
          valueColor="text-red-500"
        />
      </section>

      {/* Gasto mensal por rubrica */}
      <Section title="Gasto mensal por rubrica" right={
        <Select value={String(ano)} onValueChange={v => setAno(Number(v))}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            {anosDisponiveis.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
      }>
        {rubricasAnoNomes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem lançamentos em {ano}.</p>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={mensaisData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="mes" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip
                formatter={(v: any, name: any) => [eur(Number(v)), name]}
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {rubricasAnoNomes.map((n, i) => (
                <Bar key={n} dataKey={n} stackId="a" fill={PALETTE[i % PALETTE.length]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </Section>

      {/* Donut + Margem por obra */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section title="Onde vai o dinheiro">
          {donutData.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem gastos.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={donutData} dataKey="valor" nameKey="nome" cx="40%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2}>
                  {donutData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Pie>
                <Tooltip
                  formatter={(v: any, _n: any, p: any) => [`${eur(Number(v))} (${p.payload.pct.toFixed(1)}%)`, p.payload.nome]}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6 }}
                />
                <Legend
                  layout="vertical" align="right" verticalAlign="middle"
                  wrapperStyle={{ fontSize: 12 }}
                  formatter={(_v, _e, i) => `${donutData[i!].nome} · ${donutData[i!].pct.toFixed(1)}%`}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Section>

        <Section title="Margem por obra">
          {margemData.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem obras activas.</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(180, margemData.length * 45 + 60)}>
              <BarChart data={margemData} layout="vertical" margin={{ left: 10, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" unit="%" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis type="category" dataKey="nome" width={140} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  formatter={(_v: any, _n: any, p: any) => [`${eur(p.payload.margem)} · ${p.payload.pct}%`, "Margem"]}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6 }}
                />
                <Bar dataKey="pct" name="Margem %">
                  {margemData.map((d, i) => (
                    <Cell key={i} fill={d.pct > 15 ? "#16a34a" : d.pct >= 0 ? "#d97706" : "#dc2626"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Section>
      </div>

      {/* Evolução acumulada */}
      <Section title="Evolução acumulada do gasto">
        {evolucaoData.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem dados.</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={evolucaoData}>
              <defs>
                <linearGradient id="gastoFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1a5fa8" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#1a5fa8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="mes" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip
                formatter={(v: any, n: any) => [eur(Number(v)), n === "gasto" ? "Gasto real" : "Previsto"]}
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="gasto" name="Gasto real" stroke="#1a5fa8" strokeWidth={2} fill="url(#gastoFill)" />
              <Line type="monotone" dataKey="previsto" name="Previsto" stroke="#94a3b8" strokeWidth={2} strokeDasharray="6 4" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Section>
    </div>
  );
}

function KpiCard({ icon, color, label, value, sub, valueColor }: { icon: React.ReactNode; color: string; label: string; value: string; sub: React.ReactNode; valueColor?: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-5 shadow-sm relative overflow-hidden">
      <div className={`absolute top-4 right-4 w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>{icon}</div>
      <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{label}</div>
      <div className={`text-2xl font-semibold mt-2 tabular-nums ${valueColor ?? ""}`}>{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{sub}</div>
    </div>
  );
}

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-lg p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3 pb-3 mb-4 border-b border-border">
        <h2 className="text-lg font-semibold">{title}</h2>
        {right}
      </div>
      {children}
    </div>
  );
}

// ============================================================
// Tab Exportar PDF
// ============================================================
function ExportarPDF({ obras, rubricas, lancamentos, adendas, adRubs, geradoPor }: {
  obras: Obra[]; rubricas: Rubrica[]; lancamentos: Lanc[]; adendas: Adenda[]; adRubs: AdRub[]; geradoPor: string;
}) {
  const hoje = new Date();
  const [obraId, setObraId] = useState<string>(obras[0]?.id ?? "");
  const [mes, setMes] = useState<number>(hoje.getMonth());
  const [ano, setAno] = useState<number>(hoje.getFullYear());

  const anosDisponiveis = useMemo(() => {
    const set = new Set<number>([hoje.getFullYear()]);
    lancamentos.forEach(l => set.add(new Date(l.data).getFullYear()));
    return Array.from(set).sort((a,b) => b-a);
  }, [lancamentos]);

  function header(doc: jsPDF, titulo: string, sub: string) {
    const w = doc.internal.pageSize.getWidth();
    doc.setFontSize(18); doc.setTextColor(26, 95, 168); doc.setFont("helvetica", "bold");
    doc.text("DECOVERDI, S.A.", 14, 14);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(110);
    doc.text("Gestão de Obras", 14, 19.5);
    doc.setTextColor(0); doc.setFontSize(11); doc.text(titulo, 14, 27);
    doc.setFontSize(9); doc.setTextColor(120);
    doc.text(sub, w - 14, 14, { align: "right" });
    doc.text(`Gerado em ${hoje.toLocaleString("pt-PT")} · por ${geradoPor}`, w - 14, 20, { align: "right" });
    doc.setDrawColor(26, 95, 168); doc.setLineWidth(2);
    doc.line(14, 30, w - 14, 30);
    doc.setTextColor(0);
  }

  function footer(doc: jsPDF) {
    const pages = doc.getNumberOfPages();
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFontSize(8); doc.setTextColor(140);
      doc.text("Decoverdi, S.A. — Documento confidencial", 14, h - 6);
      doc.text(`Página ${i} de ${pages}`, w - 14, h - 6, { align: "right" });
    }
  }

  function kpiBoxes(doc: jsPDF, y: number, items: Array<{ label: string; value: string; color?: [number,number,number] }>) {
    const w = doc.internal.pageSize.getWidth();
    const margin = 14;
    const gap = 4;
    const boxW = (w - margin*2 - gap*(items.length-1)) / items.length;
    items.forEach((it, i) => {
      const x = margin + i * (boxW + gap);
      doc.setFillColor(245, 247, 250);
      doc.roundedRect(x, y, boxW, 22, 2, 2, "F");
      doc.setFontSize(8); doc.setTextColor(110);
      doc.text(it.label.toUpperCase(), x + 4, y + 6);
      doc.setFontSize(13);
      const c = it.color ?? [0,0,0];
      doc.setTextColor(c[0], c[1], c[2]);
      doc.text(it.value, x + 4, y + 16);
    });
    doc.setTextColor(0);
    return y + 22;
  }

  // ===== Relatório Executivo Mensal =====
  function gerarExecutivo() {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const obrasActivas = obras.filter(o => ["adjudicada","em_curso"].includes(o.estado));
    const calcs = obrasActivas.map(o => ({ o, ...calcObra(o, rubricas, adendas, lancamentos) }));
    const totalFat = calcs.reduce((s,c) => s + c.fat, 0);
    const totalGasto = calcs.reduce((s,c) => s + c.gasto, 0);
    const margemPct = totalFat > 0 ? ((totalFat - totalGasto)/totalFat)*100 : 0;
    const gastoAno = lancamentos.filter(l => new Date(l.data).getFullYear() === ano).reduce((s,l) => s + l.valor, 0);

    // Página 1
    header(doc, `Relatório Executivo — ${MESES[mes]} ${ano}`, `${obrasActivas.length} obras activas`);
    let y = kpiBoxes(doc, 30, [
      { label: "Volume faturável", value: eur(totalFat), color: [26,95,168] },
      { label: "Margem média", value: `${margemPct.toFixed(1)}%`, color: margemPct > 15 ? [22,163,74] : margemPct >= 0 ? [217,119,6] : [220,38,38] },
      { label: "Gasto acumulado", value: eur(gastoAno), color: [124,58,237] },
      { label: "Obras activas", value: String(obrasActivas.length), color: [0,0,0] },
    ]);

    autoTable(doc, {
      startY: y + 6,
      head: [["Obra","Cliente","Estado","Orç. cliente","Total fat.","Gasto real","Margem €","Margem %","●"]],
      body: calcs.map(c => [
        c.o.nome, c.o.cliente, ESTADO_LABEL[c.o.estado] ?? c.o.estado,
        eur(Number(c.o.orcamento_cliente)), eur(c.fat), eur(c.gasto),
        eur(c.margem), `${c.pct.toFixed(1)}%`,
        c.pct > 10 ? "●" : c.pct >= 0 ? "●" : "●",
      ]),
      headStyles: { fillColor: [26,95,168], textColor: 255 },
      alternateRowStyles: { fillColor: [248,250,252] },
      styles: { fontSize: 9, cellPadding: 2.5 },
      didParseCell: (data) => {
        if (data.section === "body") {
          const c = calcs[data.row.index];
          if (data.column.index === 8) {
            data.cell.styles.textColor = c.pct > 10 ? [22,163,74] : c.pct >= 0 ? [217,119,6] : [220,38,38];
            data.cell.styles.halign = "center";
            data.cell.styles.fontStyle = "bold";
          }
          if (c.pct < 0 && (data.column.index === 6 || data.column.index === 7)) {
            data.cell.styles.textColor = [220,38,38];
          }
        }
      },
    });

    // Página 2
    doc.addPage();
    header(doc, `Análise de custos — ${MESES[mes]} ${ano}`, "Distribuição e tendências");

    // Gasto por rubrica no mês
    const lancMes = lancamentos.filter(l => { const d = new Date(l.data); return d.getMonth() === mes && d.getFullYear() === ano; });
    const lancAno = lancamentos.filter(l => new Date(l.data).getFullYear() === ano);
    const totalMes = lancMes.reduce((s,l) => s + l.valor, 0);
    const porRubMes = new Map<string, number>();
    lancMes.forEach(l => { const n = rubricaNomeLanc(l, rubricas, adRubs); porRubMes.set(n, (porRubMes.get(n) || 0) + l.valor); });
    const porRubAno = new Map<string, number>();
    lancAno.forEach(l => { const n = rubricaNomeLanc(l, rubricas, adRubs); porRubAno.set(n, (porRubAno.get(n) || 0) + l.valor); });

    autoTable(doc, {
      startY: 30,
      head: [["Rubrica", "Gasto mês", "% do total", "Acumulado ano"]],
      body: Array.from(porRubMes.entries()).sort((a,b) => b[1]-a[1]).map(([n,v]) => [
        n, eur(v), totalMes > 0 ? `${(v/totalMes*100).toFixed(1)}%` : "—", eur(porRubAno.get(n) || 0),
      ]),
      headStyles: { fillColor: [26,95,168], textColor: 255 },
      alternateRowStyles: { fillColor: [248,250,252] },
      styles: { fontSize: 9, cellPadding: 2.5 },
    });

    // Obras em risco
    const risco = calcs.filter(c => c.pct < 10).sort((a,b) => a.pct - b.pct);
    if (risco.length > 0) {
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 6,
        head: [["Obra em risco/atenção", "Margem %", "Desvio €", "Estado"]],
        body: risco.map(c => [c.o.nome, `${c.pct.toFixed(1)}%`, eur(c.margem), ESTADO_LABEL[c.o.estado] ?? c.o.estado]),
        headStyles: { fillColor: [220,38,38], textColor: 255 },
        alternateRowStyles: { fillColor: [254,242,242] },
        styles: { fontSize: 9, cellPadding: 2.5 },
        didParseCell: (data) => {
          if (data.section === "body" && data.column.index === 1) {
            const c = risco[data.row.index];
            data.cell.styles.textColor = c.pct < 0 ? [220,38,38] : [217,119,6];
            data.cell.styles.fontStyle = "bold";
          }
        },
      });
    }

    // Últimos 6 meses
    const meses6: Array<{ mes: string; valor: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(ano, mes - i, 1);
      const v = lancamentos.filter(l => { const dl = new Date(l.data); return dl.getMonth() === d.getMonth() && dl.getFullYear() === d.getFullYear(); }).reduce((s,l) => s + l.valor, 0);
      meses6.push({ mes: `${MESES[d.getMonth()]} ${d.getFullYear()}`, valor: v });
    }
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 6,
      head: [["Mês", "Gasto", "Var. % vs anterior"]],
      body: meses6.map((m, i) => {
        const prev = i > 0 ? meses6[i-1].valor : 0;
        const varr = prev > 0 ? ((m.valor - prev)/prev)*100 : 0;
        return [m.mes, eur(m.valor), i === 0 ? "—" : `${varr >= 0 ? "+" : ""}${varr.toFixed(1)}%`];
      }),
      headStyles: { fillColor: [26,95,168], textColor: 255 },
      alternateRowStyles: { fillColor: [248,250,252] },
      styles: { fontSize: 9, cellPadding: 2.5 },
    });

    footer(doc);
    doc.save(`executivo-${ano}-${String(mes+1).padStart(2,"0")}.pdf`);
  }

  // ===== Relatório de obra (existente, melhorado) =====
  async function gerarRelatorioObra() {
    const obra = obras.find(o => o.id === obraId);
    if (!obra) return;
    const doc = new jsPDF();
    const c = calcObra(obra, rubricas, adendas, lancamentos);
    header(doc, obra.nome, obra.cliente);

    let y = kpiBoxes(doc, 30, [
      { label: "Total fat.", value: eur(c.fat), color: [26,95,168] },
      { label: "Gasto real", value: eur(c.gasto), color: [124,58,237] },
      { label: "Margem", value: eur(c.margem), color: c.pct > 15 ? [22,163,74] : c.pct >= 0 ? [217,119,6] : [220,38,38] },
      { label: "Margem %", value: `${c.pct.toFixed(1)}%`, color: c.pct > 15 ? [22,163,74] : c.pct >= 0 ? [217,119,6] : [220,38,38] },
    ]);

    const rubObra = rubricas.filter(r => r.obra_id === obra.id);
    const lancObra = lancamentos.filter(l => l.obra_id === obra.id).sort((a,b) => a.data.localeCompare(b.data));
    const adObra = adendas.filter(a => a.obra_id === obra.id);

    autoTable(doc, {
      startY: y + 6,
      head: [["Rubrica", "Orç. interno", "Gasto real", "Desvio", "% consumido"]],
      body: rubObra.map(r => {
        const g = lancamentos.filter(l => l.rubrica_id === r.id).reduce((s,l) => s + l.valor, 0);
        const oi = Number(r.orcamento_interno);
        const pct = oi > 0 ? (g/oi)*100 : 0;
        return [r.nome, eur(oi), eur(g), eur(oi - g), `${pct.toFixed(1)}%`];
      }),
      headStyles: { fillColor: [26,95,168], textColor: 255 },
      alternateRowStyles: { fillColor: [248,250,252] },
      styles: { fontSize: 9, cellPadding: 2.5 },
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 6,
      head: [["Data","Fornecedor","Descrição","Rubrica","Valor"]],
      body: lancObra.map(l => [l.data, l.fornecedor ?? "—", l.descricao, rubricaNomeLanc(l, rubricas, adRubs), eur(l.valor)]),
      headStyles: { fillColor: [26,95,168], textColor: 255 },
      alternateRowStyles: { fillColor: [248,250,252] },
      styles: { fontSize: 9, cellPadding: 2.5 },
    });

    const avulsas = lancObra.filter(l => !l.rubrica_id && !l.adenda_rubrica_id);
    if (avulsas.length > 0) {
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 6,
        head: [["Data","Fornecedor","Descrição","Rubrica avulsa","Valor"]],
        body: avulsas.map(l => [l.data, l.fornecedor ?? "—", l.descricao, l.rubrica_nome ?? "—", eur(l.valor)]),
        foot: [["", "", "", "Total", eur(avulsas.reduce((s,l) => s + l.valor, 0))]],
        headStyles: { fillColor: [217,119,6], textColor: 255 },
        footStyles: { fillColor: [240,240,240], textColor: 0, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [254,249,235] },
        styles: { fontSize: 9, cellPadding: 2.5 },
      });
    }

    if (adObra.length > 0) {
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 6,
        head: [["Data","Descrição","Valor cliente"]],
        body: adObra.map(a => [a.data, a.descricao, eur(a.valor_cliente)]),
        headStyles: { fillColor: [26,95,168], textColor: 255 },
        alternateRowStyles: { fillColor: [248,250,252] },
        styles: { fontSize: 9, cellPadding: 2.5 },
      });
    }

    footer(doc);
    doc.save(`obra-${obra.nome.replace(/\s+/g,"_")}.pdf`);
  }

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <div className="bg-card border border-border rounded-lg p-5 space-y-4 shadow-sm">
        <h3 className="font-semibold">Relatório executivo mensal</h3>
        <p className="text-sm text-muted-foreground">Resumo executivo com KPIs, obras activas e análise de custos.</p>
        <div className="grid grid-cols-2 gap-2">
          <Select value={String(mes)} onValueChange={v => setMes(Number(v))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {MESES.map((m,i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(ano)} onValueChange={v => setAno(Number(v))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {anosDisponiveis.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={gerarExecutivo} className="w-full">Gerar PDF</Button>
      </div>

      <div className="bg-card border border-border rounded-lg p-5 space-y-4 shadow-sm">
        <h3 className="font-semibold">Relatório de obra</h3>
        <p className="text-sm text-muted-foreground">Detalhe por obra: rubricas, lançamentos e adendas.</p>
        <Select value={obraId} onValueChange={setObraId}>
          <SelectTrigger><SelectValue placeholder="Selecciona uma obra" /></SelectTrigger>
          <SelectContent>
            {obras.map(o => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={gerarRelatorioObra} disabled={!obraId} className="w-full">Gerar PDF</Button>
      </div>
    </div>
  );
}
