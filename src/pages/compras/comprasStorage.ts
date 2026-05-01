import type { ServiceOrderPhoto } from "../os/osStorage";
import { createSecureId } from "../../utils/ids";

export const COTACAO_STATUS = [
  "Cotação enviada",
  "Resposta recebida",
  "Fornecedor escolhido",
  "Cotação parcial",
  "Cotação concluída",
  "Aguardando aprovação do cliente",
  "Aprovada pelo cliente",
  "Não aprovada pelo cliente",
  "Compra confirmada com fornecedor",
  "Cancelada",
] as const;

export type CotacaoStatus = (typeof COTACAO_STATUS)[number];

export type CotacaoFornecedorResponse = {
  cotacaoId: string;
  fornecedorId: string;
  fornecedorNome: string;
  preco: number;
  prazo: string;
  marca: string;
  observacao: string;
  dataResposta: string;
  itemResponses: CotacaoPecaRespostaItem[];
};

export type CotacaoPecaItem = {
  id: string;
  peca: string;
  quantidade: number;
  observacao: string;
};

export type CotacaoPecaRespostaItem = {
  pecaId: string;
  nomePeca: string;
  quantidade: number;
  preco: number;
  marca: string;
  observacaoFornecedor: string;
  dataHora: string;
};

export type CotacaoPecaEscolha = {
  pecaId: string;
  nomePeca: string;
  quantidade: number;
  fornecedorId: string;
  fornecedorNome: string;
  preco: number;
  marca: string;
  observacao: string;
  dataEscolha: string;
};

export type CotacaoPeca = {
  id: string;
  osId: string;
  oficinaNome: string;
  fornecedorId: string;
  fornecedorNome: string;
  fornecedorWhatsapp: string;
  peca: string;
  quantidade: number;
  pecas: CotacaoPecaItem[];
  urgencia: "Normal" | "Urgente";
  observacao: string;
  fotos: ServiceOrderPhoto[];
  clienteNome: string;
  clienteTelefone: string;
  veiculo: {
    marca: string;
    modelo: string;
    ano: string;
    motor: string;
    combustivel: string;
    placa: string;
    chassi: string;
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
  pecasEscolhidas: CotacaoPecaEscolha[];
  enviadaEm: string;
};

const STORAGE_KEY = "autohub:cotacoes-pecas";

function createCotacaoId() {
  return createSecureId("COT");
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

  if (status === "Parcial") {
    return "Cotação parcial";
  }

  if (status === "Concluída" || status === "Concluida") {
    return "Cotação concluída";
  }

  return "Cotação enviada";
}

function normalizeCotacao(cotacao: CotacaoPeca): CotacaoPeca {
  const responses = Array.isArray(cotacao.responses)
    ? cotacao.responses.map((response) => {
        const itemResponses = Array.isArray(response.itemResponses)
          ? response.itemResponses.map((item, index) => ({
              pecaId: item.pecaId || `peca-${index + 1}`,
              nomePeca: item.nomePeca || "Peça não informada",
              quantidade: Number(item.quantidade || 1),
              preco: Number(item.preco || 0),
              marca: item.marca || "",
              observacaoFornecedor: item.observacaoFornecedor || "",
              dataHora:
                item.dataHora || response.dataResposta || new Date().toISOString(),
            }))
          : [
              {
                pecaId: "peca-1",
                nomePeca: cotacao.peca || "Peça não informada",
                quantidade: Number(cotacao.quantidade || 1),
                preco: Number(response.preco || 0),
                marca: response.marca || "",
                observacaoFornecedor: response.observacao || "",
                dataHora: response.dataResposta || new Date().toISOString(),
              },
            ];

        return {
          cotacaoId: response.cotacaoId || cotacao.id || "",
          fornecedorId: response.fornecedorId || "",
          fornecedorNome: response.fornecedorNome || "Fornecedor não informado",
          preco: Number(response.preco || 0),
          prazo: response.prazo || "",
          marca: response.marca || "",
          observacao: response.observacao || "",
          dataResposta: response.dataResposta || new Date().toISOString(),
          itemResponses,
        };
      })
    : [];

  const rawFotos = Array.isArray(cotacao.fotos)
    ? (cotacao.fotos as Array<ServiceOrderPhoto | string>)
    : [];
  const fotos = rawFotos.map((photo, index) => {
        if (typeof photo === "string") {
          return {
            id: `foto-cotacao-${index}-${cotacao.id || createCotacaoId()}`,
            titulo: `Foto ${index + 1}`,
            tipo: "técnico" as const,
            visibilidade: "Fornecedor" as const,
            dataUrl: photo,
            criadoEm: cotacao.enviadaEm || new Date().toISOString(),
          };
        }

        return photo;
      });
  const pecas = Array.isArray(cotacao.pecas)
    ? cotacao.pecas.map((item, index) => ({
        id: item.id || `peca-${index + 1}`,
        peca: item.peca || "Peça não informada",
        quantidade: Number(item.quantidade || 1),
        observacao: item.observacao || "",
      }))
    : [
        {
          id: "peca-1",
          peca: cotacao.peca || "Peça não informada",
          quantidade: Number(cotacao.quantidade || 1),
          observacao: cotacao.observacao || "",
        },
      ];
  const pecasEscolhidas = Array.isArray(cotacao.pecasEscolhidas)
    ? cotacao.pecasEscolhidas.map((choice) => ({
        pecaId: choice.pecaId || "",
        nomePeca: choice.nomePeca || "Peça não informada",
        quantidade: Number(choice.quantidade || 1),
        fornecedorId: choice.fornecedorId || "",
        fornecedorNome: choice.fornecedorNome || "Fornecedor não informado",
        preco: Number(choice.preco || 0),
        marca: choice.marca || "",
        observacao: choice.observacao || "",
        dataEscolha: choice.dataEscolha || new Date().toISOString(),
      }))
    : [];

  return {
    ...cotacao,
    id: cotacao.id || createCotacaoId(),
    osId: cotacao.osId || "",
    oficinaNome: cotacao.oficinaNome || "",
    fornecedorId: cotacao.fornecedorId || "",
    fornecedorNome: cotacao.fornecedorNome || "Fornecedor não informado",
    fornecedorWhatsapp: cotacao.fornecedorWhatsapp || "",
    peca: cotacao.peca || "Peça não informada",
    quantidade: Number(cotacao.quantidade || 1),
    pecas,
    urgencia: cotacao.urgencia === "Urgente" ? "Urgente" : "Normal",
    observacao: cotacao.observacao || "",
    fotos,
    clienteNome: cotacao.clienteNome || "",
    clienteTelefone: cotacao.clienteTelefone || "",
    veiculo: {
      marca: cotacao.veiculo?.marca || "",
      modelo: cotacao.veiculo?.modelo || "",
      ano: cotacao.veiculo?.ano || "",
      motor: cotacao.veiculo?.motor || "",
      combustivel: cotacao.veiculo?.combustivel || "",
      placa: cotacao.veiculo?.placa || "",
      chassi: cotacao.veiculo?.chassi || "",
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
    pecasEscolhidas,
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
    | "pecasEscolhidas"
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
    pecasEscolhidas: [],
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
