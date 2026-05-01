export const COTACAO_STATUS = [
  "Cotação enviada",
  "Resposta recebida",
  "Fornecedor escolhido",
  "Aguardando aprovação do cliente",
  "Aprovada pelo cliente",
  "Não aprovada pelo cliente",
  "Compra confirmada com fornecedor",
  "Cancelada",
] as const;

export type CotacaoStatus = (typeof COTACAO_STATUS)[number];

export type CotacaoFornecedorResponse = {
  fornecedorId: string;
  fornecedorNome: string;
  preco: number;
  prazo: string;
  marca: string;
  observacao: string;
  dataResposta: string;
};

export type CotacaoPeca = {
  id: string;
  osId: string;
  fornecedorId: string;
  fornecedorNome: string;
  fornecedorWhatsapp: string;
  peca: string;
  quantidade: number;
  urgencia: "Normal" | "Urgente";
  observacao: string;
  fotos: string[];
  veiculo: {
    marca: string;
    modelo: string;
    ano: string;
    motor: string;
    placa: string;
  };
  status: CotacaoStatus;
  responses: CotacaoFornecedorResponse[];
  fornecedorEscolhidoId: string;
  fornecedorEscolhidoNome: string;
  precoFinalPeca: number;
  fornecedorSelecionado: string;
  valorSelecionado: number;
  marcaSelecionada: string;
  prazoSelecionado: string;
  enviadaEm: string;
};

const STORAGE_KEY = "autohub:cotacoes-pecas";

function createCotacaoId() {
  return `COT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function normalizeStatus(status: string): CotacaoStatus {
  if (COTACAO_STATUS.includes(status as CotacaoStatus)) {
    return status as CotacaoStatus;
  }

  if (status === "Aguardando resposta") {
    return "Cotação enviada";
  }

  if (status === "Respondida") {
    return "Resposta recebida";
  }

  if (status === "Fechado") {
    return "Fornecedor escolhido";
  }

  return "Cotação enviada";
}

function normalizeCotacao(cotacao: CotacaoPeca): CotacaoPeca {
  const responses = Array.isArray(cotacao.responses)
    ? cotacao.responses.map((response) => ({
        fornecedorId: response.fornecedorId || "",
        fornecedorNome: response.fornecedorNome || "Fornecedor não informado",
        preco: Number(response.preco || 0),
        prazo: response.prazo || "",
        marca: response.marca || "",
        observacao: response.observacao || "",
        dataResposta: response.dataResposta || new Date().toISOString(),
      }))
    : [];

  return {
    ...cotacao,
    id: cotacao.id || createCotacaoId(),
    osId: cotacao.osId || "",
    fornecedorId: cotacao.fornecedorId || "",
    fornecedorNome: cotacao.fornecedorNome || "Fornecedor não informado",
    fornecedorWhatsapp: cotacao.fornecedorWhatsapp || "",
    peca: cotacao.peca || "Peça não informada",
    quantidade: Number(cotacao.quantidade || 1),
    urgencia: cotacao.urgencia === "Urgente" ? "Urgente" : "Normal",
    observacao: cotacao.observacao || "",
    fotos: Array.isArray(cotacao.fotos) ? cotacao.fotos : [],
    veiculo: cotacao.veiculo || {
      marca: "",
      modelo: "",
      ano: "",
      motor: "",
      placa: "",
    },
    status: normalizeStatus(cotacao.status),
    responses,
    fornecedorEscolhidoId: cotacao.fornecedorEscolhidoId || "",
    fornecedorEscolhidoNome: cotacao.fornecedorEscolhidoNome || "",
    precoFinalPeca: Number(cotacao.precoFinalPeca || 0),
    fornecedorSelecionado:
      cotacao.fornecedorSelecionado || cotacao.fornecedorEscolhidoNome || "",
    valorSelecionado: Number(
      cotacao.valorSelecionado || cotacao.precoFinalPeca || 0,
    ),
    marcaSelecionada: cotacao.marcaSelecionada || "",
    prazoSelecionado: cotacao.prazoSelecionado || "",
    enviadaEm: cotacao.enviadaEm || new Date().toISOString(),
  };
}

export function getCotacoes(): CotacaoPeca[] {
  const storedCotacoes = localStorage.getItem(STORAGE_KEY);

  if (!storedCotacoes) {
    return [];
  }

  try {
    const parsedCotacoes = JSON.parse(storedCotacoes) as CotacaoPeca[];
    return Array.isArray(parsedCotacoes)
      ? parsedCotacoes.map(normalizeCotacao)
      : [];
  } catch {
    return [];
  }
}

function saveCotacoes(cotacoes: CotacaoPeca[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cotacoes));
}

export function saveCotacao(
  cotacao: Omit<
    CotacaoPeca,
    | "id"
    | "status"
    | "responses"
    | "fornecedorEscolhidoId"
    | "fornecedorEscolhidoNome"
    | "precoFinalPeca"
    | "fornecedorSelecionado"
    | "valorSelecionado"
    | "marcaSelecionada"
    | "prazoSelecionado"
    | "enviadaEm"
  >,
) {
  const newCotacao: CotacaoPeca = {
    ...cotacao,
    id: createCotacaoId(),
    status: "Cotação enviada",
    responses: [],
    fornecedorEscolhidoId: "",
    fornecedorEscolhidoNome: "",
    precoFinalPeca: 0,
    fornecedorSelecionado: "",
    valorSelecionado: 0,
    marcaSelecionada: "",
    prazoSelecionado: "",
    enviadaEm: new Date().toISOString(),
  };

  saveCotacoes([newCotacao, ...getCotacoes()]);
  return newCotacao;
}

export function updateCotacao(cotacao: CotacaoPeca) {
  const updatedCotacao = normalizeCotacao(cotacao);
  const cotacoes = getCotacoes().map((currentCotacao) =>
    currentCotacao.id === cotacao.id ? updatedCotacao : currentCotacao,
  );

  saveCotacoes(cotacoes);
  return updatedCotacao;
}
