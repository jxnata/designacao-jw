import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { FileDown, Loader2, Printer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getConfig, listarDesignacoesPorSemana, listarPartes, listarPessoas, listarSemanas } from "../lib/db";
import { dataDaReuniao, formatarData, slug } from "../lib/datas";
import { dadosS89DeDesignacao, designacoesParaS89, gerarS89 } from "../lib/s89";
import type { Config, Designacao, Parte, Pessoa, Semana } from "../lib/types";
import SemanaImpressa from "../components/SemanaImpressa";
import "../print.css";

interface Dados {
  semana: Semana;
  partes: Parte[];
  designacoes: Designacao[];
}

export default function Impressao() {
  const [config, setConfig] = useState<Config | null>(null);
  const [pessoasPorId, setPessoasPorId] = useState<Map<number, Pessoa>>(new Map());
  const [dados, setDados] = useState<Dados[] | null>(null);
  const [gerando, setGerando] = useState<{ atual: number; total: number } | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const filtro = searchParams.get("semanas");

  useEffect(() => {
    (async () => {
      const [cfg, pessoas, semanas] = await Promise.all([
        getConfig(),
        listarPessoas(true),
        listarSemanas("final"),
      ]);
      setConfig(cfg);
      setPessoasPorId(new Map(pessoas.map((p) => [p.id, p])));

      const ids = filtro ? new Set(filtro.split(",").map(Number).filter(Number.isFinite)) : null;
      const ordenadas = [...semanas]
        .filter((s) => !ids || ids.has(s.id))
        .sort((a, b) => a.ordinal - b.ordinal);
      const carregadas: Dados[] = [];
      for (const semana of ordenadas) {
        const [partes, designacoes] = await Promise.all([
          listarPartes(semana.id),
          listarDesignacoesPorSemana(semana.id),
        ]);
        carregadas.push({ semana, partes, designacoes });
      }
      setDados(carregadas);
    })();
  }, [filtro]);

  const totalS89 = useMemo(() => {
    if (!dados) return 0;
    return dados.reduce((soma, { partes, designacoes }) => soma + designacoesParaS89(partes, designacoes).length, 0);
  }, [dados]);

  if (!config || !dados) return <p className="text-sm text-slate-500">Carregando…</p>;

  async function imprimir() {
    try {
      await window.print();
    } catch (erro) {
      console.error("Falha ao abrir a impressão", erro);
      alert("Não foi possível abrir a impressão. Verifique o console para detalhes.");
    }
  }

  async function gerarArquivosS89() {
    setErro(null);
    setMensagem(null);

    const pasta = await open({ directory: true, title: "Escolher pasta para os S-89" });
    if (!pasta || Array.isArray(pasta)) return;

    // `config`/`dados` já foram checados no early return do início do
    // componente, mas essa garantia não atravessa o fechamento desta
    // função — daí os `!` abaixo.
    const cfg = config!;
    const arquivos: { caminho_relativo: string; bytes: number[] }[] = [];
    const itens = dados!.flatMap(({ semana, partes, designacoes }) =>
      designacoesParaS89(partes, designacoes).map((item) => ({ semana, item })),
    );

    setGerando({ atual: 0, total: itens.length });
    try {
      for (let i = 0; i < itens.length; i++) {
        const { semana, item } = itens[i];
        const data = formatarData(dataDaReuniao(semana.ano, semana.semana_iso, cfg.dia_semana));
        const dadosFormulario = dadosS89DeDesignacao(item, pessoasPorId, data);
        const bytes = await gerarS89(dadosFormulario);

        const numero = item.parte.numero != null ? String(item.parte.numero).padStart(2, "0") : "00";
        // A sala entra no nome do arquivo para não sobrescrever o S-89 do
        // salão principal quando a mesma parte tem designações em mais de
        // uma sala na mesma semana.
        const sufixoSala = dadosFormulario.sala === "principal" ? "" : `-sala${dadosFormulario.sala.toUpperCase()}`;
        const nomeArquivo = `${semana.ano}-S${String(semana.semana_iso).padStart(2, "0")}-p${numero}${sufixoSala}-${slug(dadosFormulario.nome)}.pdf`;

        arquivos.push({
          caminho_relativo: `S-89/${nomeArquivo}`,
          bytes: Array.from(bytes),
        });
        setGerando({ atual: i + 1, total: itens.length });
      }

      const gravados = await invoke<number>("salvar_arquivos", { pasta, arquivos });
      setMensagem(`${gravados} S-89 salvo(s) em ${pasta}/S-89`);
      await revealItemInDir(pasta).catch(() => {});
    } catch (e) {
      console.error("Falha ao gerar os S-89", e);
      setErro(String(e));
    } finally {
      setGerando(null);
    }
  }

  return (
    <div>
      <div className="no-print mb-4 flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">Programação impressa</h1>
        <div className="flex items-center gap-2">
          <button
            className="inline-flex items-center gap-1.5 rounded border border-teal-700 px-4 py-1.5 text-sm font-medium text-teal-700 hover:bg-teal-50 disabled:opacity-50"
            onClick={gerarArquivosS89}
            disabled={!!gerando || totalS89 === 0}
            title={totalS89 === 0 ? "Nenhuma designação de leitura ou ministério encontrada" : undefined}
          >
            {gerando ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Gerando… {gerando.atual}/{gerando.total}
              </>
            ) : (
              <>
                <FileDown className="size-4" />
                Gerar S-89
              </>
            )}
          </button>
          <button
            className="inline-flex items-center gap-1.5 rounded bg-teal-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-teal-800"
            onClick={imprimir}
          >
            <Printer className="size-4" />
            Imprimir / salvar PDF
          </button>
        </div>
      </div>

      {mensagem && (
        <p className="no-print mb-4 rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{mensagem}</p>
      )}
      {erro && <p className="no-print mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

      {dados.length === 0 && (
        <p className="text-sm text-slate-400">
          {filtro
            ? "Nenhuma das semanas selecionadas foi encontrada."
            : "Nenhuma semana confirmada ainda. Gere e confirme um preview na aba Designação."}
        </p>
      )}

      <div className="folha-impressa mx-auto max-w-3xl bg-white p-4 shadow-sm">
        {dados.map(({ semana, partes, designacoes }) => (
          <SemanaImpressa
            key={semana.id}
            semana={semana}
            partes={partes}
            designacoes={designacoes}
            pessoasPorId={pessoasPorId}
            config={config}
          />
        ))}
      </div>
    </div>
  );
}
