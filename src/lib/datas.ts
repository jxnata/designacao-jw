/** Helpers de data e nome de arquivo usados na geração dos S-89. */

/** Segunda-feira da semana ISO informada (4 de janeiro sempre cai na semana 1). */
function segundaFeiraDaSemanaIso(ano: number, semanaIso: number): Date {
  const quatroDeJaneiro = new Date(Date.UTC(ano, 0, 4));
  const diaSemanaIso = (quatroDeJaneiro.getUTCDay() + 6) % 7; // 0 = segunda
  const segundaSemana1 = new Date(quatroDeJaneiro);
  segundaSemana1.setUTCDate(quatroDeJaneiro.getUTCDate() - diaSemanaIso);
  const resultado = new Date(segundaSemana1);
  resultado.setUTCDate(segundaSemana1.getUTCDate() + (semanaIso - 1) * 7);
  return resultado;
}

/**
 * Data do dia da reunião dentro da semana ISO, a partir de `Config.dia_semana`
 * (0 = domingo, 1 = segunda, ... 6 = sábado).
 */
export function dataDaReuniao(ano: number, semanaIso: number, diaSemana: number): Date {
  const segunda = segundaFeiraDaSemanaIso(ano, semanaIso);
  const offsetDaSegunda = (diaSemana + 6) % 7; // domingo (0) vira 6 dias depois da segunda
  const data = new Date(segunda);
  data.setUTCDate(segunda.getUTCDate() + offsetDaSegunda);
  return data;
}

export function formatarData(d: Date): string {
  const dia = String(d.getUTCDate()).padStart(2, "0");
  const mes = String(d.getUTCMonth() + 1).padStart(2, "0");
  const ano = d.getUTCFullYear();
  return `${dia}/${mes}/${ano}`;
}

/** Normaliza texto para uso em nome de arquivo/pasta: sem acentos, minúsculo,
 * espaços e pontuação viram "-". */
export function slug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
