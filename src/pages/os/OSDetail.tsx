import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getClientes, type Cliente } from "../clientes/clientesStorage";
import { vehicleBrands, vehicleModelsByBrand } from "../vehicleCatalog";
import {
  SERVICE_ORDER_STATUSES,
  getBudgetApprovalBadgeClass,
  getBudgetApprovalLabel,
  getServiceOrderStatusForBudgetDecision,
  getServiceOrderStatusBadgeClass,
  getStoredOrders,
  saveStoredOrders,
  type BudgetApprovalStatus,
  type ChecklistStatus,
  type ServiceOrder,
  type ServiceOrderStatus,
} from "./osStorage";
import { getCotacoes, saveCotacao, updateCotacao } from "../compras/comprasStorage";
import {
  getFornecedores,
  type Fornecedor,
} from "../fornecedores/fornecedoresStorage";
import { registrarSaidaEstoque } from "../estoque/estoqueStorage";
import { getConfiguracoesOficina } from "../configuracoes/configuracoesStorage";

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
};

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
  fotos: string[];
};

const initialQuoteFormState: QuoteFormState = {
  fornecedorId: "",
  peca: "",
  quantidade: "1",
  urgencia: "Normal",
  observacao: "",
  fotos: [],
};

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function formatPhone(value: string) {
  const digits = onlyDigits(value).slice(0, 11);

  if (digits.length <= 2) {
    return digits ? `(${digits}` : "";
  }

  if (digits.length <= 7) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatCpf(value: string) {
  const digits = onlyDigits(value).slice(0, 11);

  if (digits.length <= 3) {
    return digits;
  }

  if (digits.length <= 6) {
    return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  }

  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }

  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(
    6,
    9,
  )}-${digits.slice(9)}`;
}

function formatCnpj(value: string) {
  const digits = onlyDigits(value).slice(0, 14);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 5) {
    return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  }

  if (digits.length <= 8) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  }

  if (digits.length <= 12) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(
      5,
      8,
    )}/${digits.slice(8)}`;
  }

  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(
    5,
    8,
  )}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

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

function createBudgetLink(orderId: string) {
  if (typeof window === "undefined") {
    return `/orcamento/${orderId}`;
  }

  return `${window.location.origin}/orcamento/${orderId}`;
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
  }));
}

function registerStockExitForOrder(order: ServiceOrder) {
  if (order.status !== "Finalizado") {
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
  const storedOrders = useMemo(() => getStoredOrders(), []);
  const [clientes] = useState<Cliente[]>(() => getClientes());
  const [fornecedores] = useState<Fornecedor[]>(() => getFornecedores());
  const [oficinaConfig] = useState(() => getConfiguracoesOficina());
  const order = useMemo(
    () =>
      storedOrders.find(
        (storedOrder) => storedOrder.id === id || storedOrder.codigo === id,
      ),
    [id, storedOrders],
  );

  const [clientName, setClientName] = useState(
    order?.clienteDados.nome || order?.cliente || "",
  );
  const [clientPhone, setClientPhone] = useState(
    order?.clienteDados.telefone || order?.telefone || "",
  );
  const [clientCpf, setClientCpf] = useState(order?.clienteDados.cpf || "");
  const [clientCnpj, setClientCnpj] = useState(order?.clienteDados.cnpj || "");
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
    order?.status || "Em diagnóstico",
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

  const selectedCliente = useMemo(
    () => clientes.find((cliente) => cliente.id === selectedClienteId),
    [clientes, selectedClienteId],
  );
  const selectedFornecedor = useMemo(
    () =>
      fornecedores.find((fornecedor) => fornecedor.id === quoteForm.fornecedorId),
    [fornecedores, quoteForm.fornecedorId],
  );
  const modelSuggestions = vehicleModelsByBrand[vehicleBrand] ?? [];
  const budgetLink = order ? createBudgetLink(order.id) : "";
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
    setChecklistState((currentState) => ({
      ...currentState,
      [item]: {
        ...currentState[item],
        status: itemStatus,
      },
    }));
  }

  function updateChecklistObservation(item: string, observacaoTecnica: string) {
    setChecklistState((currentState) => ({
      ...currentState,
      [item]: {
        ...currentState[item],
        observacaoTecnica,
      },
    }));
  }

  function handleSelectCliente(clienteId: string) {
    const cliente = clientes.find((currentCliente) => currentCliente.id === clienteId);
    const documentDigits = onlyDigits(cliente?.documento || "");

    setSelectedClienteId(clienteId);
    setSelectedVehicleId("");
    setClientName(cliente?.nome || "");
    setClientPhone(cliente?.telefone || "");
    setClientEmail(cliente?.email || "");
    setClientCpf(documentDigits.length <= 11 ? cliente?.documento || "" : "");
    setClientCnpj(documentDigits.length > 11 ? cliente?.documento || "" : "");
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

  function handleStatusChange(nextStatus: ServiceOrderStatus) {
    setStatus(nextStatus);

    if (!order) {
      return;
    }

    const updatedOrders = getStoredOrders().map((storedOrder) =>
      storedOrder.id === order.id
        ? { ...storedOrder, status: nextStatus }
        : storedOrder,
    );
    saveStoredOrders(updatedOrders);
    const updatedOrder = updatedOrders.find(
      (storedOrder) => storedOrder.id === order.id,
    );

    if (updatedOrder) {
      registerStockExitForOrder(updatedOrder);
    }

    setSaveMessage("Status atualizado.");
  }

  function handleConfirmClientApproval() {
    if (!order || !isPreApproved) {
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

      return {
        ...updatedOrder,
        status: getServiceOrderStatusForBudgetDecision(
          updatedOrder,
          "confirmado_oficina",
        ),
      };
    });
    const updatedOrder = updatedOrders.find(
      (storedOrder) => storedOrder.id === order.id,
    );

    if (updatedOrder) {
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
        ? {
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
            status: "Liberado para execução" as const,
          }
        : storedOrder,
    );

    saveStoredOrders(updatedOrders);
    setDepositStatus("paga");
    setDepositPaymentDate(dataPagamentoEntrada);
    setDepositPaidValue(depositSummary.entradaCalculada);
    setStatus("Liberado para execução");
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
      setSaveMessage(`Link copiado: ${budgetLink}`);
    } catch {
      setSaveMessage(`Link do orçamento: ${budgetLink}`);
    }
  }

  function handleOpenBudgetWhatsapp() {
    if (!budgetWhatsappUrl) {
      setSaveMessage("Informe o telefone do cliente para abrir o WhatsApp.");
      return;
    }

    window.open(budgetWhatsappUrl, "_blank", "noopener,noreferrer");
    setSaveMessage("WhatsApp aberto com a mensagem do orçamento.");
  }

  function resetQuoteForm() {
    setQuoteForm(initialQuoteFormState);
  }

  function handleOpenQuoteModal() {
    if (!order) {
      return;
    }

    navigate(`/compras?osId=${order.id}`);
  }

  function handleSendQuote() {
    if (!order) {
      return;
    }

    if (!selectedFornecedor) {
      setSaveMessage("Selecione um fornecedor para enviar a cotação.");
      return;
    }

    if (!quoteForm.peca.trim()) {
      setSaveMessage("Informe a peça para solicitar cotação.");
      return;
    }

    const quantidade = Math.max(Number(quoteForm.quantidade || 1), 1);
    const vehicleInfo = {
      marca: vehicleBrand.trim(),
      modelo: vehicleModel.trim(),
      ano: vehicleYear.trim(),
      motor: vehicleMotor.trim(),
      placa: vehiclePlate.trim(),
    };
    const message = [
      `${oficinaConfig.nomeOficina} - solicitação de cotação`,
      "",
      `Veículo: ${[vehicleInfo.marca, vehicleInfo.modelo, vehicleInfo.ano]
        .filter(Boolean)
        .join(" ") || "não informado"}`,
      `Motor: ${vehicleInfo.motor || "não informado"}`,
      `Placa: ${vehicleInfo.placa || "não informada"}`,
      "",
      `Peça solicitada: ${quoteForm.peca.trim()}`,
      `Quantidade: ${quantidade}`,
      `Urgência: ${quoteForm.urgencia}`,
      quoteForm.observacao.trim()
        ? `Observação: ${quoteForm.observacao.trim()}`
        : "",
      quoteForm.fotos.length
        ? `Fotos anexadas na OS: ${quoteForm.fotos.join(", ")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");
    const whatsappUrl = createQuoteWhatsappUrl(selectedFornecedor, message);

    if (!whatsappUrl) {
      setSaveMessage("O fornecedor selecionado não possui WhatsApp válido.");
      return;
    }

    saveCotacao({
      osId: order.id,
      fornecedorId: selectedFornecedor.id,
      fornecedorNome: selectedFornecedor.nome,
      fornecedorWhatsapp: selectedFornecedor.whatsapp,
      peca: quoteForm.peca.trim(),
      quantidade,
      urgencia: quoteForm.urgencia,
      observacao: quoteForm.observacao.trim(),
      fotos: quoteForm.fotos,
      veiculo: vehicleInfo,
    });

    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    setSaveMessage(`Cotação enviada para ${selectedFornecedor.nome}.`);
    setIsQuoteModalOpen(false);
    resetQuoteForm();
  }

  function handleSaveChanges() {
    if (!order) {
      return;
    }

    const vehicleDescription = [vehicleBrand, vehicleModel, vehicleYear]
      .filter(Boolean)
      .join(" ");
    const checklistInicial = checklistItems.map((item) => ({
      item,
      status: checklistState[item]?.status ?? "",
      observacaoTecnica: checklistState[item]?.observacaoTecnica.trim() ?? "",
    }));
    const pecasNecessarias = partLines.map((line) => {
      const quantidade = toNumber(line.quantity);
      const valorUnitario = toNumber(line.unitValue);

      return {
        id: line.id,
        peca: line.name.trim(),
        quantidade,
        valorUnitario,
        valorTotal: quantidade * valorUnitario,
        compraId: line.compraId,
      };
    });
    const servicosMaoDeObra = laborLines.map((line) => ({
      id: line.id,
      servico: line.service.trim(),
      descricao: line.description.trim(),
      valor: toNumber(line.value),
    }));
    const updatedOrder: ServiceOrder = {
      ...order,
      id: order.id,
      codigo: order.codigo,
      cliente: clientName.trim() || "Cliente sem nome",
      telefone: clientPhone.trim(),
      veiculo: vehicleDescription || "Veículo não informado",
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
      clienteId: selectedClienteId,
      clienteNome: clientName.trim(),
      clienteTelefone: clientPhone.trim(),
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
        telefone: clientPhone.trim(),
        cpf: clientCpf.trim(),
        cnpj: clientCnpj.trim(),
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
      orcamento: {
        totalPecas: totals.partsTotal,
        totalMaoDeObra: totals.laborTotal,
        descontoValor: toNumber(discountValue),
        descontoTipo: discountType,
        descontoAplicado: totals.discountAmount,
        formaPagamento: paymentMethod,
        totalFinal: totals.finalTotal,
      },
    };

    const updatedOrders = getStoredOrders().map((storedOrder) =>
      storedOrder.id === order.id ? updatedOrder : storedOrder,
    );
    saveStoredOrders(updatedOrders);
    registerStockExitForOrder(updatedOrder);
    setSaveMessage("Alterações salvas.");
  }

  if (!order) {
    return (
      <div>
        <button
          onClick={() => navigate("/os")}
          className="mb-6 rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
        >
          Voltar para OS
        </button>

        <section className={sectionClass}>
          <h2 className="text-3xl font-bold">OS não encontrada</h2>
          <p className="mt-2 text-slate-400">
            Não existe ordem de serviço salva para o ID informado.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold">Detalhe da OS {order.id}</h2>
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

          <button
            type="button"
            onClick={() => navigate("/os")}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
          >
            Voltar
          </button>
        </div>
      </div>

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

              <div className="grid gap-5 md:grid-cols-[1fr_140px_180px]">
                <div>
                  <label className={labelClass}>Peça</label>
                  <input
                    className={inputClass}
                    placeholder="Pastilha, filtro, sensor..."
                    value={quoteForm.peca}
                    onChange={(event) =>
                      setQuoteForm((currentState) => ({
                        ...currentState,
                        peca: event.target.value,
                      }))
                    }
                  />
                </div>

                <div>
                  <label className={labelClass}>Quantidade</label>
                  <input
                    className={inputClass}
                    type="number"
                    min="1"
                    value={quoteForm.quantidade}
                    onChange={(event) =>
                      setQuoteForm((currentState) => ({
                        ...currentState,
                        quantidade: event.target.value,
                      }))
                    }
                  />
                </div>

                <div>
                  <label className={labelClass}>Urgência</label>
                  <select
                    className={inputClass}
                    value={quoteForm.urgencia}
                    onChange={(event) =>
                      setQuoteForm((currentState) => ({
                        ...currentState,
                        urgencia:
                          event.target.value === "Urgente" ? "Urgente" : "Normal",
                      }))
                    }
                  >
                    <option>Normal</option>
                    <option>Urgente</option>
                  </select>
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
                <input
                  type="file"
                  multiple
                  className="w-full rounded-lg border border-dashed border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-100"
                  onChange={(event) =>
                    setQuoteForm((currentState) => ({
                      ...currentState,
                      fotos: Array.from(event.target.files || []).map(
                        (file) => file.name,
                      ),
                    }))
                  }
                />
                <p className="mt-2 text-xs text-slate-500">
                  As fotos são usadas apenas como referência de nome nesta versão.
                </p>
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
                    onChange={(event) => setClientCpf(formatCpf(event.target.value))}
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
                      setClientCnpj(formatCnpj(event.target.value))
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
                      {status}
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
                      <option key={serviceOrderStatus}>{serviceOrderStatus}</option>
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
                </div>
              );
            })}
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
              Adicionar serviço
            </button>
          </div>

          <div className="grid gap-0">
            {laborLines.map((line, index) => (
              <div
                key={line.id}
                className="grid gap-3 border-t border-slate-800 py-4 md:grid-cols-[minmax(150px,1.2fr)_minmax(180px,2fr)_130px]"
              >
                <div>
                  <label className={labelClass}>Serviço {index + 1}</label>
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
                  <label className={labelClass}>Descrição</label>
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
                  <label className={labelClass}>Valor</label>
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
        </section>

        <div className="sticky bottom-0 -mx-2 flex flex-wrap items-center justify-end gap-3 border-t border-slate-800 bg-slate-950/95 px-2 py-4 backdrop-blur">
          {saveMessage && (
            <span className="mr-auto text-sm font-medium text-emerald-400">
              {saveMessage}
            </span>
          )}

          <button
            type="button"
            onClick={() => navigate("/os")}
            className="rounded-xl border border-slate-700 px-6 py-3 font-semibold text-slate-200 hover:bg-slate-800"
          >
            Voltar
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
