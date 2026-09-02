import { save, open } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { useState } from "react";
import { exportarBackup, importarBackup } from "../lib/db";
import type { BackupCompleto } from "../lib/db";

export default function Backup() {
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function exportar() {
    setErro(null);
    setMensagem(null);
    try {
      const destino = await save({
        title: "Salvar backup",
        defaultPath: `designacoes-backup-${new Date().toISOString().slice(0, 10)}.json`,
        filters: [{ name: "Backup JSON", extensions: ["json"] }],
      });
      if (!destino) return;
      const backup = await exportarBackup();
      await writeTextFile(destino, JSON.stringify(backup, null, 2));
      setMensagem(`Backup salvo em ${destino}`);
    } catch (e) {
      setErro(String(e));
    }
  }

  async function importar() {
    setErro(null);
    setMensagem(null);
    if (!confirm("Importar um backup substitui TODOS os dados atuais (pessoas, semanas e designações). Continuar?")) {
      return;
    }
    try {
      const origem = await open({
        title: "Escolher backup",
        multiple: false,
        filters: [{ name: "Backup JSON", extensions: ["json"] }],
      });
      if (!origem || Array.isArray(origem)) return;
      setOcupado(true);
      const texto = await readTextFile(origem);
      const backup = JSON.parse(texto) as BackupCompleto;
      await importarBackup(backup);
      setMensagem("Backup restaurado com sucesso. Recarregue as outras páginas para ver os dados.");
    } catch (e) {
      setErro(String(e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="mb-4 text-lg font-semibold">Backup</h1>

      <div className="mb-4 rounded border border-slate-200 bg-white p-4">
        <h2 className="mb-1 text-sm font-semibold">Exportar</h2>
        <p className="mb-3 text-xs text-slate-500">
          Salva um arquivo .json com toda a configuração, pessoas, semanas, partes e designações.
        </p>
        <button
          className="rounded bg-teal-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-teal-800"
          onClick={exportar}
        >
          Exportar backup…
        </button>
      </div>

      <div className="rounded border border-slate-200 bg-white p-4">
        <h2 className="mb-1 text-sm font-semibold">Restaurar</h2>
        <p className="mb-3 text-xs text-slate-500">
          Escolhe um arquivo .json exportado anteriormente e substitui todo o conteúdo atual do
          banco.
        </p>
        <button
          className="rounded border border-red-300 px-4 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          onClick={importar}
          disabled={ocupado}
        >
          {ocupado ? "Restaurando…" : "Restaurar backup…"}
        </button>
      </div>

      {mensagem && <p className="mt-3 rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{mensagem}</p>}
      {erro && <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
    </div>
  );
}
