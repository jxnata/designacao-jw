import Database from "@tauri-apps/plugin-sql";
import type {
  Config,
  Designacao,
  Parte,
  Pessoa,
  Semana,
  SemanaWeb,
  StatusSemana,
} from "./types";

const DB_URL = "sqlite:designacoes.db";

let dbPromise: Promise<Database> | null = null;

export function getDb(): Promise<Database> {
  if (!dbPromise) dbPromise = Database.load(DB_URL);
  return dbPromise;
}

function bool(v: unknown): boolean {
  return v === 1 || v === true;
}

// tauri-plugin-sql não serializa `true`/`false` como inteiro 0/1 ao fazer
// bind de parâmetros — precisamos converter manualmente antes de gravar,
// senão os CHECK constraints e a leitura de volta (bool() acima) quebram.
function int(v: boolean): number {
  return v ? 1 : 0;
}

function toPessoa(r: Record<string, unknown>): Pessoa {
  return {
    id: r.id as number,
    nome: r.nome as string,
    grupo: r.grupo as number,
    surdo: bool(r.surdo),
    sexo: r.sexo as Pessoa["sexo"],
    publicador: bool(r.publicador),
    batizado: bool(r.batizado),
    servo: bool(r.servo),
    anciao: bool(r.anciao),
    ativo: bool(r.ativo),
  };
}

// ---------- Pessoas ----------

export async function listarPessoas(incluirInativas = true): Promise<Pessoa[]> {
  const db = await getDb();
  const rows = await db.select<Record<string, unknown>[]>(
    `SELECT * FROM pessoas ${incluirInativas ? "" : "WHERE ativo = 1"} ORDER BY nome`,
  );
  return rows.map(toPessoa);
}

export async function salvarPessoa(p: Omit<Pessoa, "id"> & { id?: number }): Promise<number> {
  const db = await getDb();
  // Mulheres nunca são servo/ancião — a UI já trava isso, mas reforçamos aqui.
  const servo = p.sexo === "f" ? false : p.servo;
  const anciao = p.sexo === "f" ? false : p.anciao;
  if (p.id) {
    await db.execute(
      `UPDATE pessoas SET nome=$1, grupo=$2, surdo=$3, sexo=$4, publicador=$5, batizado=$6, servo=$7, anciao=$8, ativo=$9 WHERE id=$10`,
      [p.nome, p.grupo, int(p.surdo), p.sexo, int(p.publicador), int(p.batizado), int(servo), int(anciao), int(p.ativo), p.id],
    );
    return p.id;
  }
  const res = await db.execute(
    `INSERT INTO pessoas (nome, grupo, surdo, sexo, publicador, batizado, servo, anciao, ativo) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [p.nome, p.grupo, int(p.surdo), p.sexo, int(p.publicador), int(p.batizado), int(servo), int(anciao), int(p.ativo)],
  );
  return res.lastInsertId as number;
}

export async function excluirPessoa(id: number): Promise<void> {
  const db = await getDb();
  await db.execute(`DELETE FROM pessoas WHERE id = $1`, [id]);
}

// ---------- Config ----------

function toConfig(r: Record<string, unknown>): Config {
  return {
    id: r.id as number,
    congregacao: r.congregacao as string,
    dia_semana: r.dia_semana as number,
    horario: r.horario as string,
    transicao_min: r.transicao_min as number,
    usar_servos_presidencia: bool(r.usar_servos_presidencia),
    usar_servos_estudo_biblico: bool(r.usar_servos_estudo_biblico),
    usar_anciaos_leitura: bool(r.usar_anciaos_leitura),
  };
}

export async function getConfig(): Promise<Config> {
  const db = await getDb();
  const rows = await db.select<Record<string, unknown>[]>(`SELECT * FROM config WHERE id = 1`);
  return toConfig(rows[0]);
}

export async function salvarConfig(c: Config): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE config SET congregacao=$1, dia_semana=$2, horario=$3, transicao_min=$4, usar_servos_presidencia=$5, usar_servos_estudo_biblico=$6, usar_anciaos_leitura=$7 WHERE id=1`,
    [
      c.congregacao,
      c.dia_semana,
      c.horario,
      c.transicao_min,
      int(c.usar_servos_presidencia),
      int(c.usar_servos_estudo_biblico),
      int(c.usar_anciaos_leitura),
    ],
  );
}

// ---------- Semanas / partes ----------

export async function listarSemanas(status?: StatusSemana): Promise<Semana[]> {
  const db = await getDb();
  const rows = status
    ? await db.select<Semana[]>(`SELECT * FROM semanas WHERE status = $1 ORDER BY ordinal`, [status])
    : await db.select<Semana[]>(`SELECT * FROM semanas ORDER BY ordinal`);
  return rows;
}

export async function proximoOrdinal(): Promise<number> {
  const db = await getDb();
  const rows = await db.select<{ m: number | null }[]>(
    `SELECT MAX(ordinal) as m FROM semanas`,
  );
  return (rows[0]?.m ?? -1) + 1;
}

/** Grava as semanas baixadas do wol.jw.org (idempotente por doc_id). */
export async function importarSemanas(semanasWeb: SemanaWeb[]): Promise<void> {
  const db = await getDb();
  let ordinal = await proximoOrdinal();
  for (const s of semanasWeb) {
    const existente = await db.select<{ id: number }[]>(
      `SELECT id FROM semanas WHERE doc_id = $1`,
      [s.doc_id],
    );
    if (existente.length > 0) continue;

    const res = await db.execute(
      `INSERT INTO semanas (ordinal, ano, semana_iso, doc_id, intervalo_texto, leitura_semanal, cantico_inicial, cantico_meio, cantico_final, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'importada')`,
      [
        ordinal,
        s.ano,
        s.semana_iso,
        s.doc_id,
        s.intervalo_texto,
        s.leitura_semanal,
        s.cantico_inicial,
        s.cantico_meio,
        s.cantico_final,
      ],
    );
    const semanaId = res.lastInsertId as number;
    ordinal += 1;

    for (const p of s.partes) {
      await db.execute(
        `INSERT INTO partes (semana_id, ordem, numero, secao, titulo, duracao_min, descricao, tipo, tem_ajudante)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [semanaId, p.ordem, p.numero, p.secao, p.titulo, p.duracao_min, p.descricao, p.tipo, int(p.tem_ajudante)],
      );
    }
  }
}

export async function listarPartes(semanaId: number): Promise<Parte[]> {
  const db = await getDb();
  const rows = await db.select<Record<string, unknown>[]>(
    `SELECT * FROM partes WHERE semana_id = $1 ORDER BY ordem`,
    [semanaId],
  );
  return rows.map((r) => ({ ...(r as unknown as Parte), tem_ajudante: bool(r.tem_ajudante) }));
}

export async function atualizarStatusSemana(id: number, status: StatusSemana): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE semanas SET status = $1, atualizado_em = datetime('now') WHERE id = $2`, [
    status,
    id,
  ]);
}

export async function excluirSemana(id: number): Promise<void> {
  const db = await getDb();
  await db.execute(`DELETE FROM semanas WHERE id = $1`, [id]);
}

// ---------- Designações ----------

export async function listarDesignacoesPorSemana(semanaId: number): Promise<Designacao[]> {
  const db = await getDb();
  return db.select<Designacao[]>(`SELECT * FROM designacoes WHERE semana_id = $1`, [semanaId]);
}

export interface DesignacaoParaGravar {
  semana_id: number;
  parte_id: number | null;
  tipo: TipoParteMinimo;
  pessoa_id: number | null;
  ajudante_id: number | null;
}
type TipoParteMinimo = string;

/** Substitui todas as designações das semanas informadas (usado tanto para
 * salvar o preview quanto para confirmar a versão final). */
export async function salvarDesignacoes(
  semanaIds: number[],
  designacoes: DesignacaoParaGravar[],
): Promise<void> {
  const db = await getDb();
  for (const id of semanaIds) {
    await db.execute(`DELETE FROM designacoes WHERE semana_id = $1`, [id]);
  }
  for (const d of designacoes) {
    await db.execute(
      `INSERT INTO designacoes (semana_id, parte_id, tipo, pessoa_id, ajudante_id) VALUES ($1,$2,$3,$4,$5)`,
      [d.semana_id, d.parte_id, d.tipo, d.pessoa_id, d.ajudante_id],
    );
  }
}

// ---------- Histórico ----------

export interface HistoricoLinha {
  pessoa_id: number;
  nome: string;
  tipo: string;
  quantidade: number;
}

/** Histórico agregado (pessoa × tipo) considerando só semanas 'final'. */
export async function historicoAgregado(): Promise<HistoricoLinha[]> {
  const db = await getDb();
  return db.select<HistoricoLinha[]>(`
    SELECT p.id as pessoa_id, p.nome as nome, d.tipo as tipo, COUNT(*) as quantidade
    FROM designacoes d
    JOIN semanas s ON s.id = d.semana_id AND s.status = 'final'
    JOIN pessoas p ON p.id = d.pessoa_id
    WHERE d.pessoa_id IS NOT NULL
    GROUP BY p.id, d.tipo
    ORDER BY p.nome
  `);
}

export interface HistoricoParaBalanceador {
  pessoa_id: number;
  tipo: string;
  semana_ordinal: number;
  como_ajudante: boolean;
}

/** Histórico "cru" (uma linha por designação) usado como entrada do
 * balanceador em Rust — ele mesmo agrega e calcula recência. */
export async function historicoParaBalanceador(): Promise<HistoricoParaBalanceador[]> {
  const db = await getDb();
  const principais = await db.select<{ pessoa_id: number; tipo: string; ordinal: number }[]>(`
    SELECT d.pessoa_id as pessoa_id, d.tipo as tipo, s.ordinal as ordinal
    FROM designacoes d
    JOIN semanas s ON s.id = d.semana_id AND s.status = 'final'
    WHERE d.pessoa_id IS NOT NULL
  `);
  const ajudantes = await db.select<{ pessoa_id: number; tipo: string; ordinal: number }[]>(`
    SELECT d.ajudante_id as pessoa_id, d.tipo as tipo, s.ordinal as ordinal
    FROM designacoes d
    JOIN semanas s ON s.id = d.semana_id AND s.status = 'final'
    WHERE d.ajudante_id IS NOT NULL
  `);
  return [
    ...principais.map((r) => ({ ...r, semana_ordinal: r.ordinal, como_ajudante: false })),
    ...ajudantes.map((r) => ({ ...r, semana_ordinal: r.ordinal, como_ajudante: true })),
  ].map(({ pessoa_id, tipo, semana_ordinal, como_ajudante }) => ({
    pessoa_id,
    tipo,
    semana_ordinal,
    como_ajudante,
  }));
}

// ---------- Backup ----------

export interface BackupCompleto {
  versao: 1;
  exportado_em: string;
  config: Config;
  pessoas: Pessoa[];
  semanas: Semana[];
  partes: Parte[];
  designacoes: Designacao[];
}

export async function exportarBackup(): Promise<BackupCompleto> {
  const db = await getDb();
  const [config, pessoas, semanas, partes, designacoes] = await Promise.all([
    getConfig(),
    listarPessoas(true),
    listarSemanas(),
    db.select<Record<string, unknown>[]>(`SELECT * FROM partes`),
    db.select<Designacao[]>(`SELECT * FROM designacoes`),
  ]);
  return {
    versao: 1,
    exportado_em: new Date().toISOString(),
    config,
    pessoas,
    semanas,
    partes: partes.map((r) => ({ ...(r as unknown as Parte), tem_ajudante: bool(r.tem_ajudante) })),
    designacoes,
  };
}

/** Restaura um backup completo, substituindo todo o conteúdo atual do
 * banco dentro de uma única transação. */
export async function importarBackup(b: BackupCompleto): Promise<void> {
  const db = await getDb();
  await db.execute("BEGIN");
  try {
    await db.execute(`DELETE FROM designacoes`);
    await db.execute(`DELETE FROM partes`);
    await db.execute(`DELETE FROM semanas`);
    await db.execute(`DELETE FROM pessoas`);

    await db.execute(
      `UPDATE config SET congregacao=$1, dia_semana=$2, horario=$3, transicao_min=$4, usar_servos_presidencia=$5, usar_servos_estudo_biblico=$6, usar_anciaos_leitura=$7 WHERE id=1`,
      [
        b.config.congregacao,
        b.config.dia_semana,
        b.config.horario,
        b.config.transicao_min,
        int(b.config.usar_servos_presidencia ?? true),
        int(b.config.usar_servos_estudo_biblico ?? true),
        int(b.config.usar_anciaos_leitura ?? false),
      ],
    );

    for (const p of b.pessoas) {
      await db.execute(
        `INSERT INTO pessoas (id, nome, grupo, surdo, sexo, publicador, batizado, servo, anciao, ativo) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [p.id, p.nome, p.grupo, int(p.surdo), p.sexo, int(p.publicador), int(p.batizado), int(p.servo), int(p.anciao), int(p.ativo)],
      );
    }
    for (const s of b.semanas) {
      await db.execute(
        `INSERT INTO semanas (id, ordinal, ano, semana_iso, doc_id, intervalo_texto, leitura_semanal, cantico_inicial, cantico_meio, cantico_final, status, atualizado_em)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          s.id, s.ordinal, s.ano, s.semana_iso, s.doc_id, s.intervalo_texto, s.leitura_semanal,
          s.cantico_inicial, s.cantico_meio, s.cantico_final, s.status, s.atualizado_em,
        ],
      );
    }
    for (const p of b.partes) {
      await db.execute(
        `INSERT INTO partes (id, semana_id, ordem, numero, secao, titulo, duracao_min, descricao, tipo, tem_ajudante)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [p.id, p.semana_id, p.ordem, p.numero, p.secao, p.titulo, p.duracao_min, p.descricao, p.tipo, int(p.tem_ajudante)],
      );
    }
    for (const d of b.designacoes) {
      await db.execute(
        `INSERT INTO designacoes (id, semana_id, parte_id, tipo, pessoa_id, ajudante_id) VALUES ($1,$2,$3,$4,$5,$6)`,
        [d.id, d.semana_id, d.parte_id, d.tipo, d.pessoa_id, d.ajudante_id],
      );
    }
    await db.execute("COMMIT");
  } catch (e) {
    await db.execute("ROLLBACK");
    throw e;
  }
}
