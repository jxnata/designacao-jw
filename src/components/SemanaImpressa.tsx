import { calcularHorarios } from "../lib/horarios";
import { CORES_SECAO, SECAO_POR_TIPO } from "../lib/secoes";
import { EVENTOS_SEM_REUNIAO, ROTULO_EVENTO, ROTULO_SALA, TITULO_DISCURSO_VISITA } from "../lib/types";
import type { Config, Designacao, Parte, Pessoa, Sala, Semana, TipoParte } from "../lib/types";

const TITULOS_SECAO: Record<"tesouros" | "ministerio" | "vida_crista", string> = {
  tesouros: "TESOUROS DA PALAVRA DE DEUS",
  ministerio: "FAÇA SEU MELHOR NO MINISTÉRIO",
  vida_crista: "NOSSA VIDA CRISTÃ",
};

/** Rótulo de papel mostrado acima do nome, replicando o modelo em PDF —
 * partes de discurso (talks) não levam rótulo, só o nome. */
function rotuloPapel(tipo: TipoParte): string | null {
  switch (tipo) {
    case "estudo_biblico":
      return "Dirigente:";
    case "oracao_inicial":
    case "oracao_final":
      return "Oração:";
    default:
      return null;
  }
}

/** "Oração:" e "Dirigente:" ficam na mesma linha do nome; os demais rótulos quebram linha. */
function rotuloEmLinha(tipo: TipoParte): boolean {
  return tipo === "oracao_inicial" || tipo === "oracao_final" || tipo === "estudo_biblico";
}

interface Props {
  semana: Semana;
  partes: Parte[];
  designacoes: Designacao[];
  pessoasPorId: Map<number, Pessoa>;
  config: Config;
}

export default function SemanaImpressa({ semana, partes, designacoes, pessoasPorId, config }: Props) {
  // Chave inclui a sala — necessário porque leitura/ministério podem ter uma
  // designação por sala (salão principal + Sala B/C) na mesma semana.
  const porTipo = new Map<string, Designacao>();
  for (const d of designacoes) {
    const sufixo = d.parte_id ? `parte:${d.parte_id}` : `tipo:${d.tipo}`;
    porTipo.set(`${d.sala}:${sufixo}`, d);
  }
  const horarios = calcularHorarios(config, partes);

  const salasAtivas: Sala[] = [
    "principal",
    ...(config.sala_b ? (["b"] as const) : []),
    ...(config.sala_b && config.sala_c ? (["c"] as const) : []),
  ];

  /** Abrevia sobrenomes ("Jonatã Oliveira" -> "Jonatã O.") para caber sem
   * quebra de linha nas linhas com designação por sala (principal + B/C). */
  function abreviar(nomeCompleto: string): string {
    const [primeiro, ...resto] = nomeCompleto.split(" ").filter(Boolean);
    if (!primeiro || resto.length === 0) return nomeCompleto;
    return `${primeiro} ${resto.map((p) => `${p[0]}.`).join(" ")}`;
  }

  function nome(d?: Designacao, opts?: { abreviar?: boolean }): string {
    if (!d?.pessoa_id) return "";
    const formatar = opts?.abreviar ? abreviar : (n: string) => n;
    const principal = formatar(pessoasPorId.get(d.pessoa_id)?.nome ?? "");
    if (d.ajudante_id && d.tipo !== "estudo_biblico") {
      const aj = formatar(pessoasPorId.get(d.ajudante_id)?.nome ?? "");
      return aj ? `${principal} & ${aj}` : principal;
    }
    return principal;
  }

  const presidente = designacoes.find((d) => d.tipo === "presidente" && d.sala === "principal");
  const presidentesSalas = salasAtivas
    .slice(1)
    .map((sala) => ({ sala, d: designacoes.find((d) => d.tipo === "presidente" && d.sala === sala) }));
  const oracaoInicial = designacoes.find((d) => d.tipo === "oracao_inicial");
  const oracaoFinal = designacoes.find((d) => d.tipo === "oracao_final");

  const tesourosPartes = partes.filter((p) => p.secao === "tesouros");
  const ministerioPartes = partes.filter((p) => p.secao === "ministerio");
  const vidaCristaPartes = partes.filter((p) => p.secao === "vida_crista");

  const ehVisita = semana.evento === "visita";

  function Linha({ parte }: { parte: Parte }) {
    const d = porTipo.get(`principal:parte:${parte.id}`);
    const ehDiscursoVisita = ehVisita && parte.tipo === "estudo_biblico";
    const titulo = ehDiscursoVisita ? TITULO_DISCURSO_VISITA : parte.titulo;
    const rotulo = ehDiscursoVisita ? null : rotuloPapel(parte.tipo);
    const emLinha = rotuloEmLinha(parte.tipo);
    const leitor =
      !ehDiscursoVisita && parte.tipo === "estudo_biblico" && d?.ajudante_id
        ? pessoasPorId.get(d.ajudante_id)?.nome
        : null;

    // Leitura da Bíblia e as partes de ministério ganham uma designação por
    // sala ativa — as demais continuam com um único nome, como sempre.
    const replicavel = SECAO_POR_TIPO[parte.tipo] === "ministerio";
    const porSala = replicavel
      ? salasAtivas.map((sala) => ({
          sala,
          d: sala === "principal" ? d : porTipo.get(`${sala}:parte:${parte.id}`),
        }))
      : [];

    return (
      <div className="linha-impressa grid grid-cols-[46px_1fr_230px] items-start gap-2 py-[3px] text-[10.5px] leading-tight">
        <div className="pt-0.5 text-slate-500">{horarios[`parte_${parte.id}`]}</div>
        <div>
          {parte.numero}. {titulo} ({parte.duracao_min} min.)
        </div>
        {porSala.length > 1 ? (
          <div className="space-y-0.5">
            {porSala.map(({ sala, d: dSala }) => (
              <div key={sala} className="whitespace-nowrap">
                <span className="text-[9px] text-slate-500">{ROTULO_SALA[sala]}: </span>
                <span className="font-medium">{nome(dSala, { abreviar: !!dSala?.ajudante_id })}</span>
              </div>
            ))}
          </div>
        ) : emLinha ? (
          <div>
            {rotulo && <span className="text-[9px] text-slate-500">{rotulo} </span>}
            <span className="font-medium">{nome(d)}</span>
            {leitor && (
              <div>
                <span className="text-[9px] text-slate-500">Leitor: </span>
                <span className="font-medium">{leitor}</span>
              </div>
            )}
          </div>
        ) : (
          <div>
            {rotulo && <div className="text-[9px] text-slate-500">{rotulo}</div>}
            <div className="font-medium">{nome(d)}</div>
          </div>
        )}
      </div>
    );
  }

  function BarraSecao({ secao }: { secao: "tesouros" | "ministerio" | "vida_crista" }) {
    return (
      <div
        className="barra-secao linha-impressa my-1 px-2 py-1 text-[10px] font-semibold text-white"
        style={{ background: CORES_SECAO[secao].borda }}
      >
        {TITULOS_SECAO[secao]}
      </div>
    );
  }

  if (semana.evento && EVENTOS_SEM_REUNIAO.includes(semana.evento)) {
    return (
      <div className="semana-impressa mb-6 rounded border border-slate-200 p-3">
        <div className="mb-1 border-b border-slate-300 pb-1 text-sm font-semibold">
          {semana.intervalo_texto} | {semana.leitura_semanal}
        </div>
        <div
          className="linha-impressa my-1 px-2 py-2 text-center text-[11px] font-semibold text-white"
          style={{ background: CORES_SECAO.vida_crista.borda }}
        >
          Não haverá reunião — {ROTULO_EVENTO[semana.evento]}
        </div>
      </div>
    );
  }

  return (
    <div className="semana-impressa mb-6 rounded border border-slate-200 p-3">
      <div className="mb-1 flex items-baseline justify-between border-b border-slate-300 pb-1">
        <div className="text-sm font-semibold">
          {semana.intervalo_texto} | {semana.leitura_semanal}
        </div>
        <div className="text-right text-[10px]">
          <div className="text-slate-500">Presidente:</div>
          <div className="font-medium">{nome(presidente)}</div>
          {presidentesSalas.map(({ sala, d }) => (
            <div key={sala}>
              <div className="mt-0.5 text-slate-500">{ROTULO_SALA[sala]}:</div>
              <div className="font-medium">{nome(d)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="linha-impressa grid grid-cols-[46px_1fr_230px] items-start gap-2 py-[3px] text-[10.5px]">
        <div className="text-slate-500">{horarios["cantico_inicial"]}</div>
        <div>Cântico {semana.cantico_inicial}</div>
        <div>
          <span className="text-[9px] text-slate-500">Oração: </span>
          <span className="font-medium">{nome(oracaoInicial)}</span>
        </div>
      </div>
      <div className="linha-impressa grid grid-cols-[46px_1fr_230px] items-start gap-2 py-[3px] text-[10.5px]">
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

      <div className="linha-impressa grid grid-cols-[46px_1fr_230px] items-start gap-2 py-[3px] text-[10.5px]">
        <div className="text-slate-500">{horarios["cantico_meio"]}</div>
        <div>Cântico {semana.cantico_meio}</div>
        <div />
      </div>

      <BarraSecao secao="vida_crista" />
      {vidaCristaPartes.map((p) => (
        <Linha key={p.id} parte={p} />
      ))}

      <div className="linha-impressa grid grid-cols-[46px_1fr_230px] items-start gap-2 border-t border-slate-200 py-[3px] pt-1 text-[10.5px]">
        <div className="text-slate-500">{horarios["comentarios_finais"]}</div>
        <div>Comentários finais (3 min)</div>
        <div />
      </div>
      <div className="linha-impressa grid grid-cols-[46px_1fr_230px] items-start gap-2 py-[3px] text-[10.5px]">
        <div className="text-slate-500">{horarios["cantico_final"]}</div>
        <div>Cântico {semana.cantico_final}</div>
        <div>
          <span className="text-[9px] text-slate-500">Oração: </span>
          <span className="font-medium">{nome(oracaoFinal)}</span>
        </div>
      </div>
    </div>
  );
}
