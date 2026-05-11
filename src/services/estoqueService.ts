import {
  addItemEstoque,
  getEstoque,
  registrarSaidaEstoque,
  removeItemEstoque,
  updateItemEstoque,
  type EstoqueItem,
} from "../pages/estoque/estoqueStorage";

export type {
  EstoqueItem,
  EstoqueMovimentacao,
  EstoqueMovimentacaoOrigem,
  EstoqueMovimentacaoTipo,
  NotaFiscalImportada,
  ProdutoEstoque,
} from "../pages/estoque/estoqueStorage";

export {
  addItemEstoque,
  atualizarProdutoEstoque,
  baixarProdutoPorOS,
  criarProdutoEstoque,
  getEstoque,
  getEstoqueMovimentacoes,
  getNotasFiscaisImportadas,
  getProdutosEstoque,
  registrarSaidaEstoque,
  removeItemEstoque,
  registrarEntradaProduto,
  reverterBaixaProdutoPorOS,
  salvarNotaFiscalImportada,
  updateItemEstoque,
} from "../pages/estoque/estoqueStorage";

export function getAll() {
  return getEstoque();
}

export function getById(id: string) {
  return getEstoque().find((item) => item.id === id);
}

export function create(input: Parameters<typeof addItemEstoque>[0]) {
  return addItemEstoque(input);
}

export function update(item: EstoqueItem) {
  return updateItemEstoque(item);
}

export function remove(id: string) {
  return removeItemEstoque(id);
}

export const estoqueService = {
  getAll,
  getById,
  create,
  update,
  remove,
  registrarSaidaEstoque,
};
