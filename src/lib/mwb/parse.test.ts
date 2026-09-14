import { describe, expect, it } from "vitest";
import { classificar, parsearApostila } from "./parse";
import type { PaginaTexto } from "./extrair";

// Porta dos testes que existiam em src-tauri/src/wol/parser.rs (removido
// junto com o scraping) — mesmos casos, mesma expectativa.
describe("classificar", () => {
  it("classifica 'Consideração' como tipo próprio, sem ajudante", () => {
    const { tipo, tem_ajudante } = classificar(
      "ministerio",
      "O que você diria?",
      "(6 min) Consideração. DE CASA EM CASA. Faça um resumo da lição 1 ponto 4. Mostre a imagem.",
    );
    expect(tipo).toBe("ministerio_consideracao");
    expect(tem_ajudante).toBe(false);
  });

  it("classifica 'Discurso' pelo título quando não está na descrição", () => {
    const { tipo, tem_ajudante } = classificar(
      "ministerio",
      "Discurso",
      "(5 min) Baseado na lição 2 da apostila Ame as Pessoas.",
    );
    expect(tipo).toBe("ministerio_discurso");
    expect(tem_ajudante).toBe(false);
  });

  it("classifica o restante do ministério como demonstração, com ajudante", () => {
    const { tipo, tem_ajudante } = classificar("ministerio", "Iniciando conversas", "(3 min)");
    expect(tipo).toBe("ministerio_demonstracao");
    expect(tem_ajudante).toBe(true);
  });

  it("reconhece joias e leitura da bíblia mesmo sem acento (limitação de fonte do PDF)", () => {
    expect(classificar("tesouros", "Joias espirituais", "").tipo).toBe("joias");
    expect(classificar("tesouros", "Leitura da biblia", "").tipo).toBe("leitura");
    expect(classificar("tesouros", "Um título qualquer", "").tipo).toBe("tesouros");
  });

  it("reconhece estudo bíblico, necessidades locais e partes de ancião em vida cristã", () => {
    expect(classificar("vida_crista", "Estudo bíblico de congregação", "").tipo).toBe("estudo_biblico");
    expect(classificar("vida_crista", "Necessidades locais", "").tipo).toBe("necessidades_locais");
    expect(classificar("vida_crista", "Um título qualquer", "Consideração feita por um ancião.").tipo).toBe(
      "vida_crista_ancioes",
    );
    expect(classificar("vida_crista", "Um título qualquer", "").tipo).toBe("vida_crista");
  });
});

function linha(texto: string, larguraTotal = false) {
  return { texto, larguraTotal };
}

describe("parsearApostila", () => {
  it("monta uma semana completa a partir das linhas extraídas do PDF", () => {
    const paginas: PaginaTexto[] = [
      {
        pagina: 1,
        linhas: [
          linha("2-8 D E N OVEMB RO EXEMPLO 1-2 3"),
          linha("Cântico 1 e oração Comentários iniciais (1 min)", true),
          linha("TESOUROS DA"),
          linha("PALAVRA DE DEUS"),
          linha("1. Um título de exemplo que"),
          linha("continua na linha seguinte (10 min)"),
          linha("Texto de exemplo do primeiro ponto."),
          linha("2. Joias espirituais (10 min)"),
          linha("Pergunta de exemplo sobre a leitura."),
          linha("3. Leitura da Bíblia (4 min)"),
          linha("Exemplo 1-2 (th lição 1)"),
          linha("FAÇA SEU MELHOR"),
          linha("NO MINISTÉRIO"),
          linha("4. Iniciando conversas (3 min)"),
          linha("DE CASA EM CASA. Texto de exemplo."),
          linha("5. Cultivando o interesse (4 min)"),
          linha("DE CASA EM CASA. Texto de exemplo."),
          linha("6. Discurso (5 min)"),
          linha("Tema de exemplo do discurso."),
          linha("NOSSA"),
          linha("VIDA CRISTA"),
          linha("Cântico 44"),
          linha("7. Um tema de exemplo da vida cristã"),
          linha("(15 min) Consideração a ser feita por um ancião."),
          linha("8. Estudo bíblico de congregação (30 min)"),
          linha("wcg cap. 1"),
          linha("Comentários finais (3 min) Cântico 33 e oração", true),
        ],
      },
    ];

    const [semana] = parsearApostila(paginas, "mwb26.11-T");
    expect(semana.ano).toBe(2026);
    expect(semana.semana_iso).toBe(45);
    expect(semana.intervalo_texto).toBe("2-8 DE NOVEMBRO");
    expect(semana.cantico_inicial).toBe(1);
    expect(semana.cantico_meio).toBe(44);
    expect(semana.cantico_final).toBe(33);
    expect(semana.partes).toHaveLength(8);

    expect(semana.partes[0]).toMatchObject({
      numero: 1,
      secao: "tesouros",
      tipo: "tesouros",
      duracao_min: 10,
      titulo: "Um título de exemplo que continua na linha seguinte",
    });
    expect(semana.partes[1].tipo).toBe("joias");
    expect(semana.partes[2].tipo).toBe("leitura");
    expect(semana.partes[3]).toMatchObject({ tipo: "ministerio_demonstracao", tem_ajudante: true });
    expect(semana.partes[5]).toMatchObject({ tipo: "ministerio_discurso", tem_ajudante: false });
    expect(semana.partes[6].tipo).toBe("vida_crista_ancioes"); // menciona "ancião" na descrição
    expect(semana.partes[7]).toMatchObject({ tipo: "estudo_biblico", numero: 8 });
  });

  it("ignora páginas de apêndice que repetem o intervalo de uma semana já fechada", () => {
    const paginas: PaginaTexto[] = [
      {
        pagina: 1,
        linhas: [
          linha("2-8 D E N OVEMB RO EXEMPLO 1-2 3"),
          linha("Cântico 1 e oração Comentários iniciais (1 min)", true),
          linha("TESOUROS DA"),
          linha("1. Único ponto de exemplo (10 min)"),
          linha("Texto de exemplo."),
          linha("Comentários finais (3 min) Cântico 33 e oração", true),
          // Página de apêndice: repete a data mas não abre com o gatilho de
          // início — não deve criar uma segunda semana nem contaminar a
          // seguinte.
          linha("2-8 D E N OVEMB RO"),
          linha("Texto de um apêndice que não faz parte de nenhuma semana."),
        ],
      },
    ];

    const semanas = parsearApostila(paginas, "mwb26.11-T");
    expect(semanas).toHaveLength(1);
    expect(semanas[0].partes).toHaveLength(1);
  });

  it("lança um erro claro quando o metadado Title não é de uma apostila mwb", () => {
    expect(() => parsearApostila([], "w26.01-T")).toThrow(/apostila mwb/);
  });
});
