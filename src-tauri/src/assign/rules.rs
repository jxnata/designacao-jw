//! Regras de elegibilidade por tipo de parte, conforme os critérios da
//! congregação (ver plano): anciãos/servos para Tesouros/Joias/Vida Cristã,
//! só anciãos para Necessidades Locais e partes que exigem anciãos, homens
//! (não precisa publicador nem batizado) para a leitura, mulheres para as
//! demonstrações de Faça Seu Melhor, homens batizados para discursos e
//! orações, e anciãos (com servo como reforço penalizado) para presidente e
//! estudo bíblico.

use super::balance::Pessoa;
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
pub fn elegivel(tipo: TipoParte, p: &Pessoa) -> Option<bool /* é reforço */> {
    if !p.ativo {
        return None;
    }
    use TipoParte::*;
    let (ok, reforco) = match tipo {
        Presidente => (p.anciao || p.servo, !p.anciao),
        OracaoInicial | OracaoFinal => (homem_batizado(p), false),
        Tesouros | Joias | VidaCrista => (anciao_ou_servo(p), false),
        Leitura => (p.sexo == 'm', false),
        MinisterioDemonstracao => (p.sexo == 'f', false),
        MinisterioDiscurso => (homem_batizado(p), false),
        VidaCristaAncioes | NecessidadesLocais => (p.anciao, false),
        EstudoBiblico => (p.anciao || p.servo, !p.anciao),
    };
    if ok {
        Some(reforco)
    } else {
        None
    }
}

/// Elegibilidade do ajudante de uma demonstração: mesmo sexo do estudante
/// designado, ativo, sem restrição de grupo.
pub fn elegivel_ajudante(sexo_estudante: char, p: &Pessoa) -> bool {
    p.ativo && p.sexo == sexo_estudante
}
