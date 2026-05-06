import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Check, X } from "lucide-react";

interface RubricaSelectProps {
  value: string;
  onChange: (nome: string) => void;
  placeholder?: string;
}

interface Padrao { id: string; nome: string }

const CUSTOM_TOKEN = "__custom__";

export function RubricaSelect({ value, onChange, placeholder }: RubricaSelectProps) {
  const [padroes, setPadroes] = useState<Padrao[]>([]);
  const [customMode, setCustomMode] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    supabase.from("rubricas_padrao").select("id,nome").eq("ativo", true).order("ordem").then(({ data }) => {
      setPadroes((data ?? []) as Padrao[]);
    });
  }, []);

  if (customMode) {
    return (
      <div className="flex gap-1 items-center w-full">
        <input
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") { e.preventDefault(); if (draft.trim()) { onChange(draft.trim()); setCustomMode(false); } }
            if (e.key === "Escape") { setCustomMode(false); setDraft(""); }
          }}
          placeholder={placeholder ?? "Nova rubrica..."}
          className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary flex-1"
        />
        <button type="button" onClick={() => { if (draft.trim()) { onChange(draft.trim()); setCustomMode(false); } }} className="text-success p-1" title="Confirmar"><Check className="w-4 h-4" /></button>
        <button type="button" onClick={() => { setCustomMode(false); setDraft(""); }} className="text-muted-foreground hover:text-danger p-1" title="Cancelar"><X className="w-4 h-4" /></button>
      </div>
    );
  }

  const isPersonalizada = value && !padroes.some(p => p.nome === value);

  return (
    <div className="flex gap-1 items-center w-full">
      <select
        value={isPersonalizada ? "__personalizada__" : value}
        onChange={e => {
          const v = e.target.value;
          if (v === CUSTOM_TOKEN) { setDraft(""); setCustomMode(true); return; }
          if (v === "__personalizada__") return;
          onChange(v);
        }}
        className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary flex-1"
      >
        {!value && <option value="">{placeholder ?? "— escolher rubrica —"}</option>}
        {isPersonalizada && <option value="__personalizada__">{value} (personalizada)</option>}
        {padroes.map(p => <option key={p.id} value={p.nome}>{p.nome}</option>)}
        <option disabled>──────────</option>
        <option value={CUSTOM_TOKEN}>Nova rubrica personalizada...</option>
      </select>
      {isPersonalizada && (
        <button type="button" onClick={() => onChange("")} className="text-xs text-muted-foreground hover:text-foreground px-1" title="Voltar à lista">↺</button>
      )}
    </div>
  );
}
