// Os nomes dos campos aqui são snake_case de propósito: são exatamente os
// nomes que atravessam o IPC do Tauri (JSON <-> structs Rust) e as colunas
// do SQLite, então manter tudo igual evita uma camada de tradução que só
// criaria oportunidade de bug.

export type Sexo = "m" | "f";

export type TipoParte =
  | "presidente"
  | "oracao_inicial"
  | "oracao_final"
  | "tesouros"
  | "joias"
  | "leitura"
  | "ministerio_discurso"
  | "ministerio_demonstracao"
  | "ministerio_consideracao"
  | "vida_crista"
  | "vida_crista_ancioes"
  | "necessidades_locais"
  | "estudo_biblico";

export const ROTULO_TIPO: Record<TipoParte, string> = {
  presidente: "Presidente",
  oracao_inicial: "Oração inicial",
  oracao_final: "Oração final",
  tesouros: "Tesouros da Palavra de Deus",
  joias: "Joias espirituais",
  leitura: "Leitura da Bíblia",
  ministerio_discurso: "Discurso (ministério)",
  ministerio_demonstracao: "Demonstração (ministério)",
  ministerio_consideracao: "Consideração (ministério)",
  vida_crista: "Nossa Vida Cristã",
  vida_crista_ancioes: "Nossa Vida Cristã (anciãos)",
  necessidades_locais: "Necessidades locais",
  estudo_biblico: "Estudo bíblico de congregação",
};

export type Secao = "tesouros" | "ministerio" | "vida_crista";

export type Sala = "principal" | "b" | "c";

export const ROTULO_SALA: Record<Sala, string> = {
  principal: "Salão principal",
  b: "Sala B",
  c: "Sala C",
};

export interface Pessoa {
  id: number;
  nome: string;
  grupo: number;
  surdo: boolean;
  sexo: Sexo;
  publicador: boolean;
  batizado: boolean;
  servo: boolean;
  anciao: boolean;
  ativo: boolean;
}

export interface Config {
  id: number;
  congregacao: string;
  dia_semana: number;
  horario: string;
  transicao_min: number;
  usar_servos_presidencia: boolean;
  usar_servos_estudo_biblico: boolean;
  usar_anciaos_leitura: boolean;
  congregacao_sinais: boolean;
  usar_anciaos_leitura_ebc: boolean;
  sala_b: boolean;
  sala_c: boolean;
}

export interface ParteWeb {
  ordem: number;
  numero: number | null;
  secao: Secao;
  titulo: string;
  duracao_min: number;
  descricao: string;
  tipo: TipoParte;
  tem_ajudante: boolean;
}

/** Retorno bruto do parser da apostila em PDF (`src/lib/mwb/`) — ainda não
 * gravado no banco. Mesmo formato que o antigo comando `importar_semanas`
 * (scraping de wol.jw.org, removido — ver CHANGELOG) produzia. */
export interface SemanaWeb {
  ano: number;
  semana_iso: number;
  doc_id: string;
  intervalo_texto: string;
  leitura_semanal: string;
  cantico_inicial: number | null;
  cantico_meio: number | null;
  cantico_final: number | null;
  partes: ParteWeb[];
}

export type StatusSemana = "importada" | "preview" | "final";

export type EventoSemana = "assembleia" | "congresso" | "visita" | "celebracao";

export const ROTULO_EVENTO: Record<EventoSemana, string> = {
  assembleia: "Assembleia",
  congresso: "Congresso",
  visita: "Visita",
  celebracao: "Celebração",
};

/** Eventos que cancelam a reunião inteira — ninguém é designado para
 * nenhuma parte. "Visita" não entra aqui: a reunião acontece normalmente,
 * só o Estudo Bíblico de Congregação é substituído. */
export const EVENTOS_SEM_REUNIAO: EventoSemana[] = ["assembleia", "congresso", "celebracao"];

export const TITULO_DISCURSO_VISITA = "Discurso da Visita";

export interface Semana {
  id: number;
  ordinal: number;
  ano: number;
  semana_iso: number;
  doc_id: string;
  intervalo_texto: string;
  leitura_semanal: string;
  cantico_inicial: number | null;
  cantico_meio: number | null;
  cantico_final: number | null;
  status: StatusSemana;
  evento: EventoSemana | null;
  atualizado_em: string;
}

export interface Parte {
  id: number;
  semana_id: number;
  ordem: number;
  numero: number | null;
  secao: Secao;
  titulo: string;
  duracao_min: number;
  descricao: string;
  tipo: TipoParte;
  tem_ajudante: boolean;
}

export interface Designacao {
  id: number;
  semana_id: number;
  parte_id: number | null;
  tipo: TipoParte;
  pessoa_id: number | null;
  ajudante_id: number | null;
  sala: Sala;
}

// --- payloads do comando Rust `gerar_atribuicoes` ---

export interface PessoaAssign {
  id: number;
  nome: string;
  grupo: number;
  surdo: boolean;
  sexo: string; // char no Rust: string de 1 caractere
  publicador: boolean;
  batizado: boolean;
  servo: boolean;
  anciao: boolean;
  ativo: boolean;
}

export interface DesignacaoHistorica {
  pessoa_id: number;
  tipo: TipoParte;
  semana_ordinal: number;
  como_ajudante: boolean;
}

export interface ParteParaDesignar {
  parte_id: string;
  semana_ordinal: number;
  tipo: TipoParte;
  tem_ajudante: boolean;
}

export interface DesignacaoResultado {
  parte_id: string;
  pessoa_id: number | null;
  ajudante_id: number | null;
}

/** Uma linha do preview editável: uma unidade de designação da semana. */
export interface ItemPreview {
  parte_id: string; // "<semana_id>:<indice>" — ver designacao.ts
  semana_id: number;
  tipo: TipoParte;
  titulo: string;
  duracao_min: number;
  tem_ajudante: boolean;
  pessoa_id: number | null;
  ajudante_id: number | null;
  sala: Sala;
  /** true quando o evento marcado na semana (assembleia/congresso/visita/
   * celebração) impede designar essa unidade — a UI desabilita os campos. */
  bloqueado?: boolean;
}
