import {
  clearServiceOrderStorageError,
  createNextOrderCode,
  createServiceOrderId,
  getStoredOrders,
  saveStoredOrders,
  type ServiceOrder,
  type ServiceOrderLabor,
  type ServiceOrderPart,
  type ServiceOrderStatus,
} from "../pages/os/osStorage";
import { supabase } from "../lib/supabase";

type OrdemServicoSupabaseRow = {
  id: string;
  cliente_id: string;
  veiculo_id: string;
  codigo: string;
  version: number;
  status: ServiceOrderStatus;
  problema_relatado: string | null;
  observacao: string | null;
  diagnostico: {
    defeitoEncontrado?: string;
    causaProvavel?: string;
    solucaoRecomendada?: string;
  } | null;
  created_at: string;
  updated_at: string;
  clientes?: {
    nome: string | null;
    telefone: string | null;
    documento: string | null;
    email: string | null;
  } | null;
  veiculos?: {
    marca: string | null;
    modelo: string | null;
    ano: string | null;
    motor: string | null;
    combustivel: string | null;
    placa: string | null;
    chassi_vin: string | null;
  } | null;
};

type OsPecaSupabaseRow = {
  id: string;
  nome: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number | null;
  origem_checklist: string | null;
  observacao: string | null;
  created_at: string;
};

type OsServicoSupabaseRow = {
  id: string;
  servico: string;
  descricao: string | null;
  valor: number;
  created_at: string;
};

type OrcamentoTotais = {
  totalPecas: number;
  totalServicos: number;
  totalGeral: number;
};

type OrcamentoPublicTokenRow = {
  id: string;
  public_token: string;
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function logSupabaseFallback(scope: string, error: unknown) {
  console.error(`[Supabase:${scope}] Usando fallback localStorage.`, error);
}

function createEmptyOrderFromSupabase(row: OrdemServicoSupabaseRow): ServiceOrder {
  const clienteNome = row.clientes?.nome ?? "";
  const clienteTelefone = row.clientes?.telefone ?? "";
  const documento = row.clientes?.documento ?? "";
  const veiculo = row.veiculos;
  const veiculoDescricao = [veiculo?.marca, veiculo?.modelo, veiculo?.ano]
    .filter(Boolean)
    .join(" ");

  return {
    id: row.id,
    codigo: row.codigo,
    criadoEm: row.created_at,
    updatedAt: row.updated_at,
    version: row.version,
    cliente: clienteNome,
    telefone: clienteTelefone,
    veiculo: veiculoDescricao,
    placa: veiculo?.placa ?? "",
    servicoInicial: row.problema_relatado ?? "",
    observacao: row.observacao ?? "",
    status: row.status,
    timeline: [],
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
    clienteId: row.cliente_id,
    clienteNome,
    clienteTelefone,
    veiculoId: row.veiculo_id,
    veiculoMarca: veiculo?.marca ?? "",
    veiculoModelo: veiculo?.modelo ?? "",
    veiculoAno: veiculo?.ano ?? "",
    veiculoMotor: veiculo?.motor ?? "",
    veiculoCombustivel: veiculo?.combustivel ?? "",
    veiculoPlaca: veiculo?.placa ?? "",
    veiculoChassi: veiculo?.chassi_vin ?? "",
    clienteDados: {
      nome: clienteNome,
      telefone: clienteTelefone,
      cpf: documento.length <= 11 ? documento : "",
      cnpj: documento.length > 11 ? documento : "",
      email: row.clientes?.email ?? "",
    },
    veiculoDados: {
      marca: veiculo?.marca ?? "",
      modelo: veiculo?.modelo ?? "",
      ano: veiculo?.ano ?? "",
      placa: veiculo?.placa ?? "",
      motor: veiculo?.motor ?? "",
      combustivel: veiculo?.combustivel ?? "",
      chassiVin: veiculo?.chassi_vin ?? "",
      kmAtual: "",
    },
    problemaRelatado: row.problema_relatado ?? "",
    diagnostico: {
      defeitoEncontrado: row.diagnostico?.defeitoEncontrado ?? "",
      causaProvavel: row.diagnostico?.causaProvavel ?? "",
      solucaoRecomendada: row.diagnostico?.solucaoRecomendada ?? "",
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
  };
}

function mergeSupabaseOrder(row: OrdemServicoSupabaseRow) {
  const localOrder = getStoredOrders().find(
    (order) => order.id === row.id || order.codigo === row.codigo,
  );
  const baseOrder = localOrder ?? createEmptyOrderFromSupabase(row);
  const supabaseOrder = createEmptyOrderFromSupabase(row);

  return {
    ...baseOrder,
    ...supabaseOrder,
    timeline: baseOrder.timeline,
    checklistInicial: baseOrder.checklistInicial,
    pecasNecessarias: baseOrder.pecasNecessarias,
    servicosMaoDeObra: baseOrder.servicosMaoDeObra,
    fotosOs: baseOrder.fotosOs,
    orcamento: baseOrder.orcamento,
    statusAprovacao: baseOrder.statusAprovacao,
    itensAprovados: baseOrder.itensAprovados,
  };
}

function mapOrderToSupabase(oficinaId: string, order: ServiceOrder) {
  return {
    oficina_id: oficinaId,
    cliente_id: order.clienteId,
    veiculo_id: order.veiculoId,
    codigo: order.codigo || order.id,
    status: order.status || "ABERTA",
    problema_relatado: order.problemaRelatado || order.servicoInicial,
    observacao: order.observacao,
    diagnostico: order.diagnostico,
  };
}

function mirrorLocalOrder(order: ServiceOrder) {
  const currentOrders = getStoredOrders();
  const exists = currentOrders.some((currentOrder) => currentOrder.id === order.id);
  const nextOrders = exists
    ? currentOrders.map((currentOrder) =>
        currentOrder.id === order.id ? order : currentOrder,
      )
    : [...currentOrders, order];

  saveStoredOrders(nextOrders);
}

function calculateServiceOrderBudgetTotals(order: ServiceOrder): OrcamentoTotais {
  const totalPecas = order.pecasNecessarias.reduce(
    (total, part) =>
      total + Number(part.quantidade || 0) * Number(part.valorUnitario || 0),
    0,
  );
  const totalServicos = order.servicosMaoDeObra.reduce(
    (total, service) => total + Number(service.valor || 0),
    0,
  );

  return {
    totalPecas,
    totalServicos,
    totalGeral: totalPecas + totalServicos,
  };
}

async function fetchBudgetPublicToken(oficinaId: string, orderId: string) {
  if (!supabase || !isUuid(orderId)) {
    return "";
  }

  const { data, error } = await supabase
    .from("orcamentos")
    .select("public_token")
    .eq("oficina_id", oficinaId)
    .eq("ordem_servico_id", orderId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ public_token: string }>();

  if (error) {
    logSupabaseFallback("orcamentos:publicToken", error);
    return "";
  }

  return data?.public_token ?? "";
}

function mapPecaFromSupabase(
  row: OsPecaSupabaseRow,
  index: number,
): ServiceOrderPart {
  const quantidade = Number(row.quantidade || 0);
  const valorUnitario = Number(row.valor_unitario || 0);

  return {
    id: index + 1,
    peca: row.nome,
    quantidade,
    valorUnitario,
    valorTotal: Number(row.valor_total ?? quantidade * valorUnitario),
    origemChecklist: row.origem_checklist ?? undefined,
  };
}

function mapServicoFromSupabase(
  row: OsServicoSupabaseRow,
  index: number,
): ServiceOrderLabor {
  return {
    id: index + 1,
    servico: row.servico || row.descricao || "Serviço",
    descricao: row.descricao ?? "",
    valor: Number(row.valor || 0),
  };
}

async function fetchServiceOrderItemsSupabase(
  oficinaId: string,
  orderId: string,
) {
  const client = supabase;

  if (!client) {
    return {
      pecasNecessarias: [] as ServiceOrderPart[],
      servicosMaoDeObra: [] as ServiceOrderLabor[],
    };
  }

  const [pecasResult, servicosResult] = await Promise.all([
    client
      .from("os_pecas")
      .select(
        "id, nome, quantidade, valor_unitario, valor_total, origem_checklist, observacao, created_at",
      )
      .eq("oficina_id", oficinaId)
      .eq("ordem_servico_id", orderId)
      .order("created_at", { ascending: true })
      .returns<OsPecaSupabaseRow[]>(),
    client
      .from("os_servicos")
      .select("id, servico, descricao, valor, created_at")
      .eq("oficina_id", oficinaId)
      .eq("ordem_servico_id", orderId)
      .order("created_at", { ascending: true })
      .returns<OsServicoSupabaseRow[]>(),
  ]);

  if (pecasResult.error || servicosResult.error) {
    throw pecasResult.error ?? servicosResult.error;
  }

  return {
    pecasNecessarias: (pecasResult.data ?? []).map(mapPecaFromSupabase),
    servicosMaoDeObra: (servicosResult.data ?? []).map(mapServicoFromSupabase),
  };
}

async function syncServiceOrderItemsSupabase(
  oficinaId: string,
  order: ServiceOrder,
) {
  const client = supabase;

  if (!client || !isUuid(order.id)) {
    return order;
  }

  const [deletePecasResult, deleteServicosResult] = await Promise.all([
    client
      .from("os_pecas")
      .delete()
      .eq("oficina_id", oficinaId)
      .eq("ordem_servico_id", order.id),
    client
      .from("os_servicos")
      .delete()
      .eq("oficina_id", oficinaId)
      .eq("ordem_servico_id", order.id),
  ]);

  if (deletePecasResult.error || deleteServicosResult.error) {
    throw deletePecasResult.error ?? deleteServicosResult.error;
  }

  const pecasPayload = order.pecasNecessarias
    .filter((part) => part.peca.trim())
    .map((part) => ({
      oficina_id: oficinaId,
      ordem_servico_id: order.id,
      nome: part.peca.trim(),
      quantidade: Number(part.quantidade || 0),
      valor_unitario: Number(part.valorUnitario || 0),
      origem_checklist: part.origemChecklist || null,
      observacao: null,
    }));
  const servicosPayload = order.servicosMaoDeObra
    .filter((service) => service.servico.trim() || service.descricao.trim())
    .map((service) => ({
      oficina_id: oficinaId,
      ordem_servico_id: order.id,
      servico: service.servico.trim() || service.descricao.trim() || "Serviço",
      descricao: service.descricao.trim(),
      valor: Number(service.valor || 0),
    }));

  if (pecasPayload.length) {
    const { error } = await client.from("os_pecas").insert(pecasPayload);

    if (error) {
      throw error;
    }
  }

  if (servicosPayload.length) {
    const { error } = await client.from("os_servicos").insert(servicosPayload);

    if (error) {
      throw error;
    }
  }

  const syncedItems = await fetchServiceOrderItemsSupabase(oficinaId, order.id);

  return {
    ...order,
    pecasNecessarias: syncedItems.pecasNecessarias.length
      ? syncedItems.pecasNecessarias
      : order.pecasNecessarias,
    servicosMaoDeObra: syncedItems.servicosMaoDeObra.length
      ? syncedItems.servicosMaoDeObra
      : order.servicosMaoDeObra,
  };
}

export async function saveServiceOrderBudgetSupabase(
  oficinaId: string,
  order: ServiceOrder,
) {
  const totals = calculateServiceOrderBudgetTotals(order);
  const localOrder = {
    ...order,
    orcamento: {
      ...order.orcamento,
      totalPecas: totals.totalPecas,
      totalMaoDeObra: totals.totalServicos,
      totalFinal: totals.totalGeral,
    },
  };

  if (!supabase || !isUuid(order.id)) {
    mirrorLocalOrder(localOrder);
    return localOrder;
  }

  const { data: existingBudget, error: existingError } = await supabase
    .from("orcamentos")
    .select("id, public_token")
    .eq("oficina_id", oficinaId)
    .eq("ordem_servico_id", order.id)
    .maybeSingle<OrcamentoPublicTokenRow>();

  if (existingError) {
    mirrorLocalOrder(localOrder);
    return localOrder;
  }

  const payload = {
    oficina_id: oficinaId,
    ordem_servico_id: order.id,
    status: "RASCUNHO",
    total_pecas: totals.totalPecas,
    total_mao_de_obra: totals.totalServicos,
    desconto_tipo: "valor",
    desconto_valor: 0,
    desconto_aplicado: 0,
    total_final: totals.totalGeral,
  };

  const saveResult = existingBudget
    ? await supabase
        .from("orcamentos")
        .update(payload)
        .eq("oficina_id", oficinaId)
        .eq("id", existingBudget.id)
        .select("id, public_token")
        .single<OrcamentoPublicTokenRow>()
    : await supabase
        .from("orcamentos")
        .insert(payload)
        .select("id, public_token")
        .single<OrcamentoPublicTokenRow>();

  if (saveResult.error) {
    mirrorLocalOrder(localOrder);
    return localOrder;
  }

  const savedBudget = saveResult.data as OrcamentoPublicTokenRow | null;
  const publicToken = savedBudget?.public_token ?? existingBudget?.public_token;
  const orderWithPublicToken = {
    ...localOrder,
    orcamento: {
      ...localOrder.orcamento,
      publicToken,
    },
  };

  mirrorLocalOrder(orderWithPublicToken);
  return orderWithPublicToken;
}

export type {
  BudgetApprovalStatus,
  ChecklistStatus,
  ServiceOrder,
  ServiceOrderChecklistItem,
  ServiceOrderLabor,
  ServiceOrderPart,
  ServiceOrderPhoto,
  ServiceOrderPhotoType,
  ServiceOrderPhotoVisibility,
  ServiceOrderStatus,
  ServiceOrderTimelineEvent,
} from "../pages/os/osStorage";

export {
  appendServiceOrderTimelineEvent,
  BUDGET_APPROVAL_STATUSES,
  clearServiceOrderStorageError,
  createNextOrderCode,
  createServiceOrderId,
  createServiceOrderTimelineEvent,
  getBudgetApprovalBadgeClass,
  getBudgetApprovalLabel,
  getServiceOrderStatusBadgeClass,
  getServiceOrderStatusForBudgetDecision,
  getServiceOrderStatusLabel,
  getServiceOrderStorageError,
  getStoredOrders,
  isServiceOrderBudgetLocked,
  normalizeBudgetApprovalStatus,
  normalizeServiceOrderStatus,
  saveStoredOrders,
  SERVICE_ORDER_PHOTO_TYPES,
  SERVICE_ORDER_PHOTO_VISIBILITIES,
  SERVICE_ORDER_STATUSES,
  updateServiceOrderStatusWithTimeline,
} from "../pages/os/osStorage";

export function getAll() {
  return getStoredOrders();
}

export function getById(id: string) {
  return getStoredOrders().find((order) => order.id === id);
}

export function create(order: ServiceOrder) {
  saveStoredOrders([...getStoredOrders(), order]);
  clearServiceOrderStorageError();
  return order;
}

export function update(order: ServiceOrder) {
  const updatedOrders = getStoredOrders().map((currentOrder) =>
    currentOrder.id === order.id ? order : currentOrder,
  );

  saveStoredOrders(updatedOrders);
  return order;
}

export function remove(id: string) {
  const updatedOrders = getStoredOrders().filter((order) => order.id !== id);
  saveStoredOrders(updatedOrders);
  return updatedOrders;
}

export async function getStoredOrdersSupabase(oficinaId: string) {
  const localOrders = getStoredOrders();

  if (!supabase) {
    return localOrders;
  }

  const { data, error } = await supabase
    .from("ordens_servico")
    .select(
      "id, cliente_id, veiculo_id, codigo, version, status, problema_relatado, observacao, diagnostico, created_at, updated_at, clientes(nome, telefone, documento, email), veiculos(marca, modelo, ano, motor, combustivel, placa, chassi_vin)",
    )
    .eq("oficina_id", oficinaId)
    .order("created_at", { ascending: false })
    .returns<OrdemServicoSupabaseRow[]>();

  if (error || !data) {
    logSupabaseFallback("os:list", error);
    return localOrders;
  }

  if (data.length === 0 && localOrders.length > 0) {
    logSupabaseFallback(
      "os:list",
      "Supabase retornou lista vazia; mantendo OS locais existentes.",
    );
    return localOrders;
  }

  return data.map(mergeSupabaseOrder);
}

export async function getServiceOrderSupabase(oficinaId: string, id: string) {
  const localOrder = getStoredOrders().find(
    (order) => order.id === id || order.codigo === id,
  );

  if (!supabase) {
    return localOrder;
  }

  let query = supabase
    .from("ordens_servico")
    .select(
      "id, cliente_id, veiculo_id, codigo, version, status, problema_relatado, observacao, diagnostico, created_at, updated_at, clientes(nome, telefone, documento, email), veiculos(marca, modelo, ano, motor, combustivel, placa, chassi_vin)",
    )
    .eq("oficina_id", oficinaId);

  query = isUuid(id) ? query.eq("id", id) : query.eq("codigo", id);

  const { data, error } = await query.maybeSingle<OrdemServicoSupabaseRow>();

  if (error || !data) {
    logSupabaseFallback("os:getById", error);
    return localOrder;
  }

  const mergedOrder = mergeSupabaseOrder(data);

  try {
    const [items, publicToken] = await Promise.all([
      fetchServiceOrderItemsSupabase(oficinaId, data.id),
      fetchBudgetPublicToken(oficinaId, data.id),
    ]);

    return {
      ...mergedOrder,
      pecasNecessarias: items.pecasNecessarias.length
        ? items.pecasNecessarias
        : mergedOrder.pecasNecessarias,
      servicosMaoDeObra: items.servicosMaoDeObra.length
        ? items.servicosMaoDeObra
        : mergedOrder.servicosMaoDeObra,
      orcamento: {
        ...mergedOrder.orcamento,
        publicToken: publicToken || mergedOrder.orcamento.publicToken,
      },
    };
  } catch (fetchItemsError) {
    logSupabaseFallback("os:items:getById", fetchItemsError);
    return mergedOrder;
  }
}

export async function createServiceOrderSupabase(
  oficinaId: string,
  order: ServiceOrder,
) {
  if (!oficinaId || !order.clienteId || !order.veiculoId) {
    throw new Error("OS deve ter oficina, cliente e veículo vinculados.");
  }

  if (!supabase) {
    mirrorLocalOrder(order);
    return order;
  }

  if (!isUuid(order.clienteId) || !isUuid(order.veiculoId)) {
    throw new Error("Cliente e veículo precisam estar salvos no Supabase antes de criar a OS.");
  }

  const { data, error } = await supabase
    .from("ordens_servico")
    .insert(mapOrderToSupabase(oficinaId, order))
    .select(
      "id, cliente_id, veiculo_id, codigo, version, status, problema_relatado, observacao, diagnostico, created_at, updated_at, clientes(nome, telefone, documento, email), veiculos(marca, modelo, ano, motor, combustivel, placa, chassi_vin)",
    )
    .single<OrdemServicoSupabaseRow>();

  if (error) {
    console.error("[Supabase:os:create] Falha ao criar OS.", error);
    throw new Error("Não foi possível salvar a OS no Supabase.");
  }

  if (!data) {
    throw new Error("Esta OS foi alterada em outro lugar. Recarregue antes de salvar.");
  }

  const savedOrder = {
    ...order,
    id: data.id,
    codigo: data.codigo,
    version: data.version,
    criadoEm: data.created_at,
    updatedAt: data.updated_at,
  };

  try {
    const savedOrderWithItems = await syncServiceOrderItemsSupabase(
      oficinaId,
      savedOrder,
    );
    const savedOrderWithBudget = await saveServiceOrderBudgetSupabase(
      oficinaId,
      savedOrderWithItems,
    );

    mirrorLocalOrder(savedOrderWithBudget);
    return savedOrderWithBudget;
  } catch (syncError) {
    console.error("[Supabase:os:create:items] Falha ao salvar itens/orçamento.", syncError);
    throw new Error("OS criada, mas não foi possível salvar itens ou orçamento.", {
      cause: syncError,
    });
  }
}

export async function updateServiceOrderSupabase(
  oficinaId: string,
  order: ServiceOrder,
) {
  if (!oficinaId || !order.clienteId || !order.veiculoId) {
    throw new Error("OS deve ter oficina, cliente e veículo vinculados.");
  }

  if (!supabase) {
    mirrorLocalOrder(order);
    return order;
  }

  if (!isUuid(order.id)) {
    throw new Error("Esta OS ainda não está salva no Supabase.");
  }

  const currentVersion = Number(order.version || 1);
  const expectedVersion = currentVersion > 1 ? currentVersion - 1 : currentVersion;
  const nextVersion = currentVersion > expectedVersion ? currentVersion : currentVersion + 1;
  const { data, error } = await supabase
    .from("ordens_servico")
    .update({
      ...mapOrderToSupabase(oficinaId, order),
      version: nextVersion,
    })
    .eq("oficina_id", oficinaId)
    .eq("id", order.id)
    .eq("version", expectedVersion)
    .select(
      "id, cliente_id, veiculo_id, codigo, version, status, problema_relatado, observacao, diagnostico, created_at, updated_at, clientes(nome, telefone, documento, email), veiculos(marca, modelo, ano, motor, combustivel, placa, chassi_vin)",
    )
    .maybeSingle<OrdemServicoSupabaseRow>();

  if (error) {
    console.error("[Supabase:os:update] Falha ao atualizar OS.", error);
    throw new Error("Não foi possível atualizar a OS no Supabase.");
  }

  if (!data) {
    throw new Error("Esta OS foi alterada em outro lugar. Recarregue antes de salvar.");
  }

  const updatedOrder = {
    ...order,
    version: data.version,
    updatedAt: data.updated_at,
  };

  try {
    const updatedOrderWithItems = await syncServiceOrderItemsSupabase(
      oficinaId,
      updatedOrder,
    );
    const updatedOrderWithBudget = await saveServiceOrderBudgetSupabase(
      oficinaId,
      updatedOrderWithItems,
    );

    mirrorLocalOrder(updatedOrderWithBudget);
    return updatedOrderWithBudget;
  } catch (syncError) {
    console.error("[Supabase:os:update:items] Falha ao salvar itens/orçamento.", syncError);
    throw new Error("OS atualizada, mas não foi possível salvar itens ou orçamento.", {
      cause: syncError,
    });
  }
}

export const osService = {
  getAll,
  getById,
  create,
  update,
  remove,
  getStoredOrdersSupabase,
  getServiceOrderSupabase,
  createServiceOrderSupabase,
  updateServiceOrderSupabase,
  fetchServiceOrderItemsSupabase,
  syncServiceOrderItemsSupabase,
  saveServiceOrderBudgetSupabase,
  createNextOrderCode,
  createServiceOrderId,
};
