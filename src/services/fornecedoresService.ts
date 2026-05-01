import {
  deleteFornecedor,
  getFornecedores,
  saveFornecedor,
  updateFornecedor,
  type Fornecedor,
} from "../pages/fornecedores/fornecedoresStorage";

export type {
  Fornecedor,
  FornecedorCategoria,
} from "../pages/fornecedores/fornecedoresStorage";

export {
  deleteFornecedor,
  FORNECEDOR_CATEGORIAS,
  getFornecedores,
  saveFornecedor,
  updateFornecedor,
} from "../pages/fornecedores/fornecedoresStorage";

export function getAll() {
  return getFornecedores();
}

export function getById(id: string) {
  return getFornecedores().find((fornecedor) => fornecedor.id === id);
}

export function create(
  fornecedor: Omit<Fornecedor, "id" | "criadoEm" | "atualizadoEm">,
) {
  return saveFornecedor(fornecedor);
}

export function update(fornecedor: Fornecedor) {
  return updateFornecedor(fornecedor);
}

export function remove(id: string) {
  return deleteFornecedor(id);
}

export const fornecedoresService = {
  getAll,
  getById,
  create,
  update,
  remove,
};
