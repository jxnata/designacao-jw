import { invoke } from "@tauri-apps/api/core";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  atualizarStatusSemana,
  excluirSemana,
  importarSemanas,
  listarPessoas,
  listarSemanas,
  salvarDesignacoes,
} from "../lib/db";
import { gerarPreview, montarUnidades } from "../lib/designacao";
import { ordenarParaSelect } from "../lib/regras";
import { CORES_SECAO, SECAO_POR_TIPO } from "../lib/secoes";
import { ROTULO_TIPO } from "../lib/types";
import type { ItemPreview, Pessoa, Semana } from "../lib/types";

export default function Designacao() {
  const [semanas, setSemanas] = useState<Semana[]>([]);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [selecionadas, setSelecionadas] = useState<Set<number>>(new Set());
  const [buscando, setBuscando] = useState(false);
  const [adicionando, setAdicionando] = useState(false);
  const [gerandoPreview, setGerandoPreview] = useState(false);
  const [preview, setPreview] = useState<ItemPreview[] | null>(null);
  const [mostrarTodos, setMostrarTodos] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState<string | null>(null);
  const navigate = useNavigate();

  async function recarregar() {
    setSemanas(await listarSemanas());
    setPessoas(await listarPessoas(false));
  }

  useEffect(() => {
    recarregar();
  }, []);

  async function buscarProgramacao() {
    setErro(null);
    setBuscando(true);
    try {
      const semanasWeb = await invoke("importar_semanas", { quantidade: 8 });
      await importarSemanas(semanasWeb as never);
      await recarregar();
    } catch (e) {
      setErro(String(e));
    } finally {
      setBuscando(false);
    }
  }

  async function adicionarSemana() {
    const ultima = [...semanas].sort((a, b) => b.ordinal - a.ordinal)[0];
    if (!ultima) return;
    setErro(null);
    setAdicionando(true);
    try {
      const semanasWeb = await invoke("importar_semanas", {
        quantidade: 1,
        anoApos: ultima.ano,
        semanaIsoApos: ultima.semana_iso,
      });
      await importarSemanas(semanasWeb as never);
      await recarregar();
    } catch (e) {
      setErro(String(e));
    } finally {
      setAdicionando(false);
    }
  }

  function alternarSelecao(id: number) {
    setSelecionadas((s) => {
      const novo = new Set(s);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  async function gerarPreviewClick() {
    const semanasEscolhidas = semanas.filter((s) => selecionadas.has(s.id) && s.status !== "final");
    if (semanasEscolhidas.length === 0) return;
    setErro(null);
    setGerandoPreview(true);
    try {
      const unidades = await montarUnidades(semanasEscolhidas);
      const preenchido = await gerarPreview(semanasEscolhidas, unidades);
      setPreview(preenchido);
    } catch (e) {
      setErro(String(e));
    } finally {
      setGerandoPreview(false);
    }
  }

  function atualizarItem(parteId: string, campo: "pessoa_id" | "ajudante_id", valor: number | null) {
    setPreview((p) => (p ? p.map((i) => (i.parte_id === parteId ? { ...i, [campo]: valor } : i)) : p));
  }

  async function confirmarEGerar() {
    if (!preview) return;
    const semanaIds = [...new Set(preview.map((i) => i.semana_id))];
    const designacoes = preview.map((i) => ({
      semana_id: i.semana_id,
      parte_id: i.parte_id.includes(":parte:") ? Number(i.parte_id.split(":parte:")[1]) : null,
      tipo: i.tipo,
      pessoa_id: i.pessoa_id,
      ajudante_id: i.ajudante_id,
    }));
    await salvarDesignacoes(semanaIds, designacoes);
    for (const id of semanaIds) await atualizarStatusSemana(id, "final");
    setPreview(null);
    setSelecionadas(new Set());
    await recarregar();
    navigate("/impressao");
  }

  async function excluir(id: number) {
    if (!confirm("Excluir esta semana importada?")) return;
    await excluirSemana(id);
    await recarregar();
  }

  const pessoasPorId = useMemo(() => new Map(pessoas.map((p) => [p.id, p])), [pessoas]);

  if (preview) {
    const porSemana = new Map<number, ItemPreview[]>();
    for (const item of preview) {
      if (!porSemana.has(item.semana_id)) porSemana.set(item.semana_id, []);
      porSemana.get(item.semana_id)!.push(item);
    }

    return (
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold">Preview — confira e ajuste antes de gerar</h1>
          <div className="flex gap-2">
            <button
              className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
              onClick={() => setPreview(null)}
            >
              Voltar
            </button>
            <button
              className="rounded bg-teal-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-teal-800"
              onClick={confirmarEGerar}
            >
              Confirmar e gerar
            </button>
          </div>
        </div>

        <div className="space-y-6">
          {[...porSemana.entries()].map(([semanaId, itens]) => {
            const semana = semanas.find((s) => s.id === semanaId);
            return (
              <div key={semanaId} className="rounded border border-slate-200 bg-white p-4">
                <h2 className="mb-3 text-sm font-semibold text-slate-700">
                  {semana?.intervalo_texto} — {semana?.leitura_semanal}
                </h2>
                <div className="space-y-2">
                  {itens.map((item) => (
                    <LinhaPreview
                      key={item.parte_id}
                      item={item}
                      pessoas={pessoas}
                      pessoasPorId={pessoasPorId}
                      mostrarTodos={mostrarTodos.has(item.parte_id)}
                      onToggleMostrarTodos={() =>
                        setMostrarTodos((s) => {
                          const novo = new Set(s);
                          novo.has(item.parte_id) ? novo.delete(item.parte_id) : novo.add(item.parte_id);
                          return novo;
                        })
                      }
                      onChange={(campo, valor) => atualizarItem(item.parte_id, campo, valor)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Designação</h1>
        <div className="flex gap-2">
          <button
            className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 disabled:opacity-50"
            onClick={buscarProgramacao}
            disabled={buscando}
          >
            {buscando ? "Buscando…" : "Buscar programação (8 semanas)"}
          </button>
          <button
            className="rounded bg-teal-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
            onClick={gerarPreviewClick}
            disabled={selecionadas.size === 0 || gerandoPreview}
          >
            {gerandoPreview ? "Gerando…" : "Gerar preview"}
          </button>
        </div>
      </div>

      {erro && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

      <div className="overflow-hidden rounded border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-8 px-3 py-2"></th>
              <th className="px-3 py-2">Semana</th>
              <th className="px-3 py-2">Leitura</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {semanas.map((s) => (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="px-3 py-2">
                  {s.status !== "final" && (
                    <input
                      type="checkbox"
                      checked={selecionadas.has(s.id)}
                      onChange={() => alternarSelecao(s.id)}
                    />
                  )}
                </td>
                <td className="px-3 py-2 font-medium">{s.intervalo_texto}</td>
                <td className="px-3 py-2 text-slate-600">{s.leitura_semanal}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={s.status} />
                </td>
                <td className="px-3 py-2 text-right">
                  {s.status === "final" ? (
                    <a href="#/impressao" className="text-xs text-teal-700 hover:underline">
                      ver impressão
                    </a>
                  ) : (
                    <button className="text-xs text-red-600 hover:underline" onClick={() => excluir(s.id)}>
                      excluir
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {semanas.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                  Nenhuma semana importada ainda. Clique em "Buscar programação".
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {semanas.length > 0 && (
        <div className="mt-3">
          <button
            className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 disabled:opacity-50"
            onClick={adicionarSemana}
            disabled={adicionando}
          >
            {adicionando ? "Adicionando…" : "Adicionar semana"}
          </button>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: Semana["status"] }) {
  const estilos: Record<Semana["status"], string> = {
    importada: "bg-slate-100 text-slate-600",
    preview: "bg-amber-50 text-amber-700",
    final: "bg-emerald-50 text-emerald-700",
  };
  const rotulos: Record<Semana["status"], string> = {
    importada: "Importada",
    preview: "Em preview",
    final: "Confirmada",
  };
  return <span className={`rounded px-2 py-0.5 text-xs ${estilos[status]}`}>{rotulos[status]}</span>;
}

function LinhaPreview({
  item,
  pessoas,
  pessoasPorId,
  mostrarTodos,
  onToggleMostrarTodos,
  onChange,
}: {
  item: ItemPreview;
  pessoas: Pessoa[];
  pessoasPorId: Map<number, Pessoa>;
  mostrarTodos: boolean;
  onToggleMostrarTodos: () => void;
  onChange: (campo: "pessoa_id" | "ajudante_id", valor: number | null) => void;
}) {
  const opcoes = mostrarTodos ? [...pessoas].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")) : ordenarParaSelect(item.tipo, pessoas);
  const pessoaEscolhida = item.pessoa_id ? pessoasPorId.get(item.pessoa_id) : null;
  const opcoesAjudante = pessoaEscolhida
    ? pessoas
        .filter((p) => mostrarTodos || p.sexo === pessoaEscolhida.sexo)
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
    : [];

  const secao = SECAO_POR_TIPO[item.tipo];
  const cores = secao ? CORES_SECAO[secao] : null;

  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded border border-slate-100 px-2 py-1.5"
      style={cores ? { borderLeft: `4px solid ${cores.borda}` } : undefined}
    >
      <div className="w-56 shrink-0 text-xs text-slate-600">
        <div className="font-medium text-slate-800">{item.titulo}</div>
        <div>{ROTULO_TIPO[item.tipo]}</div>
      </div>

      <select
        className={`min-w-[180px] flex-1 rounded border px-2 py-1 text-sm ${
          item.pessoa_id ? "border-slate-300" : "border-amber-400 bg-amber-50"
        }`}
        value={item.pessoa_id ?? ""}
        onChange={(e) => onChange("pessoa_id", e.target.value ? Number(e.target.value) : null)}
      >
        <option value="">— sem designação —</option>
        {opcoes.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nome}
          </option>
        ))}
      </select>

      {item.tem_ajudante && (
        <select
          className="min-w-[180px] flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
          value={item.ajudante_id ?? ""}
          onChange={(e) => onChange("ajudante_id", e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">— ajudante —</option>
          {opcoesAjudante.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
      )}

      <button
        type="button"
        className="text-xs text-slate-400 hover:text-slate-700"
        onClick={onToggleMostrarTodos}
        title="Mostrar todas as pessoas, mesmo as não elegíveis"
      >
        {mostrarTodos ? "só elegíveis" : "mostrar todos"}
      </button>
    </div>
  );
}
