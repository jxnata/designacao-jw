import { useEffect, useState } from "react";
import { getConfig, listarDesignacoesPorSemana, listarPartes, listarPessoas, listarSemanas } from "../lib/db";
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

  useEffect(() => {
    (async () => {
      const [cfg, pessoas, semanas] = await Promise.all([
        getConfig(),
        listarPessoas(true),
        listarSemanas("final"),
      ]);
      setConfig(cfg);
      setPessoasPorId(new Map(pessoas.map((p) => [p.id, p])));

      const ordenadas = [...semanas].sort((a, b) => a.ordinal - b.ordinal);
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
  }, []);

  if (!config || !dados) return <p className="text-sm text-slate-500">Carregando…</p>;

  async function imprimir() {
    try {
      await window.print();
    } catch (erro) {
      console.error("Falha ao abrir a impressão", erro);
      alert("Não foi possível abrir a impressão. Verifique o console para detalhes.");
    }
  }

  return (
    <div>
      <div className="no-print mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Programação impressa</h1>
        <button
          className="rounded bg-teal-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-teal-800"
          onClick={imprimir}
        >
          Imprimir / salvar PDF
        </button>
      </div>

      {dados.length === 0 && (
        <p className="text-sm text-slate-400">
          Nenhuma semana confirmada ainda. Gere e confirme um preview na aba Designação.
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
