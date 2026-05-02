import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/useAuth";
import { supabase } from "../../lib/supabase";

type LocationState = {
  from?: {
    pathname?: string;
  };
};

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isLoading: isAuthLoading, refreshAuth } = useAuth();
  const locationState = location.state as LocationState | null;
  const redirectTo = locationState?.from?.pathname || "/dashboard";
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (!supabase) {
      setErrorMessage(
        "Supabase não configurado. Preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.",
      );
      return;
    }

    setIsLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });

    setIsLoading(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    await refreshAuth();
    navigate(redirectTo, { replace: true });
  }

  if (isAuthLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-sm text-slate-300">
        Verificando sessão...
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl shadow-slate-950/40"
      >
        <div>
          <h1 className="text-xl font-semibold text-slate-100">AutoHub Oficina</h1>
          <p className="mt-1 text-sm text-slate-400">Acesse sua conta</p>
        </div>

        <label className="mt-6 block text-sm font-medium text-slate-200">
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-500"
          />
        </label>

        <label className="mt-4 block text-sm font-medium text-slate-200">
          Senha
          <input
            type="password"
            value={senha}
            onChange={(event) => setSenha(event.target.value)}
            required
            autoComplete="current-password"
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-500"
          />
        </label>

        {errorMessage && (
          <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {errorMessage}
          </p>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="mt-6 w-full rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isLoading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
