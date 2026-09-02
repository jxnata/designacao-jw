import { useEffect, useState } from "react";
import { excluirPessoa, listarPessoas, salvarPessoa } from "../lib/db";
import type { Pessoa } from "../lib/types";

type FormState = Omit<Pessoa, "id"> & { id?: number };

const VAZIO: FormState = {
  nome: "",
  grupo: 1,
  surdo: false,
  sexo: "m",
  publicador: true,
  batizado: false,
  servo: false,
  anciao: false,
  ativo: true,
};

export default function Pessoas() {
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [form, setForm] = useState<FormState>(VAZIO);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState("");

  async function recarregar() {
    setCarregando(true);
    try {
      setPessoas(await listarPessoas(true));
    } catch (e) {
      setErro(String(e));
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    recarregar();
  }, []);

  function editar(p: Pessoa) {
    setForm(p);
  }

  function novaPessoa() {
    setForm(VAZIO);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) return;
    try {
      await salvarPessoa(form);
      setForm(VAZIO);
      await recarregar();
    } catch (e) {
      setErro(String(e));
    }
  }

  async function excluir(id: number) {
    if (!confirm("Excluir esta pessoa? O histórico de designações dela será perdido.")) return;
    await excluirPessoa(id);
    await recarregar();
  }

  const pessoasFiltradas = pessoas.filter((p) =>
    p.nome.toLowerCase().includes(filtro.toLowerCase()),
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold">Pessoas</h1>
          <input
            className="w-56 rounded border border-slate-300 px-2 py-1 text-sm"
            placeholder="Buscar por nome…"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
          />
        </div>

        {erro && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
        {carregando ? (
          <p className="text-sm text-slate-500">Carregando…</p>
        ) : (
          <div className="overflow-x-auto rounded border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Nome</th>
                  <th className="px-3 py-2">Grupo</th>
                  <th className="px-3 py-2">Sexo</th>
                  <th className="px-3 py-2">Privilégios</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {pessoasFiltradas.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium">{p.nome}</td>
                    <td className="px-3 py-2">{p.grupo}</td>
                    <td className="px-3 py-2">{p.sexo === "m" ? "Homem" : "Mulher"}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {[
                        p.anciao && "Ancião",
                        p.servo && "Servo",
                        p.batizado && "Batizado",
                        p.publicador && "Publicador",
                        p.surdo && "Surdo",
                      ]
                        .filter(Boolean)
                        .join(", ") || "—"}
                    </td>
                    <td className="px-3 py-2">
                      {p.ativo ? (
                        <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                          Ativo
                        </span>
                      ) : (
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                          Inativo
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button className="text-xs text-teal-700 hover:underline" onClick={() => editar(p)}>
                        Editar
                      </button>
                      <button
                        className="ml-3 text-xs text-red-600 hover:underline"
                        onClick={() => excluir(p.id)}
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
                {pessoasFiltradas.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-slate-400">
                      Nenhuma pessoa cadastrada ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <form onSubmit={salvar} className="h-fit rounded border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">{form.id ? "Editar pessoa" : "Nova pessoa"}</h2>
          {form.id && (
            <button type="button" className="text-xs text-slate-500 hover:underline" onClick={novaPessoa}>
              cancelar edição
            </button>
          )}
        </div>

        <label className="mb-2 block text-xs font-medium text-slate-600">
          Nome
          <input
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            required
          />
        </label>

        <div className="mb-2 grid grid-cols-2 gap-2">
          <label className="block text-xs font-medium text-slate-600">
            Grupo de campo
            <input
              type="number"
              min={1}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
              value={form.grupo}
              onChange={(e) => setForm({ ...form, grupo: Number(e.target.value) })}
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Sexo
            <select
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
              value={form.sexo}
              onChange={(e) => {
                const sexo = e.target.value as "m" | "f";
                setForm({
                  ...form,
                  sexo,
                  servo: sexo === "f" ? false : form.servo,
                  anciao: sexo === "f" ? false : form.anciao,
                });
              }}
            >
              <option value="m">Homem</option>
              <option value="f">Mulher</option>
            </select>
          </label>
        </div>

        <div className="mb-3 space-y-1.5">
          <Checkbox
            label="Surdo"
            checked={form.surdo}
            onChange={(v) => setForm({ ...form, surdo: v })}
          />
          <Checkbox
            label="Publicador"
            checked={form.publicador}
            onChange={(v) => setForm({ ...form, publicador: v })}
          />
          <Checkbox
            label="Batizado"
            checked={form.batizado}
            onChange={(v) => setForm({ ...form, batizado: v })}
          />
          <Checkbox
            label="Servo ministerial"
            checked={form.servo}
            disabled={form.sexo === "f"}
            onChange={(v) => setForm({ ...form, servo: v })}
          />
          <Checkbox
            label="Ancião"
            checked={form.anciao}
            disabled={form.sexo === "f"}
            onChange={(v) => setForm({ ...form, anciao: v })}
          />
          <Checkbox label="Ativo" checked={form.ativo} onChange={(v) => setForm({ ...form, ativo: v })} />
        </div>

        <button
          type="submit"
          className="w-full rounded bg-teal-700 py-1.5 text-sm font-medium text-white hover:bg-teal-800"
        >
          {form.id ? "Salvar alterações" : "Adicionar pessoa"}
        </button>
      </form>
    </div>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-center gap-2 text-sm ${disabled ? "text-slate-300" : "text-slate-700"}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}
