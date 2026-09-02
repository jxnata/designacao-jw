import { useEffect, useState } from "react";
import { getConfig, salvarConfig } from "../lib/db";
import type { Config } from "../lib/types";

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export default function Configuracoes() {
  const [config, setConfig] = useState<Config | null>(null);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    getConfig().then(setConfig);
  }, []);

  if (!config) return <p className="text-sm text-slate-500">Carregando…</p>;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!config) return;
    await salvarConfig(config);
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2000);
  }

  return (
    <form onSubmit={salvar} className="max-w-md rounded border border-slate-200 bg-white p-4">
      <h1 className="mb-4 text-lg font-semibold">Configurações</h1>

      <label className="mb-3 block text-xs font-medium text-slate-600">
        Nome da congregação (aparece no cabeçalho impresso)
        <input
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
          value={config.congregacao}
          onChange={(e) => setConfig({ ...config, congregacao: e.target.value })}
        />
      </label>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <label className="block text-xs font-medium text-slate-600">
          Dia da semana da reunião
          <select
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
            value={config.dia_semana}
            onChange={(e) => setConfig({ ...config, dia_semana: Number(e.target.value) })}
          >
            {DIAS.map((d, i) => (
              <option key={i} value={i}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-600">
          Horário de início
          <input
            type="time"
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
            value={config.horario}
            onChange={(e) => setConfig({ ...config, horario: e.target.value })}
          />
        </label>
      </div>

      <label className="mb-4 block text-xs font-medium text-slate-600">
        Transição entre partes (min)
        <input
          type="number"
          min={0}
          max={5}
          className="mt-1 w-24 rounded border border-slate-300 px-2 py-1 text-sm"
          value={config.transicao_min}
          onChange={(e) => setConfig({ ...config, transicao_min: Number(e.target.value) })}
        />
      </label>

      <div className="mb-4 space-y-2 border-t border-slate-200 pt-3">
        <p className="text-xs font-medium text-slate-600">Designação</p>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={config.usar_servos_presidencia}
            onChange={(e) =>
              setConfig({ ...config, usar_servos_presidencia: e.target.checked })
            }
          />
          Usar servos ministeriais na presidência
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={config.usar_servos_estudo_biblico}
            onChange={(e) =>
              setConfig({ ...config, usar_servos_estudo_biblico: e.target.checked })
            }
          />
          Usar servos ministeriais no Estudo Bíblico de Congregação
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={config.usar_anciaos_leitura}
            onChange={(e) => setConfig({ ...config, usar_anciaos_leitura: e.target.checked })}
          />
          Usar anciãos na Leitura da Bíblia
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700 disabled:opacity-50">
          <input
            type="checkbox"
            checked={config.congregacao_sinais ? false : config.usar_anciaos_leitura_ebc}
            disabled={config.congregacao_sinais}
            onChange={(e) =>
              setConfig({ ...config, usar_anciaos_leitura_ebc: e.target.checked })
            }
          />
          <span className={config.congregacao_sinais ? "opacity-50" : undefined}>
            Usar anciãos na leitura do Estudo Bíblico de Congregação
          </span>
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={config.congregacao_sinais}
            onChange={(e) =>
              setConfig({
                ...config,
                congregacao_sinais: e.target.checked,
                usar_anciaos_leitura_ebc: e.target.checked ? false : config.usar_anciaos_leitura_ebc,
              })
            }
          />
          Congregação de Língua de Sinais
        </label>
      </div>

      <button className="rounded bg-teal-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-teal-800">
        Salvar
      </button>
      {salvo && <span className="ml-3 text-sm text-emerald-600">Salvo!</span>}
    </form>
  );
}
