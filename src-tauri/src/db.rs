use tauri_plugin_sql::{Migration, MigrationKind};

/// Migrations do banco local (SQLite, um arquivo por instalação, gerido
/// pelo `tauri-plugin-sql`). Toda leitura/escrita do dia a dia acontece no
/// frontend via `Database.load("sqlite:designacoes.db")`; o Rust só define
/// o schema aqui para manter uma única fonte de verdade versionada.
pub fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "schema inicial",
            kind: MigrationKind::Up,
            sql: r#"
            CREATE TABLE config (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                congregacao TEXT NOT NULL DEFAULT '',
                dia_semana INTEGER NOT NULL DEFAULT 2, -- 0=domingo .. 6=sábado
                horario TEXT NOT NULL DEFAULT '19:30',
                transicao_min INTEGER NOT NULL DEFAULT 1
            );
            INSERT INTO config (id) VALUES (1);

            CREATE TABLE pessoas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nome TEXT NOT NULL,
                grupo INTEGER NOT NULL DEFAULT 1,
                surdo INTEGER NOT NULL DEFAULT 0,
                sexo TEXT NOT NULL CHECK (sexo IN ('m','f')),
                publicador INTEGER NOT NULL DEFAULT 1,
                batizado INTEGER NOT NULL DEFAULT 0,
                servo INTEGER NOT NULL DEFAULT 0,
                anciao INTEGER NOT NULL DEFAULT 0,
                ativo INTEGER NOT NULL DEFAULT 1,
                CHECK (sexo = 'm' OR (servo = 0 AND anciao = 0))
            );

            CREATE TABLE semanas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ordinal INTEGER NOT NULL UNIQUE, -- cronológico, usado pelo balanceador
                ano INTEGER NOT NULL,
                semana_iso INTEGER NOT NULL,
                doc_id TEXT NOT NULL,
                intervalo_texto TEXT NOT NULL DEFAULT '',
                leitura_semanal TEXT NOT NULL DEFAULT '',
                cantico_inicial INTEGER,
                cantico_meio INTEGER,
                cantico_final INTEGER,
                status TEXT NOT NULL DEFAULT 'importada' CHECK (status IN ('importada','preview','final')),
                atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE partes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                semana_id INTEGER NOT NULL REFERENCES semanas(id) ON DELETE CASCADE,
                ordem INTEGER NOT NULL,
                numero INTEGER,
                secao TEXT NOT NULL,
                titulo TEXT NOT NULL,
                duracao_min INTEGER NOT NULL DEFAULT 0,
                descricao TEXT NOT NULL DEFAULT '',
                tipo TEXT NOT NULL,
                tem_ajudante INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE designacoes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                semana_id INTEGER NOT NULL REFERENCES semanas(id) ON DELETE CASCADE,
                parte_id INTEGER REFERENCES partes(id) ON DELETE CASCADE,
                tipo TEXT NOT NULL,
                pessoa_id INTEGER REFERENCES pessoas(id),
                ajudante_id INTEGER REFERENCES pessoas(id),
                criado_em TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE INDEX idx_partes_semana ON partes(semana_id);
            CREATE INDEX idx_designacoes_semana ON designacoes(semana_id);
            CREATE INDEX idx_designacoes_pessoa ON designacoes(pessoa_id);
        "#,
        },
        Migration {
            version: 2,
            description: "opcoes de servos ministeriais em presidencia e estudo biblico",
            kind: MigrationKind::Up,
            sql: r#"
            ALTER TABLE config ADD COLUMN usar_servos_presidencia INTEGER NOT NULL DEFAULT 1;
            ALTER TABLE config ADD COLUMN usar_servos_estudo_biblico INTEGER NOT NULL DEFAULT 1;
        "#,
        },
    ]
}
