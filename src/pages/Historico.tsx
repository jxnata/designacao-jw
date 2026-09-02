import { useEffect, useMemo, useState } from "react";
import { historicoAgregado } from "../lib/db";
import type { HistoricoLinha } from "../lib/db";
import { ROTULO_TIPO, type TipoParte } from "../lib/types";

export default function Historico() {
  const [linhas, setLinhas] = useState<HistoricoLinha[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    historicoAgregado()
      .then(setLinhas)
      .finally(() => setCarregando(false));
  }, []);

  const tipos = useMemo(() => {
    const s = new Set<TipoParte>();
    linhas.forEach((l) => s.add(l.tipo as TipoParte));
    return [...s].sort();
  }, [linhas]);

  const porPessoa = useMemo(() => {
    const m = new Map<string, { nome: string; porTipo: Map<string, number>; total: number }>();
    for (const l of linhas) {
      const chave = `${l.pessoa_id}`;
      if (!m.has(chave)) m.set(chave, { nome: l.nome, porTipo: new Map(), total: 0 });
      const entry = m.get(chave)!;
      entry.porTipo.set(l.tipo, l.quantidade);
      entry.total += l.quantidade;
    }
    return [...m.values()].sort((a, b) => b.total - a.total);
  }, [linhas]);

  if (carregando) return <p className="text-sm text-slate-500">Carregando…</p>;

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold">Histórico de designações</h1>
      {porPessoa.length === 0 ? (
        <p className="text-sm text-slate-400">
          Ainda não há designações confirmadas — o histórico aparece aqui depois que uma semana é
          gerada em definitivo.
        </p>
      ) : (
        <div className="overflow-x-auto rounded border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Pessoa</th>
                {tipos.map((t) => (
                  <th key={t} className="px-3 py-2 text-center">
                    {ROTULO_TIPO[t]}
                  </th>
                ))}
                <th className="px-3 py-2 text-center font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {porPessoa.map((p) => (
                <tr key={p.nome} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium">{p.nome}</td>
                  {tipos.map((t) => (
                    <td key={t} className="px-3 py-2 text-center text-slate-600">
                      {p.porTipo.get(t) ?? 0}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-center font-semibold">{p.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
