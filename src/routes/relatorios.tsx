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
  LineChart, Line, Cell,
} from "recharts";
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
interface Lanc { id: string; obra_id: string; rubrica_id: string; data: string; descricao: string; fornecedor: string | null; valor: number; }
interface Adenda { id: string; obra_id: string; data: string; descricao: string; valor_cliente: number; valor_interno: number; }

function Relatorios() {
  const { nome } = useAuth();
  const [obras, setObras] = useState<Obra[]>([]);
  const [rubricas, setRubricas] = useState<Rubrica[]>([]);
  const [lancamentos, setLancamentos] = useState<Lanc[]>([]);
  const [adendas, setAdendas] = useState<Adenda[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [{ data: o }, { data: r }, { data: l }, { data: a }] = await Promise.all([
      supabase.from("obras").select("*").order("nome"),
      supabase.from("rubricas").select("*"),
      supabase.from("lancamentos").select("*"),
      supabase.from("adendas").select("*"),
    ]);
    setObras((o ?? []) as Obra[]);
    setRubricas((r ?? []) as Rubrica[]);
    setLancamentos(((l ?? []) as Lanc[]).map(x => ({ ...x, valor: Number(x.valor) })));
    setAdendas(((a ?? []) as Adenda[]).map(x => ({ ...x, valor_cliente: Number(x.valor_cliente), valor_interno: Number(x.valor_interno) })));
    setLoading(false);
  }

  const obrasActivas = useMemo(
    () => obras.filter(o => ["adjudicada", "em_curso"].includes(o.estado)),
    [obras]
  );

  if (loading) return <div className="p-8 text-center text-muted-foreground">A carregar...</div>;

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Relatórios</h1>
        <p className="text-sm text-muted-foreground">Análise visual e exportação</p>
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="pdf">Exportar PDF</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          <MargemPorObra obras={obrasActivas} rubricas={rubricas} lancamentos={lancamentos} adendas={adendas} />
          <RubricaCharts obras={obrasActivas} rubricas={rubricas} lancamentos={lancamentos} />
        </TabsContent>

        <TabsContent value="pdf" className="space-y-4">
          <ExportarPDF
            obras={obras} rubricas={rubricas} lancamentos={lancamentos} adendas={adendas}
            geradoPor={nome || "—"}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
// Gráfico 1 — Margem por obra
// ============================================================
function MargemPorObra({ obras, rubricas, lancamentos, adendas }: {
  obras: Obra[]; rubricas: Rubrica[]; lancamentos: Lanc[]; adendas: Adenda[];
}) {
  const data = useMemo(() => {
    return obras.map(o => {
      const orcInt = rubricas.filter(r => r.obra_id === o.id).reduce((s, r) => s + Number(r.orcamento_interno), 0);
      const adObra = adendas.filter(a => a.obra_id === o.id);
      const adCli = adObra.reduce((s, a) => s + a.valor_cliente, 0);
      const adInt = adObra.reduce((s, a) => s + a.valor_interno, 0);
      const fat = Number(o.orcamento_cliente) + adCli;
      const gasto = lancamentos.filter(l => l.obra_id === o.id).reduce((s, l) => s + l.valor, 0);
      const margem = gasto > 0 ? fat - gasto : fat - (orcInt + adInt);
      const pct = fat > 0 ? (margem / fat) * 100 : 0;
      return { nome: o.nome, pct: Number(pct.toFixed(1)) };
    });
  }, [obras, rubricas, lancamentos, adendas]);

  const corPct = (p: number) => p > 15 ? "hsl(var(--chart-success))" : p >= 0 ? "hsl(var(--chart-warning))" : "hsl(var(--chart-danger))";

  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <h2 className="font-medium mb-4">Margem por obra</h2>
      {data.length === 0 ? <p className="text-sm text-muted-foreground">Sem obras activas.</p> : (
        <ResponsiveContainer width="100%" height={Math.max(220, data.length * 40 + 60)}>
          <BarChart data={data} layout="vertical" margin={{ left: 20, right: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis type="number" unit="%" stroke="hsl(var(--muted-foreground))" />
            <YAxis type="category" dataKey="nome" width={140} stroke="hsl(var(--muted-foreground))" />
            <Tooltip formatter={(v: any) => `${v}%`} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
            <Bar dataKey="pct" name="Margem %">
              {data.map((d, i) => (
                <Cell key={i} fill={d.pct > 15 ? "#16a34a" : d.pct >= 0 ? "#eab308" : "#dc2626"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ============================================================
// Gráficos 2 + 3 — partilham selecção de obra
// ============================================================
function RubricaCharts({ obras, rubricas, lancamentos }: {
  obras: Obra[]; rubricas: Rubrica[]; lancamentos: Lanc[];
}) {
  const [obraId, setObraId] = useState<string>(obras[0]?.id ?? "");
  const obra = obras.find(o => o.id === obraId);

  const rubData = useMemo(() => {
    if (!obraId) return [];
    return rubricas.filter(r => r.obra_id === obraId).map(r => {
      const gasto = lancamentos.filter(l => l.rubrica_id === r.id).reduce((s, l) => s + l.valor, 0);
      return { nome: r.nome, orcamento: Number(r.orcamento_interno), gasto };
    });
  }, [obraId, rubricas, lancamentos]);

  const evolData = useMemo(() => {
    if (!obraId) return [];
    const lanc = lancamentos.filter(l => l.obra_id === obraId).sort((a, b) => a.data.localeCompare(b.data));
    const semanas = new Map<string, number>();
    for (const l of lanc) {
      const d = new Date(l.data);
      // semana ISO (segunda-feira)
      const dow = (d.getDay() + 6) % 7;
      d.setDate(d.getDate() - dow);
      const key = d.toISOString().slice(0, 10);
      semanas.set(key, (semanas.get(key) ?? 0) + l.valor);
    }
    let acc = 0;
    return Array.from(semanas.entries()).map(([sem, v]) => ({ semana: sem, gasto: (acc += v) }));
  }, [obraId, lancamentos]);

  return (
    <>
      <div className="bg-card border border-border rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-medium">Orçamento vs Gasto {obra ? `— ${obra.nome}` : ""}</h2>
          <div className="w-64">
            <Select value={obraId} onValueChange={setObraId}>
              <SelectTrigger><SelectValue placeholder="Selecciona uma obra" /></SelectTrigger>
              <SelectContent>
                {obras.map(o => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        {rubData.length === 0 ? <p className="text-sm text-muted-foreground">Sem dados.</p> : (
          <ResponsiveContainer width="100%" height={Math.max(260, rubData.length * 48 + 60)}>
            <BarChart data={rubData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="nome" stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" />
              <Tooltip formatter={(v: any) => eur(Number(v))} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
              <Legend />
              <Bar dataKey="orcamento" name="Orçamento interno" fill="#2563eb" />
              <Bar dataKey="gasto" name="Gasto real" fill="#f97316" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="bg-card border border-border rounded-lg p-5 space-y-4">
        <h2 className="font-medium">Evolução do gasto {obra ? `— ${obra.nome}` : ""}</h2>
        {evolData.length === 0 ? <p className="text-sm text-muted-foreground">Sem lançamentos.</p> : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={evolData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="semana" stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" />
              <Tooltip formatter={(v: any) => eur(Number(v))} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
              <Line type="monotone" dataKey="gasto" stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} name="Gasto acumulado" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </>
  );
}

// ============================================================
// Tab Exportar PDF
// ============================================================
function ExportarPDF({ obras, rubricas, lancamentos, adendas, geradoPor }: {
  obras: Obra[]; rubricas: Rubrica[]; lancamentos: Lanc[]; adendas: Adenda[]; geradoPor: string;
}) {
  const [obraId, setObraId] = useState<string>(obras[0]?.id ?? "");

  function addFooter(doc: jsPDF) {
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(`Página ${i} de ${pages}`, doc.internal.pageSize.getWidth() - 14, doc.internal.pageSize.getHeight() - 8, { align: "right" });
    }
  }

  function gerarRelatorioObra() {
    const obra = obras.find(o => o.id === obraId);
    if (!obra) return;
    const doc = new jsPDF();
    const data = new Date().toLocaleString("pt-PT");

    doc.setFontSize(16); doc.text("ObraControl", 14, 16);
    doc.setFontSize(9); doc.setTextColor(120);
    doc.text(`Gerado em ${data} · por ${geradoPor}`, 14, 22);
    doc.setTextColor(0);

    doc.setFontSize(14); doc.text(obra.nome, 14, 34);
    doc.setFontSize(10);
    doc.text(`Cliente: ${obra.cliente}`, 14, 42);
    doc.text(`Localização: ${obra.localizacao ?? "—"}`, 14, 48);
    doc.text(`Estado: ${obra.estado}`, 14, 54);
    doc.text(`Início: ${obra.data_inicio ?? "—"}   Fim previsto: ${obra.data_fim_previsto ?? "—"}`, 14, 60);

    const adObra = adendas.filter(a => a.obra_id === obra.id);
    const rubObra = rubricas.filter(r => r.obra_id === obra.id);
    const lancObra = lancamentos.filter(l => l.obra_id === obra.id).sort((a, b) => a.data.localeCompare(b.data));
    const adCli = adObra.reduce((s, a) => s + a.valor_cliente, 0);
    const adInt = adObra.reduce((s, a) => s + a.valor_interno, 0);
    const orcInt = rubObra.reduce((s, r) => s + Number(r.orcamento_interno), 0);
    const gasto = lancObra.reduce((s, l) => s + l.valor, 0);
    const fat = Number(obra.orcamento_cliente) + adCli;
    const margemPrev = fat - (orcInt + adInt);
    const margemAtual = fat - gasto;
    const pctPrev = fat > 0 ? (margemPrev / fat) * 100 : 0;
    const pctAtual = fat > 0 ? (margemAtual / fat) * 100 : 0;

    let y = 70;
    doc.setFontSize(12); doc.text("Orçamento", 14, y); y += 2;
    autoTable(doc, {
      startY: y + 2, theme: "plain", styles: { fontSize: 10 },
      body: [
        ["Orçamento cliente", eur(Number(obra.orcamento_cliente))],
        ["Adendas", eur(adCli)],
        ["Total faturável", eur(fat)],
        ["Orçamento interno (+ adendas)", eur(orcInt + adInt)],
        ["Margem prevista", `${eur(margemPrev)} · ${pctPrev.toFixed(1)}%`],
        ...(gasto > 0 ? [
          ["Gasto real", eur(gasto)],
          ["Margem actual", `${eur(margemAtual)} · ${pctAtual.toFixed(1)}%`],
        ] as string[][] : []),
      ],
      columnStyles: { 0: { cellWidth: 80 }, 1: { halign: "right" } },
    });

    // Rubricas
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 8,
      head: [["Rubrica", "Orç. interno", "Gasto real", "Desvio", "% consumido"]],
      body: rubObra.map(r => {
        const g = lancamentos.filter(l => l.rubrica_id === r.id).reduce((s, l) => s + l.valor, 0);
        const oi = Number(r.orcamento_interno);
        const desv = oi - g;
        const pct = oi > 0 ? (g / oi) * 100 : 0;
        return [r.nome, eur(oi), eur(g), eur(desv), `${pct.toFixed(1)}%`];
      }),
      headStyles: { fillColor: [37, 99, 235] },
      styles: { fontSize: 9 },
    });

    // Lançamentos
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 6,
      head: [["Data", "Fornecedor", "Descrição", "Rubrica", "Valor"]],
      body: lancObra.map(l => [
        l.data,
        l.fornecedor ?? "—",
        l.descricao,
        rubObra.find(r => r.id === l.rubrica_id)?.nome ?? "—",
        eur(l.valor),
      ]),
      headStyles: { fillColor: [37, 99, 235] },
      styles: { fontSize: 9 },
    });

    // Adendas
    if (adObra.length > 0) {
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 6,
        head: [["Data", "Descrição", "Valor cliente"]],
        body: adObra.map(a => [a.data, a.descricao, eur(a.valor_cliente)]),
        headStyles: { fillColor: [37, 99, 235] },
        styles: { fontSize: 9 },
      });
    }

    addFooter(doc);
    doc.save(`obra-${obra.nome.replace(/\s+/g, "_")}.pdf`);
  }

  function gerarRelatorioGeral() {
    const doc = new jsPDF();
    const data = new Date().toLocaleString("pt-PT");

    doc.setFontSize(16); doc.text("ObraControl — Relatório Geral", 14, 16);
    doc.setFontSize(9); doc.setTextColor(120);
    doc.text(`Gerado em ${data}`, 14, 22);
    doc.setTextColor(0);

    const linhas = obras.map(o => {
      const adObra = adendas.filter(a => a.obra_id === o.id);
      const rubObra = rubricas.filter(r => r.obra_id === o.id);
      const adCli = adObra.reduce((s, a) => s + a.valor_cliente, 0);
      const adInt = adObra.reduce((s, a) => s + a.valor_interno, 0);
      const orcInt = rubObra.reduce((s, r) => s + Number(r.orcamento_interno), 0);
      const gasto = lancamentos.filter(l => l.obra_id === o.id).reduce((s, l) => s + l.valor, 0);
      const fat = Number(o.orcamento_cliente) + adCli;
      const margem = gasto > 0 ? fat - gasto : fat - (orcInt + adInt);
      const pct = fat > 0 ? (margem / fat) * 100 : 0;
      return { o, fat, gasto, margem, pct };
    });

    const ativas = linhas.filter(l => ["adjudicada", "em_curso"].includes(l.o.estado)).length;
    const margemTotal = linhas.reduce((s, l) => s + l.margem, 0);
    const risco = linhas.filter(l => l.pct < 0).length;

    autoTable(doc, {
      startY: 30, theme: "grid", styles: { fontSize: 10 },
      body: [
        ["Obras activas", String(ativas)],
        ["Margem total prevista", eur(margemTotal)],
        ["Obras em risco", String(risco)],
      ],
      columnStyles: { 0: { cellWidth: 80, fontStyle: "bold" }, 1: { halign: "right" } },
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 8,
      head: [["Nome", "Cliente", "Estado", "Orç. cliente", "Total fat.", "Gasto", "Margem €", "Margem %"]],
      body: linhas.map(l => [
        l.o.nome, l.o.cliente, l.o.estado,
        eur(Number(l.o.orcamento_cliente)), eur(l.fat), eur(l.gasto),
        eur(l.margem), `${l.pct.toFixed(1)}%`,
      ]),
      headStyles: { fillColor: [37, 99, 235] },
      styles: { fontSize: 9 },
      didParseCell: (data) => {
        if (data.section === "body" && linhas[data.row.index].margem < 0) {
          data.cell.styles.textColor = [220, 38, 38];
        }
      },
    });

    addFooter(doc);
    doc.save(`relatorio-geral.pdf`);
  }

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <div className="bg-card border border-border rounded-lg p-5 space-y-4">
        <h3 className="font-medium">Relatório de obra</h3>
        <Select value={obraId} onValueChange={setObraId}>
          <SelectTrigger><SelectValue placeholder="Selecciona uma obra" /></SelectTrigger>
          <SelectContent>
            {obras.map(o => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={gerarRelatorioObra} disabled={!obraId} className="w-full">Gerar PDF</Button>
      </div>

      <div className="bg-card border border-border rounded-lg p-5 space-y-4">
        <h3 className="font-medium">Relatório geral</h3>
        <p className="text-sm text-muted-foreground">Resumo de todas as obras com indicadores e tabela completa.</p>
        <Button onClick={gerarRelatorioGeral} className="w-full">Gerar PDF</Button>
      </div>
    </div>
  );
}
