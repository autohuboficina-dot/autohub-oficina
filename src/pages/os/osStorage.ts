import { createSecureId } from "../../utils/ids";

export type ChecklistStatus = "OK" | "Trocar" | "";

export const SERVICE_ORDER_STATUSES = [
  "ABERTA",
  "EM_DIAGNOSTICO",
  "AGUARDANDO_COTACAO",
  "COTACAO_RECEBIDA",
  "ORCAMENTO_ENVIADO",
  "AGUARDANDO_APROVACAO",
  "APROVADA",
  "APROVADA_PARCIAL",
  "AGUARDANDO_PECA",
  "EM_EXECUCAO",
  "FINALIZADA",
  "ENTREGUE",
  "CANCELADA",
] as const;

export type ServiceOrderStatus = (typeof SERVICE_ORDER_STATUSES)[number];

export type ServiceOrderTimelineEvent = {
  id: string;
  dataHora: string;
  tipo: string;
  titulo: string;
  descricao: string;
  usuarioResponsavel: string;
  statusAnterior: ServiceOrderStatus | "";
  statusNovo: ServiceOrderStatus | "";
};

export const BUDGET_APPROVAL_STATUSES = [
  "pendente",
  "pre_aprovado",
  "pre_aprovado_parcial",
  "confirmado_oficina",
  "recusado",
  "revisao",
] as const;

export type BudgetApprovalStatus = (typeof BUDGET_APPROVAL_STATUSES)[number];

export type ServiceOrderChecklistItem = {
  item: string;
  status: ChecklistStatus;
  observacaoTecnica: string;
};

export type ServiceOrderPart = {
  id: number;
  peca: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  compraId?: string;
  origemChecklist?: string;
  cotacaoPecaId?: string;
  cotacaoFornecedorEscolhido?: string;
  cotacaoPrecoEscolhido?: number;
  cotacaoMarcaEscolhida?: string;
  cotacaoObservacaoEscolhida?: string;
  cotacaoDataEscolha?: string;
};

export type ServiceOrderLabor = {
  id: number;
  servico: string;
  descricao: string;
  valor: number;
};

export const SERVICE_ORDER_PHOTO_TYPES = [
  "problema",
  "peça",
  "técnico",
  "antes",
  "depois",
] as const;

export const SERVICE_ORDER_PHOTO_VISIBILITIES = [
  "Cliente",
  "Fornecedor",
  "Ambos",
  "Interno",
] as const;

export type ServiceOrderPhotoType = (typeof SERVICE_ORDER_PHOTO_TYPES)[number];
export type ServiceOrderPhotoVisibility =
  (typeof SERVICE_ORDER_PHOTO_VISIBILITIES)[number];

export type ServiceOrderPhoto = {
  id: string;
  titulo: string;
  tipo: ServiceOrderPhotoType;
  visibilidade: ServiceOrderPhotoVisibility;
  dataUrl: string;
  criadoEm: string;
};

export type ServiceOrder = {
  id: string;
  codigo: string;
  criadoEm: string;
  updatedAt: string;
  version: number;
  cliente: string;
  telefone: string;
  veiculo: string;
  placa: string;
  servicoInicial: string;
  observacao: string;
  status: ServiceOrderStatus;
  timeline: ServiceOrderTimelineEvent[];
  statusAprovacao: BudgetApprovalStatus;
  itensAprovados: string[];
  dataDecisaoAprovacao: string;
  dataPreAprovacao: string;
  dataConfirmacaoOficina: string;
  confirmacaoOficina: boolean;
  decisaoCliente: string;
  observacaoAprovacao: string;
  exigeEntrada: boolean;
  tipoEntrada: "valor" | "percentual";
  valorEntrada: number;
  percentualEntrada: number;
  entradaCalculada: number;
  saldoRestante: number;
  statusEntrada: "nao_exige" | "pendente" | "paga";
  dataPagamentoEntrada: string;
  valorEntradaPago: number;
  formaPagamentoEscolhida: "Pix" | "Dinheiro" | "Débito" | "Crédito" | "";
  parcelasEscolhidas: number;
  valorFinalPagamento: number;
  descontoAplicado: number;
  taxaAplicada: number;
  descontoPagamentoAplicado: number;
  taxaPagamentoAplicada: number;
  clienteId: string;
  clienteNome: string;
  clienteTelefone: string;
  veiculoId: string;
  veiculoMarca: string;
  veiculoModelo: string;
  veiculoAno: string;
  veiculoMotor: string;
  veiculoCombustivel: string;
  veiculoPlaca: string;
  veiculoChassi: string;
  clienteDados: {
    nome: string;
    telefone: string;
    cpf: string;
    cnpj: string;
    email: string;
  };
  veiculoDados: {
    marca: string;
    modelo: string;
    ano: string;
    placa: string;
    motor: string;
    combustivel: string;
    chassiVin: string;
    kmAtual: string;
  };
  problemaRelatado: string;
  diagnostico: {
    defeitoEncontrado: string;
    causaProvavel: string;
    solucaoRecomendada: string;
  };
  checklistInicial: ServiceOrderChecklistItem[];
  pecasNecessarias: ServiceOrderPart[];
  servicosMaoDeObra: ServiceOrderLabor[];
  fotosOs: ServiceOrderPhoto[];
  cotacaoFornecedorEscolhido?: string;
  cotacaoPrecoFinalPeca?: number;
  cotacaoIdEscolhida?: string;
  orcamento: {
    publicToken?: string;
    totalPecas: number;
    totalMaoDeObra: number;
    descontoValor: number;
    descontoTipo: "money" | "percent";
    descontoAplicado: number;
    formaPagamento: string;
    totalFinal: number;
  };
};

const STORAGE_KEY = "autohub:service-orders";
let lastStorageError = "";

export function getServiceOrderStorageError() {
  return lastStorageError;
}

export function clearServiceOrderStorageError() {
  lastStorageError = "";
}

export function createServiceOrderId() {
  return createSecureId("OS");
}

export function normalizeServiceOrderStatus(status = ""): ServiceOrderStatus {
  if (SERVICE_ORDER_STATUSES.includes(status as ServiceOrderStatus)) {
    return status as ServiceOrderStatus;
  }

  const legacyStatusMap: Record<string, ServiceOrderStatus> = {
    "Em diagnóstico": "EM_DIAGNOSTICO",
    "Aguardando aprovação": "AGUARDANDO_APROVACAO",
    "Pré-aprovado pelo cliente": "APROVADA",
    "Aprovado confirmado": "APROVADA",
    "Aguardando pagamento da entrada": "APROVADA",
    "Liberado para execução": "APROVADA",
    "Aguardando peça": "AGUARDANDO_PECA",
    "Aguardando aprovação parcial": "APROVADA_PARCIAL",
    "Aguardando revisão": "AGUARDANDO_APROVACAO",
    "Em execução": "EM_EXECUCAO",
    Finalizado: "FINALIZADA",
    Finalizada: "FINALIZADA",
    Entregue: "ENTREGUE",
    Cancelado: "CANCELADA",
    Cancelada: "CANCELADA",
    Aprovada: "APROVADA",
  };

  return legacyStatusMap[status] || "ABERTA";
}

export function getServiceOrderStatusLabel(status: ServiceOrderStatus) {
  const labels: Record<ServiceOrderStatus, string> = {
    ABERTA: "Aberta",
    EM_DIAGNOSTICO: "Em diagnóstico",
    AGUARDANDO_COTACAO: "Aguardando cotação",
    COTACAO_RECEBIDA: "Cotação recebida",
    ORCAMENTO_ENVIADO: "Orçamento enviado",
    AGUARDANDO_APROVACAO: "Aguardando aprovação",
    APROVADA: "Aprovada",
    APROVADA_PARCIAL: "Aprovada parcial",
    AGUARDANDO_PECA: "Aguardando peça",
    EM_EXECUCAO: "Em execução",
    FINALIZADA: "Finalizada",
    ENTREGUE: "Entregue",
    CANCELADA: "Cancelada",
  };

  return labels[status];
}

export function isServiceOrderBudgetLocked(status: ServiceOrderStatus) {
  const lockedStatuses: ServiceOrderStatus[] = [
    "ORCAMENTO_ENVIADO",
    "AGUARDANDO_APROVACAO",
    "APROVADA",
    "APROVADA_PARCIAL",
    "AGUARDANDO_PECA",
    "EM_EXECUCAO",
    "FINALIZADA",
    "ENTREGUE",
    "CANCELADA",
  ];

  return lockedStatuses.includes(status);
}

export function normalizeBudgetApprovalStatus(
  status = "pendente",
): BudgetApprovalStatus {
  if (BUDGET_APPROVAL_STATUSES.includes(status as BudgetApprovalStatus)) {
    return status as BudgetApprovalStatus;
  }

  if (status === "aprovado") {
    return "pre_aprovado";
  }

  if (status === "parcial") {
    return "pre_aprovado_parcial";
  }

  return "pendente";
}

export function getServiceOrderStatusBadgeClass(status: ServiceOrderStatus) {
  const classes: Record<ServiceOrderStatus, string> = {
    ABERTA: "bg-slate-700/70 text-slate-200 ring-slate-500/30",
    EM_DIAGNOSTICO: "bg-sky-500/15 text-sky-200 ring-sky-400/30",
    AGUARDANDO_COTACAO: "bg-cyan-500/15 text-cyan-200 ring-cyan-400/30",
    COTACAO_RECEBIDA: "bg-violet-500/15 text-violet-200 ring-violet-400/30",
    ORCAMENTO_ENVIADO: "bg-blue-500/15 text-blue-200 ring-blue-400/30",
    AGUARDANDO_APROVACAO:
      "bg-amber-500/15 text-amber-200 ring-amber-400/30",
    APROVADA: "bg-emerald-500/15 text-emerald-200 ring-emerald-400/30",
    APROVADA_PARCIAL: "bg-yellow-500/15 text-yellow-200 ring-yellow-400/30",
    AGUARDANDO_PECA: "bg-orange-500/15 text-orange-200 ring-orange-400/30",
    EM_EXECUCAO: "bg-fuchsia-500/15 text-fuchsia-200 ring-fuchsia-400/30",
    FINALIZADA: "bg-green-500/15 text-green-200 ring-green-400/30",
    ENTREGUE: "bg-teal-500/15 text-teal-200 ring-teal-400/30",
    CANCELADA: "bg-red-500/15 text-red-200 ring-red-400/30",
  };

  return `inline-flex rounded-full px-2 py-1 text-xs font-medium ring-1 ${classes[status]}`;
}

export function createServiceOrderTimelineEvent({
  tipo,
  titulo,
  descricao,
  usuarioResponsavel = "Sistema",
  statusAnterior = "",
  statusNovo = "",
}: Omit<ServiceOrderTimelineEvent, "id" | "dataHora">): ServiceOrderTimelineEvent {
  return {
    id: createSecureId("evt"),
    dataHora: new Date().toISOString(),
    tipo,
    titulo,
    descricao,
    usuarioResponsavel,
    statusAnterior,
    statusNovo,
  };
}

export function appendServiceOrderTimelineEvent(
  order: ServiceOrder,
  event: Omit<ServiceOrderTimelineEvent, "id" | "dataHora">,
): ServiceOrder {
  return {
    ...order,
    updatedAt: new Date().toISOString(),
    version: Number(order.version || 0) + 1,
    timeline: [
      createServiceOrderTimelineEvent(event),
      ...(Array.isArray(order.timeline) ? order.timeline : []),
    ],
  };
}

export function updateServiceOrderStatusWithTimeline(
  order: ServiceOrder,
  nextStatus: ServiceOrderStatus,
  event: {
    tipo: string;
    titulo: string;
    descricao: string;
    usuarioResponsavel?: string;
  },
): ServiceOrder {
  const previousStatus = normalizeServiceOrderStatus(order.status);

  if (previousStatus === nextStatus) {
    return appendServiceOrderTimelineEvent(order, {
      ...event,
      usuarioResponsavel: event.usuarioResponsavel || "Sistema",
      statusAnterior: previousStatus,
      statusNovo: nextStatus,
    });
  }

  return appendServiceOrderTimelineEvent(
    {
      ...order,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
      version: Number(order.version || 0) + 1,
    },
    {
      ...event,
      usuarioResponsavel: event.usuarioResponsavel || "Sistema",
      statusAnterior: previousStatus,
      statusNovo: nextStatus,
    },
  );
}

export function getBudgetApprovalLabel(status: BudgetApprovalStatus) {
  const labels: Record<BudgetApprovalStatus, string> = {
    pendente: "Pendente",
    pre_aprovado: "Pré-aprovado pelo cliente",
    pre_aprovado_parcial: "Pré-aprovado parcial",
    confirmado_oficina: "Aprovação confirmada pela oficina",
    recusado: "Recusado",
    revisao: "Revisão solicitada",
  };

  return labels[status];
}

export function getBudgetApprovalBadgeClass(status: BudgetApprovalStatus) {
  const classes: Record<BudgetApprovalStatus, string> = {
    pendente: "bg-slate-700/70 text-slate-200 ring-slate-500/30",
    pre_aprovado: "bg-yellow-500/15 text-yellow-200 ring-yellow-400/30",
    pre_aprovado_parcial:
      "bg-amber-500/15 text-amber-200 ring-amber-400/30",
    confirmado_oficina:
      "bg-emerald-500/15 text-emerald-200 ring-emerald-400/30",
    recusado: "bg-red-500/15 text-red-200 ring-red-400/30",
    revisao: "bg-cyan-500/15 text-cyan-200 ring-cyan-400/30",
  };

  return `inline-flex rounded-full px-2 py-1 text-xs font-medium ring-1 ${classes[status]}`;
}

export function getServiceOrderStatusForBudgetDecision(
  order: ServiceOrder,
  approvalStatus: BudgetApprovalStatus,
): ServiceOrderStatus {
  if (approvalStatus === "pre_aprovado") {
    return "APROVADA";
  }

  if (approvalStatus === "pre_aprovado_parcial") {
    return "APROVADA_PARCIAL";
  }

  if (approvalStatus === "confirmado_oficina") {
    return order.pecasNecessarias.some((part) => part.compraId)
      ? "AGUARDANDO_PECA"
      : "APROVADA";
  }

  if (approvalStatus === "recusado") {
    return "CANCELADA";
  }

  if (approvalStatus === "revisao") {
    return "AGUARDANDO_APROVACAO";
  }

  return order.status;
}

export const exampleOrders: ServiceOrder[] = [
  {
    id: "OS-001",
    codigo: "OS-001",
    cliente: "Carlos Henrique",
    telefone: "(11) 99999-9999",
    veiculo: "Honda Civic 2018",
    placa: "ABC1D23",
    servicoInicial: "Cliente relatou barulho ao frear.",
    observacao: "Aguardando diagnóstico inicial.",
    status: "EM_DIAGNOSTICO",
    timeline: [
      {
        id: "evt-os-001-criada",
        dataHora: "2026-04-30T00:00:00.000Z",
        tipo: "criacao",
        titulo: "OS criada",
        descricao: "Ordem de serviço de exemplo criada.",
        usuarioResponsavel: "Sistema",
        statusAnterior: "",
        statusNovo: "EM_DIAGNOSTICO",
      },
    ],
    statusAprovacao: "pendente",
    itensAprovados: [],
    dataDecisaoAprovacao: "",
    dataPreAprovacao: "",
    dataConfirmacaoOficina: "",
    confirmacaoOficina: false,
    decisaoCliente: "",
    observacaoAprovacao: "",
    exigeEntrada: false,
    tipoEntrada: "valor",
    valorEntrada: 0,
    percentualEntrada: 0,
    entradaCalculada: 0,
    saldoRestante: 0,
    statusEntrada: "nao_exige",
    dataPagamentoEntrada: "",
    valorEntradaPago: 0,
    formaPagamentoEscolhida: "",
    parcelasEscolhidas: 1,
    valorFinalPagamento: 0,
    descontoAplicado: 0,
    taxaAplicada: 0,
    descontoPagamentoAplicado: 0,
    taxaPagamentoAplicada: 0,
    clienteId: "",
    clienteNome: "Carlos Henrique",
    clienteTelefone: "(11) 99999-9999",
    veiculoId: "",
    veiculoMarca: "Honda",
    veiculoModelo: "Civic",
    veiculoAno: "2018",
    veiculoMotor: "2.0",
    veiculoCombustivel: "Flex",
    veiculoPlaca: "ABC1D23",
    veiculoChassi: "",
    criadoEm: "2026-04-30T00:00:00.000Z",
    updatedAt: "2026-04-30T00:00:00.000Z",
    version: 1,
    clienteDados: {
      nome: "Carlos Henrique",
      telefone: "(11) 99999-9999",
      cpf: "",
      cnpj: "",
      email: "",
    },
    veiculoDados: {
      marca: "Honda",
      modelo: "Civic",
      ano: "2018",
      placa: "ABC1D23",
      motor: "2.0",
      combustivel: "Flex",
      chassiVin: "",
      kmAtual: "",
    },
    problemaRelatado: "Cliente relatou barulho ao frear.",
    diagnostico: {
      defeitoEncontrado: "",
      causaProvavel: "",
      solucaoRecomendada: "",
    },
    checklistInicial: [],
    pecasNecessarias: [],
    servicosMaoDeObra: [],
    fotosOs: [],
    cotacaoFornecedorEscolhido: "",
    cotacaoPrecoFinalPeca: 0,
    cotacaoIdEscolhida: "",
    orcamento: {
      totalPecas: 0,
      totalMaoDeObra: 0,
      descontoValor: 0,
      descontoTipo: "money",
      descontoAplicado: 0,
      formaPagamento: "",
      totalFinal: 0,
    },
  },
  {
    id: "OS-002",
    codigo: "OS-002",
    cliente: "Mariana Souza",
    telefone: "(21) 98888-7777",
    veiculo: "Fiat Argo 2021",
    placa: "XYZ4E56",
    servicoInicial: "Revisão preventiva e troca de óleo.",
    observacao: "Cliente pediu orçamento antes da execução.",
    status: "AGUARDANDO_APROVACAO",
    timeline: [
      {
        id: "evt-os-002-criada",
        dataHora: "2026-04-30T00:00:00.000Z",
        tipo: "criacao",
        titulo: "OS criada",
        descricao: "Ordem de serviço de exemplo criada.",
        usuarioResponsavel: "Sistema",
        statusAnterior: "",
        statusNovo: "AGUARDANDO_APROVACAO",
      },
    ],
    statusAprovacao: "pendente",
    itensAprovados: [],
    dataDecisaoAprovacao: "",
    dataPreAprovacao: "",
    dataConfirmacaoOficina: "",
    confirmacaoOficina: false,
    decisaoCliente: "",
    observacaoAprovacao: "",
    exigeEntrada: false,
    tipoEntrada: "valor",
    valorEntrada: 0,
    percentualEntrada: 0,
    entradaCalculada: 0,
    saldoRestante: 0,
    statusEntrada: "nao_exige",
    dataPagamentoEntrada: "",
    valorEntradaPago: 0,
    formaPagamentoEscolhida: "",
    parcelasEscolhidas: 1,
    valorFinalPagamento: 0,
    descontoAplicado: 0,
    taxaAplicada: 0,
    descontoPagamentoAplicado: 0,
    taxaPagamentoAplicada: 0,
    clienteId: "",
    clienteNome: "Mariana Souza",
    clienteTelefone: "(21) 98888-7777",
    veiculoId: "",
    veiculoMarca: "Fiat",
    veiculoModelo: "Argo",
    veiculoAno: "2021",
    veiculoMotor: "1.3",
    veiculoCombustivel: "Flex",
    veiculoPlaca: "XYZ4E56",
    veiculoChassi: "",
    criadoEm: "2026-04-30T00:00:00.000Z",
    updatedAt: "2026-04-30T00:00:00.000Z",
    version: 1,
    clienteDados: {
      nome: "Mariana Souza",
      telefone: "(21) 98888-7777",
      cpf: "",
      cnpj: "",
      email: "",
    },
    veiculoDados: {
      marca: "Fiat",
      modelo: "Argo",
      ano: "2021",
      placa: "XYZ4E56",
      motor: "1.3",
      combustivel: "Flex",
      chassiVin: "",
      kmAtual: "",
    },
    problemaRelatado: "Revisão preventiva e troca de óleo.",
    diagnostico: {
      defeitoEncontrado: "",
      causaProvavel: "",
      solucaoRecomendada: "",
    },
    checklistInicial: [],
    pecasNecessarias: [],
    servicosMaoDeObra: [],
    fotosOs: [],
    cotacaoFornecedorEscolhido: "",
    cotacaoPrecoFinalPeca: 0,
    cotacaoIdEscolhida: "",
    orcamento: {
      totalPecas: 0,
      totalMaoDeObra: 0,
      descontoValor: 0,
      descontoTipo: "money",
      descontoAplicado: 0,
      formaPagamento: "",
      totalFinal: 0,
    },
  },
];

function normalizeOrder(order: ServiceOrder): ServiceOrder {
  const codigo = order.codigo || (/^OS-\d+$/.test(order.id) ? order.id : "");
  const id = order.id || createServiceOrderId();
  const legacyPhotoSources = order as ServiceOrder & {
    fotos?: string[];
    fotosOrcamento?: string[];
    fotosVeiculo?: string[];
  };
  const legacyPhotos = [
    ...(legacyPhotoSources.fotos || []),
    ...(legacyPhotoSources.fotosOrcamento || []),
    ...(legacyPhotoSources.fotosVeiculo || []),
  ];
  const fotosOs = Array.isArray(order.fotosOs)
    ? order.fotosOs.map((photo, index) => normalizeServiceOrderPhoto(photo, index))
    : legacyPhotos.map((photo, index) =>
        normalizeServiceOrderPhoto(photo, index),
      );
  const normalizedStatus = normalizeServiceOrderStatus(order.status);
  const timeline: ServiceOrderTimelineEvent[] = Array.isArray(order.timeline)
    ? order.timeline.map((event, index) => ({
        id: event.id || `evt-legado-${id}-${index}`,
        dataHora: event.dataHora || order.criadoEm || new Date().toISOString(),
        tipo: event.tipo || "historico",
        titulo: event.titulo || "Evento da OS",
        descricao: event.descricao || "",
        usuarioResponsavel: event.usuarioResponsavel || "Sistema",
        statusAnterior: event.statusAnterior
          ? normalizeServiceOrderStatus(event.statusAnterior)
          : "",
        statusNovo: event.statusNovo
          ? normalizeServiceOrderStatus(event.statusNovo)
          : "",
      }))
    : [
        {
          id: `evt-normalizado-${id}`,
          dataHora: order.criadoEm || new Date().toISOString(),
          tipo: "criacao",
          titulo: "OS criada",
          descricao: "Evento inicial gerado a partir dos dados salvos.",
          usuarioResponsavel: "Sistema",
          statusAnterior: "",
          statusNovo: normalizedStatus,
        },
      ];

  return {
    ...order,
    id,
    codigo,
    status: normalizedStatus,
    timeline,
    statusAprovacao: normalizeBudgetApprovalStatus(order.statusAprovacao),
    itensAprovados: Array.isArray(order.itensAprovados)
      ? order.itensAprovados
      : [],
    dataDecisaoAprovacao: order.dataDecisaoAprovacao ?? "",
    dataPreAprovacao:
      order.dataPreAprovacao ?? order.dataDecisaoAprovacao ?? "",
    dataConfirmacaoOficina: order.dataConfirmacaoOficina ?? "",
    confirmacaoOficina: Boolean(order.confirmacaoOficina),
    decisaoCliente: order.decisaoCliente ?? order.statusAprovacao ?? "",
    observacaoAprovacao: order.observacaoAprovacao ?? "",
    exigeEntrada: Boolean(order.exigeEntrada),
    tipoEntrada: order.tipoEntrada === "percentual" ? "percentual" : "valor",
    valorEntrada: Number(order.valorEntrada || 0),
    percentualEntrada: Number(order.percentualEntrada || 0),
    entradaCalculada: Number(order.entradaCalculada || 0),
    saldoRestante: Number(order.saldoRestante || 0),
    statusEntrada: order.exigeEntrada
      ? order.statusEntrada === "paga"
        ? "paga"
        : "pendente"
      : "nao_exige",
    dataPagamentoEntrada: order.dataPagamentoEntrada ?? "",
    valorEntradaPago: Number(order.valorEntradaPago || 0),
    formaPagamentoEscolhida:
      order.formaPagamentoEscolhida === "Pix" ||
      order.formaPagamentoEscolhida === "Dinheiro" ||
      order.formaPagamentoEscolhida === "Débito" ||
      order.formaPagamentoEscolhida === "Crédito"
        ? order.formaPagamentoEscolhida
        : "",
    parcelasEscolhidas: Math.max(Number(order.parcelasEscolhidas || 1), 1),
    valorFinalPagamento: Number(order.valorFinalPagamento || 0),
    descontoAplicado: Number(
      order.descontoAplicado || order.descontoPagamentoAplicado || 0,
    ),
    taxaAplicada: Number(order.taxaAplicada || order.taxaPagamentoAplicada || 0),
    descontoPagamentoAplicado: Number(
      order.descontoPagamentoAplicado || order.descontoAplicado || 0,
    ),
    taxaPagamentoAplicada: Number(
      order.taxaPagamentoAplicada || order.taxaAplicada || 0,
    ),
    criadoEm: order.criadoEm || new Date().toISOString(),
    updatedAt: order.updatedAt || order.criadoEm || new Date().toISOString(),
    version: Math.max(Number(order.version || 1), 1),
    clienteId: order.clienteId ?? "",
    clienteNome: order.clienteNome ?? order.clienteDados?.nome ?? order.cliente,
    clienteTelefone:
      order.clienteTelefone ?? order.clienteDados?.telefone ?? order.telefone,
    veiculoId: order.veiculoId ?? "",
    veiculoMarca: order.veiculoMarca ?? order.veiculoDados?.marca ?? "",
    veiculoModelo: order.veiculoModelo ?? order.veiculoDados?.modelo ?? order.veiculo,
    veiculoAno: order.veiculoAno ?? order.veiculoDados?.ano ?? "",
    veiculoMotor: order.veiculoMotor ?? order.veiculoDados?.motor ?? "",
    veiculoCombustivel:
      order.veiculoCombustivel ?? order.veiculoDados?.combustivel ?? "",
    veiculoPlaca: order.veiculoPlaca ?? order.veiculoDados?.placa ?? order.placa,
    veiculoChassi: order.veiculoChassi ?? order.veiculoDados?.chassiVin ?? "",
    clienteDados: order.clienteDados ?? {
      nome: order.cliente,
      telefone: order.telefone,
      cpf: "",
      cnpj: "",
      email: "",
    },
    veiculoDados: order.veiculoDados ?? {
      marca: "",
      modelo: order.veiculo,
      ano: "",
      placa: order.placa,
      motor: "",
      combustivel: "",
      chassiVin: "",
      kmAtual: "",
    },
    problemaRelatado: order.problemaRelatado ?? order.servicoInicial,
    diagnostico: order.diagnostico ?? {
      defeitoEncontrado: "",
      causaProvavel: "",
      solucaoRecomendada: "",
    },
    checklistInicial: order.checklistInicial ?? [],
    pecasNecessarias: order.pecasNecessarias ?? [],
    servicosMaoDeObra: order.servicosMaoDeObra ?? [],
    fotosOs,
    cotacaoFornecedorEscolhido: order.cotacaoFornecedorEscolhido ?? "",
    cotacaoPrecoFinalPeca: order.cotacaoPrecoFinalPeca ?? 0,
    cotacaoIdEscolhida: order.cotacaoIdEscolhida ?? "",
    orcamento: order.orcamento ?? {
      totalPecas: 0,
      totalMaoDeObra: 0,
      descontoValor: 0,
      descontoTipo: "money",
      descontoAplicado: 0,
      formaPagamento: "",
      totalFinal: 0,
    },
  };
}

function normalizeServiceOrderPhoto(
  photo: ServiceOrderPhoto | string,
  index: number,
): ServiceOrderPhoto {
  if (typeof photo === "string") {
    return {
      id: createSecureId("foto-legada"),
      titulo: `Foto ${index + 1}`,
      tipo: "técnico",
      visibilidade: "Ambos",
      dataUrl: photo,
      criadoEm: new Date().toISOString(),
    };
  }

  const tipo = SERVICE_ORDER_PHOTO_TYPES.includes(photo.tipo)
    ? photo.tipo
    : "técnico";
  const visibilidade = SERVICE_ORDER_PHOTO_VISIBILITIES.includes(
    photo.visibilidade,
  )
    ? photo.visibilidade
    : "Interno";

  return {
    id: photo.id || createSecureId("foto"),
    titulo: photo.titulo || `Foto ${index + 1}`,
    tipo,
    visibilidade,
    dataUrl: photo.dataUrl || "",
    criadoEm: photo.criadoEm || new Date().toISOString(),
  };
}

export function getStoredOrders() {
  lastStorageError = "";

  try {
    const storedOrders = localStorage.getItem(STORAGE_KEY) || "";

    if (!storedOrders) {
      return [];
    }

    const parsedOrders = JSON.parse(storedOrders) as ServiceOrder[];
    return Array.isArray(parsedOrders)
      ? parsedOrders.map(normalizeOrder)
      : [];
  } catch {
    lastStorageError =
      "Os dados de Ordens de Serviço salvos no navegador parecem corrompidos ou indisponíveis. Nenhum dado de exemplo foi carregado para evitar confusão.";
    return [];
  }
}

export function saveStoredOrders(orders: ServiceOrder[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
    lastStorageError = "";
  } catch {
    lastStorageError =
      "Não foi possível salvar as Ordens de Serviço. O armazenamento local pode estar cheio ou indisponível.";
    throw new Error(lastStorageError);
  }
}

export function createNextOrderCode(orders: ServiceOrder[]) {
  const lastNumber = orders.reduce((max, order) => {
    const match = (order.codigo || order.id).match(/^OS-(\d+)$/);
    const orderNumber = match ? Number(match[1]) : 0;
    return Math.max(max, orderNumber);
  }, 0);

  return `OS-${String(lastNumber + 1).padStart(3, "0")}`;
}
