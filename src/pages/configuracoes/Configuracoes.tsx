import { useState, type FormEvent } from "react";
import { ROLE_LABELS, USER_ROLES, type UserRole } from "../../accessControl";
import { formatCpfCnpj, formatPhone, onlyDigits } from "../../utils/formatters";
import {
  deleteUsuario,
  getConfiguracoesOficina,
  getUsuarios,
  saveConfiguracoesOficina,
  saveUsuario,
  updateUsuario,
  type OficinaConfiguracoes,
  type UsuarioSistema,
  type UsuarioStatus,
} from "../../services/configuracoesService";

type ConfiguracoesProps = {
  role: UserRole;
};

type UsuarioFormState = {
  nome: string;
  email: string;
  perfil: UserRole;
  status: UsuarioStatus;
};

const initialUsuarioForm: UsuarioFormState = {
  nome: "",
  email: "",
  perfil: "atendimento",
  status: "ativo",
};

const permissionLabels: Record<UserRole, string> = {
  admin: "Admin vê todos os módulos, configurações e permissões.",
  financeiro: "Financeiro vê somente o módulo Financeiro.",
  mecanico: "Mecânico vê OS e Estoque em consulta.",
  atendimento: "Atendimento vê Clientes, OS, Orçamentos e SDR.",
  compras: "Compras vê Compras, Fornecedores e Estoque.",
};

export default function Configuracoes({ role }: ConfiguracoesProps) {
  const [config, setConfig] = useState<OficinaConfiguracoes>(() => {
    const storedConfig = getConfiguracoesOficina();

    return {
      ...storedConfig,
      cnpj: formatCpfCnpj(storedConfig.cnpj),
      whatsapp: formatPhone(storedConfig.whatsapp),
    };
  });
  const [usuarios, setUsuarios] = useState<UsuarioSistema[]>(() => getUsuarios());
  const [usuarioForm, setUsuarioForm] =
    useState<UsuarioFormState>(initialUsuarioForm);
  const [editingUsuarioId, setEditingUsuarioId] = useState("");
  const [feedback, setFeedback] = useState("");

  const inputClass =
    "w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none transition focus:border-sky-500";
  const labelClass = "mb-2 block text-sm font-medium text-slate-300";
  const sectionClass =
    "rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-sm shadow-slate-950/20 sm:p-6";

  function updateConfigField(field: keyof OficinaConfiguracoes, value: string) {
    setConfig((currentConfig) => ({
      ...currentConfig,
      [field]: value,
    }));
  }

  function updateDiscountRule(
    field: "pix" | "dinheiro" | "debito",
    key: "tipo" | "valor",
    value: string,
  ) {
    setConfig((currentConfig) => ({
      ...currentConfig,
      regrasPagamento: {
        ...currentConfig.regrasPagamento,
        [field]: {
          ...currentConfig.regrasPagamento[field],
          [key]: key === "valor" ? Number(value || 0) : value,
        },
      },
    }));
  }

  function updateCreditRule(
    key:
      | "maxParcelas"
      | "parcelasSemJuros"
      | "taxaParcelamentoPercentual"
      | "repassarTaxaCliente",
    value: string | boolean,
  ) {
    setConfig((currentConfig) => ({
      ...currentConfig,
      regrasPagamento: {
        ...currentConfig.regrasPagamento,
        credito: {
          ...currentConfig.regrasPagamento.credito,
          [key]: typeof value === "boolean" ? value : Number(value || 0),
        },
      },
    }));
  }

  function handleSaveConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const savedConfig = saveConfiguracoesOficina({
      ...config,
      cnpj: onlyDigits(config.cnpj),
      whatsapp: onlyDigits(config.whatsapp),
    });
    setConfig({
      ...savedConfig,
      cnpj: formatCpfCnpj(savedConfig.cnpj),
      whatsapp: formatPhone(savedConfig.whatsapp),
    });
    setFeedback("Configurações da oficina salvas.");
  }

  function handleSubmitUsuario(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!usuarioForm.nome.trim()) {
      setFeedback("Informe o nome do usuário.");
      return;
    }

    if (editingUsuarioId) {
      const currentUsuario = usuarios.find(
        (usuario) => usuario.id === editingUsuarioId,
      );

      if (currentUsuario) {
        updateUsuario({
          ...currentUsuario,
          nome: usuarioForm.nome.trim(),
          email: usuarioForm.email.trim(),
          perfil: usuarioForm.perfil,
          status: usuarioForm.status,
        });
      }
    } else {
      saveUsuario({
        nome: usuarioForm.nome.trim(),
        email: usuarioForm.email.trim(),
        perfil: usuarioForm.perfil,
        status: usuarioForm.status,
      });
    }

    setUsuarios(getUsuarios());
    setUsuarioForm(initialUsuarioForm);
    setEditingUsuarioId("");
    setFeedback(editingUsuarioId ? "Usuário atualizado." : "Usuário criado.");
  }

  function handleEditUsuario(usuario: UsuarioSistema) {
    setEditingUsuarioId(usuario.id);
    setUsuarioForm({
      nome: usuario.nome,
      email: usuario.email,
      perfil: usuario.perfil,
      status: usuario.status,
    });
  }

  function handleDeleteUsuario(usuarioId: string) {
    deleteUsuario(usuarioId);
    setUsuarios(getUsuarios());
    setFeedback("Usuário removido.");
  }

  if (role !== "admin") {
    return (
      <div className="max-w-3xl">
        <section className="rounded-2xl border border-red-400/20 bg-red-500/10 p-6">
          <span className="text-sm font-semibold uppercase text-red-200">
            Acesso restrito
          </span>
          <h2 className="mt-2 text-3xl font-bold">
            Acesso restrito ao administrador
          </h2>
          <p className="mt-2 text-slate-300">
            Somente o perfil Admin pode alterar configurações e permissões.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="max-w-7xl space-y-6">
      <div>
        <span className="text-sm font-semibold uppercase text-sky-400">
          Configurações
        </span>
        <h2 className="mt-1 text-3xl font-bold">Oficina e permissões</h2>
        <p className="mt-2 text-slate-400">
          Dados usados em orçamentos, WhatsApp e controle básico de perfis.
        </p>
      </div>

      {feedback && (
        <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-200">
          {feedback}
        </div>
      )}

      <form className={sectionClass} onSubmit={handleSaveConfig}>
        <div className="mb-5">
          <h3 className="text-xl font-bold">Configurações da oficina</h3>
          <p className="mt-1 text-sm text-slate-400">
            Essas informações aparecem no orçamento do cliente e nas mensagens.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <label className={labelClass}>Nome da oficina</label>
            <input
              className={inputClass}
              value={config.nomeOficina}
              onChange={(event) =>
                updateConfigField("nomeOficina", event.target.value)
              }
            />
          </div>

          <div>
            <label className={labelClass}>CNPJ</label>
            <input
              className={inputClass}
              value={config.cnpj}
              onChange={(event) =>
                updateConfigField("cnpj", formatCpfCnpj(event.target.value))
              }
            />
          </div>

          <div>
            <label className={labelClass}>WhatsApp</label>
            <input
              className={inputClass}
              value={config.whatsapp}
              onChange={(event) =>
                updateConfigField("whatsapp", formatPhone(event.target.value))
              }
            />
          </div>

          <div>
            <label className={labelClass}>E-mail</label>
            <input
              className={inputClass}
              value={config.email}
              onChange={(event) => updateConfigField("email", event.target.value)}
            />
          </div>

          <div>
            <label className={labelClass}>Endereço</label>
            <input
              className={inputClass}
              value={config.endereco}
              onChange={(event) =>
                updateConfigField("endereco", event.target.value)
              }
            />
          </div>

          <div>
            <label className={labelClass}>Cidade</label>
            <input
              className={inputClass}
              value={config.cidade}
              onChange={(event) =>
                updateConfigField("cidade", event.target.value)
              }
            />
          </div>

          <div>
            <label className={labelClass}>Logo (URL)</label>
            <input
              className={inputClass}
              value={config.logo}
              onChange={(event) => updateConfigField("logo", event.target.value)}
            />
          </div>

          <div>
            <label className={labelClass}>Chave Pix</label>
            <input
              className={inputClass}
              value={config.chavePix}
              onChange={(event) =>
                updateConfigField("chavePix", event.target.value)
              }
            />
          </div>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div>
            <label className={labelClass}>Texto padrão do orçamento</label>
            <textarea
              rows={4}
              className={inputClass}
              value={config.textoPadraoOrcamento}
              onChange={(event) =>
                updateConfigField("textoPadraoOrcamento", event.target.value)
              }
            />
          </div>

          <div>
            <label className={labelClass}>Política de entrada/sinal</label>
            <textarea
              rows={4}
              className={inputClass}
              value={config.politicaEntradaSinal}
              onChange={(event) =>
                updateConfigField("politicaEntradaSinal", event.target.value)
              }
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="submit"
            className="rounded-xl bg-sky-500 px-5 py-3 text-sm font-semibold text-white hover:bg-sky-400"
          >
            Salvar configurações
          </button>
        </div>
      </form>

      <section className={sectionClass}>
        <div className="mb-5">
          <h3 className="text-xl font-bold">Regras de pagamento</h3>
          <p className="mt-1 text-sm text-slate-400">
            Usadas para calcular Pix, dinheiro, débito e crédito sobre o saldo
            restante quando houver entrada/sinal.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {(["pix", "dinheiro", "debito"] as const).map((field) => (
            <div key={field} className="rounded-xl border border-slate-800 bg-slate-950 p-4">
              <h4 className="font-semibold capitalize text-slate-100">
                {field === "debito" ? "Débito à vista" : field}
              </h4>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Tipo</label>
                  <select
                    className={inputClass}
                    value={config.regrasPagamento[field].tipo}
                    onChange={(event) =>
                      updateDiscountRule(field, "tipo", event.target.value)
                    }
                  >
                    <option value="percentual">Percentual</option>
                    <option value="valor">Valor</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Valor</label>
                  <input
                    className={inputClass}
                    type="number"
                    min="0"
                    step="0.01"
                    value={config.regrasPagamento[field].valor}
                    onChange={(event) =>
                      updateDiscountRule(field, "valor", event.target.value)
                    }
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-4">
          <h4 className="font-semibold text-slate-100">Cartão de crédito</h4>
          <div className="mt-4 grid gap-4 md:grid-cols-4">
            <div>
              <label className={labelClass}>Máximo de parcelas</label>
              <input
                className={inputClass}
                type="number"
                min="1"
                value={config.regrasPagamento.credito.maxParcelas}
                onChange={(event) =>
                  updateCreditRule("maxParcelas", event.target.value)
                }
              />
            </div>
            <div>
              <label className={labelClass}>Parcelas sem juros</label>
              <input
                className={inputClass}
                type="number"
                min="1"
                value={config.regrasPagamento.credito.parcelasSemJuros}
                onChange={(event) =>
                  updateCreditRule("parcelasSemJuros", event.target.value)
                }
              />
            </div>
            <div>
              <label className={labelClass}>Taxa percentual</label>
              <input
                className={inputClass}
                type="number"
                min="0"
                step="0.01"
                value={config.regrasPagamento.credito.taxaParcelamentoPercentual}
                onChange={(event) =>
                  updateCreditRule("taxaParcelamentoPercentual", event.target.value)
                }
              />
            </div>
            <label className="flex items-end gap-3 rounded-lg border border-slate-800 bg-slate-900 p-3 text-sm font-medium text-slate-200">
              <input
                type="checkbox"
                checked={config.regrasPagamento.credito.repassarTaxaCliente}
                onChange={(event) =>
                  updateCreditRule("repassarTaxaCliente", event.target.checked)
                }
                className="h-4 w-4 rounded border-slate-600 bg-slate-900 accent-sky-500"
              />
              Repassar taxa ao cliente
            </label>
          </div>
        </div>
      </section>

      <section className={sectionClass}>
        <div className="mb-5">
          <h3 className="text-xl font-bold">Usuários e permissões</h3>
          <p className="mt-1 text-sm text-slate-400">
            Cadastro local temporário para preparar o controle de acesso.
          </p>
        </div>

        <form
          className="grid gap-4 lg:grid-cols-[1fr_1fr_180px_150px_auto]"
          onSubmit={handleSubmitUsuario}
        >
          <div>
            <label className={labelClass}>Nome</label>
            <input
              className={inputClass}
              value={usuarioForm.nome}
              onChange={(event) =>
                setUsuarioForm((currentForm) => ({
                  ...currentForm,
                  nome: event.target.value,
                }))
              }
            />
          </div>

          <div>
            <label className={labelClass}>E-mail</label>
            <input
              className={inputClass}
              value={usuarioForm.email}
              onChange={(event) =>
                setUsuarioForm((currentForm) => ({
                  ...currentForm,
                  email: event.target.value,
                }))
              }
            />
          </div>

          <div>
            <label className={labelClass}>Perfil</label>
            <select
              className={inputClass}
              value={usuarioForm.perfil}
              onChange={(event) =>
                setUsuarioForm((currentForm) => ({
                  ...currentForm,
                  perfil: event.target.value as UserRole,
                }))
              }
            >
              {USER_ROLES.map((userRole) => (
                <option key={userRole} value={userRole}>
                  {ROLE_LABELS[userRole]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Status</label>
            <select
              className={inputClass}
              value={usuarioForm.status}
              onChange={(event) =>
                setUsuarioForm((currentForm) => ({
                  ...currentForm,
                  status:
                    event.target.value === "inativo" ? "inativo" : "ativo",
                }))
              }
            >
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-400"
            >
              {editingUsuarioId ? "Atualizar" : "Adicionar"}
            </button>
          </div>
        </form>

        <div className="mt-6 grid gap-3">
          {usuarios.length ? (
            usuarios.map((usuario) => (
              <article
                key={usuario.id}
                className="rounded-xl border border-slate-800 bg-slate-950 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-slate-100">
                      {usuario.nome}
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                      {usuario.email || "Sem e-mail"} ·{" "}
                      {ROLE_LABELS[usuario.perfil]}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      {permissionLabels[usuario.perfil]}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ring-1 ${
                        usuario.status === "ativo"
                          ? "bg-emerald-500/15 text-emerald-200 ring-emerald-400/30"
                          : "bg-slate-700/70 text-slate-200 ring-slate-500/30"
                      }`}
                    >
                      {usuario.status}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleEditUsuario(usuario)}
                      className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteUsuario(usuario.id)}
                      className="rounded-lg border border-red-400/40 px-3 py-2 text-xs font-semibold text-red-200 hover:bg-red-500/10"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <p className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-400">
              Nenhum usuário cadastrado ainda.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
