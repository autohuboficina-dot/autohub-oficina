import { useState } from "react";
import { LogOut, Sparkles } from "lucide-react";
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import {
  type UserRole,
} from "./accessControl";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import { AuthProvider } from "./contexts/AuthContext";
import { supabase } from "./lib/supabase";
import Cadastro from "./pages/cadastro/Cadastro";
import Clientes from "./pages/clientes/Clientes";
import ClienteDetail from "./pages/clientes/ClienteDetail";
import Compras from "./pages/compras/Compras";
import Configuracoes from "./pages/configuracoes/Configuracoes";
import Dashboard from "./pages/dashboard/Dashboard";
import Estoque from "./pages/estoque/Estoque";
import Financeiro from "./pages/financeiro/Financeiro";
import FornecedorCotacaoView from "./pages/fornecedor/FornecedorCotacaoView";
import Fornecedores from "./pages/fornecedores/Fornecedores";
import Login from "./pages/auth/Login";
import OSList from "./pages/os/OSList";
import OSDetail from "./pages/os/OSDetail";
import OSNew from "./pages/os/OSNew";
import OrcamentoView from "./pages/orcamento/OrcamentoView";
import SDR from "./pages/sdr/SDR";
import {
  getConfiguracoesOficina,
  getCurrentRole,
} from "./services/configuracoesService";

type MenuItem = {
  label: string;
  path: string;
  icon?: "hermes";
};

const MENU_BY_ROLE: Record<UserRole, MenuItem[]> = {
  admin: [
    { label: "Dashboard", path: "/dashboard" },
    { label: "Financeiro", path: "/financeiro" },
    { label: "Clientes", path: "/clientes" },
    { label: "Ordens de Serviço", path: "/os" },
    { label: "Compras", path: "/compras" },
    { label: "Fornecedores", path: "/fornecedores" },
    { label: "Estoque", path: "/estoque" },
    { label: "Hermes IA", path: "/sdr", icon: "hermes" },
    { label: "Configurações", path: "/configuracoes" },
  ],
  mecanico: [
    { label: "Dashboard", path: "/dashboard" },
    { label: "Minhas OS", path: "/minhas-os" },
    { label: "Ordens de Serviço", path: "/os" },
    { label: "Estoque apenas consulta", path: "/estoque" },
  ],
  atendimento: [
    { label: "Dashboard", path: "/dashboard" },
    { label: "Clientes", path: "/clientes" },
    { label: "Veículos", path: "/veiculos" },
    { label: "Ordens de Serviço", path: "/os" },
    { label: "Orçamentos", path: "/orcamentos" },
    { label: "Hermes IA", path: "/sdr", icon: "hermes" },
  ],
  compras: [
    { label: "Dashboard", path: "/dashboard" },
    { label: "Compras", path: "/compras" },
    { label: "Fornecedores", path: "/fornecedores" },
    { label: "Estoque", path: "/estoque" },
  ],
  financeiro: [
    { label: "Dashboard", path: "/dashboard" },
    { label: "Financeiro", path: "/financeiro" },
  ],
};

function getInitialRole() {
  return getCurrentRole();
}

function getStoredUserName() {
  return localStorage.getItem("autohub:usuario-nome") || "Usuário";
}

function isActivePath(currentPath: string, itemPath: string) {
  if (itemPath === "/dashboard") {
    return currentPath === "/" || currentPath === "/dashboard";
  }

  return currentPath === itemPath || currentPath.startsWith(`${itemPath}/`);
}

function getRoleBadgeClass(role: UserRole) {
  const badgeClasses: Record<UserRole, string> = {
    admin: "bg-sky-500/20 text-sky-200 ring-sky-400/30",
    mecanico: "bg-emerald-500/20 text-emerald-200 ring-emerald-400/30",
    atendimento: "bg-amber-500/20 text-amber-200 ring-amber-400/30",
    compras: "bg-violet-500/20 text-violet-200 ring-violet-400/30",
    financeiro: "bg-orange-500/20 text-orange-200 ring-orange-400/30",
  };

  return badgeClasses[role];
}

function getRoleBadgeLabel(role: UserRole) {
  const labels: Record<UserRole, string> = {
    admin: "Administrador",
    mecanico: "Mecânico",
    atendimento: "Atendimento",
    compras: "Compras",
    financeiro: "Financeiro",
  };

  return labels[role];
}

function AppContent() {
  const location = useLocation();
  const [currentRole] = useState<UserRole>(getInitialRole);
  const [userName] = useState(getStoredUserName);
  const [oficinaConfig] = useState(() => getConfiguracoesOficina());
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const isPublicBudgetRoute =
    location.pathname.startsWith("/orcamento/") ||
    location.pathname.startsWith("/fornecedor/cotacao/");

  async function handleSignOut() {
    await supabase?.auth.signOut();
    localStorage.removeItem("autohub:perfil");
    localStorage.removeItem("autohub:usuario-nome");
    window.location.href = "/login";
  }

  if (isPublicBudgetRoute) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <Routes>
            <Route path="/orcamento/:id" element={<OrcamentoView />} />
            <Route
              path="/fornecedor/cotacao/:id"
              element={<FornecedorCotacaoView />}
            />
            <Route path="*" element={<Navigate to="/os" />} />
          </Routes>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {isSidebarOpen && (
        <button
          type="button"
          aria-label="Fechar menu"
          className="fixed inset-0 z-30 bg-slate-950/70 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside
        className={`no-print fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-slate-800 bg-slate-900 p-6 transition-transform duration-200 lg:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div>
          <h1 className="text-xl font-bold text-sky-400">
            {oficinaConfig.nomeOficina}
          </h1>
          <p className="mt-1 text-sm text-slate-400">Gestão inteligente</p>

          <nav className="mt-8 space-y-2">
            {MENU_BY_ROLE[currentRole].map((item) => {
              const isActive = isActivePath(location.pathname, item.path);

              return (
                <Link
                  key={`${currentRole}-${item.path}-${item.label}`}
                  to={item.path}
                  onClick={() => setIsSidebarOpen(false)}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm transition ${
                    isActive
                      ? "bg-sky-500 font-medium text-white"
                      : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  {item.icon === "hermes" && (
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                  )}
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          className="mt-auto flex w-full items-center gap-3 rounded-lg px-4 py-2 text-left text-sm font-medium text-red-400 transition hover:bg-slate-800 hover:text-red-300"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Sair
        </button>
      </aside>

      <main className="min-h-screen p-4 lg:ml-64 lg:p-8">
        <header className="no-print mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900 px-5 py-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Abrir menu"
              onClick={() => setIsSidebarOpen(true)}
              className="rounded-lg border border-slate-700 px-3 py-2 text-lg leading-none text-slate-200 hover:bg-slate-800 lg:hidden"
            >
              ☰
            </button>

            <div>
              <span className="text-xs font-semibold uppercase text-slate-500">
                USUÁRIO CONECTADO
              </span>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <p className="text-lg font-semibold text-white">{userName}</p>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${getRoleBadgeClass(
                    currentRole,
                  )}`}
                >
                  {getRoleBadgeLabel(currentRole)}
                </span>
              </div>
            </div>
          </div>
        </header>

        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" />} />
          <Route path="/dashboard" element={<Dashboard role={currentRole} />} />
          <Route path="/financeiro" element={<Financeiro role={currentRole} />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/clientes/:id" element={<ClienteDetail />} />
          <Route path="/veiculos" element={<Clientes />} />
          <Route path="/os" element={<OSList />} />
          <Route path="/minhas-os" element={<OSList />} />
          <Route path="/orcamentos" element={<OSList />} />
          <Route path="/os/nova" element={<OSNew />} />
          <Route path="/os/:id" element={<OSDetail />} />
          <Route path="/sdr" element={<SDR />} />
          <Route path="/compras" element={<Compras />} />
          <Route path="/estoque" element={<Estoque />} />
          <Route path="/fornecedores" element={<Fornecedores />} />
          <Route
            path="/configuracoes"
            element={<Configuracoes role={currentRole} />}
          />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/cadastro" element={<Cadastro />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/orcamento/:id"
            element={
              <div className="min-h-screen bg-slate-950 text-slate-100">
                <main className="px-4 py-6 sm:px-6 lg:px-8">
                  <OrcamentoView />
                </main>
              </div>
            }
          />
          <Route
            path="/fornecedor/cotacao/:id"
            element={
              <div className="min-h-screen bg-slate-950 text-slate-100">
                <main className="px-4 py-6 sm:px-6 lg:px-8">
                  <FornecedorCotacaoView />
                </main>
              </div>
            }
          />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <AppContent />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
