use app_lib::assign::{
    gerar_atribuicoes, ConfiguracaoDesignacao, DesignacaoHistorica, ParteParaDesignar, Pessoa,
};
use app_lib::tipos::TipoParte;
use std::collections::HashMap;

fn pessoa(id: i64, nome: &str, sexo: char, anciao: bool, servo: bool, batizado: bool) -> Pessoa {
    Pessoa {
        id,
        nome: nome.to_string(),
        grupo: 1,
        surdo: false,
        sexo,
        publicador: true,
        batizado,
        servo,
        anciao,
        ativo: true,
    }
}

/// Congregação sintética: 4 anciãos, 5 servos, 10 mulheres, 6 homens não
/// batizados (estudantes de leitura), conforme o plano de testes.
fn congregacao_sintetica() -> Vec<Pessoa> {
    let mut pessoas = Vec::new();
    let mut id = 1;
    for i in 1..=4 {
        pessoas.push(pessoa(id, &format!("Anciao{i}"), 'm', true, false, true));
        id += 1;
    }
    for i in 1..=5 {
        pessoas.push(pessoa(id, &format!("Servo{i}"), 'm', false, true, true));
        id += 1;
    }
    for i in 1..=10 {
        pessoas.push(pessoa(id, &format!("Mulher{i}"), 'f', false, false, true));
        id += 1;
    }
    for i in 1..=6 {
        pessoas.push(pessoa(id, &format!("Homem{i}"), 'm', false, false, false));
        id += 1;
    }
    pessoas
}

/// Programa fixo de 8 partes por semana, como o observado no PDF/no wol.
fn partes_da_semana(semana_ordinal: i64) -> Vec<ParteParaDesignar> {
    use TipoParte::*;
    let base = [
        (Presidente, false),
        (OracaoInicial, false),
        (Tesouros, false),
        (Joias, false),
        (Leitura, false),
        (MinisterioDemonstracao, true),
        (MinisterioDemonstracao, true),
        (MinisterioDiscurso, false),
        (VidaCrista, false),
        (EstudoBiblico, false),
        (OracaoFinal, false),
    ];
    base.iter()
        .enumerate()
        .map(|(i, (tipo, tem_ajudante))| ParteParaDesignar {
            parte_id: format!("{semana_ordinal}-{i}"),
            semana_ordinal,
            tipo: *tipo,
            tem_ajudante: *tem_ajudante,
        })
        .collect()
}

#[test]
fn respeita_privilegios_por_tipo_de_parte() {
    let pessoas = congregacao_sintetica();
    let mut partes = Vec::new();
    for semana in 0..8 {
        partes.extend(partes_da_semana(semana));
    }

    let resultado = gerar_atribuicoes(&pessoas, &[], &partes, ConfiguracaoDesignacao::default());
    let por_id: HashMap<i64, &Pessoa> = pessoas.iter().map(|p| (p.id, p)).collect();

    for (parte, r) in partes.iter().zip(resultado.iter()) {
        let Some(pid) = r.pessoa_id else { continue };
        let p = por_id[&pid];
        use TipoParte::*;
        match parte.tipo {
            Presidente => assert!(p.anciao || p.servo, "presidente deve ser ancião/servo"),
            OracaoInicial | OracaoFinal => {
                assert!(p.sexo == 'm' && p.batizado, "oração: homem batizado")
            }
            Tesouros | Joias | VidaCrista => {
                assert!(p.anciao || p.servo, "{:?}: ancião ou servo", parte.tipo)
            }
            Leitura => assert_eq!(p.sexo, 'm', "leitura: qualquer homem"),
            MinisterioDemonstracao => assert_eq!(p.sexo, 'f', "demonstração: mulher"),
            MinisterioDiscurso => {
                assert!(p.sexo == 'm' && p.batizado, "discurso: homem batizado")
            }
            VidaCristaAncioes | NecessidadesLocais => assert!(p.anciao),
            EstudoBiblico => assert!(p.anciao || p.servo),
            MinisterioConsideracao => {
                assert!(p.anciao || p.servo, "consideração: ancião ou servo")
            }
        }

        if parte.tem_ajudante {
            if let Some(aid) = r.ajudante_id {
                assert_eq!(
                    por_id[&aid].sexo, p.sexo,
                    "ajudante mesmo sexo do estudante"
                );
                assert_ne!(aid, pid, "ajudante não pode ser a mesma pessoa");
            }
        }
    }
}

#[test]
fn mantem_equilibrio_apos_oito_semanas() {
    let pessoas = congregacao_sintetica();
    let mut partes = Vec::new();
    for semana in 0..8 {
        partes.extend(partes_da_semana(semana));
    }

    let resultado = gerar_atribuicoes(&pessoas, &[], &partes, ConfiguracaoDesignacao::default());

    let mut total: HashMap<i64, u32> = HashMap::new();
    for r in &resultado {
        if let Some(pid) = r.pessoa_id {
            *total.entry(pid).or_default() += 1;
        }
    }

    let anciaos: Vec<i64> = pessoas.iter().filter(|p| p.anciao).map(|p| p.id).collect();
    let contagens_anciaos: Vec<u32> = anciaos
        .iter()
        .map(|id| *total.get(id).unwrap_or(&0))
        .collect();
    let max = *contagens_anciaos.iter().max().unwrap();
    let min = *contagens_anciaos.iter().min().unwrap();
    assert!(
        max - min <= 2,
        "diferença de designações entre anciãos deveria ser <= 2, contagens={:?}",
        contagens_anciaos
    );

    let mulheres: Vec<i64> = pessoas
        .iter()
        .filter(|p| p.sexo == 'f')
        .map(|p| p.id)
        .collect();
    let contagens_mulheres: Vec<u32> = mulheres
        .iter()
        .map(|id| *total.get(id).unwrap_or(&0))
        .collect();
    let max_m = *contagens_mulheres.iter().max().unwrap();
    let min_m = *contagens_mulheres.iter().min().unwrap();
    assert!(
        max_m - min_m <= 2,
        "diferença de designações entre mulheres deveria ser <= 2, contagens={:?}",
        contagens_mulheres
    );
}

#[test]
fn nao_designa_duas_partes_para_a_mesma_pessoa_na_mesma_semana() {
    let pessoas = congregacao_sintetica();
    let partes = partes_da_semana(0);
    let resultado = gerar_atribuicoes(&pessoas, &[], &partes, ConfiguracaoDesignacao::default());

    let mut vistos = std::collections::HashSet::new();
    for r in &resultado {
        if let Some(pid) = r.pessoa_id {
            assert!(
                vistos.insert(pid),
                "pessoa {pid} designada duas vezes na mesma semana"
            );
        }
        if let Some(aid) = r.ajudante_id {
            assert!(
                vistos.insert(aid),
                "ajudante {aid} colidiu com outra designação na semana"
            );
        }
    }
}

/// Regressão: congregação com só 2 anciãos e nenhum servo. Numa mesma
/// semana com Presidente, Necessidades Locais, Vida Cristã dos Anciãos e
/// Estudo Bíblico (todas exigindo ancião), o pool de 2 pessoas se esgota
/// antes do Estudo Bíblico — antes da correção, ele ficava sem designado em
/// vez de repetir alguém já usado na semana.
#[test]
fn nao_deixa_estudo_biblico_sem_designado_quando_pool_de_anciaos_esgota() {
    let pessoas = vec![
        pessoa(1, "Anciao1", 'm', true, false, true),
        pessoa(2, "Anciao2", 'm', true, false, true),
        pessoa(3, "Homem1", 'm', false, false, true),
        pessoa(4, "Mulher1", 'f', false, false, true),
    ];
    let partes = vec![
        ParteParaDesignar {
            parte_id: "0-presidente".into(),
            semana_ordinal: 0,
            tipo: TipoParte::Presidente,
            tem_ajudante: false,
        },
        ParteParaDesignar {
            parte_id: "0-necessidades".into(),
            semana_ordinal: 0,
            tipo: TipoParte::NecessidadesLocais,
            tem_ajudante: false,
        },
        ParteParaDesignar {
            parte_id: "0-vidacrista-anciaos".into(),
            semana_ordinal: 0,
            tipo: TipoParte::VidaCristaAncioes,
            tem_ajudante: false,
        },
        ParteParaDesignar {
            parte_id: "0-estudo".into(),
            semana_ordinal: 0,
            tipo: TipoParte::EstudoBiblico,
            tem_ajudante: false,
        },
    ];

    let config = ConfiguracaoDesignacao {
        usar_servos_estudo_biblico: false,
        ..ConfiguracaoDesignacao::default()
    };
    let resultado = gerar_atribuicoes(&pessoas, &[], &partes, config);

    let estudo = resultado.iter().find(|r| r.parte_id == "0-estudo").unwrap();
    assert!(
        estudo.pessoa_id.is_some(),
        "Estudo Bíblico não deveria ficar sem designado quando ainda há ancião elegível, mesmo repetindo"
    );
}

#[test]
fn usa_historico_para_priorizar_quem_designou_menos() {
    let pessoas = congregacao_sintetica();
    // Ancião 1 já tem 5 designações de Tesouros; os outros têm 0.
    let historico = vec![
        DesignacaoHistorica {
            pessoa_id: 1,
            tipo: TipoParte::Tesouros,
            semana_ordinal: -1,
            como_ajudante: false,
        },
        DesignacaoHistorica {
            pessoa_id: 1,
            tipo: TipoParte::Tesouros,
            semana_ordinal: -2,
            como_ajudante: false,
        },
        DesignacaoHistorica {
            pessoa_id: 1,
            tipo: TipoParte::Tesouros,
            semana_ordinal: -3,
            como_ajudante: false,
        },
        DesignacaoHistorica {
            pessoa_id: 1,
            tipo: TipoParte::Tesouros,
            semana_ordinal: -4,
            como_ajudante: false,
        },
        DesignacaoHistorica {
            pessoa_id: 1,
            tipo: TipoParte::Tesouros,
            semana_ordinal: -5,
            como_ajudante: false,
        },
    ];
    let partes = vec![ParteParaDesignar {
        parte_id: "0-0".into(),
        semana_ordinal: 0,
        tipo: TipoParte::Tesouros,
        tem_ajudante: false,
    }];

    let resultado = gerar_atribuicoes(
        &pessoas,
        &historico,
        &partes,
        ConfiguracaoDesignacao::default(),
    );
    assert_ne!(
        resultado[0].pessoa_id,
        Some(1),
        "não deveria escolher quem já está sobrecarregado"
    );
}
