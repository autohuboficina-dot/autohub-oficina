import {
  deleteLancamento,
  getLancamentos,
  saveLancamento,
  updateLancamento,
  type LancamentoFinanceiro,
} from "../pages/financeiro/financeiroStorage";

export type {
  LancamentoCategoria,
  LancamentoFinanceiro,
  LancamentoOrigem,
  LancamentoStatus,
  LancamentoTipo,
} from "../pages/financeiro/financeiroStorage";

export {
  deleteLancamento,
  getLancamentos,
  LANCAMENTO_CATEGORIAS,
  LANCAMENTO_ORIGENS,
  LANCAMENTO_STATUS,
  LANCAMENTO_TIPOS,
  saveLancamento,
  updateLancamento,
} from "../pages/financeiro/financeiroStorage";

export function getAll() {
  return getLancamentos();
}

export function getById(id: string) {
  return getLancamentos().find((lancamento) => lancamento.id === id);
}

export function create(
  lancamento: Omit<LancamentoFinanceiro, "id" | "criadoEm" | "atualizadoEm">,
) {
  return saveLancamento(lancamento);
}

export function update(lancamento: LancamentoFinanceiro) {
  return updateLancamento(lancamento);
}

export function remove(id: string) {
  return deleteLancamento(id);
}

export const financeiroService = {
  getAll,
  getById,
  create,
  update,
  remove,
};
