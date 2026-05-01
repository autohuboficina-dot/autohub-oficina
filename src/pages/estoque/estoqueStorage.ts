export type EstoqueMovimentacaoTipo = "entrada" | "saida" | "ajuste";

export type EstoqueMovimentacao = {
  id: string;
  tipo: EstoqueMovimentacaoTipo;
  quantidade: number;
  valorUnitario: number;
  fornecedor: string;
  osId: string;
  compraId: string;
  descricao: string;
  data: string;
};

export type EstoqueItem = {
  id: string;
  nome: string;
  quantidade: number;
  valorUnitario: number;
  fornecedor: string;
  dataEntrada: string;
  osId: string;
  historicoMovimentacao: EstoqueMovimentacao[];
};

type EstoqueInput = {
  nome: string;
  quantidade: number;
  valorUnitario: number;
  fornecedor: string;
  dataEntrada?: string;
  osId?: string;
  compraId?: string;
  movimentacaoId?: string;
  descricao?: string;
};

type EstoqueSaidaInput = {
  nome: string;
  quantidade: number;
  osId: string;
  compraId?: string;
  descricao?: string;
};

const STORAGE_KEY = "autohub:estoque";

function createEstoqueId() {
  return createSecureId("EST");
}

function createMovimentacaoId() {
  return createSecureId("MOV");
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function normalizeMovimentacao(
  movimentacao: EstoqueMovimentacao,
): EstoqueMovimentacao {
  return {
    id: movimentacao.id || createMovimentacaoId(),
    tipo: ["entrada", "saida", "ajuste"].includes(movimentacao.tipo)
      ? movimentacao.tipo
      : "ajuste",
    quantidade: Number(movimentacao.quantidade || 0),
    valorUnitario: Number(movimentacao.valorUnitario || 0),
    fornecedor: movimentacao.fornecedor || "",
    osId: movimentacao.osId || "",
    compraId: movimentacao.compraId || "",
    descricao: movimentacao.descricao || "",
    data: movimentacao.data || new Date().toISOString(),
  };
}

function normalizeItem(item: EstoqueItem): EstoqueItem {
  return {
    id: item.id || createEstoqueId(),
    nome: item.nome || "Peça sem nome",
    quantidade: Number(item.quantidade || 0),
    valorUnitario: Number(item.valorUnitario || 0),
    fornecedor: item.fornecedor || "Fornecedor não informado",
    dataEntrada: item.dataEntrada || new Date().toISOString(),
    osId: item.osId || "",
    historicoMovimentacao: Array.isArray(item.historicoMovimentacao)
      ? item.historicoMovimentacao.map(normalizeMovimentacao)
      : [],
  };
}

function saveEstoque(items: EstoqueItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.map(normalizeItem)));
}

function hasMovimentacao(items: EstoqueItem[], movimentacaoId: string) {
  return items.some((item) =>
    item.historicoMovimentacao.some(
      (movimentacao) => movimentacao.id === movimentacaoId,
    ),
  );
}

function getMatchingItem(
  items: EstoqueItem[],
  nome: string,
  fornecedor: string,
) {
  const normalizedName = normalizeText(nome);
  const normalizedSupplier = normalizeText(fornecedor);

  return items.find(
    (item) =>
      normalizeText(item.nome) === normalizedName &&
      normalizeText(item.fornecedor) === normalizedSupplier,
  );
}

export function getEstoque(): EstoqueItem[] {
  const storedItems = localStorage.getItem(STORAGE_KEY);

  if (!storedItems) {
    return [];
  }

  try {
    const parsedItems = JSON.parse(storedItems) as EstoqueItem[];
    return Array.isArray(parsedItems) ? parsedItems.map(normalizeItem) : [];
  } catch {
    return [];
  }
}

export function addItemEstoque(input: EstoqueInput) {
  const quantidade = Math.max(Number(input.quantidade || 0), 0);
  const valorUnitario = Math.max(Number(input.valorUnitario || 0), 0);
  const now = input.dataEntrada || new Date().toISOString();
  const movimentacaoId = input.movimentacaoId || createMovimentacaoId();
  const currentItems = getEstoque();

  if (!input.nome.trim() || quantidade <= 0) {
    return currentItems;
  }

  if (hasMovimentacao(currentItems, movimentacaoId)) {
    return currentItems;
  }

  const fornecedor = input.fornecedor.trim() || "Fornecedor não informado";
  const movimentacao: EstoqueMovimentacao = {
    id: movimentacaoId,
    tipo: "entrada",
    quantidade,
    valorUnitario,
    fornecedor,
    osId: input.osId || "",
    compraId: input.compraId || "",
    descricao: input.descricao || "Entrada de estoque",
    data: now,
  };
  const existingItem = getMatchingItem(currentItems, input.nome, fornecedor);

  if (existingItem) {
    const updatedItems = currentItems.map((item) => {
      if (item.id !== existingItem.id) {
        return item;
      }

      const currentValue = item.quantidade * item.valorUnitario;
      const incomingValue = quantidade * valorUnitario;
      const nextQuantity = item.quantidade + quantidade;
      const nextAverageValue =
        nextQuantity > 0 ? (currentValue + incomingValue) / nextQuantity : 0;

      return {
        ...item,
        quantidade: nextQuantity,
        valorUnitario: nextAverageValue,
        dataEntrada: now,
        osId: input.osId || item.osId,
        historicoMovimentacao: [
          ...item.historicoMovimentacao,
          movimentacao,
        ],
      };
    });

    saveEstoque(updatedItems);
    return updatedItems;
  }

  const newItem: EstoqueItem = {
    id: createEstoqueId(),
    nome: input.nome.trim(),
    quantidade,
    valorUnitario,
    fornecedor,
    dataEntrada: now,
    osId: input.osId || "",
    historicoMovimentacao: [movimentacao],
  };
  const updatedItems = [newItem, ...currentItems];

  saveEstoque(updatedItems);
  return updatedItems;
}

export function updateItemEstoque(item: EstoqueItem) {
  const normalizedItem = normalizeItem(item);
  const updatedItems = getEstoque().map((currentItem) =>
    currentItem.id === item.id ? normalizedItem : currentItem,
  );

  saveEstoque(updatedItems);
  return normalizedItem;
}

export function removeItemEstoque(itemId: string) {
  const updatedItems = getEstoque().filter((item) => item.id !== itemId);
  saveEstoque(updatedItems);
  return updatedItems;
}

export function registrarSaidaEstoque(input: EstoqueSaidaInput) {
  const quantidade = Math.max(Number(input.quantidade || 0), 0);
  const movimentacaoId = `saida-${input.osId}-${input.compraId || normalizeText(input.nome)}`;
  const currentItems = getEstoque();

  if (!input.nome.trim() || !input.osId || quantidade <= 0) {
    return currentItems;
  }

  if (hasMovimentacao(currentItems, movimentacaoId)) {
    return currentItems;
  }

  const itemByCompra = input.compraId
    ? currentItems.find((item) =>
        item.historicoMovimentacao.some(
          (movimentacao) =>
            movimentacao.tipo === "entrada" &&
            movimentacao.compraId === input.compraId,
        ),
      )
    : undefined;
  const itemByName = currentItems.find(
    (item) => normalizeText(item.nome) === normalizeText(input.nome),
  );
  const targetItem = itemByCompra || itemByName;

  if (!targetItem) {
    return currentItems;
  }

  const removedQuantity = Math.min(targetItem.quantidade, quantidade);
  const movimentacao: EstoqueMovimentacao = {
    id: movimentacaoId,
    tipo: "saida",
    quantidade: removedQuantity,
    valorUnitario: targetItem.valorUnitario,
    fornecedor: targetItem.fornecedor,
    osId: input.osId,
    compraId: input.compraId || "",
    descricao: input.descricao || "Saída para uso em OS",
    data: new Date().toISOString(),
  };
  const updatedItems = currentItems.map((item) =>
    item.id === targetItem.id
      ? {
          ...item,
          quantidade: Math.max(item.quantidade - removedQuantity, 0),
          historicoMovimentacao: [
            ...item.historicoMovimentacao,
            movimentacao,
          ],
        }
      : item,
  );

  saveEstoque(updatedItems);
  return updatedItems;
}
import { createSecureId } from "../../utils/ids";
