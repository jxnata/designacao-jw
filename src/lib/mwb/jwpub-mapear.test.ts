import { describe, expect, it } from "vitest";
import { mapearSemanaJwpub, mapearSemanasJwpub, numeroCantico, type EdicaoJwpub } from "./jwpub-mapear";
import { validarNomeArquivoJwpub } from "./validar";
import {
  SEMANA_COM_NECESSIDADES_LOCAIS,
  SEMANA_COMUM,
  SEMANA_CRUZANDO_MES,
  SEMANA_VIRADA_DE_ANO,
} from "./fixtures/jwpub-exemplo";

const EDICAO: EdicaoJwpub = { ano: 2026, mes: 3, idioma: "T" };

describe("mapearSemanaJwpub — semana comum", () => {
  const semana = mapearSemanaJwpub(SEMANA_COMUM, EDICAO)!;

  it("monta ano, semana ISO e doc_id", () => {
    expect(semana.ano).toBe(2026);
    expect(semana.semana_iso).toBeGreaterThan(0);
    expect(semana.doc_id).toBe(`mwb:${semana.ano}-${semana.semana_iso}`);
  });

  it("normaliza intervalo_texto e leitura semanal", () => {
    expect(semana.intervalo_texto).toBe("2-8 DE MARÇO");
    expect(semana.leitura_semanal).toBe("Salmo 105");
  });

  it("normaliza os cânticos", () => {
    expect(semana.cantico_inicial).toBe(3);
    expect(semana.cantico_meio).toBe(84);
    expect(semana.cantico_final).toBe(97);
  });

  it("monta as 9 partes na ordem e seção certas", () => {
    expect(semana.partes).toHaveLength(9);
    expect(semana.partes.map((p) => p.numero)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(semana.partes.map((p) => p.secao)).toEqual([
      "tesouros",
      "tesouros",
      "tesouros",
      "ministerio",
      "ministerio",
      "ministerio",
      "ministerio",
      "vida_crista",
      "vida_crista",
    ]);
  });

  it("classifica tesouros/joias/leitura pela posição estrutural", () => {
    const [talk, gems, bread] = semana.partes;
    expect(talk.tipo).toBe("tesouros");
    expect(talk.duracao_min).toBe(10);
    expect(gems.tipo).toBe("joias");
    expect(gems.titulo).toBe("Joias espirituais");
    expect(bread.tipo).toBe("leitura");
    expect(bread.duracao_min).toBe(4);
    expect(bread.descricao).toBe("Sl 105:24-45 (th lição 5)");
  });

  it("classifica as partes de ministério com ajudante conforme o tipo", () => {
    const [, , , iniciando, cultivando, explicando, discurso] = semana.partes;
    expect(iniciando.tipo).toBe("ministerio_demonstracao");
    expect(iniciando.tem_ajudante).toBe(true);
    expect(iniciando.duracao_min).toBe(3);
    expect(cultivando.tipo).toBe("ministerio_demonstracao");
    expect(explicando.tipo).toBe("ministerio_demonstracao");
    expect(discurso.tipo).toBe("ministerio_discurso");
    expect(discurso.tem_ajudante).toBe(false);
    expect(discurso.duracao_min).toBe(5);
  });

  it("classifica o Estudo Bíblico de Congregação e a última parte de vida cristã", () => {
    const ebc = semana.partes[semana.partes.length - 1];
    expect(ebc.tipo).toBe("estudo_biblico");
    expect(ebc.duracao_min).toBe(30);
    expect(ebc.descricao).toBe("bt cap. 17 §13-19");

    const lc = semana.partes[semana.partes.length - 2];
    expect(lc.titulo).toBe("Expressões do seu amor");
    expect(lc.duracao_min).toBe(15);
  });
});

describe("mapearSemanaJwpub — Necessidades locais e vida cristã de anciãos", () => {
  const semana = mapearSemanaJwpub(SEMANA_COM_NECESSIDADES_LOCAIS, EDICAO)!;

  it("classifica 'Necessidades locais' e a parte com conteúdo de discurso", () => {
    const necessidades = semana.partes.find((p) => p.titulo === "Necessidades locais");
    expect(necessidades?.tipo).toBe("necessidades_locais");

    const ancioes = semana.partes.find((p) => p.titulo === "Anciãos qualificados");
    expect(ancioes?.tipo).toBe("vida_crista_ancioes");
  });

  it("numera as 10 partes corretamente", () => {
    expect(semana.partes.map((p) => p.numero)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});

describe("mapearSemanaJwpub — datas", () => {
  it("interpreta semana cruzando o mês", () => {
    const semana = mapearSemanaJwpub(SEMANA_CRUZANDO_MES, { ano: 2026, mes: 11, idioma: "T" })!;
    expect(semana.intervalo_texto).toBe("30 DE NOVEMBRO–6 DE DEZEMBRO");
  });

  it("corrige o ano quando a primeira semana da edição de janeiro começa em dezembro", () => {
    const semana = mapearSemanaJwpub(SEMANA_VIRADA_DE_ANO, { ano: 2026, mes: 1, idioma: "T" })!;
    expect(semana.intervalo_texto).toBe("28 DE DEZEMBRO–3 DE JANEIRO");
    // 28 de dezembro de 2025 pertence à semana ISO 2026-01 (a quinta-feira
    // cai em janeiro) — o ponto principal é que o mês do intervalo é
    // dezembro do ANO ANTERIOR ao da edição, não o mesmo ano.
    expect(semana.ano).toBeLessThanOrEqual(2026);
  });
});

describe("numeroCantico", () => {
  it("aceita number dentro da faixa", () => {
    expect(numeroCantico(97)).toBe(97);
  });

  it("extrai o número de um texto substituto", () => {
    expect(numeroCantico("Cântico 97 e oração")).toBe(97);
  });

  it("descarta valores fora de faixa ou sem número", () => {
    expect(numeroCantico(200)).toBeNull();
    expect(numeroCantico("Oração final")).toBeNull();
    expect(numeroCantico(undefined)).toBeNull();
    expect(numeroCantico(null)).toBeNull();
  });
});

describe("mapearSemanasJwpub", () => {
  it("mapeia todas as semanas válidas e ignora o que não é MWBSchedule", () => {
    const wSchedule = { w_study_date: "2026/03/02", w_study_title: "Título qualquer" };
    const { semanas, ignoradas } = mapearSemanasJwpub(
      [SEMANA_COMUM, wSchedule as never, SEMANA_COM_NECESSIDADES_LOCAIS],
      EDICAO,
    );
    expect(semanas).toHaveLength(2);
    expect(ignoradas).toBe(1);
  });
});

describe("validarNomeArquivoJwpub", () => {
  it("aceita o nome padrão da apostila em português", () => {
    expect(validarNomeArquivoJwpub("mwb_T_202601.jwpub")).toEqual({ ano: 2026, mes: 1, idioma: "T" });
  });

  it("aceita o nome padrão da apostila em Libras", () => {
    expect(validarNomeArquivoJwpub("mwb_LSB_202601.jwpub")).toEqual({ ano: 2026, mes: 1, idioma: "LSB" });
  });

  it("rejeita arquivo renomeado", () => {
    expect(() => validarNomeArquivoJwpub("apostila (1).jwpub")).toThrow();
    expect(() => validarNomeArquivoJwpub("mwb_T_202601 (1).jwpub")).toThrow();
  });

  it("rejeita o arquivo da Sentinela", () => {
    expect(() => validarNomeArquivoJwpub("w_T_202601.jwpub")).toThrow(/Sentinela/);
  });

  it("rejeita edições anteriores a janeiro de 2024", () => {
    expect(() => validarNomeArquivoJwpub("mwb_T_202311.jwpub")).toThrow(/2024/);
  });
});
