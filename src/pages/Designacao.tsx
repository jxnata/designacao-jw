import { invoke } from "@tauri-apps/api/core";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRightLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  Printer,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  atualizarStatusSemana,
  excluirSemana,
  getConfig,
  importarSemanas,
  listarPessoas,
  listarSemanas,
  salvarDesignacoes,
} from "../lib/db";
import { carregarPreviewExistente, gerarPreview, montarUnidades } from "../lib/designacao";
import { elegivel, elegivelAjudante } from "../lib/regras";
import { CORES_SECAO, SECAO_POR_TIPO } from "../lib/secoes";
import { ROTULO_TIPO } from "../lib/types";
import type { Config, ItemPreview, Pessoa, Semana } from "../lib/types";

export default function Designacao() {
  const [semanas, setSemanas] = useState<Semana[]>([]);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [selecionadas, setSelecionadas] = useState<Set<number>>(new Set());
  const [adicionando, setAdicionando] = useState(false);
  const [quantidade, setQuantidade] = useState(1);
  const [gerandoPreview, setGerandoPreview] = useState(false);
  const [preview, setPreview] = useState<ItemPreview[] | null>(null);
  const [modoPreview, setModoPreview] = useState<"gerar" | "editar">("gerar");
  const [mostrarTodos, setMostrarTodos] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState<string | null>(null);
  const [pagina, setPagina] = useState(1);
  const navigate = useNavigate();

  const POR_PAGINA = 10;

  async function recarregar() {
    setSemanas(await listarSemanas());
    setPessoas(await listarPessoas(false));
    setConfig(await getConfig());
  }

  useEffect(() => {
    recarregar();
  }, []);

  const semanasOrdenadas = useMemo(
    () => [...semanas].sort((a, b) => b.ordinal - a.ordinal),
    [semanas],
  );
  const totalPaginas = Math.max(1, Math.ceil(semanasOrdenadas.length / POR_PAGINA));
  const semanasPagina = useMemo(
    () => semanasOrdenadas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA),
    [semanasOrdenadas, pagina],
  );

  useEffect(() => {
    if (pagina > totalPaginas) setPagina(totalPaginas);
  }, [pagina, totalPaginas]);

  async function buscarSemanas() {
    if (
      !confirm(
        `Isso vai buscar ${quantidade === 1 ? "a próxima semana" : `as próximas ${quantidade} semanas`} diretamente do jw.org. Pode levar alguns instantes. Continuar?`,
      )
    ) {
      return;
    }
    const ultima = [...semanas].sort((a, b) => b.ordinal - a.ordinal)[0];
    setErro(null);
    setAdicionando(true);
    try {
      const semanasWeb = await invoke("importar_semanas", {
        quantidade,
        anoApos: ultima?.ano ?? null,
        semanaIsoApos: ultima?.semana_iso ?? null,
      });
      await importarSemanas(semanasWeb as never);
      await recarregar();
      setPagina(1);
    } catch (e) {
      setErro(String(e));
    } finally {
      setAdicionando(false);
    }
  }

  function temDesignacao(s: Semana) {
    return s.status === "final";
  }

  function alternarSelecao(id: number) {
    setSelecionadas((s) => {
      const semana = semanas.find((sem) => sem.id === id);
      if (!semana) return s;
      const primeira = semanas.find((sem) => s.has(sem.id));
      if (primeira && temDesignacao(primeira) !== temDesignacao(semana) && !s.has(id)) return s;
      const novo = new Set(s);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  function imprimirSelecionadas() {
    const ids = semanas.filter((s) => selecionadas.has(s.id) && temDesignacao(s)).map((s) => s.id);
    if (ids.length === 0) return;
    navigate(`/impressao?semanas=${ids.join(",")}`);
  }

  async function gerarPreviewClick() {
    const semanasEscolhidas = semanas.filter((s) => selecionadas.has(s.id) && s.status !== "final");
    if (semanasEscolhidas.length === 0) return;
    setErro(null);
    setGerandoPreview(true);
    try {
      const unidades = await montarUnidades(semanasEscolhidas);
      const preenchido = await gerarPreview(semanasEscolhidas, unidades);
      setModoPreview("gerar");
      setPreview(preenchido);
    } catch (e) {
      setErro(String(e));
    } finally {
      setGerandoPreview(false);
    }
  }

  async function editarSemanas(ids: number[]) {
    const semanasEscolhidas = semanas.filter((s) => ids.includes(s.id) && s.status === "final");
    if (semanasEscolhidas.length === 0) return;
    setErro(null);
    setGerandoPreview(true);
    try {
      const preenchido = await carregarPreviewExistente(semanasEscolhidas);
      setModoPreview("editar");
      setPreview(preenchido);
    } catch (e) {
      setErro(String(e));
    } finally {
      setGerandoPreview(false);
    }
  }

  function editarSelecionadas() {
    editarSemanas([...selecionadas]);
  }

  function atualizarItem(parteId: string, campo: "pessoa_id" | "ajudante_id", valor: number | null) {
    setPreview((p) => (p ? p.map((i) => (i.parte_id === parteId ? { ...i, [campo]: valor } : i)) : p));
  }

  function inverterAjudante(parteId: string) {
    setPreview((p) =>
      p
        ? p.map((i) =>
            i.parte_id === parteId ? { ...i, pessoa_id: i.ajudante_id, ajudante_id: i.pessoa_id } : i,
          )
        : p,
    );
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
    navigate(`/impressao?semanas=${semanaIds.join(",")}`);
  }

  async function excluir(id: number) {
    if (!confirm("Excluir esta semana importada?")) return;
    await excluirSemana(id);
    await recarregar();
  }

  const pessoasPorId = useMemo(() => new Map(pessoas.map((p) => [p.id, p])), [pessoas]);

  const tipoSelecao = useMemo(() => {
    const primeira = semanas.find((s) => selecionadas.has(s.id));
    return primeira ? (temDesignacao(primeira) ? "com" : "sem") : null;
  }, [semanas, selecionadas]);

  const contagemPorPessoa = useMemo(() => {
    const m = new Map<number, number>();
    for (const i of preview ?? []) {
      if (i.pessoa_id != null) m.set(i.pessoa_id, (m.get(i.pessoa_id) ?? 0) + 1);
      if (i.ajudante_id != null) m.set(i.ajudante_id, (m.get(i.ajudante_id) ?? 0) + 1);
    }
    return m;
  }, [preview]);

  if (preview) {
    const porSemana = new Map<number, ItemPreview[]>();
    for (const item of preview) {
      if (!porSemana.has(item.semana_id)) porSemana.set(item.semana_id, []);
      porSemana.get(item.semana_id)!.push(item);
    }

    return (
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold">
            {modoPreview === "editar"
              ? "Editar designações"
              : "Preview — confira e ajuste antes de gerar"}
          </h1>
          <div className="flex gap-2">
            <button
              className="inline-flex items-center gap-1.5 rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
              onClick={() => setPreview(null)}
            >
              <ArrowLeft className="size-4" />
              Voltar
            </button>
            <button
              className="inline-flex items-center gap-1.5 rounded bg-teal-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-teal-800"
              onClick={confirmarEGerar}
            >
              {modoPreview === "editar" ? (
                <>
                  <Save className="size-4" />
                  Salvar alterações
                </>
              ) : (
                <>
                  <Check className="size-4" />
                  Confirmar e gerar
                </>
              )}
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
                      contagemPorPessoa={contagemPorPessoa}
                      mostrarTodos={mostrarTodos.has(item.parte_id)}
                      onToggleMostrarTodos={() =>
                        setMostrarTodos((s) => {
                          const novo = new Set(s);
                          novo.has(item.parte_id) ? novo.delete(item.parte_id) : novo.add(item.parte_id);
                          return novo;
                        })
                      }
                      onChange={(campo, valor) => atualizarItem(item.parte_id, campo, valor)}
                      onInverterAjudante={() => inverterAjudante(item.parte_id)}
                      config={config}
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
            className="inline-flex items-center gap-1.5 rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 disabled:opacity-50"
            onClick={imprimirSelecionadas}
            disabled={tipoSelecao !== "com"}
          >
            <Printer className="size-4" />
            Imprimir Designações
          </button>
          <button
            className="inline-flex items-center gap-1.5 rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 disabled:opacity-50"
            onClick={editarSelecionadas}
            disabled={tipoSelecao !== "com" || gerandoPreview}
          >
            <Pencil className="size-4" />
            Editar Designações
          </button>
          <button
            className="inline-flex items-center gap-1.5 rounded bg-teal-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
            onClick={gerarPreviewClick}
            disabled={tipoSelecao !== "sem" || gerandoPreview}
          >
            {gerandoPreview ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Gerando…
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                Gerar Designações
              </>
            )}
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
            {semanasPagina.map((s) => (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selecionadas.has(s.id)}
                    disabled={tipoSelecao !== null && tipoSelecao !== (temDesignacao(s) ? "com" : "sem")}
                    onChange={() => alternarSelecao(s.id)}
                    className="disabled:opacity-40"
                  />
                </td>
                <td className="px-3 py-2 font-medium">{s.intervalo_texto}</td>
                <td className="px-3 py-2 text-slate-600">{s.leitura_semanal}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={s.status} />
                </td>
                <td className="px-3 py-2 text-right">
                  {temDesignacao(s) ? (
                    <button
                      className="rounded p-1 text-teal-700 hover:bg-teal-50"
                      onClick={() => editarSemanas([s.id])}
                      title="Editar designações"
                    >
                      <Pencil className="size-4" />
                    </button>
                  ) : (
                    <button
                      className="rounded p-1 text-red-600 hover:bg-red-50"
                      onClick={() => excluir(s.id)}
                      title="Excluir semana"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {semanas.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                  Nenhuma semana importada ainda. Use o controle abaixo para carregar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">Adicionar</span>
          <input
            type="number"
            min={1}
            max={8}
            value={quantidade}
            onChange={(e) => {
              const valor = Number(e.target.value);
              setQuantidade(Math.min(8, Math.max(1, Number.isNaN(valor) ? 1 : valor)));
            }}
            disabled={adicionando}
            className="w-16 rounded border border-slate-300 px-2 py-1.5 text-sm disabled:opacity-50"
          />
          <span className="text-sm text-slate-600">semanas</span>
          <button
            className="inline-flex items-center gap-1.5 rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 disabled:opacity-50"
            onClick={buscarSemanas}
            disabled={adicionando}
          >
            {adicionando ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Carregando…
              </>
            ) : (
              <>
                <Download className="size-4" />
                Carregar
              </>
            )}
          </button>
        </div>

        {totalPaginas > 1 && (
          <div className="flex items-center gap-2">
            <button
              className="rounded border border-slate-300 p-1.5 hover:bg-slate-100 disabled:opacity-40"
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
              disabled={pagina <= 1}
              title="Página anterior"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-sm text-slate-600">
              Página {pagina} de {totalPaginas}
            </span>
            <button
              className="rounded border border-slate-300 p-1.5 hover:bg-slate-100 disabled:opacity-40"
              onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
              disabled={pagina >= totalPaginas}
              title="Próxima página"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        )}
      </div>
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
    importada: "Sem designações",
    preview: "Em preview",
    final: "Designações feitas",
  };
  return <span className={`rounded px-2 py-0.5 text-xs ${estilos[status]}`}>{rotulos[status]}</span>;
}

function LinhaPreview({
  item,
  pessoas,
  pessoasPorId,
  contagemPorPessoa,
  mostrarTodos,
  onToggleMostrarTodos,
  onChange,
  onInverterAjudante,
  config,
}: {
  item: ItemPreview;
  pessoas: Pessoa[];
  pessoasPorId: Map<number, Pessoa>;
  contagemPorPessoa: Map<number, number>;
  mostrarTodos: boolean;
  onToggleMostrarTodos: () => void;
  onChange: (campo: "pessoa_id" | "ajudante_id", valor: number | null) => void;
  onInverterAjudante: () => void;
  config: Config | null;
}) {
  const ehLeitorEstudo = item.tipo === "estudo_biblico";
  const opcoes = (
    mostrarTodos ? pessoas : pessoas.filter((p) => elegivel(item.tipo, p) || p.id === item.pessoa_id)
  )
    .slice()
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const pessoaEscolhida = item.pessoa_id ? pessoasPorId.get(item.pessoa_id) : null;
  const opcoesAjudante = ehLeitorEstudo
    ? pessoas
        .filter((p) => mostrarTodos || (config && elegivelAjudante(item.tipo, "", p, config)))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
    : pessoaEscolhida
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
            {p.nome} ({contagemPorPessoa.get(p.id) ?? 0})
          </option>
        ))}
      </select>

      {item.tem_ajudante && !ehLeitorEstudo && (
        <button
          type="button"
          className="shrink-0 rounded border border-slate-300 p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={onInverterAjudante}
          disabled={!item.pessoa_id && !item.ajudante_id}
          title="Inverter designado e ajudante"
        >
          <ArrowRightLeft className="size-4" />
        </button>
      )}

      {item.tem_ajudante && (
        <select
          className="min-w-[180px] flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
          value={item.ajudante_id ?? ""}
          onChange={(e) => onChange("ajudante_id", e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">{ehLeitorEstudo ? "— leitor —" : "— ajudante —"}</option>
          {opcoesAjudante.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome} ({contagemPorPessoa.get(p.id) ?? 0})
            </option>
          ))}
        </select>
      )}

      <button
        type="button"
        className="inline-flex shrink-0 items-center gap-1 text-xs text-slate-400 hover:text-slate-700"
        onClick={onToggleMostrarTodos}
        title="Mostrar todas as pessoas, mesmo as não elegíveis"
      >
        {mostrarTodos ? (
          <>
            <EyeOff className="size-3.5" />
            só elegíveis
          </>
        ) : (
          <>
            <Eye className="size-3.5" />
            mostrar todos
          </>
        )}
      </button>
    </div>
  );
}
