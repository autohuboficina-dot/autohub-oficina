import { useRef, useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";

type CadastroForm = {
  nomeOficina: string;
  nomeUsuario: string;
  whatsapp: string;
  email: string;
  senha: string;
  confirmarSenha: string;
};

const initialForm: CadastroForm = {
  nomeOficina: "",
  nomeUsuario: "",
  whatsapp: "",
  email: "",
  senha: "",
  confirmarSenha: "",
};

const benefits = [
  {
    icon: "OS",
    title: "OS Digital",
    description: "Abra e acompanhe ordens de serviço sem papel",
  },
  {
    icon: "CP",
    title: "Cotação de Peças",
    description: "Compare fornecedores e confirme compras direto no sistema",
  },
  {
    icon: "AC",
    title: "Aprovação do Cliente",
    description: "Cliente aprova o orçamento pelo celular, sem ligação",
  },
];

function translateSupabaseError(message: string) {
  if (
    message.includes("user_already_exists") ||
    message.includes("User already registered")
  ) {
    return "Este e-mail já possui uma conta";
  }

  return "Erro ao criar conta. Tente novamente.";
}

function validateForm(form: CadastroForm) {
  if (!form.nomeOficina.trim()) {
    return "Informe o nome da oficina.";
  }

  if (!form.nomeUsuario.trim()) {
    return "Informe seu nome.";
  }

  if (!form.email.trim()) {
    return "Informe o e-mail.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    return "Informe um e-mail válido.";
  }

  if (form.senha.length < 6) {
    return "A senha deve ter no mínimo 6 caracteres.";
  }

  if (form.senha !== form.confirmarSenha) {
    return "As senhas não conferem.";
  }

  return "";
}

export default function Cadastro() {
  const navigate = useNavigate();
  const formSectionRef = useRef<HTMLElement | null>(null);
  const [form, setForm] = useState<CadastroForm>(initialForm);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSenha, setShowSenha] = useState(false);
  const [showConfirmarSenha, setShowConfirmarSenha] = useState(false);

  function updateField(field: keyof CadastroForm, value: string) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  function scrollToForm() {
    formSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    const validationError = validateForm(form);

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    if (!supabase) {
      setErrorMessage(
        "Supabase não configurado. Preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.",
      );
      return;
    }

    setIsLoading(true);

    const email = form.email.trim();
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password: form.senha,
    });

    if (signUpError || !signUpData.user) {
      setErrorMessage(translateSupabaseError(signUpError?.message || ""));
      setIsLoading(false);
      return;
    }

    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({
        email,
        password: form.senha,
      });

    if (signInError || !signInData.session) {
      setErrorMessage("Conta criada. Faça login para continuar.");
      setIsLoading(false);
      navigate("/login", { replace: true });
      return;
    }

    const { error: rpcError } = await supabase.rpc("criar_oficina_e_usuario", {
      p_nome_oficina: form.nomeOficina.trim(),
      p_whatsapp: form.whatsapp.trim() || null,
      p_nome_usuario: form.nomeUsuario.trim(),
      p_email: email,
    });

    setIsLoading(false);

    if (rpcError) {
      setErrorMessage("Erro ao configurar sua oficina. Entre em contato.");
      return;
    }

    localStorage.setItem("autohub:perfil", "admin");
    navigate("/dashboard", {
      replace: true,
      state: {
        welcomeMessage: `Bem-vindo ao AutoHub Oficina, ${form.nomeUsuario.trim()}!`,
      },
    });
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <section className="px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-6xl text-center">
          <div>
            <p className="text-sm font-semibold uppercase text-sky-400">
              AutoHub Oficina
            </p>
            <p className="mt-2 text-sm text-slate-400">
              Gestão inteligente para sua oficina
            </p>
          </div>

          <h1 className="mx-auto mt-8 max-w-4xl text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Sua oficina no controle. Do orçamento à entrega.
          </h1>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {benefits.map((benefit) => (
              <article
                key={benefit.title}
                className="flex items-start gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-5 text-left shadow-sm shadow-slate-950/20"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sm font-bold text-sky-200 ring-1 ring-sky-400/30">
                  {benefit.icon}
                </span>
                <div>
                  <h2 className="font-semibold text-slate-100">{benefit.title}</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    {benefit.description}
                  </p>
                </div>
              </article>
            ))}
          </div>

          <button
            type="button"
            onClick={scrollToForm}
            className="mt-10 rounded-xl bg-sky-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-sky-400"
          >
            Começar grátis agora
          </button>
        </div>
      </section>

      <section ref={formSectionRef} className="px-4 pb-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl shadow-slate-950/40 sm:p-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white">Crie sua conta grátis</h2>
            <p className="mt-2 text-sm text-slate-400">
              Sem cartão de crédito. Cancele quando quiser.
            </p>
          </div>

          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            <label className="block text-sm font-medium text-slate-200">
              Nome da oficina
              <input
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-500"
                value={form.nomeOficina}
                onChange={(event) => updateField("nomeOficina", event.target.value)}
                autoComplete="organization"
              />
            </label>

            <label className="block text-sm font-medium text-slate-200">
              Seu nome
              <input
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-500"
                value={form.nomeUsuario}
                onChange={(event) => updateField("nomeUsuario", event.target.value)}
                autoComplete="name"
              />
            </label>

            <label className="block text-sm font-medium text-slate-200">
              WhatsApp <span className="text-slate-500">(opcional)</span>
              <input
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-500"
                value={form.whatsapp}
                onChange={(event) => updateField("whatsapp", event.target.value)}
                autoComplete="tel"
              />
            </label>

            <label className="block text-sm font-medium text-slate-200">
              E-mail
              <input
                type="email"
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-500"
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
                autoComplete="email"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-200">
                Senha
                <span className="relative mt-2 block">
                  <input
                    type={showSenha ? "text" : "password"}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 pr-10 text-sm text-slate-100 outline-none transition focus:border-sky-500"
                    value={form.senha}
                    onChange={(event) => updateField("senha", event.target.value)}
                    autoComplete="new-password"
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

              <label className="block text-sm font-medium text-slate-200">
                Confirmar senha
                <span className="relative mt-2 block">
                  <input
                    type={showConfirmarSenha ? "text" : "password"}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 pr-10 text-sm text-slate-100 outline-none transition focus:border-sky-500"
                    value={form.confirmarSenha}
                    onChange={(event) =>
                      updateField("confirmarSenha", event.target.value)
                    }
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowConfirmarSenha((currentValue) => !currentValue)
                    }
                    className="absolute inset-y-0 right-2 flex items-center text-slate-400 hover:text-slate-200"
                    aria-label={
                      showConfirmarSenha ? "Ocultar senha" : "Mostrar senha"
                    }
                  >
                    {showConfirmarSenha ? (
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                </span>
              </label>
            </div>

            {errorMessage && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {errorMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoading && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              )}
              {isLoading ? "Criando sua conta..." : "Criar minha conta"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-400">
            Já tem uma conta?{" "}
            <Link className="font-semibold text-sky-300 hover:text-sky-200" to="/login">
              Fazer login
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
