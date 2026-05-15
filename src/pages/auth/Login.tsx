import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { normalizeRole } from "../../accessControl";
import { useAuth } from "../../contexts/useAuth";
import { supabase } from "../../lib/supabase";
import { updateCurrentRole } from "../../services/configuracoesService";
import { useAsyncAction } from "../../hooks/useAsyncAction";

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
  const [showSenha, setShowSenha] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  const performLogin = useCallback(async () => {
    setErrorMessage("");

    if (!supabase) {
      throw new Error(
        "Supabase não configurado. Preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.",
      );
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });

    if (error) {
      throw new Error("E-mail ou senha incorretos");
    }

    if (data.user) {
      const { data: usuario } = await supabase
        .from("usuarios")
        .select("nome, perfil")
        .eq("auth_user_id", data.user.id)
        .maybeSingle<{ nome: string | null; perfil: string | null }>();

      updateCurrentRole(normalizeRole(usuario?.perfil ?? null));

      if (usuario?.nome) {
        localStorage.setItem("autohub:usuario-nome", usuario.nome);
      }

      if (usuario?.perfil) {
        localStorage.setItem("autohub:perfil", usuario.perfil);
      }
    }

    await refreshAuth();
    navigate(redirectTo, { replace: true });
  }, [email, navigate, redirectTo, refreshAuth, senha]);

  const { execute: executeLogin, loading: isLoading } = useAsyncAction(
    performLogin,
    {
      successMessage: "Bem-vindo!",
      errorMessage: "E-mail ou senha incorretos",
      onError: (error) => {
        setErrorMessage(
          error instanceof Error ? error.message : "E-mail ou senha incorretos",
        );
      },
    },
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void executeLogin();
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
          <span className="relative mt-2 block">
            <input
              type={showSenha ? "text" : "password"}
              value={senha}
              onChange={(event) => setSenha(event.target.value)}
              required
              autoComplete="current-password"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 pr-10 text-sm text-slate-100 outline-none transition focus:border-sky-500"
            />
            <button
              type="button"
              onClick={() => setShowSenha((currentValue) => !currentValue)}
              className="absolute inset-y-0 right-2 flex items-center text-slate-400 hover:text-slate-200"
              aria-label={showSenha ? "Ocultar senha" : "Mostrar senha"}
            >
              {showSenha ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </span>
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

        <p className="mt-5 text-center text-sm text-slate-400">
          Ainda não tem conta?{" "}
          <Link
            to="/cadastro"
            className="font-semibold text-sky-300 hover:text-sky-200"
          >
            Cadastre-se grátis
          </Link>
        </p>
      </form>
    </div>
  );
}
