export type ChecklistStatus = "OK" | "Trocar" | "";

export const SERVICE_ORDER_STATUSES = [
  "Em diagnóstico",
  "Aguardando aprovação",
  "Pré-aprovado pelo cliente",
  "Aprovado confirmado",
  "Aguardando pagamento da entrada",
  "Liberado para execução",
  "Aguardando peça",
  "Aguardando aprovação parcial",
  "Aguardando revisão",
  "Em execução",
  "Finalizado",
  "Cancelado",
] as const;

export type ServiceOrderStatus = (typeof SERVICE_ORDER_STATUSES)[number];

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
};

export type ServiceOrderLabor = {
  id: number;
  servico: string;
  descricao: string;
  valor: number;
};

export type ServiceOrder = {
  id: string;
  codigo: string;
  criadoEm: string;
  cliente: string;
  telefone: string;
  veiculo: string;
  placa: string;
  servicoInicial: string;
  observacao: string;
  status: ServiceOrderStatus;
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
  cotacaoFornecedorEscolhido?: string;
  cotacaoPrecoFinalPeca?: number;
  cotacaoIdEscolhida?: string;
  orcamento: {
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

export function normalizeServiceOrderStatus(status = ""): ServiceOrderStatus {
  if (SERVICE_ORDER_STATUSES.includes(status as ServiceOrderStatus)) {
    return status as ServiceOrderStatus;
  }

  if (status === "Aprovada") {
    return "Em execução";
  }

  if (status === "Finalizada") {
    return "Finalizado";
  }

  if (status === "Cancelada") {
    return "Cancelado";
  }

  return "Em diagnóstico";
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
    "Em diagnóstico": "bg-sky-500/15 text-sky-200 ring-sky-400/30",
    "Aguardando aprovação": "bg-amber-500/15 text-amber-200 ring-amber-400/30",
    "Pré-aprovado pelo cliente":
      "bg-yellow-500/15 text-yellow-200 ring-yellow-400/30",
    "Aprovado confirmado":
      "bg-emerald-500/15 text-emerald-200 ring-emerald-400/30",
    "Aguardando pagamento da entrada":
      "bg-amber-500/15 text-amber-200 ring-amber-400/30",
    "Liberado para execução":
      "bg-green-500/15 text-green-200 ring-green-400/30",
    "Aguardando peça": "bg-orange-500/15 text-orange-200 ring-orange-400/30",
    "Aguardando aprovação parcial":
      "bg-yellow-500/15 text-yellow-200 ring-yellow-400/30",
    "Aguardando revisão": "bg-cyan-500/15 text-cyan-200 ring-cyan-400/30",
    "Em execução": "bg-violet-500/15 text-violet-200 ring-violet-400/30",
    Finalizado: "bg-emerald-500/15 text-emerald-200 ring-emerald-400/30",
    Cancelado: "bg-red-500/15 text-red-200 ring-red-400/30",
  };

  return `inline-flex rounded-full px-2 py-1 text-xs font-medium ring-1 ${classes[status]}`;
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
    return "Pré-aprovado pelo cliente";
  }

  if (approvalStatus === "pre_aprovado_parcial") {
    return "Pré-aprovado pelo cliente";
  }

  if (approvalStatus === "confirmado_oficina") {
    if (order.exigeEntrada && order.statusEntrada !== "paga") {
      return "Aguardando pagamento da entrada";
    }

    return "Aprovado confirmado";
  }

  if (approvalStatus === "recusado") {
    return "Cancelado";
  }

  if (approvalStatus === "revisao") {
    return "Aguardando revisão";
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
    status: "Em diagnóstico",
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
    status: "Aguardando aprovação",
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
  const codigo = order.codigo || order.id;
  const id = /^OS-\d+$/.test(order.id) ? order.id : codigo;

  return {
    ...order,
    id,
    codigo,
    status: normalizeServiceOrderStatus(order.status),
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
    criadoEm: order.criadoEm || new Date().toISOString(),
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

export function getStoredOrders() {
  const storedOrders = localStorage.getItem(STORAGE_KEY);

  if (!storedOrders) {
    return exampleOrders.map(normalizeOrder);
  }

  try {
    const parsedOrders = JSON.parse(storedOrders) as ServiceOrder[];
    return Array.isArray(parsedOrders)
      ? parsedOrders.map(normalizeOrder)
      : exampleOrders.map(normalizeOrder);
  } catch {
    return exampleOrders.map(normalizeOrder);
  }
}

export function saveStoredOrders(orders: ServiceOrder[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
}

export function createNextOrderCode(orders: ServiceOrder[]) {
  const lastNumber = orders.reduce((max, order) => {
    const match = (order.codigo || order.id).match(/^OS-(\d+)$/);
    const orderNumber = match ? Number(match[1]) : 0;
    return Math.max(max, orderNumber);
  }, 0);

  return `OS-${String(lastNumber + 1).padStart(3, "0")}`;
}
