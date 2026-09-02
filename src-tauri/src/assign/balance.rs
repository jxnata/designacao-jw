//! Algoritmo de designação balanceada. Recebe as pessoas, o histórico de
//! designações já confirmadas e a lista de partes a designar (uma ou mais
//! semanas, em ordem cronológica) e devolve, para cada parte, a pessoa (e
//! ajudante, quando aplicável) escolhida — determinístico e sem estado
//! externo, o que o torna fácil de testar isoladamente.

use std::collections::{HashMap, HashSet};

use rand::Rng;
use serde::{Deserialize, Serialize};

use super::rules::{
    elegivel, elegivel_ajudante, PENALIDADE_MESMA_SEMANA, PENALIDADE_RECENTE, PENALIDADE_REFORCO,
    PENALIDADE_SEMANA_CONSECUTIVA,
};
use crate::wol::TipoParte;

/// Quantas semanas (ordinais) contam como "recente" para penalizar repetir
/// o mesmo tipo de parte.
pub const JANELA_RECENCIA_SEMANAS: i64 = 8;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pessoa {
    pub id: i64,
    pub nome: String,
    pub grupo: i32,
    pub surdo: bool,
    pub sexo: char,
    pub publicador: bool,
    pub batizado: bool,
    pub servo: bool,
    pub anciao: bool,
    pub ativo: bool,
}

/// Uma designação já confirmada no passado (`status = 'final'` no banco),
/// usada para inicializar as contagens do balanceador.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DesignacaoHistorica {
    pub pessoa_id: i64,
    pub tipo: TipoParte,
    /// Ordinal crescente da semana (ex.: número sequencial de linha, ou
    /// qualquer inteiro que preserve a ordem cronológica). Quanto maior,
    /// mais recente.
    pub semana_ordinal: i64,
    /// `true` quando a pessoa cobriu a parte como ajudante (conta metade no
    /// total geral e não entra na contagem específica do tipo).
    #[serde(default)]
    pub como_ajudante: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParteParaDesignar {
    pub parte_id: String,
    pub semana_ordinal: i64,
    pub tipo: TipoParte,
    pub tem_ajudante: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DesignacaoResultado {
    pub parte_id: String,
    pub pessoa_id: Option<i64>,
    pub ajudante_id: Option<i64>,
}

/// Opções da congregação que afetam elegibilidade (ver `Configuracoes` na
/// UI). Ambas defaultam para `true` — o comportamento histórico do app
/// permitia servo ministerial como reforço nessas duas partes.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(default)]
pub struct ConfiguracaoDesignacao {
    pub usar_servos_presidencia: bool,
    pub usar_servos_estudo_biblico: bool,
    /// Se anciãos podem ser designados para a Leitura da Bíblia — em muitas
    /// congregações essa parte é reservada a publicadores/estudantes em
    /// desenvolvimento, então o default é excluir anciãos.
    pub usar_anciaos_leitura: bool,
    /// Se anciãos podem ser designados como leitor do Estudo Bíblico de
    /// Congregação — só é relevante em congregações comuns (o slot de
    /// leitor não existe em congregação de língua de sinais, onde a
    /// condução já é toda em sinais). Default `false`, na mesma linha de
    /// `usar_anciaos_leitura`.
    pub usar_anciaos_leitura_ebc: bool,
}

impl Default for ConfiguracaoDesignacao {
    fn default() -> Self {
        Self {
            usar_servos_presidencia: true,
            usar_servos_estudo_biblico: true,
            usar_anciaos_leitura: false,
            usar_anciaos_leitura_ebc: false,
        }
    }
}

#[derive(Default, Clone)]
struct Estado {
    contagem_tipo: HashMap<(i64, TipoParteKey), u32>,
    contagem_ajudante: HashMap<i64, u32>,
    pontos_total: HashMap<i64, f64>,
    ultima_geral: HashMap<i64, i64>,
    ultima_tipo: HashMap<(i64, TipoParteKey), i64>,
}

type TipoParteKey = TipoParte;

impl Estado {
    fn novo(historico: &[DesignacaoHistorica]) -> Self {
        let mut e = Estado::default();
        for h in historico {
            if h.como_ajudante {
                *e.contagem_ajudante.entry(h.pessoa_id).or_default() += 1;
                *e.pontos_total.entry(h.pessoa_id).or_default() += 0.5;
            } else {
                *e.contagem_tipo.entry((h.pessoa_id, h.tipo)).or_default() += 1;
                *e.pontos_total.entry(h.pessoa_id).or_default() += 1.0;
                let ult = e
                    .ultima_tipo
                    .entry((h.pessoa_id, h.tipo))
                    .or_insert(h.semana_ordinal);
                if h.semana_ordinal > *ult {
                    *ult = h.semana_ordinal;
                }
            }
            let ult_geral = e
                .ultima_geral
                .entry(h.pessoa_id)
                .or_insert(h.semana_ordinal);
            if h.semana_ordinal > *ult_geral {
                *ult_geral = h.semana_ordinal;
            }
        }
        e
    }

    fn qtd_tipo(&self, pessoa_id: i64, tipo: TipoParte) -> u32 {
        *self.contagem_tipo.get(&(pessoa_id, tipo)).unwrap_or(&0)
    }

    fn pontos_total(&self, pessoa_id: i64) -> f64 {
        *self.pontos_total.get(&pessoa_id).unwrap_or(&0.0)
    }

    fn ultima_geral(&self, pessoa_id: i64) -> i64 {
        *self.ultima_geral.get(&pessoa_id).unwrap_or(&-1)
    }

    /// `true` quando a pessoa teve qualquer designação (estudante ou
    /// ajudante) na semana imediatamente anterior a `agora` — usado para
    /// evitar designações em semanas consecutivas.
    fn designada_na_semana_anterior(&self, pessoa_id: i64, agora: i64) -> bool {
        agora - self.ultima_geral(pessoa_id) == 1
    }

    fn semanas_desde_ultimo_no_tipo(&self, pessoa_id: i64, tipo: TipoParte, agora: i64) -> i64 {
        match self.ultima_tipo.get(&(pessoa_id, tipo)) {
            Some(ultimo) => agora - ultimo,
            None => i64::MAX,
        }
    }

    fn registrar(&mut self, pessoa_id: i64, tipo: TipoParte, semana_ordinal: i64) {
        *self.contagem_tipo.entry((pessoa_id, tipo)).or_default() += 1;
        *self.pontos_total.entry(pessoa_id).or_default() += 1.0;
        self.ultima_tipo.insert((pessoa_id, tipo), semana_ordinal);
        self.ultima_geral.insert(pessoa_id, semana_ordinal);
    }

    fn registrar_ajudante(&mut self, pessoa_id: i64, semana_ordinal: i64) {
        *self.contagem_ajudante.entry(pessoa_id).or_default() += 1;
        *self.pontos_total.entry(pessoa_id).or_default() += 0.5;
        self.ultima_geral.insert(pessoa_id, semana_ordinal);
    }
}

/// Chave de ordenação: menor é melhor. `f64` não implementa `Ord`, então
/// comparamos com `total_cmp` via um wrapper leve. O último campo é só um
/// sorteio (não o nome) — quando os três primeiros critérios empatam de
/// verdade, o desempate é aleatório em vez de sempre cair em ordem
/// alfabética.
#[derive(PartialEq, PartialOrd)]
struct Chave(f64, f64, i64, u32);

fn escolher<'a>(
    candidatos: &[(&'a Pessoa, u32 /* penalidade extra */)],
    tipo: TipoParte,
    estado: &Estado,
    agora: i64,
) -> Option<&'a Pessoa> {
    let mut rng = rand::thread_rng();
    let sorteios: Vec<u32> = (0..candidatos.len()).map(|_| rng.gen()).collect();
    candidatos
        .iter()
        .zip(sorteios)
        .min_by(|((pa, pena_a), sa), ((pb, pena_b), sb)| {
            let ka = chave(pa, tipo, estado, agora, *pena_a, *sa);
            let kb = chave(pb, tipo, estado, agora, *pena_b, *sb);
            ka.0.total_cmp(&kb.0)
                .then(ka.1.total_cmp(&kb.1))
                .then(ka.2.cmp(&kb.2))
                .then(ka.3.cmp(&kb.3))
        })
        .map(|((p, _), _)| *p)
}

fn chave(
    p: &Pessoa,
    tipo: TipoParte,
    estado: &Estado,
    agora: i64,
    penalidade_extra: u32,
    sorteio: u32,
) -> Chave {
    let recente = estado.semanas_desde_ultimo_no_tipo(p.id, tipo, agora) < JANELA_RECENCIA_SEMANAS;
    let penalidade_recencia = if recente { PENALIDADE_RECENTE } else { 0 };
    let penalidade_consecutiva = if estado.designada_na_semana_anterior(p.id, agora) {
        PENALIDADE_SEMANA_CONSECUTIVA
    } else {
        0
    };
    let qtd_tipo_ajustada = estado.qtd_tipo(p.id, tipo) as f64
        + (penalidade_recencia + penalidade_extra + penalidade_consecutiva) as f64;
    Chave(
        qtd_tipo_ajustada,
        estado.pontos_total(p.id),
        // DESC = quem está há mais tempo sem designação vem primeiro, então
        // negamos para caber num sort ascendente.
        -estado.ultima_geral(p.id),
        sorteio,
    )
}

/// Gera as designações para todas as partes informadas, respeitando a ordem
/// cronológica (`semana_ordinal`) e mantendo o equilíbrio de carga entre as
/// pessoas elegíveis. Repetir alguém que já tem outra parte na mesma semana
/// é fortemente penalizado (`PENALIDADE_MESMA_SEMANA`), mas permitido como
/// último recurso — por exemplo, em semanas com poucos anciãos disponíveis,
/// o presidente pode acabar cobrindo também Joias Espirituais. A parte só
/// fica com `pessoa_id: None` (sinalizada na UI) quando literalmente
/// ninguém é elegível para o tipo, mesmo repetindo.
pub fn gerar_atribuicoes(
    pessoas: &[Pessoa],
    historico: &[DesignacaoHistorica],
    partes: &[ParteParaDesignar],
    config: ConfiguracaoDesignacao,
) -> Vec<DesignacaoResultado> {
    let mut estado = Estado::novo(historico);
    let mut resultado = Vec::with_capacity(partes.len());

    // Agrupa por semana preservando a ordem original de cada parte dentro
    // da semana (importante para o preview ficar na ordem do programa).
    let mut por_semana: Vec<(i64, Vec<&ParteParaDesignar>)> = Vec::new();
    for parte in partes {
        match por_semana.last_mut() {
            Some((ord, lista)) if *ord == parte.semana_ordinal => lista.push(parte),
            _ => por_semana.push((parte.semana_ordinal, vec![parte])),
        }
    }
    por_semana.sort_by_key(|(ord, _)| *ord);

    for (semana_ordinal, partes_semana) in por_semana {
        let mut usados_na_semana: HashSet<i64> = HashSet::new();

        for parte in partes_semana {
            let candidatos: Vec<(&Pessoa, u32)> = pessoas
                .iter()
                .filter_map(|p| {
                    elegivel(parte.tipo, p, &config).map(|reforco| {
                        let mut penalidade = if reforco { PENALIDADE_REFORCO } else { 0 };
                        if usados_na_semana.contains(&p.id) {
                            penalidade += PENALIDADE_MESMA_SEMANA;
                        }
                        (p, penalidade)
                    })
                })
                .collect();

            let escolhido = escolher(&candidatos, parte.tipo, &estado, semana_ordinal);
            let pessoa_id = escolhido.map(|p| p.id);
            if let Some(p) = escolhido {
                usados_na_semana.insert(p.id);
                estado.registrar(p.id, parte.tipo, semana_ordinal);
            }

            let ajudante_id = if parte.tem_ajudante {
                if let Some(estudante) = escolhido {
                    let candidatos_aj: Vec<&Pessoa> = pessoas
                        .iter()
                        // Ninguém pode ser o próprio ajudante da sua parte,
                        // mesmo em último recurso.
                        .filter(|p| p.id != estudante.id)
                        .filter(|p| elegivel_ajudante(parte.tipo, estudante.sexo, p, &config))
                        .collect();
                    let mut rng_aj = rand::thread_rng();
                    let sorteios_aj: Vec<u32> =
                        (0..candidatos_aj.len()).map(|_| rng_aj.gen()).collect();
                    let aj = candidatos_aj
                        .into_iter()
                        .zip(sorteios_aj)
                        .min_by(|(a, sa), (b, sb)| {
                            let ca = *estado.contagem_ajudante.get(&a.id).unwrap_or(&0)
                                + if estado.designada_na_semana_anterior(a.id, semana_ordinal) {
                                    PENALIDADE_SEMANA_CONSECUTIVA
                                } else {
                                    0
                                }
                                + if usados_na_semana.contains(&a.id) {
                                    PENALIDADE_MESMA_SEMANA
                                } else {
                                    0
                                };
                            let cb = *estado.contagem_ajudante.get(&b.id).unwrap_or(&0)
                                + if estado.designada_na_semana_anterior(b.id, semana_ordinal) {
                                    PENALIDADE_SEMANA_CONSECUTIVA
                                } else {
                                    0
                                }
                                + if usados_na_semana.contains(&b.id) {
                                    PENALIDADE_MESMA_SEMANA
                                } else {
                                    0
                                };
                            ca.cmp(&cb).then_with(|| sa.cmp(sb))
                        })
                        .map(|(a, _)| a);
                    if let Some(a) = aj {
                        usados_na_semana.insert(a.id);
                        estado.registrar_ajudante(a.id, semana_ordinal);
                        Some(a.id)
                    } else {
                        None
                    }
                } else {
                    None
                }
            } else {
                None
            };

            resultado.push(DesignacaoResultado {
                parte_id: parte.parte_id.clone(),
                pessoa_id,
                ajudante_id,
            });
        }
    }

    resultado
}

#[cfg(test)]
mod tests {
    use super::*;

    fn pessoa(id: i64, nome: &str) -> Pessoa {
        Pessoa {
            id,
            nome: nome.to_string(),
            grupo: 1,
            surdo: false,
            sexo: 'm',
            publicador: true,
            batizado: true,
            servo: false,
            anciao: true,
            ativo: true,
        }
    }

    fn parte(id: &str, semana_ordinal: i64) -> ParteParaDesignar {
        ParteParaDesignar {
            parte_id: id.to_string(),
            semana_ordinal,
            tipo: TipoParte::Presidente,
            tem_ajudante: false,
        }
    }

    /// Com opções sobrando, ninguém deve repetir na semana seguinte.
    #[test]
    fn evita_semanas_consecutivas_quando_ha_opcao() {
        let pessoas = vec![
            pessoa(1, "A"),
            pessoa(2, "B"),
            pessoa(3, "C"),
            pessoa(4, "D"),
        ];
        let partes = vec![
            parte("s1", 1),
            parte("s2", 2),
            parte("s3", 3),
            parte("s4", 4),
        ];

        let resultado =
            gerar_atribuicoes(&pessoas, &[], &partes, ConfiguracaoDesignacao::default());
        for par in resultado.windows(2) {
            assert_ne!(
                par[0].pessoa_id, par[1].pessoa_id,
                "mesma pessoa não deveria repetir em semanas consecutivas quando há opção"
            );
        }
    }

    /// Sem opção (só uma pessoa elegível), a repetição consecutiva deve
    /// acontecer em vez de deixar a parte sem designado.
    #[test]
    fn permite_semana_consecutiva_quando_nao_ha_opcao() {
        let pessoas = vec![pessoa(1, "Única")];
        let partes = vec![parte("s1", 1), parte("s2", 2)];

        let resultado =
            gerar_atribuicoes(&pessoas, &[], &partes, ConfiguracaoDesignacao::default());
        assert_eq!(resultado[0].pessoa_id, Some(1));
        assert_eq!(resultado[1].pessoa_id, Some(1));
    }

    fn parte_leitura(id: &str, semana_ordinal: i64) -> ParteParaDesignar {
        ParteParaDesignar {
            parte_id: id.to_string(),
            semana_ordinal,
            tipo: TipoParte::Leitura,
            tem_ajudante: false,
        }
    }

    fn homem_nao_anciao(id: i64, nome: &str) -> Pessoa {
        Pessoa {
            anciao: false,
            servo: false,
            ..pessoa(id, nome)
        }
    }

    /// Com `usar_anciaos_leitura: false` (default), ancião nunca deve ser
    /// escolhido para a Leitura da Bíblia enquanto houver outro homem.
    #[test]
    fn exclui_anciaos_da_leitura_por_padrao() {
        let pessoas = vec![pessoa(1, "Anciao"), homem_nao_anciao(2, "Publicador")];
        let partes = vec![parte_leitura("s1", 1)];

        let resultado =
            gerar_atribuicoes(&pessoas, &[], &partes, ConfiguracaoDesignacao::default());
        assert_eq!(resultado[0].pessoa_id, Some(2));
    }

    /// Com `usar_anciaos_leitura: true`, ancião volta a ser elegível.
    #[test]
    fn permite_anciaos_na_leitura_quando_configurado() {
        let pessoas = vec![pessoa(1, "Anciao")];
        let partes = vec![parte_leitura("s1", 1)];
        let config = ConfiguracaoDesignacao {
            usar_anciaos_leitura: true,
            ..ConfiguracaoDesignacao::default()
        };

        let resultado = gerar_atribuicoes(&pessoas, &[], &partes, config);
        assert_eq!(resultado[0].pessoa_id, Some(1));
    }
}
