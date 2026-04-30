export type ChecklistStatus = "OK" | "Trocar" | "";

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
  status: string;
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
    criadoEm: order.criadoEm || new Date().toISOString(),
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
