use app_lib::wol::{extrair_doc_id, parser::parse_documento, Secao, TipoParte};

#[test]
fn extrai_doc_id_da_pagina_de_reunioes() {
    let html = include_str!("fixtures/meetings_2026_36.html");
    let doc_id = extrair_doc_id(html).expect("deveria achar o docId");
    assert_eq!(doc_id, "202026249");
}

#[test]
fn parseia_documento_da_semana() {
    let html = include_str!("fixtures/mwb_202026249.html");
    let semana = parse_documento(html).expect("parse deveria funcionar");

    assert_eq!(semana.intervalo_texto, "31 DE AGOSTO–6 DE SETEMBRO");
    assert_eq!(semana.leitura_semanal, "JEREMIAS 31");
    assert_eq!(semana.cantico_inicial, Some(27));
    assert_eq!(semana.cantico_meio, Some(67));
    assert_eq!(semana.cantico_final, Some(132));

    assert_eq!(semana.partes.len(), 8, "esperava 8 partes numeradas");

    let duracoes: Vec<u32> = semana.partes.iter().map(|p| p.duracao_min).collect();
    assert_eq!(duracoes, vec![10, 10, 4, 3, 4, 5, 15, 30]);

    let tipos: Vec<TipoParte> = semana.partes.iter().map(|p| p.tipo).collect();
    use TipoParte::*;
    assert_eq!(
        tipos,
        vec![
            Tesouros,
            Joias,
            Leitura,
            MinisterioDemonstracao,
            MinisterioDemonstracao,
            MinisterioDiscurso,
            VidaCrista,
            EstudoBiblico,
        ]
    );

    let secoes: Vec<Secao> = semana.partes.iter().map(|p| p.secao).collect();
    assert_eq!(secoes[0], Secao::Tesouros);
    assert_eq!(secoes[3], Secao::Ministerio);
    assert_eq!(secoes[6], Secao::VidaCrista);

    assert!(semana.partes[5]
        .descricao
        .to_lowercase()
        .contains("discurso"));
    assert!(semana.partes[3].tem_ajudante);
    assert!(!semana.partes[5].tem_ajudante);
}
