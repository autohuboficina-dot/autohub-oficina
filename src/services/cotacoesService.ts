import {
  getCotacoes,
  saveCotacao,
  updateCotacao,
  type CotacaoPeca,
} from "../pages/compras/comprasStorage";

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

export function create(
  cotacao: Parameters<typeof saveCotacao>[0],
) {
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
};
