import { useEffect, useState, type FormEvent } from "react";
import { ROLE_LABELS, USER_ROLES, type UserRole } from "../../accessControl";
import { useToast } from "../../components/Toast";
import { useAuth } from "../../contexts/useAuth";
import { formatCpfCnpj, formatPhone, onlyDigits } from "../../utils/formatters";
import {
  deleteUsuario,
  getConfiguracoesOficina,
  getConfiguracoesOficinaSupabase,
  getUsuarios,
  saveConfiguracoesOficinaSupabase,
  saveUsuario,
  updateUsuario,
  type OficinaConfiguracoes,
  type UsuarioSistema,
  type UsuarioStatus,
} from "../../services/configuracoesService";
import {
  getChecklistConfig,
  saveChecklistConfig,
} from "../../services/checklistConfigService";

type ConfiguracoesProps = {
  role: UserRole;
};

type ConfigTabId =
  | "oficina"
  | "checklist"
  | "servicos"
  | "pagamentos"
  | "usuarios"
  | "feedback";

type UsuarioFormState = {
  nome: string;
  email: string;
  perfil: UserRole;
  status: UsuarioStatus;
};

type ServicoCatalogo = {
  id: string;
  nome: string;
  valor_padrao: number;
  categoria:
    | "Mecânica"
    | "Elétrica"
    | "Funilaria"
    | "Suspensão"
    | "Freios"
    | "Revisão"
    | "Outros";
  ativo: boolean;
};

type FeedbackItem = {
  id: string;
  tipo: "Sugestão de melhoria" | "Reportar problema" | "Nova funcionalidade";
  descricao: string;
  avaliacao: number;
  oficina_nome: string;
  created_at: string;
};

const configTabs: { id: ConfigTabId; label: string }[] = [
  { id: "oficina", label: "Oficina" },
  { id: "checklist", label: "Checklist" },
  { id: "servicos", label: "Serviços" },
  { id: "pagamentos", label: "Pagamentos" },
  { id: "usuarios", label: "Usuários" },
  { id: "feedback", label: "Feedback" },
];

const serviceCategories: ServicoCatalogo["categoria"][] = [
  "Mecânica",
  "Elétrica",
  "Funilaria",
  "Suspensão",
  "Freios",
  "Revisão",
  "Outros",
];

const SERVICOS_STORAGE_KEY = "autohub:servicos-catalogo";
const FEEDBACK_STORAGE_KEY = "autohub:feedbacks";

function createLocalId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getServicosCatalogo(): ServicoCatalogo[] {
  const stored = localStorage.getItem(SERVICOS_STORAGE_KEY);

  if (!stored) {
    return [
      "Alinhamento",
      "Balanceamento",
      "Troca de óleo",
      "Revisão completa",
      "Troca de pastilha de freio",
    ].map((nome) => ({
      id: createLocalId("SRV"),
      nome,
      categoria: "Mecânica",
      valor_padrao: 0,
      ativo: true,
    }));
  }

  try {
    const parsed = JSON.parse(stored) as ServicoCatalogo[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveServicosCatalogo(servicos: ServicoCatalogo[]) {
  localStorage.setItem(SERVICOS_STORAGE_KEY, JSON.stringify(servicos));
  return servicos;
}

function getFeedbacks(): FeedbackItem[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(FEEDBACK_STORAGE_KEY) ?? "[]") as FeedbackItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

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
  atendimento: "Atendimento vê Clientes, OS, Orçamentos e Hermes.",
  compras: "Compras vê Compras, Fornecedores e Estoque.",
};

export default function Configuracoes({ role }: ConfiguracoesProps) {
  const { oficina_id } = useAuth();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<ConfigTabId>("oficina");
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
  const [configError, setConfigError] = useState("");
  const [salvandoConfig, setSalvandoConfig] = useState(false);
  const [checklistItems, setChecklistItems] = useState<string[]>(() =>
    getChecklistConfig(),
  );
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [checklistError, setChecklistError] = useState("");
  const [servicos, setServicos] = useState<ServicoCatalogo[]>(() =>
    getServicosCatalogo(),
  );
  const [servicoForm, setServicoForm] = useState({
    nome: "",
    categoria: "Mecânica" as ServicoCatalogo["categoria"],
    valor_padrao: "",
  });
  const [feedbackForm, setFeedbackForm] = useState({
    tipo: "Sugestão de melhoria" as FeedbackItem["tipo"],
    descricao: "",
    avaliacao: 5,
  });
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>(() => getFeedbacks());

  const inputClass =
    "w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none transition focus:border-sky-500";
  const labelClass = "mb-2 block text-sm font-medium text-slate-300";
  const sectionClass =
    "rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-sm shadow-slate-950/20 sm:p-6";

  useEffect(() => {
    let isMounted = true;

    async function loadConfig() {
      setConfigError("");

      if (!oficina_id) {
        setConfigError(
          "Não foi possível identificar a oficina do usuário logado.",
        );
        return;
      }

      const loadedConfig = await getConfiguracoesOficinaSupabase(oficina_id);

      if (!isMounted) {
        return;
      }

      setConfig({
        ...loadedConfig,
        cnpj: formatCpfCnpj(loadedConfig.cnpj),
        whatsapp: formatPhone(loadedConfig.whatsapp),
      });
    }

    loadConfig();

    return () => {
      isMounted = false;
    };
  }, [oficina_id]);

  function updateConfigField(
    field: keyof OficinaConfiguracoes,
    value: string | number,
  ) {
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

  async function handleSaveConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (salvandoConfig) {
      return;
    }

    setConfigError("");

    if (!oficina_id) {
      const errorMessage = "Não foi possível identificar a oficina do usuário logado.";
      setConfigError(errorMessage);
      toast.error(`Erro ao salvar configurações: ${errorMessage}`);
      return;
    }

    setSalvandoConfig(true);

    try {
      const configToSave = {
        ...config,
        nomeOficina: config.nomeOficina.trim(),
        cnpj: onlyDigits(config.cnpj),
        whatsapp: onlyDigits(config.whatsapp),
      };
      const savedConfig = await saveConfiguracoesOficinaSupabase(
        oficina_id,
        configToSave,
      );

      setConfig({
        ...savedConfig,
        cnpj: formatCpfCnpj(savedConfig.cnpj),
        whatsapp: formatPhone(savedConfig.whatsapp),
      });
      setFeedback("Configurações da oficina salvas.");
      toast.success("Configurações da oficina salvas.");
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Não foi possível salvar as configurações.";
      setConfigError(errorMessage);
      toast.error(`Erro ao salvar configurações: ${errorMessage}`);
    } finally {
      setSalvandoConfig(false);
    }
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

  function isChecklistAdmin() {
    return localStorage.getItem("autohub:perfil") === "admin";
  }

  function handleAddChecklistItem() {
    const item = newChecklistItem.trim();

    if (!item) {
      setChecklistError("Informe um item para adicionar ao checklist.");
      return;
    }

    if (
      checklistItems.some(
        (currentItem) => currentItem.toLowerCase() === item.toLowerCase(),
      )
    ) {
      setChecklistError("Este item já existe no checklist.");
      return;
    }

    setChecklistItems((currentItems) => [...currentItems, item]);
    setNewChecklistItem("");
    setChecklistError("");
  }

  function handleRemoveChecklistItem(itemToRemove: string) {
    setChecklistItems((currentItems) =>
      currentItems.filter((item) => item !== itemToRemove),
    );
    setChecklistError("");
  }

  function handleSaveChecklist() {
    const normalizedItems = checklistItems
      .map((item) => item.trim())
      .filter(Boolean);

    if (normalizedItems.length < 3) {
      setChecklistError("Mantenha ao menos 3 itens no checklist padrão.");
      return;
    }

    setChecklistItems(saveChecklistConfig(normalizedItems));
    setChecklistError("");
    setFeedback("Checklist padrão da OS salvo.");
  }

  function handleAddServico(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!servicoForm.nome.trim()) {
      setFeedback("Informe o nome do serviço.");
      return;
    }

    setServicos((currentServicos) => [
      ...currentServicos,
      {
        id: createLocalId("SRV"),
        nome: servicoForm.nome.trim(),
        categoria: servicoForm.categoria,
        valor_padrao: Number(servicoForm.valor_padrao || 0),
        ativo: true,
      },
    ]);
    setServicoForm({ nome: "", categoria: "Mecânica", valor_padrao: "" });
  }

  function handleSaveServicos() {
    setServicos(saveServicosCatalogo(servicos));
    setFeedback("Catálogo de serviços salvo.");
  }

  function handleSubmitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (feedbackForm.descricao.trim().length < 20) {
      setFeedback("Descreva seu feedback com pelo menos 20 caracteres.");
      return;
    }

    const nextFeedbacks = [
      {
        id: createLocalId("FDB"),
        tipo: feedbackForm.tipo,
        descricao: feedbackForm.descricao.trim(),
        avaliacao: feedbackForm.avaliacao,
        oficina_nome: config.nomeOficina,
        created_at: new Date().toISOString(),
      },
      ...feedbacks,
    ];

    localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(nextFeedbacks));
    setFeedbacks(nextFeedbacks);
    setFeedbackForm({
      tipo: "Sugestão de melhoria",
      descricao: "",
      avaliacao: 5,
    });
    setFeedback("Obrigado! Seu feedback foi registrado.");
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
      <toast.ToastContainer />
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

      {configError && (
        <div className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-200">
          {configError}
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto border-b border-slate-800">
        {configTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition ${
              activeTab === tab.id
                ? "border-sky-400 bg-slate-900 text-sky-100"
                : "border-transparent text-slate-400 hover:bg-slate-900/70 hover:text-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "checklist" && isChecklistAdmin() && (
        <section className={sectionClass}>
          <div className="mb-5">
            <h3 className="text-xl font-bold">Checklist padrão da OS</h3>
            <p className="mt-1 text-sm text-slate-400">
              Este checklist será aplicado em todas as novas OS criadas
            </p>
          </div>

          {checklistError && (
            <div className="mb-4 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-200">
              {checklistError}
            </div>
          )}

          <div className="grid gap-3">
            {checklistItems.map((item) => (
              <div
                key={item}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 px-4 py-3"
              >
                <span className="text-sm font-medium text-slate-100">{item}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveChecklistItem(item)}
                  className="rounded-lg border border-red-400/40 px-3 py-2 text-xs font-semibold text-red-200 hover:bg-red-500/10"
                >
                  Remover
                </button>
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
            <input
              className={inputClass}
              value={newChecklistItem}
              onChange={(event) => setNewChecklistItem(event.target.value)}
              placeholder="Novo item do checklist"
            />
            <button
              type="button"
              onClick={handleAddChecklistItem}
              className="rounded-xl bg-sky-500 px-5 py-3 text-sm font-semibold text-white hover:bg-sky-400"
            >
              Adicionar item
            </button>
          </div>

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={handleSaveChecklist}
              className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-400"
            >
              Salvar checklist
            </button>
          </div>
        </section>
      )}

      {activeTab === "oficina" && (
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

          <div>
            <label className={labelClass}>Markup padrão de peças (%)</label>
            <input
              className={inputClass}
              type="number"
              min="0"
              max="200"
              placeholder="0"
              value={config.markupPecas}
              onChange={(event) =>
                updateConfigField("markupPecas", Number(event.target.value || 0))
              }
            />
            <p className="mt-2 text-xs text-slate-500">
              Percentual adicionado automaticamente sobre o custo das peças ao
              confirmar uma compra. Ex: 30 = 30% sobre o custo.
            </p>
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
            disabled={salvandoConfig}
            className="rounded-xl bg-sky-500 px-5 py-3 text-sm font-semibold text-white hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {salvandoConfig ? "Salvando..." : "Salvar configurações"}
          </button>
        </div>
      </form>
      )}

      {activeTab === "servicos" && (
      <section className={sectionClass}>
        <div className="mb-5">
          <h3 className="text-xl font-bold">Catálogo de serviços</h3>
          <p className="mt-1 text-sm text-slate-400">
            Cadastre os serviços que sua oficina oferece. Eles aparecerão como
            opções ao adicionar serviços em uma OS.
          </p>
        </div>

        <form className="mb-6 grid gap-4 md:grid-cols-[1fr_180px_160px_auto]" onSubmit={handleAddServico}>
          <div>
            <label className={labelClass}>Nome do serviço</label>
            <input
              className={inputClass}
              value={servicoForm.nome}
              onChange={(event) =>
                setServicoForm((currentForm) => ({
                  ...currentForm,
                  nome: event.target.value,
                }))
              }
            />
          </div>
          <div>
            <label className={labelClass}>Categoria</label>
            <select
              className={inputClass}
              value={servicoForm.categoria}
              onChange={(event) =>
                setServicoForm((currentForm) => ({
                  ...currentForm,
                  categoria: event.target.value as ServicoCatalogo["categoria"],
                }))
              }
            >
              {serviceCategories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Valor padrão</label>
            <input
              className={inputClass}
              type="number"
              min="0"
              step="0.01"
              value={servicoForm.valor_padrao}
              onChange={(event) =>
                setServicoForm((currentForm) => ({
                  ...currentForm,
                  valor_padrao: event.target.value,
                }))
              }
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="rounded-lg bg-sky-500 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-400"
            >
              Adicionar serviço
            </button>
          </div>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-slate-400">
              <tr>
                <th className="py-3 pr-4 text-left">Nome</th>
                <th className="py-3 pr-4 text-left">Categoria</th>
                <th className="py-3 pr-4 text-left">Valor padrão</th>
                <th className="py-3 pr-4 text-left">Ativo</th>
                <th className="py-3 text-left">Remover</th>
              </tr>
            </thead>
            <tbody>
              {servicos.map((servico) => (
                <tr key={servico.id} className="border-t border-slate-800">
                  <td className="py-3 pr-4 text-slate-100">{servico.nome}</td>
                  <td className="py-3 pr-4 text-slate-300">{servico.categoria}</td>
                  <td className="py-3 pr-4 text-slate-300">
                    R$ {servico.valor_padrao.toFixed(2)}
                  </td>
                  <td className="py-3 pr-4">
                    <button
                      type="button"
                      onClick={() =>
                        setServicos((currentServicos) =>
                          currentServicos.map((currentServico) =>
                            currentServico.id === servico.id
                              ? { ...currentServico, ativo: !currentServico.ativo }
                              : currentServico,
                          ),
                        )
                      }
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        servico.ativo
                          ? "bg-emerald-500/15 text-emerald-200"
                          : "bg-slate-700 text-slate-200"
                      }`}
                    >
                      {servico.ativo ? "Ativo" : "Inativo"}
                    </button>
                  </td>
                  <td className="py-3">
                    <button
                      type="button"
                      onClick={() =>
                        setServicos((currentServicos) =>
                          currentServicos.filter(
                            (currentServico) => currentServico.id !== servico.id,
                          ),
                        )
                      }
                      className="rounded-lg border border-red-400/40 px-3 py-2 text-xs font-semibold text-red-200 hover:bg-red-500/10"
                    >
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={handleSaveServicos}
            className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-400"
          >
            Salvar catálogo
          </button>
        </div>
      </section>
      )}

      {activeTab === "pagamentos" && (
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
      )}

      {activeTab === "usuarios" && (
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
      )}

      {activeTab === "feedback" && (
      <section className={sectionClass}>
        <div className="mb-5">
          <h3 className="text-xl font-bold">Enviar sugestão</h3>
          <p className="mt-1 text-sm text-slate-400">
            Sua opinião ajuda a melhorar o AutoHub. Conte o que está faltando
            ou o que poderia ser melhor.
          </p>
        </div>
        <form className="grid gap-4" onSubmit={handleSubmitFeedback}>
          <div className="grid gap-4 md:grid-cols-[220px_1fr]">
            <div>
              <label className={labelClass}>Tipo de feedback</label>
              <select
                className={inputClass}
                value={feedbackForm.tipo}
                onChange={(event) =>
                  setFeedbackForm((currentForm) => ({
                    ...currentForm,
                    tipo: event.target.value as FeedbackItem["tipo"],
                  }))
                }
              >
                <option>Sugestão de melhoria</option>
                <option>Reportar problema</option>
                <option>Nova funcionalidade</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Avaliação geral</label>
              <div className="flex gap-1 pt-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() =>
                      setFeedbackForm((currentForm) => ({
                        ...currentForm,
                        avaliacao: star,
                      }))
                    }
                    className={`text-2xl ${
                      star <= feedbackForm.avaliacao
                        ? "text-amber-300"
                        : "text-slate-600"
                    }`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className={labelClass}>Descrição</label>
            <textarea
              className={inputClass}
              rows={5}
              value={feedbackForm.descricao}
              onChange={(event) =>
                setFeedbackForm((currentForm) => ({
                  ...currentForm,
                  descricao: event.target.value,
                }))
              }
            />
          </div>
          <div>
            <button
              type="submit"
              className="rounded-xl bg-sky-500 px-5 py-3 text-sm font-semibold text-white hover:bg-sky-400"
            >
              Enviar feedback
            </button>
          </div>
        </form>

        <div className="mt-6 grid gap-3">
          {feedbacks.map((item) => (
            <article
              key={item.id}
              className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm"
            >
              <div className="flex flex-wrap justify-between gap-3">
                <span className="text-slate-400">
                  {new Date(item.created_at).toLocaleString("pt-BR")} ·{" "}
                  {item.tipo}
                </span>
                <span className="text-amber-300">{"★".repeat(item.avaliacao)}</span>
              </div>
              <p className="mt-2 text-slate-200">
                {item.descricao.length > 120
                  ? `${item.descricao.slice(0, 120)}...`
                  : item.descricao}
              </p>
            </article>
          ))}
        </div>
      </section>
      )}
    </div>
  );
}
