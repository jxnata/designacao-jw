// Conversão do cabeçalho de datas da apostila ("2-8 DE NOVEMBRO JEREMIAS
// 49-50", ou cruzando o mês/ano: "30 DE NOVEMBRO–6 DE DEZEMBRO") em ano +
// semana ISO + leitura semanal, usando o metadado `Title` do PDF (ex.:
// "mwb26.11-T") como referência de ano/bimestre — os cabeçalhos de página
// não repetem o ano.

const MESES: Record<string, number> = {
  JANEIRO: 1,
  FEVEREIRO: 2,
  MARCO: 3,
  MARÇO: 3,
  ABRIL: 4,
  MAIO: 5,
  JUNHO: 6,
  JULHO: 7,
  AGOSTO: 8,
  SETEMBRO: 9,
  OUTUBRO: 10,
  NOVEMBRO: 11,
  DEZEMBRO: 12,
};

const NOMES_MES = [
  "",
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

const NOMES_MESES_REGEX = Object.keys(MESES).join("|");
const RE_DATA = new RegExp(
  `^(\\d{1,2})(?:-(\\d{1,2}))?DE(${NOMES_MESES_REGEX})(?:[-–—](\\d{1,2})DE(${NOMES_MESES_REGEX}))?`,
);

/** Extrai (ano, bimestre) do `Title` do PDF, ex.: "mwb26.11-T" → (2026, 11). */
export function anoEBimestreDoTitulo(titulo: string): { ano: number; bimestreInicial: number } | null {
  const m = /^mwb(\d{2})\.(\d{2})-/i.exec(titulo.trim());
  if (!m) return null;
  return { ano: 2000 + Number(m[1]), bimestreInicial: Number(m[2]) };
}

export interface CabecalhoSemana {
  inicio: Date;
  fim: Date;
  intervalo_texto: string;
  /** Livro + capítulos, quando reconhecível no restante da linha — melhor
   * esforço, é só um texto de exibição. */
  leitura_semanal: string;
}

/** Interpreta o cabeçalho de datas (+ leitura semanal) de uma semana da
 * apostila. `anoBase` é o ano do bimestre (do metadado do PDF); como o
 * cabeçalho da página nunca repete o ano, ele serve de âncora — a virada
 * dez→jan é detectada quando o mês final é "janeiro" e o inicial não. */
export function interpretarCabecalho(linha: string, anoBase: number): CabecalhoSemana | null {
  const compacta = linha.toUpperCase().replace(/\s+/g, "");
  const m = RE_DATA.exec(compacta);
  if (!m) return null;

  const dia1 = Number(m[1]);
  const mes1 = MESES[m[3]];
  const temSegundo = m[4] !== undefined && m[5] !== undefined;
  const dia2 = temSegundo ? Number(m[4]) : m[2] !== undefined ? Number(m[2]) : dia1;
  const mes2 = temSegundo ? MESES[m[5]] : mes1;

  // Virada de ano: só o mês final pode ser janeiro com o inicial sendo
  // dezembro (a apostila nunca cruza mais de um ano numa mesma semana).
  const ano1 = anoBase;
  const ano2 = mes1 === 12 && mes2 === 1 ? anoBase + 1 : anoBase;

  const inicio = new Date(Date.UTC(ano1, mes1 - 1, dia1));
  const fim = new Date(Date.UTC(ano2, mes2 - 1, dia2));

  const intervalo_texto = temSegundo
    ? `${dia1} DE ${nomeMes(mes1).toUpperCase()}–${dia2} DE ${nomeMes(mes2).toUpperCase()}`
    : `${dia1}-${dia2} DE ${nomeMes(mes1).toUpperCase()}`;

  const resto = compacta.slice(m[0].length);
  const leituraM = /^([A-ZÇÃÕÁÉÍÓÚÂÊÔ]+)(\d{1,3})(?:-(\d{1,3}))?/.exec(resto);
  const leitura_semanal = leituraM
    ? `${capitalizar(leituraM[1])} ${formatarCapitulos(leituraM[2], leituraM[3])}`
    : "";

  return { inicio, fim, intervalo_texto, leitura_semanal };
}

function nomeMes(n: number): string {
  return NOMES_MES[n] ?? "";
}

function capitalizar(palavra: string): string {
  return palavra.charAt(0) + palavra.slice(1).toLowerCase();
}

/** Nenhum livro da Bíblia passa de 150 capítulos (Salmos). Usado só para
 * descolar um número de página que grudou sem separador no fim do
 * capítulo final (ex.: "49-502", onde "50" é o capítulo e "2" é a página). */
const MAX_CAPITULOS_BIBLIA = 150;

function formatarCapitulos(cap1: string, cap2: string | undefined): string {
  if (cap2 === undefined) return cap1;
  let fim = cap2;
  while (fim.length > 1 && Number(fim) > MAX_CAPITULOS_BIBLIA) {
    fim = fim.slice(0, -1);
  }
  if (Number(fim) > MAX_CAPITULOS_BIBLIA) return cap1;
  return `${cap1}-${fim}`;
}

/** Ano e número da semana ISO 8601 (semana começa na segunda; pertence ao
 * ano da quinta-feira daquela semana) — mesmo esquema usado pelo `chrono`
 * no antigo scraper em Rust. */
export function semanaIso(data: Date): { ano: number; semana_iso: number } {
  const d = new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate()));
  // getUTCDay(): 0=domingo..6=sábado; converte para 1=segunda..7=domingo.
  const diaSemanaIso = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + 4 - diaSemanaIso); // quinta-feira desta semana
  const anoIso = d.getUTCFullYear();
  const inicioAno = new Date(Date.UTC(anoIso, 0, 1));
  const semana = Math.ceil(((d.getTime() - inicioAno.getTime()) / 86400000 + 1) / 7);
  return { ano: anoIso, semana_iso: semana };
}
