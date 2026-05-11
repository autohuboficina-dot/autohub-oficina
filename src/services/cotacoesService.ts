import { supabase } from "../lib/supabase";
import {
  getCotacoes,
  saveCotacao,
  updateCotacao,
  type CotacaoFornecedorResponse,
  type CotacaoPeca,
  type CotacaoPecaEscolha,
  type CotacaoPecaItem,
  type CotacaoPecaRespostaItem,
  type CotacaoStatus,
} from "../pages/compras/comprasStorage";

type CotacaoStatusDb =
  | "COTACAO_ENVIADA"
  | "RESPOSTA_RECEBIDA"
  | "SELECIONADA"
  | "FORNECEDOR_ESCOLHIDO"
  | "COTACAO_PARCIAL"
  | "COTACAO_CONCLUIDA"
  | "AGUARDANDO_APROVACAO_CLIENTE"
  | "APROVADA_PELO_CLIENTE"
  | "NAO_APROVADA_PELO_CLIENTE"
  | "COMPRA_CONFIRMADA_FORNECEDOR"
  | "CANCELADA";

type CotacaoRow = {
  id: string;
  oficina_id: string;
  ordem_servico_id: string | null;
  fornecedor_id: string | null;
  status: CotacaoStatusDb;
  observacao: string | null;
  enviada_em: string;
  fornecedores?: {
    nome: string | null;
    whatsapp: string | null;
  } | null;
  ordens_servico?: {
    clientes?: { nome: string | null; telefone: string | null } | null;
    veiculos?: {
      marca: string | null;
      modelo: string | null;
      ano: string | null;
      motor: string | null;
      combustivel: string | null;
      placa: string | null;
      chassi_vin: string | null;
    } | null;
  } | null;
};

type CotacaoItemRow = {
  id: string;
  cotacao_id: string;
  nome_peca: string;
  quantidade: number;
  observacao: string | null;
};

type RespostaFornecedorRow = {
  id: string;
  cotacao_id: string;
  cotacao_item_id: string | null;
  fornecedor_id: string | null;
  preco: number;
  marca: string | null;
  observacao: string | null;
  data_resposta: string;
  escolhido: boolean;
  fornecedores?: { nome: string | null } | null;
};

type PublicCotacaoResponse = {
  id: string;
  status: CotacaoStatusDb;
  observacao: string | null;
  enviada_em: string;
  oficina?: { nome: string | null } | null;
  fornecedor?: { id: string | null; nome: string | null } | null;
  cliente?: { nome: string | null; telefone: string | null } | null;
  veiculo?: {
    marca: string | null;
    modelo: string | null;
    ano: string | null;
    motor: string | null;
    combustivel: string | null;
    placa: string | null;
    chassi: string | null;
  } | null;
  os_id: string | null;
  itens: CotacaoPecaItem[];
  respostas: RespostaFornecedorRow[];
};

const STATUS_TO_DB: Record<CotacaoStatus, CotacaoStatusDb> = {
  "Cotação enviada": "COTACAO_ENVIADA",
  "Resposta recebida": "RESPOSTA_RECEBIDA",
  "Fornecedor escolhido": "SELECIONADA",
  "Cotação parcial": "COTACAO_PARCIAL",
  "Cotação concluída": "COTACAO_CONCLUIDA",
  "Aguardando aprovação do cliente": "AGUARDANDO_APROVACAO_CLIENTE",
  "Aprovada pelo cliente": "APROVADA_PELO_CLIENTE",
  "Não aprovada pelo cliente": "NAO_APROVADA_PELO_CLIENTE",
  "Compra confirmada com fornecedor": "COMPRA_CONFIRMADA_FORNECEDOR",
  Cancelada: "CANCELADA",
};

const STATUS_FROM_DB: Record<CotacaoStatusDb, CotacaoStatus> = {
  COTACAO_ENVIADA: "Cotação enviada",
  RESPOSTA_RECEBIDA: "Resposta recebida",
  SELECIONADA: "Fornecedor escolhido",
  FORNECEDOR_ESCOLHIDO: "Fornecedor escolhido",
  COTACAO_PARCIAL: "Cotação parcial",
  COTACAO_CONCLUIDA: "Cotação concluída",
  AGUARDANDO_APROVACAO_CLIENTE: "Aguardando aprovação do cliente",
  APROVADA_PELO_CLIENTE: "Aprovada pelo cliente",
  NAO_APROVADA_PELO_CLIENTE: "Não aprovada pelo cliente",
  COMPRA_CONFIRMADA_FORNECEDOR: "Compra confirmada com fornecedor",
  CANCELADA: "Cancelada",
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function mirrorCotacao(cotacao: CotacaoPeca) {
  const local = getCotacoes();

  if (local.some((item) => item.id === cotacao.id)) {
    return updateCotacao(cotacao);
  }

  localStorage.setItem("autohub:cotacoes-pecas", JSON.stringify([cotacao, ...local]));
  return cotacao;
}

function buildResponses(
  cotacao: CotacaoPeca,
  responses: RespostaFornecedorRow[],
): CotacaoFornecedorResponse[] {
  const grouped = responses.reduce<Record<string, RespostaFornecedorRow[]>>(
    (groups, response) => {
      const key = [
        response.fornecedor_id || "",
        response.data_resposta || "",
      ].join("|");

      return {
        ...groups,
        [key]: [...(groups[key] || []), response],
      };
    },
    {},
  );

  return Object.values(grouped).map((group) => {
    const first = group[0];
    const itemResponses: CotacaoPecaRespostaItem[] = group.map((response) => {
      const item = cotacao.pecas.find(
        (peca) => peca.id === response.cotacao_item_id,
      );
      const quantidade = Number(item?.quantidade || 1);

      return {
        pecaId: response.cotacao_item_id || item?.id || "peca-1",
        nomePeca: item?.peca || "Peça não informada",
        quantidade,
        preco: Number(response.preco || 0),
        marca: response.marca || "",
        observacaoFornecedor: response.observacao || "",
        dataHora: response.data_resposta,
      };
    });
    const total = itemResponses.reduce(
      (sum, item) => sum + item.preco * item.quantidade,
      0,
    );

    return {
      cotacaoId: cotacao.id,
      fornecedorId: first.fornecedor_id || cotacao.fornecedorId,
      fornecedorNome:
        first.fornecedores?.nome || cotacao.fornecedorNome || "Fornecedor",
      preco: total,
      prazo: "",
      marca: itemResponses.map((item) => item.marca).filter(Boolean).join(" / "),
      observacao: itemResponses
        .map((item) => item.observacaoFornecedor)
        .filter(Boolean)
        .join(" / "),
      dataResposta: first.data_resposta,
      itemResponses,
    };
  });
}

function buildChoicesFromResponses(
  cotacao: CotacaoPeca,
  responses: RespostaFornecedorRow[],
): CotacaoPecaEscolha[] {
  return responses
    .filter((response) => response.escolhido)
    .map((response) => {
      const item = cotacao.pecas.find(
        (peca) => peca.id === response.cotacao_item_id,
      );
      const quantidade = Number(item?.quantidade || 1);

      return {
        pecaId: response.cotacao_item_id || item?.id || "peca-1",
        nomePeca: item?.peca || "Peça não informada",
        quantidade,
        fornecedorId: response.fornecedor_id || "",
        fornecedorNome:
          response.fornecedores?.nome || cotacao.fornecedorNome || "Fornecedor",
        preco: Number(response.preco || 0),
        marca: response.marca || "",
        observacao: response.observacao || "",
        dataEscolha: response.data_resposta,
      };
    });
}

function mapCotacaoFromRows(
  row: CotacaoRow,
  items: CotacaoItemRow[],
  responses: RespostaFornecedorRow[],
): CotacaoPeca {
  const pecas = items.map((item) => ({
    id: item.id,
    peca: item.nome_peca,
    quantidade: Number(item.quantidade || 1),
    observacao: item.observacao || "",
  }));
  const cotacao: CotacaoPeca = {
    id: row.id,
    osId: row.ordem_servico_id,
    oficinaNome: "",
    fornecedorId: row.fornecedor_id || "",
    fornecedorNome: row.fornecedores?.nome || "Fornecedor não informado",
    fornecedorWhatsapp: row.fornecedores?.whatsapp || "",
    peca: pecas[0]?.peca || "Peça não informada",
    quantidade: pecas[0]?.quantidade || 1,
    pecas,
    urgencia: "Normal",
    observacao: row.observacao || "",
    fotos: [],
    clienteNome: row.ordens_servico?.clientes?.nome || "",
    clienteTelefone: row.ordens_servico?.clientes?.telefone || "",
    veiculo: {
      marca: row.ordens_servico?.veiculos?.marca || "",
      modelo: row.ordens_servico?.veiculos?.modelo || "",
      ano: row.ordens_servico?.veiculos?.ano || "",
      motor: row.ordens_servico?.veiculos?.motor || "",
      combustivel: row.ordens_servico?.veiculos?.combustivel || "",
      placa: row.ordens_servico?.veiculos?.placa || "",
      chassi: row.ordens_servico?.veiculos?.chassi_vin || "",
    },
    status: STATUS_FROM_DB[row.status],
    responses: [],
    fornecedorEscolhidoId: "",
    fornecedorEscolhidoNome: "",
    precoFinalPeca: 0,
    fornecedorSelecionado: "",
    valorSelecionado: 0,
    marcaSelecionada: "",
    prazoSelecionado: "",
    pecasEscolhidas: [],
    enviadaEm: row.enviada_em,
  };

  const choices = buildChoicesFromResponses(cotacao, responses);
  const totalSelectedValue = choices.reduce(
    (total, choice) => total + choice.preco * choice.quantidade,
    0,
  );
  const firstChoice = choices[0];

  return {
    ...cotacao,
    responses: buildResponses(cotacao, responses),
    fornecedorEscolhidoId: firstChoice?.fornecedorId || "",
    fornecedorEscolhidoNome: firstChoice?.fornecedorNome || "",
    precoFinalPeca: firstChoice?.preco || 0,
    fornecedorSelecionado: firstChoice?.fornecedorNome || "",
    valorSelecionado: totalSelectedValue,
    marcaSelecionada: firstChoice?.marca || "",
    pecasEscolhidas: choices,
  };
}

function mapPublicCotacao(data: PublicCotacaoResponse): CotacaoPeca {
  const cotacao: CotacaoPeca = {
    id: data.id,
    osId: data.os_id,
    oficinaNome: data.oficina?.nome || "",
    fornecedorId: data.fornecedor?.id || "",
    fornecedorNome: data.fornecedor?.nome || "Fornecedor",
    fornecedorWhatsapp: "",
    peca: data.itens[0]?.peca || "Peça não informada",
    quantidade: data.itens[0]?.quantidade || 1,
    pecas: data.itens,
    urgencia: "Normal",
    observacao: data.observacao || "",
    fotos: [],
    clienteNome: data.cliente?.nome || "",
    clienteTelefone: data.cliente?.telefone || "",
    veiculo: {
      marca: data.veiculo?.marca || "",
      modelo: data.veiculo?.modelo || "",
      ano: data.veiculo?.ano || "",
      motor: data.veiculo?.motor || "",
      combustivel: data.veiculo?.combustivel || "",
      placa: data.veiculo?.placa || "",
      chassi: data.veiculo?.chassi || "",
    },
    status: STATUS_FROM_DB[data.status],
    responses: [],
    fornecedorEscolhidoId: "",
    fornecedorEscolhidoNome: "",
    precoFinalPeca: 0,
    fornecedorSelecionado: "",
    valorSelecionado: 0,
    marcaSelecionada: "",
    prazoSelecionado: "",
    pecasEscolhidas: [],
    enviadaEm: data.enviada_em,
  };

  const choices = buildChoicesFromResponses(cotacao, data.respostas || []);
  const totalSelectedValue = choices.reduce(
    (total, choice) => total + choice.preco * choice.quantidade,
    0,
  );
  const firstChoice = choices[0];

  return {
    ...cotacao,
    responses: buildResponses(cotacao, data.respostas || []),
    fornecedorEscolhidoId: firstChoice?.fornecedorId || "",
    fornecedorEscolhidoNome: firstChoice?.fornecedorNome || "",
    precoFinalPeca: firstChoice?.preco || 0,
    fornecedorSelecionado: firstChoice?.fornecedorNome || "",
    valorSelecionado: totalSelectedValue,
    marcaSelecionada: firstChoice?.marca || "",
    pecasEscolhidas: choices,
  };
}

export async function getCotacoesSupabase(oficinaId: string) {
  const local = getCotacoes();

  if (!supabase) {
    return local;
  }

  const { data: rows, error } = await supabase
    .from("cotacoes")
    .select(
      "id, oficina_id, ordem_servico_id, fornecedor_id, status, observacao, enviada_em, fornecedores(nome, whatsapp), ordens_servico(clientes(nome, telefone), veiculos(marca, modelo, ano, motor, combustivel, placa, chassi_vin))",
    )
    .eq("oficina_id", oficinaId)
    .order("enviada_em", { ascending: false })
    .returns<CotacaoRow[]>();

  if (error || !rows) {
    console.error("[Supabase:cotacoes:list] Usando fallback localStorage.", error);
    return local;
  }

  if (rows.length === 0 && local.length > 0) {
    console.error("[Supabase:cotacoes:list] Lista vazia; mantendo fallback local.");
    return local;
  }

  const cotacaoIds = rows.map((row) => row.id);
  const [itemsResult, responsesResult] = await Promise.all([
    supabase
      .from("cotacao_itens")
      .select("id, cotacao_id, nome_peca, quantidade, observacao")
      .in("cotacao_id", cotacaoIds)
      .returns<CotacaoItemRow[]>(),
    supabase
      .from("respostas_fornecedor")
      .select(
        "id, cotacao_id, cotacao_item_id, fornecedor_id, preco, marca, observacao, data_resposta, escolhido, fornecedores(nome)",
      )
      .in("cotacao_id", cotacaoIds)
      .returns<RespostaFornecedorRow[]>(),
  ]);

  if (itemsResult.error || responsesResult.error) {
    console.error(
      "[Supabase:cotacoes:details] Usando fallback localStorage.",
      itemsResult.error ?? responsesResult.error,
    );
    return local;
  }

  return rows.map((row) =>
    mapCotacaoFromRows(
      row,
      (itemsResult.data ?? []).filter((item) => item.cotacao_id === row.id),
      (responsesResult.data ?? []).filter(
        (response) => response.cotacao_id === row.id,
      ),
    ),
  );
}

export async function saveCotacaoSupabase(
  oficinaId: string,
  cotacao: Parameters<typeof saveCotacao>[0],
) {
  if (!supabase) {
    return saveCotacao(cotacao);
  }

  if (!cotacao.osId || !isUuid(cotacao.osId) || !isUuid(cotacao.fornecedorId)) {
    return saveCotacao(cotacao);
  }

  const { data: row, error } = await supabase
    .from("cotacoes")
    .insert({
      oficina_id: oficinaId,
      ordem_servico_id: cotacao.osId,
      fornecedor_id: cotacao.fornecedorId,
      status: "COTACAO_ENVIADA",
      observacao: cotacao.observacao,
    })
    .select(
      "id, oficina_id, ordem_servico_id, fornecedor_id, status, observacao, enviada_em, fornecedores(nome, whatsapp), ordens_servico(clientes(nome, telefone), veiculos(marca, modelo, ano, motor, combustivel, placa, chassi_vin))",
    )
    .single<CotacaoRow>();

  if (error || !row) {
    console.error("[Supabase:cotacoes:create] Falha ao salvar cotação.", error);
    throw new Error("Não foi possível salvar a cotação no Supabase.");
  }

  const itemsPayload = cotacao.pecas.map((item) => ({
    oficina_id: oficinaId,
    cotacao_id: row.id,
    nome_peca: item.peca,
    quantidade: item.quantidade,
    observacao: item.observacao,
  }));
  const { data: items, error: itemsError } = await supabase
    .from("cotacao_itens")
    .insert(itemsPayload)
    .select("id, cotacao_id, nome_peca, quantidade, observacao")
    .returns<CotacaoItemRow[]>();

  if (itemsError || !items) {
    console.error("[Supabase:cotacoes:items] Falha ao salvar itens.", itemsError);
    throw new Error("Cotação criada, mas os itens não foram salvos.");
  }

  const savedCotacao = mapCotacaoFromRows(row, items, []);
  mirrorCotacao(savedCotacao);
  return savedCotacao;
}

export async function updateCotacaoSupabase(cotacao: CotacaoPeca) {
  const localCotacao = updateCotacao(cotacao);

  if (!supabase || !isUuid(cotacao.id)) {
    return localCotacao;
  }

  const { error } = await supabase
    .from("cotacoes")
    .update({
      status: STATUS_TO_DB[cotacao.status],
      observacao: cotacao.observacao,
    })
    .eq("id", cotacao.id);

  if (error) {
    console.error("[Supabase:cotacoes:update] Falha ao atualizar cotação.", error);
    throw new Error("Não foi possível atualizar a cotação no Supabase.");
  }

  const { error: deleteResponsesError } = await supabase
    .from("respostas_fornecedor")
    .delete()
    .eq("cotacao_id", cotacao.id);

  if (deleteResponsesError) {
    console.error(
      "[Supabase:cotacoes:responses:delete] Falha ao atualizar respostas.",
      deleteResponsesError,
    );
    throw new Error("Não foi possível atualizar as respostas no Supabase.");
  }

  const responsesPayload = cotacao.responses.flatMap((response) =>
    response.itemResponses
      .filter((item) => isUuid(item.pecaId))
      .map((item) => ({
        oficina_id: "",
        cotacao_id: cotacao.id,
        cotacao_item_id: item.pecaId,
        fornecedor_id: isUuid(response.fornecedorId)
          ? response.fornecedorId
          : null,
        preco: item.preco,
        marca: item.marca,
        observacao: item.observacaoFornecedor,
        data_resposta: response.dataResposta,
        escolhido: cotacao.pecasEscolhidas.some(
          (choice) =>
            choice.pecaId === item.pecaId &&
            choice.fornecedorId === response.fornecedorId,
        ),
      })),
  );

  if (responsesPayload.length) {
    const { data: cotacaoRow, error: cotacaoRowError } = await supabase
      .from("cotacoes")
      .select("oficina_id")
      .eq("id", cotacao.id)
      .single<{ oficina_id: string }>();

    if (cotacaoRowError || !cotacaoRow) {
      throw new Error("Não foi possível identificar a oficina da cotação.");
    }

    const { error: insertResponsesError } = await supabase
      .from("respostas_fornecedor")
      .insert(
        responsesPayload.map((response) => ({
          ...response,
          oficina_id: cotacaoRow.oficina_id,
        })),
      );

    if (insertResponsesError) {
      console.error(
        "[Supabase:cotacoes:responses:insert] Falha ao salvar respostas.",
        insertResponsesError,
      );
      throw new Error("Não foi possível salvar as respostas no Supabase.");
    }
  }

  return localCotacao;
}

export async function selectCotacaoFornecedorSupabase(
  cotacao: CotacaoPeca,
  choice: CotacaoPecaEscolha,
) {
  if (
    !supabase ||
    !isUuid(cotacao.id) ||
    !isUuid(choice.pecaId) ||
    !isUuid(choice.fornecedorId)
  ) {
    return updateCotacao(cotacao);
  }

  const { data: cotacaoRow, error: cotacaoRowError } = await supabase
    .from("cotacoes")
    .select("oficina_id, ordem_servico_id")
    .eq("id", cotacao.id)
    .single<{ oficina_id: string; ordem_servico_id: string | null }>();

  if (cotacaoRowError || !cotacaoRow) {
    console.error(
      "[Supabase:cotacoes:select:row] Falha ao identificar cotação.",
      cotacaoRowError,
    );
    throw new Error("Não foi possível identificar a cotação no Supabase.");
  }

  const { error: unselectError } = await supabase
    .from("respostas_fornecedor")
    .update({ escolhido: false })
    .eq("cotacao_id", cotacao.id)
    .eq("cotacao_item_id", choice.pecaId);

  if (unselectError) {
    console.error(
      "[Supabase:cotacoes:select:clear] Falha ao limpar seleção anterior.",
      unselectError,
    );
    throw new Error("Não foi possível atualizar a seleção anterior.");
  }

  const { data: selectedResponses, error: selectResponseError } = await supabase
    .from("respostas_fornecedor")
    .update({ escolhido: true })
    .eq("cotacao_id", cotacao.id)
    .eq("cotacao_item_id", choice.pecaId)
    .eq("fornecedor_id", choice.fornecedorId)
    .select("id")
    .returns<{ id: string }[]>();

  if (selectResponseError || !selectedResponses?.length) {
    console.error(
      "[Supabase:cotacoes:select:response] Falha ao marcar fornecedor escolhido.",
      selectResponseError,
    );
    throw new Error("Não foi possível marcar o fornecedor escolhido.");
  }

  const { error: cotacaoUpdateError } = await supabase
    .from("cotacoes")
    .update({ status: STATUS_TO_DB[cotacao.status] })
    .eq("id", cotacao.id);

  if (cotacaoUpdateError) {
    console.error(
      "[Supabase:cotacoes:select:status] Falha ao marcar cotação selecionada.",
      cotacaoUpdateError,
    );
    throw new Error("Não foi possível marcar a cotação como selecionada.");
  }

  if (cotacaoRow.ordem_servico_id) {
    const partPayload = {
      oficina_id: cotacaoRow.oficina_id,
      ordem_servico_id: cotacaoRow.ordem_servico_id,
      cotacao_item_id: choice.pecaId,
      nome: choice.nomePeca,
      quantidade: Number(choice.quantidade || 1),
      valor_unitario: Number(choice.preco || 0),
      fornecedor_escolhido: choice.fornecedorNome,
      marca_escolhida: choice.marca || null,
      observacao: choice.observacao || null,
    };

    const { data: existingPartByItem, error: existingPartError } = await supabase
      .from("os_pecas")
      .select("id")
      .eq("oficina_id", cotacaoRow.oficina_id)
      .eq("ordem_servico_id", cotacaoRow.ordem_servico_id)
      .eq("cotacao_item_id", choice.pecaId)
      .maybeSingle<{ id: string }>();

    if (existingPartError) {
      console.error(
        "[Supabase:cotacoes:select:part:get] Falha ao localizar peça da OS.",
        existingPartError,
      );
      throw new Error("Não foi possível localizar a peça vinculada à OS.");
    }

    const { data: existingPartByName, error: existingPartByNameError } =
      existingPartByItem
        ? { data: null, error: null }
        : await supabase
            .from("os_pecas")
            .select("id")
            .eq("oficina_id", cotacaoRow.oficina_id)
            .eq("ordem_servico_id", cotacaoRow.ordem_servico_id)
            .eq("nome", choice.nomePeca)
            .is("cotacao_item_id", null)
            .limit(1)
            .maybeSingle<{ id: string }>();

    if (existingPartByNameError) {
      console.error(
        "[Supabase:cotacoes:select:part:name] Falha ao localizar peça por nome.",
        existingPartByNameError,
      );
      throw new Error("Não foi possível localizar a peça da OS para atualização.");
    }

    const existingPart = existingPartByItem ?? existingPartByName;

    const partResult = existingPart
      ? await supabase
          .from("os_pecas")
          .update(partPayload)
          .eq("oficina_id", cotacaoRow.oficina_id)
          .eq("id", existingPart.id)
      : await supabase.from("os_pecas").insert(partPayload);

    if (partResult.error) {
      console.error(
        "[Supabase:cotacoes:select:part:save] Falha ao vincular peça escolhida.",
        partResult.error,
      );
      throw new Error("Não foi possível vincular a peça à cotação escolhida.");
    }
  }

  return updateCotacao(cotacao);
}

export async function getPublicCotacaoSupabase(id: string) {
  if (!supabase || !isUuid(id)) {
    return getCotacoes().find((cotacao) => cotacao.id === id);
  }

  const { data, error } = await supabase.rpc("public_get_cotacao", {
    p_cotacao_id: id,
  });

  if (error) {
    console.error("[Supabase:cotacoes:publicGet] Falha ao buscar cotação.", error);
    return getCotacoes().find((cotacao) => cotacao.id === id);
  }

  return data ? mapPublicCotacao(data as PublicCotacaoResponse) : undefined;
}

export async function submitPublicCotacaoResponseSupabase(
  cotacao: CotacaoPeca,
  itemResponses: CotacaoPecaRespostaItem[],
) {
  if (!supabase || !isUuid(cotacao.id)) {
    const total = itemResponses.reduce(
      (sum, item) => sum + item.preco * item.quantidade,
      0,
    );

    return updateCotacao({
      ...cotacao,
      status:
        cotacao.status === "Cotação enviada" ? "Resposta recebida" : cotacao.status,
      responses: [
        ...cotacao.responses,
        {
          cotacaoId: cotacao.id,
          fornecedorId: cotacao.fornecedorId,
          fornecedorNome: cotacao.fornecedorNome,
          preco: total,
          prazo: "",
          marca: itemResponses.map((item) => item.marca).filter(Boolean).join(" / "),
          observacao: itemResponses
            .map((item) => item.observacaoFornecedor)
            .filter(Boolean)
            .join(" / "),
          dataResposta: new Date().toISOString(),
          itemResponses,
        },
      ],
    });
  }

  const { data, error } = await supabase.rpc("public_submit_cotacao_response", {
    p_cotacao_id: cotacao.id,
    p_items: itemResponses.map((item) => ({
      cotacao_item_id: item.pecaId,
      preco_unitario: item.preco,
      marca: item.marca,
      observacao: item.observacaoFornecedor,
    })),
  });

  if (error) {
    console.error("[Supabase:cotacoes:publicResponse] Falha ao enviar resposta.", error);
    throw new Error("Não foi possível enviar a resposta. Tente novamente.");
  }

  const result = data as { success?: boolean; message?: string } | null;

  if (!result?.success) {
    throw new Error(result?.message || "Não foi possível enviar a resposta.");
  }

  const refreshed = await getPublicCotacaoSupabase(cotacao.id);

  if (!refreshed) {
    throw new Error("Resposta enviada, mas não foi possível recarregar a cotação.");
  }

  mirrorCotacao(refreshed);
  return refreshed;
}

export type {
  CotacaoFornecedorResponse,
  CotacaoPeca,
  CotacaoPecaEscolha,
  CotacaoPecaItem,
  CotacaoPecaRespostaItem,
  CotacaoStatus,
} from "../pages/compras/comprasStorage";

export {
  COTACAO_STATUS,
  getCotacoes,
  saveCotacao,
  updateCotacao,
} from "../pages/compras/comprasStorage";

export function getAll() {
  return getCotacoes();
}

export function getById(id: string) {
  return getCotacoes().find((cotacao) => cotacao.id === id);
}

export function create(cotacao: Parameters<typeof saveCotacao>[0]) {
  return saveCotacao(cotacao);
}

export function update(cotacao: CotacaoPeca) {
  return updateCotacao(cotacao);
}

export const cotacoesService = {
  getAll,
  getById,
  create,
  update,
  getCotacoesSupabase,
  saveCotacaoSupabase,
  updateCotacaoSupabase,
  selectCotacaoFornecedorSupabase,
  getPublicCotacaoSupabase,
  submitPublicCotacaoResponseSupabase,
};
