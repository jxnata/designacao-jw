//! Regras de elegibilidade por tipo de parte, conforme os critérios da
//! congregação (ver plano): anciãos/servos para Tesouros/Joias/Vida
//! Cristã/Consideração (ministério), só anciãos para Necessidades Locais e
//! partes que exigem anciãos, homens (não precisa publicador nem batizado)
//! para a leitura, mulheres para as demonstrações de Faça Seu Melhor,
//! homens batizados para discursos e orações, e anciãos (com servo como
//! reforço penalizado) para presidente e estudo bíblico.

use super::balance::{ConfiguracaoDesignacao, Pessoa};
use crate::wol::TipoParte;

/// Penalidade somada à posição do candidato no ranking quando ele cobre uma
/// parte "acima" do seu privilégio natural (ex.: servo presidindo ou
/// dirigindo o estudo bíblico só porque não há ancião disponível). É grande
/// o bastante para nunca vencer um ancião elegível, mas ainda permite que a
/// designação aconteça quando não sobra outra opção.
pub const PENALIDADE_REFORCO: u32 = 1_000;

/// Penalidade aplicada quando a pessoa já cobriu o mesmo tipo de parte
/// dentro da janela de "recência" (ver `balance::JANELA_RECENCIA_SEMANAS`).
pub const PENALIDADE_RECENTE: u32 = 100;

/// Penalidade aplicada quando a pessoa teve qualquer designação (como
/// estudante/orador ou como ajudante) na semana imediatamente anterior.
/// É muito maior que as demais para praticamente nunca vencer alguém livre
/// na semana passada — mas continua sendo só uma penalidade de ranking, não
/// uma exclusão: se ninguém mais está elegível, a pessoa ainda pode ser
/// designada de novo em semanas consecutivas.
pub const PENALIDADE_SEMANA_CONSECUTIVA: u32 = 10_000;

pub fn homem_batizado(p: &Pessoa) -> bool {
    p.sexo == 'm' && p.batizado
}

pub fn anciao_ou_servo(p: &Pessoa) -> bool {
    p.anciao || p.servo
}

/// Retorna `true` se a pessoa pode, em tese, cobrir o tipo de parte (sem
/// considerar equilíbrio/recência — isso é papel do balanceador). Também
/// informa se a designação seria um "reforço" (fora do privilégio natural,
/// ex.: servo em uma parte de ancião) para que o balanceador some a
/// penalidade correspondente.
///
/// `config` controla se servos ministeriais podem cobrir Presidente e
/// Estudo Bíblico de Congregação — em algumas congregações essas partes são
/// reservadas só a anciãos, mesmo como reforço.
pub fn elegivel(
    tipo: TipoParte,
    p: &Pessoa,
    config: &ConfiguracaoDesignacao,
) -> Option<bool /* é reforço */> {
    if !p.ativo {
        return None;
    }
    use TipoParte::*;
    let (ok, reforco) = match tipo {
        Presidente => {
            if config.usar_servos_presidencia {
                (p.anciao || p.servo, !p.anciao)
            } else {
                (p.anciao, false)
            }
        }
        OracaoInicial | OracaoFinal => (homem_batizado(p), false),
        Tesouros | Joias | VidaCrista | MinisterioConsideracao => (anciao_ou_servo(p), false),
        Leitura => (p.sexo == 'm' && (config.usar_anciaos_leitura || !p.anciao), false),
        MinisterioDemonstracao => (p.sexo == 'f', false),
        MinisterioDiscurso => (homem_batizado(p), false),
        VidaCristaAncioes | NecessidadesLocais => (p.anciao, false),
        EstudoBiblico => {
            if config.usar_servos_estudo_biblico {
                (p.anciao || p.servo, !p.anciao)
            } else {
                (p.anciao, false)
            }
        }
    };
    if ok {
        Some(reforco)
    } else {
        None
    }
}

/// Elegibilidade do "ajudante" de uma parte. Para a demonstração de
/// ministério, é o ajudante propriamente dito: mesmo sexo do estudante
/// designado, ativo, sem restrição de grupo. Para o Estudo Bíblico de
/// Congregação, esse mesmo slot é reaproveitado para o leitor (só existe em
/// congregação de língua de sinais): homem batizado e ativo, com anciãos
/// entrando apenas se `config.usar_anciaos_leitura_ebc` estiver ligado.
pub fn elegivel_ajudante(
    tipo: TipoParte,
    sexo_estudante: char,
    p: &Pessoa,
    config: &ConfiguracaoDesignacao,
) -> bool {
    if !p.ativo {
        return false;
    }
    match tipo {
        TipoParte::EstudoBiblico => {
            homem_batizado(p) && (config.usar_anciaos_leitura_ebc || !p.anciao)
        }
        _ => p.sexo == sexo_estudante,
    }
}
