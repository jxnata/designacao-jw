import { HashRouter, NavLink, Navigate, Route, Routes } from "react-router-dom";
import Pessoas from "./pages/Pessoas";
import Designacao from "./pages/Designacao";
import Impressao from "./pages/Impressao";
import Historico from "./pages/Historico";
import Backup from "./pages/Backup";
import Configuracoes from "./pages/Configuracoes";

const abas = [
  { to: "/designacao", label: "Designação" },
  { to: "/pessoas", label: "Pessoas" },
  { to: "/historico", label: "Histórico" },
  { to: "/backup", label: "Backup" },
  { to: "/configuracoes", label: "Configurações" },
];

export default function App() {
  return (
    <HashRouter>
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <nav className="no-print sticky top-0 z-10 border-b border-slate-200 bg-white shadow-sm">
          <div className="mx-auto flex max-w-6xl items-center gap-1 px-4">
            <span className="mr-4 py-3 text-sm font-semibold tracking-tight text-slate-700">
              Designações — Vida e Ministério
            </span>
            {abas.map((a) => (
              <NavLink
                key={a.to}
                to={a.to}
                className={({ isActive }) =>
                  `border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
                    isActive
                      ? "border-teal-700 text-teal-700"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`
                }
              >
                {a.label}
              </NavLink>
            ))}
          </div>
        </nav>

        <main className="mx-auto max-w-6xl px-4 py-6">
          <Routes>
            <Route path="/" element={<Navigate to="/designacao" replace />} />
            <Route path="/designacao" element={<Designacao />} />
            <Route path="/pessoas" element={<Pessoas />} />
            <Route path="/historico" element={<Historico />} />
            <Route path="/backup" element={<Backup />} />
            <Route path="/configuracoes" element={<Configuracoes />} />
            <Route path="/impressao" element={<Impressao />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}
