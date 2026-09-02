import { calcularHorarios } from "../lib/horarios";
import type { Config, Designacao, Parte, Pessoa, Semana, TipoParte } from "../lib/types";

const CORES: Record<"tesouros" | "ministerio" | "vida_crista", string> = {
  tesouros: "#3B696F",
  ministerio: "#A66902",
  vida_crista: "#96141F",
};

const TITULOS_SECAO: Record<"tesouros" | "ministerio" | "vida_crista", string> = {
  tesouros: "TESOUROS DA PALAVRA DE DEUS",
  ministerio: "FAÇA SEU MELHOR NO MINISTÉRIO",
  vida_crista: "NOSSA VIDA CRISTÃ",
};

/** Rótulo de papel mostrado acima do nome, replicando o modelo em PDF —
 * partes de discurso (talks) não levam rótulo, só o nome. */
function rotuloPapel(tipo: TipoParte): string | null {
  switch (tipo) {
    case "leitura":
      return "Estudante:";
    case "ministerio_demonstracao":
      return "Estudante/Ajudante:";
    case "estudo_biblico":
      return "Dirigente:";
    case "oracao_inicial":
    case "oracao_final":
      return "Oração:";
    default:
      return null;
  }
}

interface Props {
  semana: Semana;
  partes: Parte[];
  designacoes: Designacao[];
  pessoasPorId: Map<number, Pessoa>;
  config: Config;
}

export default function SemanaImpressa({ semana, partes, designacoes, pessoasPorId, config }: Props) {
  const porTipo = new Map<string, Designacao>();
  for (const d of designacoes) {
    const chave = d.parte_id ? `parte:${d.parte_id}` : `tipo:${d.tipo}`;
    porTipo.set(chave, d);
  }
  const horarios = calcularHorarios(config, partes);

  function nome(d?: Designacao): string {
    if (!d?.pessoa_id) return "";
    const principal = pessoasPorId.get(d.pessoa_id)?.nome ?? "";
    if (d.ajudante_id) {
      const aj = pessoasPorId.get(d.ajudante_id)?.nome ?? "";
      return aj ? `${principal} & ${aj}` : principal;
    }
    return principal;
  }

  const presidente = designacoes.find((d) => d.tipo === "presidente");
  const oracaoInicial = designacoes.find((d) => d.tipo === "oracao_inicial");
  const oracaoFinal = designacoes.find((d) => d.tipo === "oracao_final");

  const tesourosPartes = partes.filter((p) => p.secao === "tesouros");
  const ministerioPartes = partes.filter((p) => p.secao === "ministerio");
  const vidaCristaPartes = partes.filter((p) => p.secao === "vida_crista");

  function Linha({ parte }: { parte: Parte }) {
    const d = porTipo.get(`parte:${parte.id}`);
    const rotulo = rotuloPapel(parte.tipo);
    return (
      <div className="grid grid-cols-[46px_1fr_200px] items-start gap-2 py-[3px] text-[10.5px] leading-tight">
        <div className="pt-0.5 text-slate-500">{horarios[`parte_${parte.id}`]}</div>
        <div>
          {parte.numero}. {parte.titulo} ({parte.duracao_min} min.)
        </div>
        <div>
          {rotulo && <div className="text-[9px] text-slate-500">{rotulo}</div>}
          <div className="font-medium">{nome(d)}</div>
        </div>
      </div>
    );
  }

  function BarraSecao({ secao }: { secao: "tesouros" | "ministerio" | "vida_crista" }) {
    return (
      <div
        className="my-1 px-2 py-1 text-[10px] font-semibold text-white"
        style={{ background: CORES[secao] }}
      >
        {TITULOS_SECAO[secao]}
      </div>
    );
  }

  return (
    <div className="mb-6 break-inside-avoid rounded border border-slate-200 p-3">
      <div className="mb-1 flex items-baseline justify-between border-b border-slate-300 pb-1">
        <div className="text-sm font-semibold">
          {semana.intervalo_texto} | {semana.leitura_semanal}
        </div>
        <div className="text-right text-[10px]">
          <div className="text-slate-500">Presidente:</div>
          <div className="font-medium">{nome(presidente)}</div>
        </div>
      </div>

      <div className="grid grid-cols-[46px_1fr_200px] items-start gap-2 py-[3px] text-[10.5px]">
        <div className="text-slate-500">{horarios["cantico_inicial"]}</div>
        <div>Cântico {semana.cantico_inicial}</div>
        <div>
          <div className="text-[9px] text-slate-500">Oração:</div>
          <div className="font-medium">{nome(oracaoInicial)}</div>
        </div>
      </div>
      <div className="grid grid-cols-[46px_1fr_200px] items-start gap-2 py-[3px] text-[10.5px]">
        <div className="text-slate-500">{horarios["comentarios_iniciais"]}</div>
        <div>Comentários iniciais (1 min)</div>
        <div className="text-[9px] text-slate-500">Salão principal</div>
      </div>

      <BarraSecao secao="tesouros" />
      {tesourosPartes.map((p) => (
        <Linha key={p.id} parte={p} />
      ))}

      <BarraSecao secao="ministerio" />
      {ministerioPartes.map((p) => (
        <Linha key={p.id} parte={p} />
      ))}

      <div className="grid grid-cols-[46px_1fr_200px] items-start gap-2 py-[3px] text-[10.5px]">
        <div className="text-slate-500">{horarios["cantico_meio"]}</div>
        <div>Cântico {semana.cantico_meio}</div>
        <div />
      </div>

      <BarraSecao secao="vida_crista" />
      {vidaCristaPartes.map((p) => (
        <Linha key={p.id} parte={p} />
      ))}

      <div className="grid grid-cols-[46px_1fr_200px] items-start gap-2 border-t border-slate-200 py-[3px] pt-1 text-[10.5px]">
        <div className="text-slate-500">{horarios["comentarios_finais"]}</div>
        <div>Comentários finais (3 min)</div>
        <div />
      </div>
      <div className="grid grid-cols-[46px_1fr_200px] items-start gap-2 py-[3px] text-[10.5px]">
        <div className="text-slate-500">{horarios["cantico_final"]}</div>
        <div>Cântico {semana.cantico_final}</div>
        <div>
          <div className="text-[9px] text-slate-500">Oração:</div>
          <div className="font-medium">{nome(oracaoFinal)}</div>
        </div>
      </div>
    </div>
  );
}
