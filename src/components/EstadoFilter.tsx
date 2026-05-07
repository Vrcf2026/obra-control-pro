import { useEffect, useRef, useState } from "react";
import { estadoLabel } from "@/lib/format";
import { ChevronDown } from "lucide-react";

export const ESTADOS_DEFAULT = ["adjudicada", "em_curso"];

export function EstadoFilter({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const all = Object.keys(estadoLabel);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const summary =
    value.length === 0 ? "Nenhum estado" :
    value.length === all.length ? "Todos" :
    value.length === 1 ? estadoLabel[value[0]] :
    `${value.length} estados`;

  function toggle(k: string) {
    onChange(value.includes(k) ? value.filter(x => x !== k) : [...value, k]);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="border border-input rounded-md px-3 py-2 text-sm bg-background inline-flex items-center gap-2 min-w-[150px] justify-between"
      >
        <span>{summary}</span>
        <ChevronDown className="w-4 h-4 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 z-30 bg-popover border border-border rounded-md shadow-md p-2 min-w-[220px]">
          <div className="flex items-center justify-between gap-2 px-1 pb-2 border-b border-border mb-2">
            <button onClick={() => onChange(all)} className="text-xs text-primary hover:underline">Seleccionar todos</button>
            <button onClick={() => onChange([])} className="text-xs text-muted-foreground hover:underline">Limpar</button>
          </div>
          {all.map(k => (
            <label key={k} className="flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted cursor-pointer">
              <input type="checkbox" checked={value.includes(k)} onChange={() => toggle(k)} />
              <span>{estadoLabel[k]}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
