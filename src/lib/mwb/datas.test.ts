import { describe, expect, it } from "vitest";
import { anoEBimestreDoTitulo, interpretarCabecalho, semanaIso } from "./datas";

describe("anoEBimestreDoTitulo", () => {
  it("lê ano e bimestre do metadado Title do PDF", () => {
    expect(anoEBimestreDoTitulo("mwb26.11-T")).toEqual({ ano: 2026, bimestreInicial: 11 });
  });

  it("devolve null para um título que não é da mwb", () => {
    expect(anoEBimestreDoTitulo("w26.01-T")).toBeNull();
    expect(anoEBimestreDoTitulo("")).toBeNull();
  });
});

describe("interpretarCabecalho", () => {
  it("interpreta uma semana dentro do mesmo mês", () => {
    const cab = interpretarCabecalho("2-8 D E N OVEMB RO JER EMIAS 49-50 2", 2026);
    expect(cab).not.toBeNull();
    expect(cab!.intervalo_texto).toBe("2-8 DE NOVEMBRO");
    expect(cab!.leitura_semanal).toBe("Jeremias 49-50");
    expect(cab!.inicio.toISOString().slice(0, 10)).toBe("2026-11-02");
    expect(cab!.fim.toISOString().slice(0, 10)).toBe("2026-11-08");
  });

  it("interpreta uma semana que cruza o mês", () => {
    const cab = interpretarCabecalho("30 D E N OVEMB RO–6 D E D EZEMB RO EZEQUIEL 1-2 8", 2026);
    expect(cab).not.toBeNull();
    expect(cab!.intervalo_texto).toBe("30 DE NOVEMBRO–6 DE DEZEMBRO");
    expect(cab!.inicio.toISOString().slice(0, 10)).toBe("2026-11-30");
    expect(cab!.fim.toISOString().slice(0, 10)).toBe("2026-12-06");
  });

  it("interpreta a virada de ano (dezembro para janeiro)", () => {
    const cab = interpretarCabecalho("28 D E D EZEMB RO–3 D E JAN EIRO EZEQUIEL 9-10 14", 2026);
    expect(cab).not.toBeNull();
    expect(cab!.inicio.toISOString().slice(0, 10)).toBe("2026-12-28");
    expect(cab!.fim.toISOString().slice(0, 10)).toBe("2027-01-03");
  });

  it("devolve null quando a linha não é um cabeçalho de datas", () => {
    expect(interpretarCabecalho("TESOUROS DA PALAVRA DE DEUS", 2026)).toBeNull();
  });
});

describe("semanaIso", () => {
  it("calcula ano e semana ISO de uma data no meio do ano", () => {
    // 2 de novembro de 2026 é uma segunda-feira, semana ISO 45.
    expect(semanaIso(new Date(Date.UTC(2026, 10, 2)))).toEqual({ ano: 2026, semana_iso: 45 });
  });

  it("atribui a semana que cruza o ano ao ano da quinta-feira (regra ISO)", () => {
    // Semana de 28/dez/2026 (segunda) a 3/jan/2027 (domingo): a
    // quinta-feira (31/dez/2026) ainda cai em 2026 → semana pertence a 2026.
    expect(semanaIso(new Date(Date.UTC(2026, 11, 28)))).toEqual({ ano: 2026, semana_iso: 53 });
  });
});
