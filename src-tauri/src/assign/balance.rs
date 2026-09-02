//! Algoritmo de designação balanceada. Recebe as pessoas, o histórico de
//! designações já confirmadas e a lista de partes a designar (uma ou mais
//! semanas, em ordem cronológica) e devolve, para cada parte, a pessoa (e
//! ajudante, quando aplicável) escolhida — determinístico e sem estado
//! externo, o que o torna fácil de testar isoladamente.

use std::collections::{HashMap, HashSet};

use serde::{Deserialize, Serialize};

use super::rules::{elegivel, elegivel_ajudante, PENALIDADE_RECENTE, PENALIDADE_REFORCO};
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
/// comparamos com `total_cmp` via um wrapper leve.
#[derive(PartialEq, PartialOrd)]
struct Chave(f64, f64, i64, String);

fn escolher<'a>(
    candidatos: &[(&'a Pessoa, u32 /* penalidade extra */)],
    tipo: TipoParte,
    estado: &Estado,
    agora: i64,
) -> Option<&'a Pessoa> {
    candidatos
        .iter()
        .min_by(|(pa, pena_a), (pb, pena_b)| {
            let ka = chave(pa, tipo, estado, agora, *pena_a);
            let kb = chave(pb, tipo, estado, agora, *pena_b);
            ka.0.total_cmp(&kb.0)
                .then(ka.1.total_cmp(&kb.1))
                .then(ka.2.cmp(&kb.2))
                .then(ka.3.cmp(&kb.3))
        })
        .map(|(p, _)| *p)
}

fn chave(p: &Pessoa, tipo: TipoParte, estado: &Estado, agora: i64, penalidade_extra: u32) -> Chave {
    let recente = estado.semanas_desde_ultimo_no_tipo(p.id, tipo, agora) < JANELA_RECENCIA_SEMANAS;
    let penalidade_recencia = if recente { PENALIDADE_RECENTE } else { 0 };
    let qtd_tipo_ajustada =
        estado.qtd_tipo(p.id, tipo) as f64 + (penalidade_recencia + penalidade_extra) as f64;
    Chave(
        qtd_tipo_ajustada,
        estado.pontos_total(p.id),
        // DESC = quem está há mais tempo sem designação vem primeiro, então
        // negamos para caber num sort ascendente.
        -estado.ultima_geral(p.id),
        p.nome.clone(),
    )
}

/// Gera as designações para todas as partes informadas, respeitando a ordem
/// cronológica (`semana_ordinal`) e mantendo o equilíbrio de carga entre as
/// pessoas elegíveis. Quando não há ninguém elegível e livre naquela semana,
/// a parte fica com `pessoa_id: None` (sinalizada na UI) em vez de falhar.
pub fn gerar_atribuicoes(
    pessoas: &[Pessoa],
    historico: &[DesignacaoHistorica],
    partes: &[ParteParaDesignar],
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
                .filter(|p| !usados_na_semana.contains(&p.id))
                .filter_map(|p| {
                    elegivel(parte.tipo, p)
                        .map(|reforco| (p, if reforco { PENALIDADE_REFORCO } else { 0 }))
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
                        .filter(|p| !usados_na_semana.contains(&p.id))
                        .filter(|p| elegivel_ajudante(estudante.sexo, p))
                        .collect();
                    let aj = candidatos_aj.into_iter().min_by(|a, b| {
                        let ca = *estado.contagem_ajudante.get(&a.id).unwrap_or(&0);
                        let cb = *estado.contagem_ajudante.get(&b.id).unwrap_or(&0);
                        ca.cmp(&cb).then_with(|| a.nome.cmp(&b.nome))
                    });
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
