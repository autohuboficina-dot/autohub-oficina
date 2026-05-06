import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import BackButton from "../../components/ui/BackButton";
import { useAuth } from "../../contexts/useAuth";
import { formatCpfCnpj, formatPhone, onlyDigits } from "../../utils/formatters";
import { getClientes, type Cliente } from "../../services/clientesService";
import { vehicleBrands, vehicleModelsByBrand } from "../vehicleCatalog";
import {
  calculatePaymentSimulation,
  getConfiguracoesOficina,
} from "../../services/configuracoesService";
import {
  SERVICE_ORDER_STATUSES,
  appendServiceOrderTimelineEvent,
  getBudgetApprovalBadgeClass,
  getBudgetApprovalLabel,
  getServiceOrderStatusLabel,
  getServiceOrderStatusForBudgetDecision,
  getServiceOrderStatusBadgeClass,
  getServiceOrderSupabase,
  getStoredOrders,
  isServiceOrderBudgetLocked,
  saveServiceOrderBudgetSupabase,
  saveStoredOrders,
  updateServiceOrderSupabase,
  updateServiceOrderStatusWithTimeline,
  type BudgetApprovalStatus,
  type ChecklistStatus,
  type ServiceOrder,
  type ServiceOrderPhoto,
  type ServiceOrderStatus,
} from "../../services/osService";
import {
  getCotacoes,
  getCotacoesSupabase,
  saveCotacao,
  saveCotacaoSupabase,
  selectCotacaoFornecedorSupabase,
  updateCotacao,
  type CotacaoFornecedorResponse,
  type CotacaoPeca,
  type CotacaoPecaEscolha,
  type CotacaoPecaItem,
  type CotacaoPecaRespostaItem,
  type CotacaoStatus,
} from "../../services/cotacoesService";
import {
  getFornecedores,
  type Fornecedor,
} from "../../services/fornecedoresService";
import { registrarSaidaEstoque } from "../../services/estoqueService";
import ServiceOrderPhotosSection from "./ServiceOrderPhotosSection";

const checklistItems = [
  "Freio",
  "Pneus",
  "Óleo",
  "Suspensão",
  "Bateria",
  "Iluminação",
];

type PartLine = {
  id: number;
  name: string;
  quantity: string;
  unitValue: string;
  compraId?: string;
  generatedFromChecklist?: string;
};

function getBudgetEditSnapshot(
  parts: PartLine[],
  labor: LaborLine[],
  discountValue: string,
  discountType: "money" | "percent",
) {
  return JSON.stringify({
    parts: parts.map((part) => ({
      id: part.id,
      name: part.name.trim(),
      quantity: toNumber(part.quantity),
      unitValue: toNumber(part.unitValue),
      compraId: part.compraId || "",
    })),
    labor: labor.map((line) => ({
      id: line.id,
      service: line.service.trim(),
      description: line.description.trim(),
      value: toNumber(line.value),
    })),
    discountValue: toNumber(discountValue),
    discountType,
  });
}

type LaborLine = {
  id: number;
  service: string;
  description: string;
  value: string;
};

type ChecklistFormState = Record<
  string,
  {
    status: ChecklistStatus;
    observacaoTecnica: string;
  }
>;

type QuoteFormState = {
  fornecedorId: string;
  peca: string;
  quantidade: string;
  urgencia: "Normal" | "Urgente";
  observacao: string;
  fotos: ServiceOrderPhoto[];
};

const initialQuoteFormState: QuoteFormState = {
  fornecedorId: "",
  peca: "",
  quantidade: "1",
  urgencia: "Normal",
  observacao: "",
  fotos: [],
};

const EXECUTION_STATUS_TRANSITIONS: Partial<
  Record<ServiceOrderStatus, ServiceOrderStatus>
> = {
  APROVADA: "EM_EXECUCAO",
  EM_EXECUCAO: "FINALIZADA",
  FINALIZADA: "ENTREGUE",
};

function toNumber(value: string) {
  return Number(value || 0);
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(value: string) {
  if (!value) {
    return "Ainda sem decisão";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Data indisponível";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function createBudgetLink(publicToken: string) {
  if (typeof window === "undefined") {
    return `/orcamento/${publicToken}`;
  }

  return `${window.location.origin}/orcamento/${publicToken}`;
}

function getWhatsAppPhone(value: string) {
  const digits = onlyDigits(value);

  if (!digits) {
    return "";
  }

  if (digits.startsWith("55")) {
    return digits;
  }

  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  return digits;
}

function createBudgetWhatsappUrl(
  phone: string,
  budgetLink: string,
  oficinaNome: string,
) {
  const whatsappPhone = getWhatsAppPhone(phone);
  const message = `Olá, aqui é da ${oficinaNome}. Seu orçamento está pronto. Clique no link para visualizar e aprovar: ${budgetLink}`;

  if (!whatsappPhone) {
    return "";
  }

  return `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`;
}

function createQuoteWhatsappUrl(fornecedor: Fornecedor, message: string) {
  const whatsappPhone = getWhatsAppPhone(fornecedor.whatsapp);

  if (!whatsappPhone) {
    return "";
  }

  return `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`;
}

function getQuoteItemsFromOrder(order?: ServiceOrder): CotacaoPecaItem[] {
  return (order?.pecasNecessarias || [])
    .filter((part) => part.peca.trim())
    .map((part) => ({
      id: `peca-${part.id}`,
      peca: part.peca.trim(),
      quantidade: Math.max(Number(part.quantidade || 1), 1),
      observacao: part.origemChecklist || "",
    }));
}

function getResponseForPart(
  response: CotacaoFornecedorResponse,
  pecaId: string,
) {
  return response.itemResponses.find((item) => item.pecaId === pecaId);
}

function getChoiceForPart(cotacao: CotacaoPeca, pecaId: string) {
  return cotacao.pecasEscolhidas.find((choice) => choice.pecaId === pecaId);
}

function getCotacaoStatusAfterChoice(
  cotacao: CotacaoPeca,
  choices: CotacaoPecaEscolha[],
): CotacaoStatus {
  const selectedCount = cotacao.pecas.filter((part) =>
    choices.some((choice) => choice.pecaId === part.id),
  ).length;

  if (selectedCount >= cotacao.pecas.length && cotacao.pecas.length > 0) {
    return "Fornecedor escolhido";
  }

  if (selectedCount > 0) {
    return "Cotação parcial";
  }

  return cotacao.status === "Cotação enviada"
    ? "Resposta recebida"
    : cotacao.status;
}

function createChecklistState(order?: ServiceOrder) {
  return checklistItems.reduce<ChecklistFormState>((state, item) => {
    const storedItem = order?.checklistInicial.find(
      (checklistItem) => checklistItem.item === item,
    );
    state[item] = {
      status: storedItem?.status ?? "",
      observacaoTecnica: storedItem?.observacaoTecnica ?? "",
    };
    return state;
  }, {});
}

function createPartLines(order?: ServiceOrder): PartLine[] {
  if (!order?.pecasNecessarias.length) {
    return [{ id: 1, name: "", quantity: "1", unitValue: "" }];
  }

  return order.pecasNecessarias.map((part) => ({
    id: part.id,
    name: part.peca,
    quantity: String(part.quantidade),
    unitValue: String(part.valorUnitario),
    compraId: part.compraId,
    generatedFromChecklist: part.origemChecklist,
  }));
}

function registerStockExitForOrder(order: ServiceOrder) {
  if (order.status !== "FINALIZADA") {
    return;
  }

  order.pecasNecessarias.forEach((part) => {
    registrarSaidaEstoque({
      nome: part.peca,
      quantidade: part.quantidade,
      osId: order.id,
      compraId: part.compraId,
      descricao: `Peça usada na OS ${order.id}.`,
    });
  });
}

function createLaborLines(order?: ServiceOrder): LaborLine[] {
  if (!order?.servicosMaoDeObra.length) {
    return [{ id: 1, service: "", description: "", value: "" }];
  }

  return order.servicosMaoDeObra.map((labor) => ({
    id: labor.id,
    service: labor.servico,
    description: labor.descricao,
    value: String(labor.valor),
  }));
}

export default function OSDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { oficina_id } = useAuth();
  const [clientes] = useState<Cliente[]>(() => getClientes());
  const [fornecedores] = useState<Fornecedor[]>(() => getFornecedores());
  const [oficinaConfig] = useState(() => getConfiguracoesOficina());
  const [order, setOrder] = useState<ServiceOrder | undefined>(() =>
    getStoredOrders().find(
      (storedOrder) => storedOrder.id === id || storedOrder.codigo === id,
    ),
  );
  const [isLoadingOrder, setIsLoadingOrder] = useState(Boolean(id));
  const [hasLoadedOrder, setHasLoadedOrder] = useState(false);

  const [clientName, setClientName] = useState(
    order?.clienteDados.nome || order?.cliente || "",
  );
  const [clientPhone, setClientPhone] = useState(
    formatPhone(order?.clienteDados.telefone || order?.telefone || ""),
  );
  const [clientCpf, setClientCpf] = useState(
    formatCpfCnpj(order?.clienteDados.cpf || ""),
  );
  const [clientCnpj, setClientCnpj] = useState(
    formatCpfCnpj(order?.clienteDados.cnpj || ""),
  );
  const [clientEmail, setClientEmail] = useState(order?.clienteDados.email || "");
  const [selectedClienteId, setSelectedClienteId] = useState(order?.clienteId || "");
  const [selectedVehicleId, setSelectedVehicleId] = useState(order?.veiculoId || "");
  const [vehicleBrand, setVehicleBrand] = useState(order?.veiculoDados.marca || "");
  const [vehicleModel, setVehicleModel] = useState(order?.veiculoDados.modelo || "");
  const [vehicleYear, setVehicleYear] = useState(order?.veiculoDados.ano || "");
  const [vehiclePlate, setVehiclePlate] = useState(
    order?.veiculoDados.placa || order?.placa || "",
  );
  const [vehicleMotor, setVehicleMotor] = useState(order?.veiculoDados.motor || "");
  const [vehicleFuel, setVehicleFuel] = useState(
    order?.veiculoDados.combustivel || "",
  );
  const [vehicleVin, setVehicleVin] = useState(
    order?.veiculoDados.chassiVin || "",
  );
  const [vehicleKm, setVehicleKm] = useState(order?.veiculoDados.kmAtual || "");
  const [status, setStatus] = useState<ServiceOrderStatus>(
    order?.status || "ABERTA",
  );
  const [approvalStatus, setApprovalStatus] = useState<BudgetApprovalStatus>(
    order?.statusAprovacao || "pendente",
  );
  const [approvalDecisionDate] = useState(
    order?.dataDecisaoAprovacao || "",
  );
  const [approvalConfirmationDate, setApprovalConfirmationDate] = useState(
    order?.dataConfirmacaoOficina || "",
  );
  const [officeConfirmedApproval, setOfficeConfirmedApproval] = useState(
    Boolean(order?.confirmacaoOficina),
  );
  const [clientDecision, setClientDecision] = useState(
    order?.decisaoCliente || order?.statusAprovacao || "",
  );
  const [problemReport, setProblemReport] = useState(
    order?.problemaRelatado || order?.servicoInicial || "",
  );
  const [defectFound, setDefectFound] = useState(
    order?.diagnostico.defeitoEncontrado || "",
  );
  const [probableCause, setProbableCause] = useState(
    order?.diagnostico.causaProvavel || "",
  );
  const [recommendedSolution, setRecommendedSolution] = useState(
    order?.diagnostico.solucaoRecomendada || "",
  );
  const [checklistState, setChecklistState] = useState<ChecklistFormState>(() =>
    createChecklistState(order),
  );
  const [partLines, setPartLines] = useState<PartLine[]>(() =>
    createPartLines(order),
  );
  const [laborLines, setLaborLines] = useState<LaborLine[]>(() =>
    createLaborLines(order),
  );
  const [photos, setPhotos] = useState<ServiceOrderPhoto[]>(
    () => order?.fotosOs || [],
  );
  const [timeline, setTimeline] = useState(() => order?.timeline || []);
  const [loadedUpdatedAt, setLoadedUpdatedAt] = useState(order?.updatedAt || "");
  const [loadedVersion, setLoadedVersion] = useState(order?.version || 0);
  const [discountValue, setDiscountValue] = useState(
    order ? String(order.orcamento.descontoValor) : "",
  );
  const [discountType, setDiscountType] = useState<"money" | "percent">(
    order?.orcamento.descontoTipo ?? "money",
  );
  const [paymentMethod, setPaymentMethod] = useState(
    order?.orcamento.formaPagamento || "",
  );
  const [requiresDeposit, setRequiresDeposit] = useState(
    Boolean(order?.exigeEntrada),
  );
  const [depositType, setDepositType] = useState<"valor" | "percentual">(
    order?.tipoEntrada || "valor",
  );
  const [depositValue, setDepositValue] = useState(
    order ? String(order.valorEntrada || "") : "",
  );
  const [depositPercent, setDepositPercent] = useState(
    order ? String(order.percentualEntrada || "") : "",
  );
  const [depositStatus, setDepositStatus] = useState<
    "nao_exige" | "pendente" | "paga"
  >(order?.statusEntrada || "nao_exige");
  const [depositPaymentDate, setDepositPaymentDate] = useState(
    order?.dataPagamentoEntrada || "",
  );
  const [depositPaidValue, setDepositPaidValue] = useState(
    order?.valorEntradaPago || 0,
  );
  const [saveMessage, setSaveMessage] = useState("");
  const [showBudgetActions, setShowBudgetActions] = useState(false);
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [quoteForm, setQuoteForm] =
    useState<QuoteFormState>(initialQuoteFormState);
  const [osCotacoes, setOsCotacoes] = useState<CotacaoPeca[]>(() =>
    getCotacoes().filter(
      (cotacao) => cotacao.osId === id || cotacao.osId === order?.id,
    ),
  );

  useEffect(() => {
    let isMounted = true;

    async function loadOrder() {
      if (!id) {
        if (isMounted) {
          setOrder(undefined);
          setIsLoadingOrder(false);
          setHasLoadedOrder(true);
        }
        return;
      }

      if (isMounted) {
        setIsLoadingOrder(true);
      }

      try {
        const loadedOrder = oficina_id
          ? await getServiceOrderSupabase(oficina_id, id)
          : getStoredOrders().find(
              (storedOrder) => storedOrder.id === id || storedOrder.codigo === id,
            );

        if (isMounted) {
          setOrder((currentOrder) => loadedOrder ?? currentOrder);
          setHasLoadedOrder(true);
        }
      } finally {
        if (isMounted) {
          setIsLoadingOrder(false);
        }
      }
    }

    void loadOrder();

    return () => {
      isMounted = false;
    };
  }, [id, oficina_id]);

  useEffect(() => {
    let isMounted = true;

    async function loadOrderCotacoes() {
      if (!order?.id) {
        return;
      }

      const loadedCotacoes = oficina_id
        ? await getCotacoesSupabase(oficina_id)
        : getCotacoes();
      const orderCotacoes = loadedCotacoes.filter(
        (cotacao) => cotacao.osId === order.id || cotacao.osId === order.codigo,
      );

      if (isMounted) {
        setOsCotacoes(orderCotacoes);
      }
    }

    void loadOrderCotacoes();

    return () => {
      isMounted = false;
    };
  }, [order?.id, order?.codigo, oficina_id]);

  useEffect(() => {
    if (!order) {
      return;
    }

    let isCancelled = false;

    queueMicrotask(() => {
      if (isCancelled) {
        return;
      }

      setClientName(order.clienteDados.nome || order.cliente || "");
      setClientPhone(formatPhone(order.clienteDados.telefone || order.telefone || ""));
      setClientCpf(formatCpfCnpj(order.clienteDados.cpf || ""));
      setClientCnpj(formatCpfCnpj(order.clienteDados.cnpj || ""));
      setClientEmail(order.clienteDados.email || "");
      setSelectedClienteId(order.clienteId || "");
      setSelectedVehicleId(order.veiculoId || "");
      setVehicleBrand(order.veiculoDados.marca || "");
      setVehicleModel(order.veiculoDados.modelo || "");
      setVehicleYear(order.veiculoDados.ano || "");
      setVehiclePlate(order.veiculoDados.placa || order.placa || "");
      setVehicleMotor(order.veiculoDados.motor || "");
      setVehicleFuel(order.veiculoDados.combustivel || "");
      setVehicleVin(order.veiculoDados.chassiVin || "");
      setVehicleKm(order.veiculoDados.kmAtual || "");
      setStatus(order.status || "ABERTA");
      setApprovalStatus(order.statusAprovacao || "pendente");
      setApprovalConfirmationDate(order.dataConfirmacaoOficina || "");
      setOfficeConfirmedApproval(Boolean(order.confirmacaoOficina));
      setClientDecision(order.decisaoCliente || order.statusAprovacao || "");
      setProblemReport(order.problemaRelatado || order.servicoInicial || "");
      setDefectFound(order.diagnostico.defeitoEncontrado || "");
      setProbableCause(order.diagnostico.causaProvavel || "");
      setRecommendedSolution(order.diagnostico.solucaoRecomendada || "");
      setChecklistState(createChecklistState(order));
      setPartLines(createPartLines(order));
      setLaborLines(createLaborLines(order));
      setPhotos(order.fotosOs || []);
      setTimeline(order.timeline || []);
      setLoadedUpdatedAt(order.updatedAt || "");
      setLoadedVersion(order.version || 0);
      setDiscountValue(String(order.orcamento.descontoValor || ""));
      setDiscountType(order.orcamento.descontoTipo ?? "money");
      setPaymentMethod(order.orcamento.formaPagamento || "");
      setRequiresDeposit(Boolean(order.exigeEntrada));
      setDepositType(order.tipoEntrada || "valor");
      setDepositValue(String(order.valorEntrada || ""));
      setDepositPercent(String(order.percentualEntrada || ""));
      setDepositStatus(order.statusEntrada || "nao_exige");
      setDepositPaymentDate(order.dataPagamentoEntrada || "");
      setDepositPaidValue(order.valorEntradaPago || 0);
    });

    return () => {
      isCancelled = true;
    };
  }, [order]);

  const selectedCliente = useMemo(
    () => clientes.find((cliente) => cliente.id === selectedClienteId),
    [clientes, selectedClienteId],
  );
  const selectedFornecedor = useMemo(
    () =>
      fornecedores.find((fornecedor) => fornecedor.id === quoteForm.fornecedorId),
    [fornecedores, quoteForm.fornecedorId],
  );
  const quoteItemsFromOrder = useMemo(() => getQuoteItemsFromOrder(order), [order]);
  const modelSuggestions = vehicleModelsByBrand[vehicleBrand] ?? [];
  const budgetLink = order
    ? createBudgetLink(order.orcamento.publicToken || order.id)
    : "";
  const budgetWhatsappUrl = order
    ? createBudgetWhatsappUrl(
        clientPhone || order.clienteTelefone || order.telefone,
        budgetLink,
        oficinaConfig.nomeOficina,
      )
    : "";
  const approvalItemLabels = useMemo(() => {
    if (!order) {
      return [];
    }

    const items = [
      ...order.pecasNecessarias.map((part) => ({
        id: `peca-${part.id}`,
        label: part.peca || "Peça sem descrição",
      })),
      ...order.servicosMaoDeObra.map((service) => ({
        id: `servico-${service.id}`,
        label: service.servico || "Serviço sem descrição",
      })),
    ];

    return items
      .filter((item) => order.itensAprovados.includes(item.id))
      .map((item) => item.label);
  }, [order]);
  const isPreApproved =
    approvalStatus === "pre_aprovado" ||
    approvalStatus === "pre_aprovado_parcial";
  const isFullPreApproval =
    approvalStatus === "pre_aprovado" ||
    (approvalStatus === "confirmado_oficina" &&
      clientDecision === "pre_aprovado");

  const inputClass =
    "w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none transition focus:border-sky-500";
  const compactInputClass =
    "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none transition focus:border-sky-500";
  const labelClass = "mb-2 block text-sm font-medium text-slate-300";
  const sectionClass =
    "rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-sm shadow-slate-950/20 sm:p-6";
  const subTitleClass =
    "mb-4 border-b border-slate-800 pb-2 text-base font-semibold text-sky-300";

  const totals = useMemo(() => {
    const partsTotal = partLines.reduce((total, line) => {
      return total + toNumber(line.quantity) * toNumber(line.unitValue);
    }, 0);
    const laborTotal = laborLines.reduce((total, line) => {
      return total + toNumber(line.value);
    }, 0);
    const subtotal = partsTotal + laborTotal;
    const discountNumber = toNumber(discountValue);
    const discountAmount =
      discountType === "percent"
        ? (subtotal * Math.min(discountNumber, 100)) / 100
        : discountNumber;
    const finalTotal = Math.max(subtotal - discountAmount, 0);

    return { partsTotal, laborTotal, discountAmount, finalTotal };
  }, [discountType, discountValue, laborLines, partLines]);
  const depositSummary = useMemo(() => {
    if (!requiresDeposit) {
      return {
        entradaCalculada: 0,
        saldoRestante: totals.finalTotal,
      };
    }

    const entradaCalculada =
      depositType === "percentual"
        ? (totals.finalTotal * Math.min(toNumber(depositPercent), 100)) / 100
        : toNumber(depositValue);
    const safeEntrada = Math.min(Math.max(entradaCalculada, 0), totals.finalTotal);

    return {
      entradaCalculada: safeEntrada,
      saldoRestante: Math.max(totals.finalTotal - safeEntrada, 0),
    };
  }, [depositPercent, depositType, depositValue, requiresDeposit, totals.finalTotal]);
  const paymentOptions = useMemo(() => {
    const regras = oficinaConfig.regrasPagamento;
    const baseArgs = [
      totals.finalTotal,
      depositSummary.entradaCalculada,
      requiresDeposit,
      regras,
    ] as const;

    return {
      pix: calculatePaymentSimulation(...baseArgs, "Pix"),
      dinheiro: calculatePaymentSimulation(...baseArgs, "Dinheiro"),
      debito: calculatePaymentSimulation(...baseArgs, "Débito"),
      credito: Array.from({ length: regras.credito.maxParcelas }, (_, index) =>
        calculatePaymentSimulation(...baseArgs, "Crédito", index + 1),
      ),
    };
  }, [depositSummary.entradaCalculada, oficinaConfig.regrasPagamento, requiresDeposit, totals.finalTotal]);
  const supplierVisiblePhotos = useMemo(
    () =>
      photos.filter(
        (photo) =>
          photo.visibilidade === "Fornecedor" || photo.visibilidade === "Ambos",
      ),
    [photos],
  );
  const initialBudgetSnapshot = useMemo(
    () =>
      order
        ? getBudgetEditSnapshot(
            createPartLines(order),
            createLaborLines(order),
            String(order.orcamento.descontoValor || ""),
            order.orcamento.descontoTipo,
          )
        : "",
    [order],
  );

  function hasConcurrentOrderChange() {
    if (!order) {
      return false;
    }

    const currentOrder = getStoredOrders().find(
      (storedOrder) => storedOrder.id === order.id,
    );

    return Boolean(
      currentOrder?.updatedAt &&
        loadedUpdatedAt &&
        (currentOrder.updatedAt !== loadedUpdatedAt ||
          currentOrder.version !== loadedVersion),
    );
  }

  function syncLoadedVersion(updatedOrder?: ServiceOrder) {
    if (!updatedOrder) {
      return;
    }

    setLoadedUpdatedAt(updatedOrder.updatedAt || new Date().toISOString());
    setLoadedVersion(updatedOrder.version || 0);
    setTimeline(updatedOrder.timeline);
  }

  function hasLockedBudgetChanges() {
    if (!order || !isServiceOrderBudgetLocked(order.status)) {
      return false;
    }

    const currentSnapshot = getBudgetEditSnapshot(
      partLines,
      laborLines,
      discountValue,
      discountType,
    );

    return currentSnapshot !== initialBudgetSnapshot;
  }

  function addPartLine() {
    setPartLines((lines) => [
      ...lines,
      {
        id: Math.max(0, ...lines.map((line) => line.id)) + 1,
        name: "",
        quantity: "1",
        unitValue: "",
      },
    ]);
  }

  function addLaborLine() {
    setLaborLines((lines) => [
      ...lines,
      {
        id: Math.max(0, ...lines.map((line) => line.id)) + 1,
        service: "",
        description: "",
        value: "",
      },
    ]);
  }

  function updatePartLine(
    lineId: number,
    field: keyof Omit<PartLine, "id">,
    value: string,
  ) {
    setPartLines((lines) =>
      lines.map((line) =>
        line.id === lineId ? { ...line, [field]: value } : line,
      ),
    );
  }

  function updateLaborLine(
    lineId: number,
    field: keyof Omit<LaborLine, "id">,
    value: string,
  ) {
    setLaborLines((lines) =>
      lines.map((line) =>
        line.id === lineId ? { ...line, [field]: value } : line,
      ),
    );
  }

  function updateChecklistStatus(item: string, itemStatus: ChecklistStatus) {
    const observacaoTecnica = checklistState[item]?.observacaoTecnica ?? "";
    setChecklistState((currentState) => ({
      ...currentState,
      [item]: {
        ...currentState[item],
        status: itemStatus,
      },
    }));
    syncChecklistSuggestion(item, itemStatus, observacaoTecnica);
  }

  function updateChecklistObservation(item: string, observacaoTecnica: string) {
    const itemStatus = checklistState[item]?.status ?? "";
    setChecklistState((currentState) => ({
      ...currentState,
      [item]: {
        ...currentState[item],
        observacaoTecnica,
      },
    }));
    syncChecklistSuggestion(item, itemStatus, observacaoTecnica);
  }

  function syncChecklistSuggestion(
    item: string,
    itemStatus: ChecklistStatus,
    observacaoTecnica: string,
  ) {
    if (itemStatus !== "Trocar" || !observacaoTecnica.trim()) {
      return;
    }

    setPartLines((lines) => {
      if (
        lines.some(
          (line) =>
            line.generatedFromChecklist === item ||
            line.name.toLowerCase().includes(item.toLowerCase()),
        )
      ) {
        return lines;
      }

      return [
        ...lines,
        {
          id: Math.max(0, ...lines.map((line) => line.id)) + 1,
          name: `${item}: ${observacaoTecnica.trim()}`,
          quantity: "1",
          unitValue: "0",
          generatedFromChecklist: item,
        },
      ];
    });
  }

  function removePartLine(lineId: number) {
    setPartLines((lines) => lines.filter((line) => line.id !== lineId));
  }

  function handleSelectCliente(clienteId: string) {
    const cliente = clientes.find((currentCliente) => currentCliente.id === clienteId);
    const documentDigits = onlyDigits(cliente?.documento || "");

    setSelectedClienteId(clienteId);
    setSelectedVehicleId("");
    setClientName(cliente?.nome || "");
    setClientPhone(formatPhone(cliente?.telefone || ""));
    setClientEmail(cliente?.email || "");
    setClientCpf(
      documentDigits.length <= 11 ? formatCpfCnpj(cliente?.documento || "") : "",
    );
    setClientCnpj(
      documentDigits.length > 11 ? formatCpfCnpj(cliente?.documento || "") : "",
    );
  }

  function handleSelectVehicle(vehicleId: string) {
    const veiculo = selectedCliente?.veiculos.find(
      (currentVehicle) => currentVehicle.id === vehicleId,
    );

    setSelectedVehicleId(vehicleId);
    setVehicleBrand(veiculo?.marca || "");
    setVehicleModel(veiculo?.modelo || "");
    setVehicleYear(veiculo?.ano || "");
    setVehiclePlate(veiculo?.placa || "");
    setVehicleMotor(veiculo?.motor || "");
    setVehicleFuel(veiculo?.combustivel || "");
    setVehicleVin(veiculo?.chassiVin || "");
  }

  async function handleStatusChange(nextStatus: ServiceOrderStatus) {
    setStatus(nextStatus);

    if (!order) {
      return;
    }

    if (
      ["EM_EXECUCAO", "FINALIZADA", "ENTREGUE"].includes(nextStatus) &&
      EXECUTION_STATUS_TRANSITIONS[order.status] !== nextStatus
    ) {
      setSaveMessage(
        "Ação inválida para o status atual. Siga a sequência da execução da OS.",
      );
      return;
    }

    if (hasConcurrentOrderChange()) {
      setSaveMessage(
        "Esta OS foi alterada em outro lugar. Recarregue antes de salvar.",
      );
      return;
    }

    const updatedOrders = getStoredOrders().map((storedOrder) =>
      storedOrder.id === order.id
        ? updateServiceOrderStatusWithTimeline(storedOrder, nextStatus, {
            tipo: "status",
            titulo: "Status alterado",
            descricao: `Status alterado para ${getServiceOrderStatusLabel(nextStatus)}.`,
            usuarioResponsavel: "Oficina",
          })
        : storedOrder,
    );
    saveStoredOrders(updatedOrders);
    const updatedOrder = updatedOrders.find(
      (storedOrder) => storedOrder.id === order.id,
    );

    if (updatedOrder) {
      try {
        const savedOrder = oficina_id
          ? await updateServiceOrderSupabase(oficina_id, updatedOrder)
          : updatedOrder;

        syncLoadedVersion(savedOrder);
        registerStockExitForOrder(savedOrder);
        setOrder(savedOrder);
      } catch (error) {
        setSaveMessage(
          error instanceof Error
            ? error.message
            : "Não foi possível atualizar o status.",
        );
        return;
      }
    }

    setSaveMessage("Status atualizado.");
  }

  async function handleManualStatusAction(
    nextStatus: ServiceOrderStatus,
    titulo: string,
    descricao: string,
    tipo = "acao_manual",
  ) {
    setStatus(nextStatus);

    if (!order) {
      return;
    }

    if (hasConcurrentOrderChange()) {
      setSaveMessage(
        "Esta OS foi alterada em outro lugar. Recarregue antes de salvar.",
      );
      return;
    }

    const updatedOrders = getStoredOrders().map((storedOrder) =>
      storedOrder.id === order.id
        ? updateServiceOrderStatusWithTimeline(storedOrder, nextStatus, {
            tipo,
            titulo,
            descricao,
            usuarioResponsavel: "Oficina",
          })
        : storedOrder,
    );
    saveStoredOrders(updatedOrders);
    const updatedOrder = updatedOrders.find(
      (storedOrder) => storedOrder.id === order.id,
    );

    if (updatedOrder) {
      try {
        const savedOrder = oficina_id
          ? await updateServiceOrderSupabase(oficina_id, updatedOrder)
          : updatedOrder;

        syncLoadedVersion(savedOrder);
        registerStockExitForOrder(savedOrder);
        setOrder(savedOrder);
      } catch (error) {
        setSaveMessage(
          error instanceof Error
            ? error.message
            : "Não foi possível atualizar a OS.",
        );
        return;
      }
    }

    setSaveMessage(descricao || titulo);
  }

  function handleConfirmClientApproval() {
    if (!order || !isPreApproved) {
      return;
    }

    if (hasConcurrentOrderChange()) {
      setSaveMessage(
        "Esta OS foi alterada em outro lugar. Recarregue antes de salvar.",
      );
      return;
    }

    const dataConfirmacaoOficina = new Date().toISOString();
    const updatedOrders = getStoredOrders().map((storedOrder) => {
      if (storedOrder.id !== order.id) {
        return storedOrder;
      }

      const updatedOrder = {
        ...storedOrder,
        statusAprovacao: "confirmado_oficina" as const,
        confirmacaoOficina: true,
        dataConfirmacaoOficina,
        decisaoCliente: storedOrder.decisaoCliente || approvalStatus,
        exigeEntrada: requiresDeposit,
        tipoEntrada: depositType,
        valorEntrada: toNumber(depositValue),
        percentualEntrada: toNumber(depositPercent),
        entradaCalculada: depositSummary.entradaCalculada,
        saldoRestante: depositSummary.saldoRestante,
        statusEntrada: requiresDeposit ? depositStatus === "paga" ? "paga" as const : "pendente" as const : "nao_exige" as const,
      };

      return updateServiceOrderStatusWithTimeline(
        updatedOrder,
        getServiceOrderStatusForBudgetDecision(
          updatedOrder,
          "confirmado_oficina",
        ),
        {
          tipo: "aprovacao_confirmada",
          titulo: "Aprovação confirmada pela oficina",
          descricao:
            "Oficina confirmou a autorização com o cliente antes de iniciar.",
          usuarioResponsavel: "Oficina",
        },
      );
    });
    const updatedOrder = updatedOrders.find(
      (storedOrder) => storedOrder.id === order.id,
    );

    if (updatedOrder) {
      syncLoadedVersion(updatedOrder);
      const cotacoes = getCotacoes();
      updatedOrder.pecasNecessarias
        .filter((part) => part.compraId)
        .forEach((part) => {
          const wasApproved = updatedOrder.itensAprovados.includes(
            `peca-${part.id}`,
          );
          const cotacao = cotacoes.find(
            (currentCotacao) => currentCotacao.id === part.compraId,
          );

          if (!cotacao || !wasApproved) {
            return;
          }

          updateCotacao({
            ...cotacao,
            status: "Aprovada pelo cliente",
          });
        });

      setStatus(updatedOrder.status);
    }

    saveStoredOrders(updatedOrders);
    setApprovalStatus("confirmado_oficina");
    setApprovalConfirmationDate(dataConfirmacaoOficina);
    setOfficeConfirmedApproval(true);
    setClientDecision((currentDecision) => currentDecision || approvalStatus);
    setSaveMessage("Aprovação confirmada pela oficina.");
  }

  function handleConfirmDepositPayment() {
    if (!order || !requiresDeposit) {
      return;
    }

    const dataPagamentoEntrada = new Date().toISOString();
    const updatedOrders = getStoredOrders().map((storedOrder) =>
      storedOrder.id === order.id
        ? updateServiceOrderStatusWithTimeline(
            {
              ...storedOrder,
              exigeEntrada: true,
              tipoEntrada: depositType,
              valorEntrada: toNumber(depositValue),
              percentualEntrada: toNumber(depositPercent),
              entradaCalculada: depositSummary.entradaCalculada,
              saldoRestante: depositSummary.saldoRestante,
              statusEntrada: "paga" as const,
              dataPagamentoEntrada,
              valorEntradaPago: depositSummary.entradaCalculada,
            },
            "APROVADA",
            {
              tipo: "entrada_paga",
              titulo: "Entrada recebida",
              descricao: "Pagamento de entrada confirmado pela oficina.",
              usuarioResponsavel: "Oficina",
            },
          )
        : storedOrder,
    );

    saveStoredOrders(updatedOrders);
    const updatedOrder = updatedOrders.find(
      (storedOrder) => storedOrder.id === order.id,
    );
    if (updatedOrder) {
      syncLoadedVersion(updatedOrder);
    }
    setDepositStatus("paga");
    setDepositPaymentDate(dataPagamentoEntrada);
    setDepositPaidValue(depositSummary.entradaCalculada);
    setStatus("APROVADA");
    setSaveMessage("Recebimento da entrada confirmado.");
  }

  async function handleCopyBudgetLink() {
    if (!order) {
      return;
    }

    try {
      if (!navigator.clipboard) {
        throw new Error("Clipboard unavailable");
      }

      await navigator.clipboard.writeText(budgetLink);
      registerBudgetSent("Link do orçamento copiado para envio ao cliente.");
      setSaveMessage(`Link copiado: ${budgetLink}`);
    } catch {
      registerBudgetSent("Link do orçamento exibido para envio ao cliente.");
      setSaveMessage(`Link do orçamento: ${budgetLink}`);
    }
  }

  function handleOpenBudgetWhatsapp() {
    if (!budgetWhatsappUrl) {
      setSaveMessage("Informe o telefone do cliente para abrir o WhatsApp.");
      return;
    }

    window.open(budgetWhatsappUrl, "_blank", "noopener,noreferrer");
    registerBudgetSent("Orçamento enviado ao cliente pelo WhatsApp.");
    setSaveMessage("WhatsApp aberto com a mensagem do orçamento.");
  }

  function registerBudgetSent(descricao: string) {
    if (!order) {
      return;
    }

    const updatedOrders = getStoredOrders().map((storedOrder) => {
      if (storedOrder.id !== order.id) {
        return storedOrder;
      }

      return updateServiceOrderStatusWithTimeline(
        appendServiceOrderTimelineEvent(storedOrder, {
          tipo: "orcamento_enviado",
          titulo: "Orçamento enviado ao cliente",
          descricao,
          usuarioResponsavel: "Atendimento",
          statusAnterior: storedOrder.status,
          statusNovo: "ORCAMENTO_ENVIADO",
        }),
        "AGUARDANDO_APROVACAO",
        {
          tipo: "status",
          titulo: "Aguardando aprovação",
          descricao: "OS ficou aguardando resposta do cliente.",
          usuarioResponsavel: "Sistema",
        },
      );
    });

    saveStoredOrders(updatedOrders);
    const updatedOrder = updatedOrders.find(
      (storedOrder) => storedOrder.id === order.id,
    );
    if (updatedOrder) {
      syncLoadedVersion(updatedOrder);
    }
    setStatus("AGUARDANDO_APROVACAO");
  }

  function resetQuoteForm() {
    setQuoteForm(initialQuoteFormState);
  }

  function handleOpenQuoteModal() {
    if (!order) {
      return;
    }

    const updatedOrders = getStoredOrders().map((storedOrder) =>
      storedOrder.id === order.id
        ? updateServiceOrderStatusWithTimeline(storedOrder, "AGUARDANDO_COTACAO", {
            tipo: "cotacao_solicitada",
            titulo: "Cotação solicitada",
            descricao: "Oficina iniciou a solicitação de cotação de peças.",
            usuarioResponsavel: "Compras",
          })
        : storedOrder,
    );
    saveStoredOrders(updatedOrders);
    setStatus("AGUARDANDO_COTACAO");
    const updatedOrder = updatedOrders.find(
      (storedOrder) => storedOrder.id === order.id,
    );
    if (updatedOrder) {
      syncLoadedVersion(updatedOrder);
    }
    navigate(`/compras?osId=${order.id}`);
  }

  async function handleSendQuote() {
    if (!order) {
      return;
    }

    if (!selectedFornecedor) {
      setSaveMessage("Selecione um fornecedor para enviar a cotação.");
      return;
    }

    const quoteItems = getQuoteItemsFromOrder(order);

    if (!quoteItems.length) {
      setSaveMessage(
        "Esta OS não possui peças salvas para cotação. Adicione e salve as peças antes de solicitar.",
      );
      return;
    }

    const vehicleInfo = {
      marca: vehicleBrand.trim(),
      modelo: vehicleModel.trim(),
      ano: vehicleYear.trim(),
      motor: vehicleMotor.trim(),
      combustivel: vehicleFuel.trim(),
      placa: vehiclePlate.trim(),
      chassi: vehicleVin.trim(),
    };
    const mainQuoteItem = quoteItems[0];
    const message = [
      `${oficinaConfig.nomeOficina} - solicitação de cotação`,
      "",
      `Veículo: ${[vehicleInfo.marca, vehicleInfo.modelo, vehicleInfo.ano]
        .filter(Boolean)
        .join(" ") || "não informado"}`,
      `Motor: ${vehicleInfo.motor || "não informado"}`,
      `Combustível: ${vehicleInfo.combustivel || "não informado"}`,
      `Placa: ${vehicleInfo.placa || "não informada"}`,
      `Chassi/VIN: ${vehicleInfo.chassi || "não informado"}`,
      "",
      "Peças solicitadas:",
      ...quoteItems.map(
        (quoteItem) =>
          `- ${quoteItem.peca} | Quantidade: ${quoteItem.quantidade}`,
      ),
      supplierVisiblePhotos.length
        ? "Fotos técnicas disponíveis no link da cotação."
        : "",
    ]
      .filter(Boolean)
      .join("\n");
    const whatsappUrl = createQuoteWhatsappUrl(selectedFornecedor, message);

    if (!whatsappUrl) {
      setSaveMessage("O fornecedor selecionado não possui WhatsApp válido.");
      return;
    }

    const cotacaoPayload = {
      osId: order.id,
      oficinaNome: oficinaConfig.nomeOficina,
      fornecedorId: selectedFornecedor.id,
      fornecedorNome: selectedFornecedor.nome,
      fornecedorWhatsapp: selectedFornecedor.whatsapp,
      peca: mainQuoteItem.peca,
      quantidade: mainQuoteItem.quantidade,
      pecas: quoteItems,
      urgencia: quoteForm.urgencia,
      observacao: quoteForm.observacao.trim(),
      fotos: supplierVisiblePhotos,
      clienteNome: clientName.trim(),
      clienteTelefone: onlyDigits(clientPhone),
      veiculo: vehicleInfo,
    };
    let newCotacao;

    try {
      newCotacao = oficina_id
        ? await saveCotacaoSupabase(oficina_id, cotacaoPayload)
        : saveCotacao(cotacaoPayload);
    } catch (error) {
      setSaveMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar a cotação.",
      );
      return;
    }
    const responseLink = `${window.location.origin}/fornecedor/cotacao/${newCotacao.id}`;
    const whatsappUrlWithLink = createQuoteWhatsappUrl(
      selectedFornecedor,
      `${message}\n\nResponda a cotação neste link: ${responseLink}`,
    );

    const updatedOrders = getStoredOrders().map((storedOrder) =>
      storedOrder.id === order.id
        ? updateServiceOrderStatusWithTimeline(storedOrder, "AGUARDANDO_COTACAO", {
            tipo: "cotacao_solicitada",
            titulo: "Cotação solicitada",
            descricao: `Cotação ${newCotacao.id} enviada para ${selectedFornecedor.nome}.`,
            usuarioResponsavel: "Compras",
          })
        : storedOrder,
    );
    saveStoredOrders(updatedOrders);
    setStatus("AGUARDANDO_COTACAO");
    const updatedOrder = updatedOrders.find(
      (storedOrder) => storedOrder.id === order.id,
    );
    if (updatedOrder) {
      syncLoadedVersion(updatedOrder);
    }

    window.open(whatsappUrlWithLink || whatsappUrl, "_blank", "noopener,noreferrer");
    setOsCotacoes((currentCotacoes) => [newCotacao, ...currentCotacoes]);
    setSaveMessage(`Cotação enviada para ${selectedFornecedor.nome}.`);
    setIsQuoteModalOpen(false);
    resetQuoteForm();
  }

  async function handleChooseQuoteSupplier(
    cotacao: CotacaoPeca,
    cotacaoPart: CotacaoPecaItem,
    response: CotacaoFornecedorResponse,
    itemResponse: CotacaoPecaRespostaItem,
  ) {
    if (getChoiceForPart(cotacao, cotacaoPart.id)) {
      setSaveMessage("Esta peça já tem fornecedor escolhido.");
      return;
    }

    const nextChoice: CotacaoPecaEscolha = {
      pecaId: cotacaoPart.id,
      nomePeca: itemResponse.nomePeca || cotacaoPart.peca,
      quantidade: Number(itemResponse.quantidade || cotacaoPart.quantidade || 1),
      fornecedorId: response.fornecedorId,
      fornecedorNome: response.fornecedorNome,
      preco: Number(itemResponse.preco || 0),
      marca: itemResponse.marca,
      observacao: itemResponse.observacaoFornecedor,
      dataEscolha: new Date().toISOString(),
    };
    const nextChoices = [...cotacao.pecasEscolhidas, nextChoice];
    const totalSelectedValue = nextChoices.reduce(
      (total, choice) => total + choice.preco * choice.quantidade,
      0,
    );
    const nextCotacao = {
      ...cotacao,
      status: getCotacaoStatusAfterChoice(cotacao, nextChoices),
      fornecedorEscolhidoId: response.fornecedorId,
      fornecedorEscolhidoNome: response.fornecedorNome,
      precoFinalPeca: Number(itemResponse.preco || 0),
      fornecedorSelecionado: response.fornecedorNome,
      valorSelecionado: totalSelectedValue,
      marcaSelecionada: itemResponse.marca,
      prazoSelecionado: "",
      pecasEscolhidas: nextChoices,
    };

    try {
      const updatedCotacao = await selectCotacaoFornecedorSupabase(
        nextCotacao,
        nextChoice,
      );

      setOsCotacoes((currentCotacoes) =>
        currentCotacoes.map((currentCotacao) =>
          currentCotacao.id === cotacao.id ? updatedCotacao : currentCotacao,
        ),
      );

      if (oficina_id && order?.id) {
        const updatedOrder = await getServiceOrderSupabase(oficina_id, order.id);

        if (updatedOrder) {
          setOrder(updatedOrder);
          syncLoadedVersion(updatedOrder);
        }
      }

      setSaveMessage("Fornecedor selecionado com sucesso.");
    } catch (error) {
      setSaveMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível selecionar o fornecedor.",
      );
    }
  }

  async function handleSaveChanges() {
    if (!order) {
      return;
    }

    if (!oficina_id) {
      setSaveMessage("Não foi possível identificar a oficina do usuário logado.");
      return;
    }

    if (hasConcurrentOrderChange()) {
      setSaveMessage(
        "Esta OS foi alterada em outro lugar. Recarregue antes de salvar.",
      );
      return;
    }

    if (hasLockedBudgetChanges()) {
      setSaveMessage(
        "Orçamento já enviado/aprovado. Para alterar valores, crie uma revisão.",
      );
      return;
    }

    const vehicleDescription = [vehicleBrand, vehicleModel, vehicleYear]
      .filter(Boolean)
      .join(" ");

    if (!clientName.trim()) {
      setSaveMessage("Informe o cliente antes de salvar a OS.");
      return;
    }

    if (!selectedClienteId) {
      setSaveMessage("Selecione um cliente vinculado antes de salvar a OS.");
      return;
    }

    if (!selectedVehicleId) {
      setSaveMessage("Selecione um veículo vinculado antes de salvar a OS.");
      return;
    }

    if (!vehicleDescription || !vehiclePlate.trim()) {
      setSaveMessage("Informe o veículo e a placa antes de salvar a OS.");
      return;
    }
    const checklistInicial = checklistItems.map((item) => ({
      item,
      status: checklistState[item]?.status ?? "",
      observacaoTecnica: checklistState[item]?.observacaoTecnica.trim() ?? "",
    }));
    const pecasNecessarias = partLines.map((line) => {
      const quantidade = toNumber(line.quantity);
      const valorUnitario = toNumber(line.unitValue);
      const existingPart = order.pecasNecessarias.find(
        (part) => part.id === line.id,
      );

      return {
        ...existingPart,
        id: line.id,
        peca: line.name.trim(),
        quantidade,
        valorUnitario,
        valorTotal: quantidade * valorUnitario,
        compraId: line.compraId,
        origemChecklist: line.generatedFromChecklist,
      };
    });
    const servicosMaoDeObra = laborLines.map((line) => ({
      id: line.id,
      servico: line.service.trim(),
      descricao: line.description.trim(),
      valor: toNumber(line.value),
    }));
    const clientPhoneDigits = onlyDigits(clientPhone);
    const clientCpfDigits = onlyDigits(clientCpf);
    const clientCnpjDigits = onlyDigits(clientCnpj);
    const updatedOrder: ServiceOrder = {
      ...order,
      id: order.id,
      codigo: order.codigo,
      cliente: clientName.trim(),
      telefone: clientPhoneDigits,
      veiculo: vehicleDescription,
      placa: vehiclePlate.trim(),
      servicoInicial: problemReport.trim(),
      observacao: [defectFound, probableCause, recommendedSolution]
        .filter(Boolean)
        .join(" | "),
      status,
      statusAprovacao: approvalStatus,
      dataDecisaoAprovacao: approvalDecisionDate,
      dataConfirmacaoOficina: approvalConfirmationDate,
      confirmacaoOficina: officeConfirmedApproval,
      decisaoCliente: clientDecision,
      exigeEntrada: requiresDeposit,
      tipoEntrada: depositType,
      valorEntrada: toNumber(depositValue),
      percentualEntrada: toNumber(depositPercent),
      entradaCalculada: depositSummary.entradaCalculada,
      saldoRestante: depositSummary.saldoRestante,
      statusEntrada: requiresDeposit ? depositStatus : "nao_exige",
      dataPagamentoEntrada: depositPaymentDate,
      valorEntradaPago: depositPaidValue,
      formaPagamentoEscolhida: order.formaPagamentoEscolhida,
      parcelasEscolhidas: order.parcelasEscolhidas,
      valorFinalPagamento: order.valorFinalPagamento,
      descontoAplicado: order.descontoAplicado,
      taxaAplicada: order.taxaAplicada,
      descontoPagamentoAplicado: order.descontoPagamentoAplicado,
      taxaPagamentoAplicada: order.taxaPagamentoAplicada,
      clienteId: selectedClienteId,
      clienteNome: clientName.trim(),
      clienteTelefone: clientPhoneDigits,
      veiculoId: selectedVehicleId,
      veiculoMarca: vehicleBrand.trim(),
      veiculoModelo: vehicleModel.trim(),
      veiculoAno: vehicleYear.trim(),
      veiculoMotor: vehicleMotor.trim(),
      veiculoCombustivel: vehicleFuel,
      veiculoPlaca: vehiclePlate.trim(),
      veiculoChassi: vehicleVin.trim(),
      clienteDados: {
        nome: clientName.trim(),
        telefone: clientPhoneDigits,
        cpf: clientCpfDigits,
        cnpj: clientCnpjDigits,
        email: clientEmail.trim(),
      },
      veiculoDados: {
        marca: vehicleBrand.trim(),
        modelo: vehicleModel.trim(),
        ano: vehicleYear.trim(),
        placa: vehiclePlate.trim(),
        motor: vehicleMotor.trim(),
        combustivel: vehicleFuel,
        chassiVin: vehicleVin.trim(),
        kmAtual: vehicleKm.trim(),
      },
      problemaRelatado: problemReport.trim(),
      diagnostico: {
        defeitoEncontrado: defectFound.trim(),
        causaProvavel: probableCause.trim(),
        solucaoRecomendada: recommendedSolution.trim(),
      },
      checklistInicial,
      pecasNecessarias,
      servicosMaoDeObra,
      fotosOs: photos,
      orcamento: {
        ...order.orcamento,
        totalPecas: totals.partsTotal,
        totalMaoDeObra: totals.laborTotal,
        descontoValor: toNumber(discountValue),
        descontoTipo: discountType,
        descontoAplicado: totals.discountAmount,
        formaPagamento: paymentMethod,
        totalFinal: totals.finalTotal,
      },
    };
    const orderWithTimeline = appendServiceOrderTimelineEvent(updatedOrder, {
      tipo: "edicao",
      titulo: "OS editada",
      descricao: "Dados da ordem de serviço foram atualizados.",
      usuarioResponsavel: "Oficina",
      statusAnterior: order.status,
      statusNovo: status,
    });

    try {
      const savedOrder = await updateServiceOrderSupabase(
        oficina_id,
        orderWithTimeline,
      );
      const updatedOrders = getStoredOrders().map((storedOrder) =>
        storedOrder.id === order.id ? savedOrder : storedOrder,
      );
      saveStoredOrders(updatedOrders);
      registerStockExitForOrder(savedOrder);
      const refetchedOrder = await getServiceOrderSupabase(
        oficina_id,
        savedOrder.id,
      );
      const completeOrder = refetchedOrder ?? savedOrder;
      syncLoadedVersion(completeOrder);
      setOrder(completeOrder);
      setSaveMessage("Alterações salvas.");
    } catch (error) {
      setSaveMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar as alterações.",
      );
    }
  }

  async function handleGenerateBudget() {
    if (!order) {
      return;
    }

    if (!oficina_id) {
      setSaveMessage("Não foi possível identificar a oficina do usuário logado.");
      return;
    }

    try {
      const orderWithBudget = await saveServiceOrderBudgetSupabase(
        oficina_id,
        {
          ...order,
          pecasNecessarias: partLines.map((line) => {
            const quantidade = toNumber(line.quantity);
            const valorUnitario = toNumber(line.unitValue);

            return {
              id: line.id,
              peca: line.name.trim(),
              quantidade,
              valorUnitario,
              valorTotal: quantidade * valorUnitario,
              compraId: line.compraId,
              origemChecklist: line.generatedFromChecklist,
            };
          }),
          servicosMaoDeObra: laborLines.map((line) => ({
            id: line.id,
            servico: line.service.trim(),
            descricao: line.description.trim(),
            valor: toNumber(line.value),
          })),
        },
      );

      setOrder(orderWithBudget);
      setSaveMessage("Orçamento gerado como rascunho.");
    } catch (error) {
      setSaveMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível gerar o orçamento.",
      );
    }
  }

  if (isLoadingOrder && !order) {
    return (
      <div>
        <BackButton className="mb-6" />

        <section className={sectionClass}>
          <h2 className="text-3xl font-bold">Carregando OS</h2>
          <p className="mt-2 text-slate-400">
            Buscando dados completos da ordem de serviço.
          </p>
        </section>
      </div>
    );
  }

  if (!order && hasLoadedOrder) {
    return (
      <div>
        <BackButton className="mb-6" />

        <section className={sectionClass}>
          <h2 className="text-3xl font-bold">OS não encontrada</h2>
          <p className="mt-2 text-slate-400">
            Não existe ordem de serviço salva para o ID informado.
          </p>
        </section>
      </div>
    );
  }

  if (!order) {
    return null;
  }

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <BackButton className="mb-4" />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold">
            Detalhe da OS {order.codigo || order.id}
          </h2>
          <p className="mt-2 text-slate-400">
            Edite os dados completos da ordem de serviço.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setShowBudgetActions((currentValue) => !currentValue)}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-400"
          >
            Enviar orçamento
          </button>

          <button
            type="button"
            onClick={handleOpenQuoteModal}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-amber-400"
          >
            Solicitar cotação
          </button>
        </div>
      </div>
      </div>

      <section className={`${sectionClass} mb-6`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="text-sm font-semibold uppercase text-sky-400">
              Status da OS
            </span>
            <h3 className="mt-1 text-2xl font-bold">
              {getServiceOrderStatusLabel(status)}
            </h3>
            <p className="mt-2 text-sm text-slate-400">
              Use as ações rápidas para registrar a evolução operacional da OS.
            </p>
          </div>
          <span className={getServiceOrderStatusBadgeClass(status)}>
            {getServiceOrderStatusLabel(status)}
          </span>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          {status === "ABERTA" && (
            <button
              type="button"
              onClick={() =>
                handleManualStatusAction(
                  "EM_DIAGNOSTICO",
                  "Diagnóstico iniciado",
                  "OS movida para diagnóstico inicial.",
                  "diagnostico_iniciado",
                )
              }
              className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-400"
            >
              Iniciar diagnóstico
            </button>
          )}

          <button
            type="button"
            onClick={handleOpenQuoteModal}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400"
          >
            Solicitar cotação
          </button>

          <button
            type="button"
            onClick={() => setShowBudgetActions((currentValue) => !currentValue)}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400"
          >
            Enviar orçamento
          </button>

          {status === "APROVADA" && (
            <button
              type="button"
              onClick={() =>
                handleManualStatusAction(
                  "EM_EXECUCAO",
                  "Serviço iniciado",
                  "Execução do serviço iniciada.",
                  "servico_iniciado",
                )
              }
              className="rounded-lg bg-fuchsia-500 px-4 py-2 text-sm font-semibold text-white hover:bg-fuchsia-400"
            >
              Iniciar serviço
            </button>
          )}

          <button
            type="button"
            onClick={() =>
              handleManualStatusAction(
                "AGUARDANDO_PECA",
                "Aguardando peça",
                "OS marcada como aguardando peça.",
                "aguardando_peca",
              )
            }
            className="rounded-lg border border-orange-400/40 px-4 py-2 text-sm font-semibold text-orange-200 hover:bg-orange-500/10"
          >
            Marcar aguardando peça
          </button>

          {status === "EM_EXECUCAO" && (
            <button
              type="button"
              onClick={() =>
                handleManualStatusAction(
                  "FINALIZADA",
                  "Serviço finalizado",
                  "Execução do serviço finalizada.",
                  "servico_finalizado",
                )
              }
              className="rounded-lg bg-green-500 px-4 py-2 text-sm font-semibold text-white hover:bg-green-400"
            >
              Finalizar serviço
            </button>
          )}

          {status === "FINALIZADA" && (
            <button
              type="button"
              onClick={() =>
                handleManualStatusAction(
                  "ENTREGUE",
                  "Veículo entregue",
                  "Veículo entregue ao cliente.",
                  "entrega",
                )
              }
              className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-400"
            >
              Entregar veículo
            </button>
          )}

          {status !== "CANCELADA" && status !== "ENTREGUE" && (
            <button
              type="button"
              onClick={() =>
                handleManualStatusAction(
                  "CANCELADA",
                  "OS cancelada",
                  "Ordem de serviço cancelada pela oficina.",
                  "cancelamento",
                )
              }
              className="rounded-lg border border-red-400/40 px-4 py-2 text-sm font-semibold text-red-200 hover:bg-red-500/10"
            >
              Cancelar OS
            </button>
          )}
        </div>
      </section>

      <section className={`${sectionClass} mb-6`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="text-sm font-semibold uppercase text-sky-400">
              Orçamento
            </span>
            <h3 className="mt-1 text-2xl font-bold">Aprovação do cliente</h3>
            <p className="mt-2 text-slate-400">
              Link público: {budgetLink}
            </p>
          </div>

          <span className={getBudgetApprovalBadgeClass(approvalStatus)}>
            {getBudgetApprovalLabel(approvalStatus)}
          </span>
        </div>

        {showBudgetActions && (
          <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <input
                className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300 outline-none"
                value={budgetLink}
                readOnly
              />

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleCopyBudgetLink}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
                >
                  Copiar link
                </button>

                <button
                  type="button"
                  onClick={handleOpenBudgetWhatsapp}
                  className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-400"
                >
                  Abrir WhatsApp
                </button>
              </div>
            </div>

            <p className="mt-3 text-xs text-slate-500">
              Mensagem: Olá, aqui é da {oficinaConfig.nomeOficina}. Seu
              orçamento está pronto. Clique no link para visualizar e aprovar:{" "}
              {budgetLink}
            </p>
          </div>
        )}

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <span className="text-xs uppercase text-slate-500">
              Decisão do cliente
            </span>
            <p className="mt-1 font-semibold">
              {getBudgetApprovalLabel(approvalStatus)}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <span className="text-xs uppercase text-slate-500">
              Data da decisão
            </span>
            <p className="mt-1 font-semibold">
              {formatDate(approvalDecisionDate)}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <span className="text-xs uppercase text-slate-500">
              Itens aprovados
            </span>
            <p className="mt-1 font-semibold">
              {isFullPreApproval
                ? "Todos"
                : approvalItemLabels.length
                  ? `${approvalItemLabels.length} item(ns)`
                  : "Nenhum"}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <span className="text-xs uppercase text-slate-500">
              Confirmação da oficina
            </span>
            <p className="mt-1 font-semibold">
              {officeConfirmedApproval
                ? `Confirmada em ${formatDate(approvalConfirmationDate)}`
                : "Ainda não confirmada"}
            </p>
          </div>

          {isPreApproved && (
            <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-4">
              <p className="text-sm font-medium text-amber-100">
                Antes de confirmar, entre em contato com o cliente por telefone
                ou WhatsApp e confirme que ele autorizou este orçamento.
              </p>
              <button
                type="button"
                onClick={handleConfirmClientApproval}
                className="mt-4 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400"
              >
                Confirmar aprovação com cliente
              </button>
            </div>
          )}
        </div>

        {requiresDeposit && (
          <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/10 p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <span className="text-xs uppercase text-amber-200">
                  Entrada/sinal
                </span>
                <p className="mt-1 font-semibold text-amber-50">
                  Status:{" "}
                  {depositStatus === "paga"
                    ? "Paga"
                    : "Pendente de pagamento"}
                </p>
                <p className="mt-1 text-sm text-amber-100/80">
                  Entrada {formatCurrency(depositSummary.entradaCalculada)} ·
                  Saldo restante {formatCurrency(depositSummary.saldoRestante)}
                </p>
                {depositStatus === "paga" && (
                  <p className="mt-1 text-xs text-amber-100/70">
                    Pago em {formatDate(depositPaymentDate)} · Valor recebido{" "}
                    {formatCurrency(depositPaidValue)}
                  </p>
                )}
              </div>

              {approvalStatus === "confirmado_oficina" &&
                depositStatus !== "paga" && (
                  <button
                    type="button"
                    onClick={handleConfirmDepositPayment}
                    className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400"
                  >
                    Confirmar recebimento da entrada
                  </button>
                )}
            </div>
          </div>
        )}

        {(approvalItemLabels.length > 0 || order.observacaoAprovacao) && (
          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
            {approvalItemLabels.length > 0 && (
              <p>Itens aprovados: {approvalItemLabels.join(", ")}.</p>
            )}
            {order.observacaoAprovacao && (
              <p className="mt-2">
                Observação do cliente: {order.observacaoAprovacao}
              </p>
            )}
          </div>
        )}
      </section>

      <section className={sectionClass}>
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="text-sm font-semibold uppercase text-amber-300">
              Compras
            </span>
            <h3 className="mt-1 text-2xl font-bold">
              Cotações e compras da OS
            </h3>
            <p className="mt-2 text-sm text-slate-400">
              Solicite cotação, acompanhe respostas e escolha o fornecedor sem
              sair desta OS.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsQuoteModalOpen(true)}
            className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-400"
          >
            Solicitar cotação
          </button>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-slate-100">
                Peças salvas na OS
              </p>
              <p className="mt-1 text-sm text-slate-400">
                Peças de checklist e peças adicionadas manualmente entram na
                cotação.
              </p>
            </div>
            <span className="rounded-full bg-sky-500/15 px-3 py-1 text-xs font-semibold text-sky-200 ring-1 ring-sky-400/30">
              {quoteItemsFromOrder.length} peça(s)
            </span>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {quoteItemsFromOrder.length ? (
              quoteItemsFromOrder.map((part) => (
                <div
                  key={part.id}
                  className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm"
                >
                  <p className="font-medium text-slate-100">{part.peca}</p>
                  <p className="mt-1 text-slate-400">
                    Quantidade: {part.quantidade}
                  </p>
                </div>
              ))
            ) : (
              <p className="rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100 md:col-span-2">
                Nenhuma peça salva nesta OS para cotação.
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-4">
          {osCotacoes.length ? (
            osCotacoes.map((cotacao) => {
              const selectedChoices = cotacao.pecasEscolhidas;

              return (
                <article
                  key={cotacao.id}
                  className="rounded-xl border border-slate-800 bg-slate-950 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h4 className="font-semibold text-slate-100">
                        Cotação {cotacao.id}
                      </h4>
                      <p className="mt-1 text-sm text-slate-400">
                        {cotacao.fornecedorNome} · enviada em{" "}
                        {formatDate(cotacao.enviadaEm)}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-200">
                      {cotacao.status}
                    </span>
                  </div>

                  {selectedChoices.length > 0 && (
                    <div className="mt-4 rounded-lg border border-emerald-400/20 bg-emerald-500/10 p-3 text-sm text-emerald-100">
                      <p className="text-xs font-semibold uppercase text-emerald-200/80">
                        Fornecedor escolhido
                      </p>
                      <div className="mt-2 grid gap-2 md:grid-cols-2">
                        {selectedChoices.map((choice) => (
                          <div
                            key={`${choice.pecaId}-${choice.fornecedorId}`}
                            className="rounded-lg border border-emerald-400/20 bg-slate-950/50 px-3 py-2"
                          >
                            <p className="font-medium">{choice.nomePeca}</p>
                            <p className="mt-1 text-xs text-emerald-100/80">
                              {choice.fornecedorNome} · Preço unitário:{" "}
                              {formatCurrency(choice.preco)} · Total:{" "}
                              {formatCurrency(choice.preco * choice.quantidade)} ·{" "}
                              {choice.marca || "Marca não informada"}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h5 className="font-semibold text-slate-100">
                          Respostas dos fornecedores
                        </h5>
                        <p className="mt-1 text-sm text-slate-400">
                          Escolha uma resposta vencedora para cada peça.
                        </p>
                      </div>
                      <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-200">
                        {cotacao.responses.length} resposta(s)
                      </span>
                    </div>

                    {!cotacao.responses.length && (
                      <p className="mt-3 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-400">
                        Aguardando resposta do fornecedor
                      </p>
                    )}

                    {cotacao.responses.length > 0 && (
                      <div className="mt-4 grid gap-4">
                        {cotacao.pecas.map((cotacaoPart) => {
                          const partOptions = cotacao.responses
                            .map((response) => ({
                              response,
                              itemResponse: getResponseForPart(
                                response,
                                cotacaoPart.id,
                              ),
                            }))
                            .filter(
                              (
                                option,
                              ): option is {
                                response: CotacaoFornecedorResponse;
                                itemResponse: CotacaoPecaRespostaItem;
                              } => Boolean(option.itemResponse),
                            );
                          const selectedChoice = getChoiceForPart(
                            cotacao,
                            cotacaoPart.id,
                          );

                          return (
                            <div
                              key={cotacaoPart.id}
                              className="rounded-xl border border-slate-800 bg-slate-950 p-4"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div>
                                  <p className="font-semibold text-slate-100">
                                    {cotacaoPart.peca}
                                  </p>
                                  <p className="mt-1 text-sm text-slate-400">
                                    Quantidade: {cotacaoPart.quantidade}
                                  </p>
                                </div>
                                {selectedChoice && (
                                  <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-200 ring-1 ring-emerald-400/30">
                                    Escolhido: {selectedChoice.fornecedorNome}
                                  </span>
                                )}
                              </div>

                              {partOptions.length ? (
                                <div className="mt-4 grid gap-3">
                                  {partOptions.map(({ response, itemResponse }) => {
                                    const isSelected =
                                      selectedChoice?.fornecedorId ===
                                      response.fornecedorId;

                                    return (
                                      <div
                                        key={`${cotacaoPart.id}-${response.fornecedorId}-${itemResponse.dataHora}`}
                                        className={`grid gap-3 rounded-lg border p-3 md:grid-cols-[1.2fr_110px_140px_140px_1fr_1.2fr_auto] md:items-center ${
                                          isSelected
                                            ? "border-emerald-400/40 bg-emerald-500/10"
                                            : "border-slate-800 bg-slate-900"
                                        }`}
                                      >
                                        <div>
                                          <span className="text-xs uppercase text-slate-500">
                                            Fornecedor
                                          </span>
                                          <p className="mt-1 font-medium text-slate-100">
                                            {response.fornecedorNome}
                                          </p>
                                        </div>
                                        <div>
                                          <span className="text-xs uppercase text-slate-500">
                                            Qtd.
                                          </span>
                                          <p className="mt-1 text-sm font-semibold text-slate-100">
                                            {itemResponse.quantidade}
                                          </p>
                                        </div>
                                        <div>
                                          <span className="text-xs uppercase text-slate-500">
                                            Preço unitário
                                          </span>
                                          <p className="mt-1 text-sm font-semibold text-slate-100">
                                            {formatCurrency(itemResponse.preco)}
                                          </p>
                                        </div>
                                        <div>
                                          <span className="text-xs uppercase text-slate-500">
                                            Total
                                          </span>
                                          <p className="mt-1 text-sm font-semibold text-slate-100">
                                            {formatCurrency(
                                              itemResponse.preco *
                                                itemResponse.quantidade,
                                            )}
                                          </p>
                                        </div>
                                        <div>
                                          <span className="text-xs uppercase text-slate-500">
                                            Marca
                                          </span>
                                          <p className="mt-1 text-sm text-slate-300">
                                            {itemResponse.marca || "-"}
                                          </p>
                                        </div>
                                        <div>
                                          <span className="text-xs uppercase text-slate-500">
                                            Observação
                                          </span>
                                          <p className="mt-1 text-sm text-slate-300">
                                            {itemResponse.observacaoFornecedor || "-"}
                                          </p>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            void handleChooseQuoteSupplier(
                                              cotacao,
                                              cotacaoPart,
                                              response,
                                              itemResponse,
                                            )
                                          }
                                          disabled={Boolean(selectedChoice)}
                                          className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                          {isSelected
                                            ? "Escolhido"
                                            : "Escolher este fornecedor"}
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p className="mt-4 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-400">
                                  Aguardando resposta do fornecedor
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </article>
              );
            })
          ) : (
            <p className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-400">
              Nenhuma cotação enviada para esta OS ainda.
            </p>
          )}
        </div>
      </section>

      {isQuoteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl shadow-slate-950/40 sm:p-6">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
              <div>
                <span className="text-sm font-semibold uppercase text-amber-300">
                  Compras
                </span>
                <h3 className="mt-1 text-2xl font-bold">
                  Solicitar cotação de peça
                </h3>
                <p className="mt-2 text-sm text-slate-400">
                  Envie a solicitação para um fornecedor cadastrado via WhatsApp.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsQuoteModalOpen(false)}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
              >
                Fechar
              </button>
            </div>

            <div className="mb-5 rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm">
              <span className="text-xs uppercase text-slate-500">Veículo</span>
              <p className="mt-1 font-semibold text-slate-100">
                {[vehicleBrand, vehicleModel, vehicleYear].filter(Boolean).join(" ") ||
                  "Veículo não informado"}
              </p>
              <p className="mt-1 text-slate-400">
                Motor {vehicleMotor || "-"} · Placa {vehiclePlate || "-"}
              </p>
            </div>

            <div className="grid gap-5">
              <div>
                <label className={labelClass}>Fornecedor</label>
                <select
                  className={inputClass}
                  value={quoteForm.fornecedorId}
                  onChange={(event) =>
                    setQuoteForm((currentState) => ({
                      ...currentState,
                      fornecedorId: event.target.value,
                    }))
                  }
                >
                  <option value="">Selecione um fornecedor</option>
                  {fornecedores.map((fornecedor) => (
                    <option key={fornecedor.id} value={fornecedor.id}>
                      {fornecedor.nome} - {fornecedor.categoria}
                    </option>
                  ))}
                </select>
              </div>

              {selectedFornecedor && (
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm">
                  <p className="font-medium text-slate-100">
                    {selectedFornecedor.nome}
                  </p>
                  <p className="mt-1 text-slate-400">
                    WhatsApp: {selectedFornecedor.whatsapp || "não informado"}
                  </p>
                  {selectedFornecedor.observacoes && (
                    <p className="mt-1 text-slate-500">
                      {selectedFornecedor.observacoes}
                    </p>
                  )}
                </div>
              )}

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-100">
                      Peças da OS
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                      A solicitação será enviada com as peças salvas nesta OS.
                    </p>
                  </div>
                  <span className="rounded-full bg-sky-500/15 px-3 py-1 text-xs font-semibold text-sky-200 ring-1 ring-sky-400/30">
                    {quoteItemsFromOrder.length} peça(s)
                  </span>
                </div>
                <div className="mt-3 grid gap-2">
                  {quoteItemsFromOrder.length ? (
                    quoteItemsFromOrder.map((part) => (
                      <div
                        key={part.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm"
                      >
                        <span className="font-medium text-slate-100">
                          {part.peca}
                        </span>
                        <span className="text-slate-400">
                          Quantidade: {part.quantidade}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                      Nenhuma peça salva nesta OS para cotação.
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className={labelClass}>Observação</label>
                <textarea
                  rows={4}
                  className={inputClass}
                  placeholder="Marca preferida, lado do veículo, prazo desejado..."
                  value={quoteForm.observacao}
                  onChange={(event) =>
                    setQuoteForm((currentState) => ({
                      ...currentState,
                      observacao: event.target.value,
                    }))
                  }
                />
              </div>

              <div>
                <label className={labelClass}>Fotos</label>
                {supplierVisiblePhotos.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {supplierVisiblePhotos.map((photo) => (
                      <figure
                        key={photo.id}
                        className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950"
                      >
                        <img
                          src={photo.dataUrl}
                          alt={photo.titulo}
                          className="h-32 w-full object-cover"
                        />
                        <figcaption className="p-3 text-xs text-slate-400">
                          <strong className="block text-slate-100">
                            {photo.titulo}
                          </strong>
                          {photo.tipo} · {photo.visibilidade}
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950 p-4 text-sm text-slate-400">
                    Nenhuma foto liberada para fornecedor nesta OS.
                  </div>
                )}
              </div>

              <div className="flex flex-wrap justify-end gap-3 border-t border-slate-800 pt-5">
                <button
                  type="button"
                  onClick={() => setIsQuoteModalOpen(false)}
                  className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-800"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={handleSendQuote}
                  className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-400"
                >
                  Enviar para fornecedor
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          handleSaveChanges();
        }}
      >
        <section className={sectionClass}>
          <div className="mb-6">
            <span className="text-sm font-semibold uppercase text-sky-400">
              Etapa 1
            </span>
            <h3 className="mt-1 text-2xl font-bold">Entrada do veículo</h3>
          </div>

          <div className="space-y-6">
            <div>
              <h4 className={subTitleClass}>Dados do cliente</h4>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className={labelClass}>Cliente vinculado</label>
                  <select
                    className={inputClass}
                    value={selectedClienteId}
                    onChange={(event) => handleSelectCliente(event.target.value)}
                  >
                    <option value="">Sem vínculo</option>
                    {clientes.map((cliente) => (
                      <option key={cliente.id} value={cliente.id}>
                        {cliente.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Nome</label>
                  <input
                    className={inputClass}
                    placeholder="Nome completo"
                    value={clientName}
                    onChange={(event) => setClientName(event.target.value)}
                  />
                </div>

                <div>
                  <label className={labelClass}>Telefone</label>
                  <input
                    className={inputClass}
                    inputMode="numeric"
                    placeholder="(00) 00000-0000"
                    value={clientPhone}
                    onChange={(event) =>
                      setClientPhone(formatPhone(event.target.value))
                    }
                  />
                </div>

                <div>
                  <label className={labelClass}>CPF opcional</label>
                  <input
                    className={inputClass}
                    inputMode="numeric"
                    placeholder="000.000.000-00"
                    value={clientCpf}
                    onChange={(event) =>
                      setClientCpf(formatCpfCnpj(event.target.value))
                    }
                  />
                </div>

                <div>
                  <label className={labelClass}>CNPJ opcional</label>
                  <input
                    className={inputClass}
                    inputMode="numeric"
                    placeholder="00.000.000/0000-00"
                    value={clientCnpj}
                    onChange={(event) =>
                      setClientCnpj(formatCpfCnpj(event.target.value))
                    }
                  />
                </div>

                <div>
                  <label className={labelClass}>E-mail opcional</label>
                  <input
                    type="email"
                    className={inputClass}
                    placeholder="cliente@email.com"
                    value={clientEmail}
                    onChange={(event) => setClientEmail(event.target.value)}
                  />
                </div>

                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <label className="block text-sm font-medium text-slate-300">
                      Status da OS
                    </label>
                    <span className={getServiceOrderStatusBadgeClass(status)}>
                      {getServiceOrderStatusLabel(status)}
                    </span>
                  </div>
                  <select
                    className={inputClass}
                    value={status}
                    onChange={(event) =>
                      handleStatusChange(event.target.value as ServiceOrderStatus)
                    }
                  >
                    {SERVICE_ORDER_STATUSES.map((serviceOrderStatus) => (
                      <option key={serviceOrderStatus} value={serviceOrderStatus}>
                        {getServiceOrderStatusLabel(serviceOrderStatus)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div>
              <h4 className={subTitleClass}>Dados do veículo</h4>

              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
                <div className="lg:col-span-2">
                  <label className={labelClass}>Veículo vinculado</label>
                  <select
                    className={inputClass}
                    value={selectedVehicleId}
                    onChange={(event) => handleSelectVehicle(event.target.value)}
                    disabled={!selectedCliente}
                  >
                    <option value="">
                      {selectedCliente
                        ? "Sem vínculo"
                        : "Selecione um cliente primeiro"}
                    </option>
                    {selectedCliente?.veiculos.map((veiculo) => (
                      <option key={veiculo.id} value={veiculo.id}>
                        {[veiculo.marca, veiculo.modelo, veiculo.ano]
                          .filter(Boolean)
                          .join(" ") || "Veículo sem identificação"}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Marca</label>
                  <input
                    className={inputClass}
                    list="vehicle-brands"
                    placeholder="Honda"
                    value={vehicleBrand}
                    onChange={(event) => setVehicleBrand(event.target.value)}
                  />
                  <datalist id="vehicle-brands">
                    {vehicleBrands.map((brand) => (
                      <option key={brand} value={brand} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className={labelClass}>Modelo</label>
                  <input
                    className={inputClass}
                    list="vehicle-models"
                    placeholder="Civic"
                    value={vehicleModel}
                    onChange={(event) => setVehicleModel(event.target.value)}
                  />
                  <datalist id="vehicle-models">
                    {modelSuggestions.map((model) => (
                      <option key={model} value={model} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className={labelClass}>Ano</label>
                  <input
                    className={inputClass}
                    placeholder="2018"
                    value={vehicleYear}
                    onChange={(event) => setVehicleYear(event.target.value)}
                  />
                </div>

                <div>
                  <label className={labelClass}>Placa</label>
                  <input
                    className={inputClass}
                    placeholder="ABC1D23"
                    value={vehiclePlate}
                    onChange={(event) => setVehiclePlate(event.target.value)}
                  />
                </div>

                <div>
                  <label className={labelClass}>Motor</label>
                  <input
                    className={inputClass}
                    placeholder="2.0"
                    value={vehicleMotor}
                    onChange={(event) => setVehicleMotor(event.target.value)}
                  />
                </div>

                <div>
                  <label className={labelClass}>Combustível</label>
                  <select
                    className={inputClass}
                    value={vehicleFuel}
                    onChange={(event) => setVehicleFuel(event.target.value)}
                  >
                    <option value="" disabled>
                      Selecione
                    </option>
                    <option>Flex</option>
                    <option>Gasolina</option>
                    <option>Etanol</option>
                    <option>Diesel</option>
                    <option>Elétrico</option>
                    <option>Híbrido</option>
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Chassi/VIN opcional</label>
                  <input
                    className={inputClass}
                    placeholder="Identificação"
                    value={vehicleVin}
                    onChange={(event) => setVehicleVin(event.target.value)}
                  />
                </div>

                <div>
                  <label className={labelClass}>Km atual</label>
                  <input
                    className={inputClass}
                    inputMode="numeric"
                    placeholder="000.000"
                    value={vehicleKm}
                    onChange={(event) => setVehicleKm(event.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={sectionClass}>
          <span className="text-sm font-semibold uppercase text-sky-400">
            Etapa 2
          </span>
          <h3 className="mt-1 text-2xl font-bold">
            Problema relatado pelo cliente
          </h3>

          <label className={`${labelClass} mt-5`}>
            O que o cliente percebeu?
          </label>
          <textarea
            rows={4}
            className={inputClass}
            placeholder="Ex: barulho ao frear, luz acesa no painel, perda de potência."
            value={problemReport}
            onChange={(event) => setProblemReport(event.target.value)}
          />
        </section>

        <section className={sectionClass}>
          <span className="text-sm font-semibold uppercase text-sky-400">
            Etapa 3
          </span>
          <h3 className="mt-1 text-2xl font-bold">Diagnóstico da oficina</h3>

          <div className="mt-5 grid gap-5 lg:grid-cols-3">
            <div>
              <label className={labelClass}>Defeito encontrado</label>
              <textarea
                rows={4}
                className={inputClass}
                placeholder="Ex: pastilhas gastas e disco riscado."
                value={defectFound}
                onChange={(event) => setDefectFound(event.target.value)}
              />
            </div>

            <div>
              <label className={labelClass}>Causa provável</label>
              <textarea
                rows={4}
                className={inputClass}
                placeholder="Ex: desgaste natural por uso."
                value={probableCause}
                onChange={(event) => setProbableCause(event.target.value)}
              />
            </div>

            <div>
              <label className={labelClass}>Solução recomendada</label>
              <textarea
                rows={4}
                className={inputClass}
                placeholder="Ex: trocar pastilhas e revisar fluido."
                value={recommendedSolution}
                onChange={(event) => setRecommendedSolution(event.target.value)}
              />
            </div>
          </div>
        </section>

        <section className={sectionClass}>
          <span className="text-sm font-semibold uppercase text-sky-400">
            Etapa 4
          </span>
          <h3 className="mt-1 text-2xl font-bold">Checklist inicial</h3>

          <div className="mt-5 grid gap-0">
            {checklistItems.map((item) => (
              <div
                key={item}
                className="grid gap-3 border-t border-slate-800 py-4 text-sm text-slate-200 md:grid-cols-[minmax(110px,1fr)_180px_minmax(180px,1.5fr)] md:items-center"
              >
                <span className="font-medium">{item}</span>

                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`detail-checklist-${item}`}
                      value="OK"
                      checked={checklistState[item]?.status === "OK"}
                      onChange={() => updateChecklistStatus(item, "OK")}
                      className="h-4 w-4 border-slate-600 bg-slate-900 accent-sky-500"
                    />
                    OK
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`detail-checklist-${item}`}
                      value="Trocar"
                      checked={checklistState[item]?.status === "Trocar"}
                      onChange={() => updateChecklistStatus(item, "Trocar")}
                      className="h-4 w-4 border-slate-600 bg-slate-900 accent-sky-500"
                    />
                    Trocar
                  </label>
                </div>

                <input
                  className={compactInputClass}
                  placeholder="Observação técnica"
                  value={checklistState[item]?.observacaoTecnica ?? ""}
                  onChange={(event) =>
                    updateChecklistObservation(item, event.target.value)
                  }
                />
              </div>
            ))}
          </div>
        </section>

        <ServiceOrderPhotosSection
          photos={photos}
          onChange={setPhotos}
          sectionClass={sectionClass}
          labelClass={labelClass}
          inputClass={inputClass}
        />

        <section className={sectionClass}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-sm font-semibold uppercase text-sky-400">
                Etapa 5
              </span>
              <h3 className="mt-1 text-2xl font-bold">Peças necessárias</h3>
            </div>

            <button
              type="button"
              onClick={addPartLine}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
            >
              Adicionar peça
            </button>
          </div>

          <div className="grid gap-0">
            {partLines.map((line, index) => {
              const lineTotal = toNumber(line.quantity) * toNumber(line.unitValue);

              return (
                <div
                  key={line.id}
                  className="grid gap-3 border-t border-slate-800 py-4 md:grid-cols-[minmax(160px,2fr)_100px_130px_130px]"
                >
                  <div>
                    <label className={labelClass}>Peça {index + 1}</label>
                    <input
                      className={compactInputClass}
                      placeholder="Pastilha de freio"
                      value={line.name}
                      onChange={(event) =>
                        updatePartLine(line.id, "name", event.target.value)
                      }
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Quantidade</label>
                    <input
                      type="number"
                      min="0"
                      className={compactInputClass}
                      value={line.quantity}
                      onChange={(event) =>
                        updatePartLine(line.id, "quantity", event.target.value)
                      }
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Valor unitário</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className={compactInputClass}
                      placeholder="0,00"
                      value={line.unitValue}
                      onChange={(event) =>
                        updatePartLine(line.id, "unitValue", event.target.value)
                      }
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Valor total</label>
                    <div className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm font-semibold text-slate-100">
                      {formatCurrency(lineTotal)}
                    </div>
                  </div>
                  <div className="md:col-span-4">
                    <button
                      type="button"
                      onClick={() => removePartLine(line.id)}
                      className="rounded-lg border border-red-400/40 px-3 py-2 text-xs font-semibold text-red-200 hover:bg-red-500/10"
                    >
                      Remover peça
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={addPartLine}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
            >
              Adicionar peça
            </button>
          </div>
        </section>

        <section className={sectionClass}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-sm font-semibold uppercase text-sky-400">
                Etapa 6
              </span>
              <h3 className="mt-1 text-2xl font-bold">
                Serviços / mão de obra
              </h3>
            </div>

            <button
              type="button"
              onClick={addLaborLine}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
            >
              Adicionar outro serviço
            </button>
          </div>

          <div className="grid gap-0">
            {laborLines.map((line) => (
              <div
                key={line.id}
                className="grid gap-3 border-t border-slate-800 py-4 md:grid-cols-[minmax(150px,1.2fr)_minmax(180px,2fr)_130px]"
              >
                <div>
                  <label className={labelClass}>Serviço</label>
                  <input
                    className={compactInputClass}
                    placeholder="Troca de pastilhas"
                    value={line.service}
                    onChange={(event) =>
                      updateLaborLine(line.id, "service", event.target.value)
                    }
                  />
                </div>

                <div>
                  <label className={labelClass}>Observação</label>
                  <input
                    className={compactInputClass}
                    placeholder="Remover rodas, substituir e testar"
                    value={line.description}
                    onChange={(event) =>
                      updateLaborLine(line.id, "description", event.target.value)
                    }
                  />
                </div>

                <div>
                  <label className={labelClass}>Valor da mão de obra</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={compactInputClass}
                    placeholder="0,00"
                    value={line.value}
                    onChange={(event) =>
                      updateLaborLine(line.id, "value", event.target.value)
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={sectionClass}>
          <span className="text-sm font-semibold uppercase text-sky-400">
            Etapa 7
          </span>
          <h3 className="mt-1 text-2xl font-bold">Resumo do orçamento</h3>

          <div className="mt-5 grid gap-6 lg:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-slate-400">Total de peças</span>
                <strong>{formatCurrency(totals.partsTotal)}</strong>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-slate-400">
                  Total de mão de obra
                </span>
                <strong>{formatCurrency(totals.laborTotal)}</strong>
              </div>

              <div className="flex items-center justify-between gap-4 border-t border-slate-800 pt-3">
                <span className="text-sm text-slate-400">Desconto aplicado</span>
                <strong>{formatCurrency(totals.discountAmount)}</strong>
              </div>

              <div className="flex items-center justify-between gap-4 border-t border-slate-800 pt-3">
                <span className="text-base font-semibold">Total final</span>
                <strong className="text-xl text-sky-300">
                  {formatCurrency(totals.finalTotal)}
                </strong>
              </div>
              <div className="flex items-center justify-between gap-4 border-t border-slate-800 pt-3">
                <span className="text-sm text-slate-400">Total geral</span>
                <strong>{formatCurrency(totals.partsTotal + totals.laborTotal)}</strong>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm">
                <p className="font-semibold text-slate-100">
                  Entrada/sinal: {formatCurrency(depositSummary.entradaCalculada)}
                </p>
                <p className="mt-1 text-slate-400">
                  Saldo restante: {formatCurrency(depositSummary.saldoRestante)}
                </p>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_130px]">
                <div>
                  <label className={labelClass}>Desconto</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={compactInputClass}
                    placeholder="0"
                    value={discountValue}
                    onChange={(event) => setDiscountValue(event.target.value)}
                  />
                </div>

                <div>
                  <label className={labelClass}>Tipo</label>
                  <select
                    className={compactInputClass}
                    value={discountType}
                    onChange={(event) =>
                      setDiscountType(
                        event.target.value === "percent" ? "percent" : "money",
                      )
                    }
                  >
                    <option value="money">R$</option>
                    <option value="percent">%</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={labelClass}>Forma de pagamento</label>
                <select
                  className={inputClass}
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                >
                  <option value="" disabled>
                    Selecione
                  </option>
                  <option>Pix</option>
                  <option>Dinheiro</option>
                  <option>Débito</option>
                  <option>Crédito</option>
                </select>
              </div>

              <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 p-4">
                <label className="flex items-center gap-3 text-sm font-semibold text-amber-100">
                  <input
                    type="checkbox"
                    checked={requiresDeposit}
                    onChange={(event) => {
                      setRequiresDeposit(event.target.checked);
                      setDepositStatus(event.target.checked ? "pendente" : "nao_exige");
                    }}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-900 accent-amber-500"
                  />
                  Exigir entrada/sinal para iniciar o serviço
                </label>

                {requiresDeposit && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div>
                      <label className={labelClass}>Tipo da entrada</label>
                      <select
                        className={compactInputClass}
                        value={depositType}
                        onChange={(event) =>
                          setDepositType(
                            event.target.value === "percentual"
                              ? "percentual"
                              : "valor",
                          )
                        }
                      >
                        <option value="valor">Valor fixo</option>
                        <option value="percentual">Percentual</option>
                      </select>
                    </div>

                    {depositType === "valor" ? (
                      <div>
                        <label className={labelClass}>Valor da entrada</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className={compactInputClass}
                          value={depositValue}
                          onChange={(event) => setDepositValue(event.target.value)}
                        />
                      </div>
                    ) : (
                      <div>
                        <label className={labelClass}>Percentual</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          className={compactInputClass}
                          value={depositPercent}
                          onChange={(event) =>
                            setDepositPercent(event.target.value)
                          }
                        />
                      </div>
                    )}

                    <div className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm">
                      <span className="text-xs uppercase text-slate-500">
                        Entrada / saldo
                      </span>
                      <p className="mt-1 font-semibold text-slate-100">
                        {formatCurrency(depositSummary.entradaCalculada)}
                      </p>
                      <p className="text-xs text-slate-400">
                        Saldo {formatCurrency(depositSummary.saldoRestante)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950 p-4">
            <h4 className="font-semibold text-slate-100">
              Formas de pagamento disponíveis
            </h4>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                <span className="text-xs uppercase text-slate-500">Pix</span>
                <p className="mt-1 font-semibold">
                  {formatCurrency(paymentOptions.pix.valorFinalPagamento)}
                </p>
                <p className="text-xs text-slate-500">
                  Desconto {formatCurrency(paymentOptions.pix.descontoAplicado)}
                </p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                <span className="text-xs uppercase text-slate-500">Dinheiro</span>
                <p className="mt-1 font-semibold">
                  {formatCurrency(paymentOptions.dinheiro.valorFinalPagamento)}
                </p>
                <p className="text-xs text-slate-500">
                  Desconto {formatCurrency(paymentOptions.dinheiro.descontoAplicado)}
                </p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                <span className="text-xs uppercase text-slate-500">Débito</span>
                <p className="mt-1 font-semibold">
                  {formatCurrency(paymentOptions.debito.valorFinalPagamento)}
                </p>
                <p className="text-xs text-slate-500">
                  Desconto {formatCurrency(paymentOptions.debito.descontoAplicado)}
                </p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                <span className="text-xs uppercase text-slate-500">Crédito</span>
                <p className="mt-1 font-semibold">
                  até {oficinaConfig.regrasPagamento.credito.maxParcelas}x
                </p>
                <p className="text-xs text-slate-500">
                  {oficinaConfig.regrasPagamento.credito.parcelasSemJuros}x sem juros
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className={sectionClass}>
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="text-sm font-semibold uppercase text-sky-400">
                Histórico
              </span>
              <h3 className="mt-1 text-2xl font-bold">Histórico da OS</h3>
              <p className="mt-2 text-sm text-slate-400">
                Eventos internos registrados em ordem cronológica reversa.
              </p>
            </div>
            <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
              {timeline.length} evento(s)
            </span>
          </div>

          <div className="space-y-3">
            {timeline.length ? (
              [...timeline]
                .sort(
                  (a, b) =>
                    new Date(b.dataHora).getTime() -
                    new Date(a.dataHora).getTime(),
                )
                .map((event) => (
                  <div
                    key={event.id}
                    className="rounded-xl border border-slate-800 bg-slate-950 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-100">
                          {event.titulo}
                        </p>
                        <p className="mt-1 text-sm text-slate-400">
                          {event.descricao}
                        </p>
                      </div>
                      <span className="text-xs text-slate-500">
                        {formatDate(event.dataHora)}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
                      {event.statusAnterior && event.statusNovo && (
                        <span className="rounded-full border border-slate-700 px-2 py-1">
                          {getServiceOrderStatusLabel(event.statusAnterior)} →{" "}
                          {getServiceOrderStatusLabel(event.statusNovo)}
                        </span>
                      )}
                      <span className="rounded-full border border-slate-700 px-2 py-1">
                        Responsável: {event.usuarioResponsavel}
                      </span>
                      <span className="rounded-full border border-slate-700 px-2 py-1">
                        Tipo: {event.tipo}
                      </span>
                    </div>
                  </div>
                ))
            ) : (
              <p className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-400">
                Nenhum evento registrado ainda.
              </p>
            )}
          </div>
        </section>

        <div className="sticky bottom-0 -mx-2 flex flex-wrap items-center justify-end gap-3 border-t border-slate-800 bg-slate-950/95 px-2 py-4 backdrop-blur">
          {saveMessage && (
            <span className="mr-auto text-sm font-medium text-emerald-400">
              {saveMessage}
            </span>
          )}

          <button
            type="button"
            onClick={handleOpenQuoteModal}
            className="rounded-xl bg-amber-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-amber-400"
          >
            Solicitar cotação
          </button>

          <button
            type="button"
            onClick={() => setShowBudgetActions((currentValue) => !currentValue)}
            className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-400"
          >
            Enviar orçamento
          </button>

          <button
            type="button"
            onClick={handleGenerateBudget}
            className="rounded-xl bg-violet-500 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-400"
          >
            Gerar orçamento
          </button>

          <button
            type="submit"
            className="rounded-xl bg-sky-500 px-6 py-3 font-semibold text-white hover:bg-sky-400"
          >
            Salvar alterações
          </button>
        </div>
      </form>
    </div>
  );
}
