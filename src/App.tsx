import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";
import OSList from "./pages/os/OSList";
import OSDetail from "./pages/os/OSDetail";
import OSNew from "./pages/os/OSNew";

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-950 text-slate-100">
        {/* Sidebar */}
        <aside className="fixed left-0 top-0 h-screen w-64 border-r border-slate-800 bg-slate-900 p-6">
          <h1 className="text-xl font-bold text-sky-400">AutoHub Oficina</h1>
          <p className="mt-1 text-sm text-slate-400">Gestão inteligente</p>

          <nav className="mt-8 space-y-2">
            <a className="block rounded-lg px-4 py-2 text-slate-300 hover:bg-slate-800">
              Dashboard
            </a>
            <a className="block rounded-lg px-4 py-2 text-slate-300 hover:bg-slate-800">
              Clientes
            </a>
            <a className="block rounded-lg px-4 py-2 text-slate-300 hover:bg-slate-800">
              Veículos
            </a>
            <Link
              to="/os"
              className="block rounded-lg bg-sky-500 px-4 py-2 font-medium text-white"
            >
              Ordens de Serviço
            </Link>
            <a className="block rounded-lg px-4 py-2 text-slate-300 hover:bg-slate-800">
              Compras
            </a>
            <a className="block rounded-lg px-4 py-2 text-slate-300 hover:bg-slate-800">
              Estoque
            </a>
            <a className="block rounded-lg px-4 py-2 text-slate-300 hover:bg-slate-800">
              Orçamentos
            </a>
            <a className="block rounded-lg px-4 py-2 text-slate-300 hover:bg-slate-800">
              Fornecedores
            </a>
          </nav>
        </aside>

        {/* Conteúdo */}
        <main className="ml-64 p-8">
          <Routes>
            <Route path="/" element={<Navigate to="/os" />} />
            <Route path="/os" element={<OSList />} />
            <Route path="/os/nova" element={<OSNew />} />
            <Route path="/os/:id" element={<OSDetail />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
