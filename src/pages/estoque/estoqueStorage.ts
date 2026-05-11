import { createSecureId } from "../../utils/ids";

export type ProdutoEstoque = {
  id: string;
  nome: string;
  categoria: string;
  unidade: string;
  estoque_atual: number;
  estoque_minimo: number;
  valor_custo_medio: number;
  ativo: boolean;
};

export type EstoqueMovimentacaoTipo = "entrada" | "saida" | "ajuste";
export type EstoqueMovimentacaoOrigem = "xml_nf" | "manual" | "os" | "ajuste";

export type EstoqueMovimentacao = {
  id: string;
  produto_id: string;
  produto_nome: string;
  tipo: EstoqueMovimentacaoTipo;
  quantidade: number;
  valor_unitario: number;
  origem: EstoqueMovimentacaoOrigem;
  nota_fiscal_id: string;
  os_codigo: string;
  observacao: string;
  created_at: string;
};

export type NotaFiscalImportada = {
  id: string;
  chave_acesso: string;
  numero: string;
  serie: string;
  data_emissao: string;
  fornecedor_nome: string;
  fornecedor_cnpj: string;
  valor_total: number;
  created_at: string;
};

export type EstoqueItem = {
  id: string;
  nome: string;
  quantidade: number;
  valorUnitario: number;
  fornecedor: string;
  dataEntrada: string;
  osId: string;
  historicoMovimentacao: Array<{
    id: string;
    tipo: EstoqueMovimentacaoTipo;
    quantidade: number;
    valorUnitario: number;
    fornecedor: string;
    osId: string;
    compraId: string;
    descricao: string;
    data: string;
  }>;
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

type RegistrarEntradaProdutoInput = {
  produtoId: string;
  quantidade: number;
  valorUnitario: number;
  origem: EstoqueMovimentacaoOrigem;
  notaFiscalId?: string;
  osCodigo?: string;
  observacao?: string;
  createdAt?: string;
  movimentacaoId?: string;
};

const LEGACY_ESTOQUE_KEY = "autohub:estoque";
const PRODUTOS_KEY = "autohub:produtos";
const MOVIMENTACOES_KEY = "autohub:estoque-movimentacoes";
const NOTAS_FISCAIS_KEY = "autohub:notas-fiscais";

function createProdutoId() {
  return createSecureId("PROD");
}

function createMovimentacaoId() {
  return createSecureId("MOV");
}

function createNotaFiscalId() {
  return createSecureId("NF");
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function readArray<T>(key: string): T[] {
  const storedValue = localStorage.getItem(key);

  if (!storedValue) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(storedValue) as T[];
    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch {
    return [];
  }
}

function saveProdutos(produtos: ProdutoEstoque[]) {
  localStorage.setItem(PRODUTOS_KEY, JSON.stringify(produtos.map(normalizeProduto)));
}

function saveMovimentacoes(movimentacoes: EstoqueMovimentacao[]) {
  localStorage.setItem(
    MOVIMENTACOES_KEY,
    JSON.stringify(movimentacoes.map(normalizeMovimentacao)),
  );
}

function saveNotasFiscais(notas: NotaFiscalImportada[]) {
  localStorage.setItem(
    NOTAS_FISCAIS_KEY,
    JSON.stringify(notas.map(normalizeNotaFiscal)),
  );
}

function normalizeProduto(produto: ProdutoEstoque): ProdutoEstoque {
  return {
    id: produto.id || createProdutoId(),
    nome: produto.nome || "Produto sem nome",
    categoria: produto.categoria || "Geral",
    unidade: produto.unidade || "un",
    estoque_atual: Number(produto.estoque_atual || 0),
    estoque_minimo: Number(produto.estoque_minimo || 0),
    valor_custo_medio: Number(produto.valor_custo_medio || 0),
    ativo: produto.ativo !== false,
  };
}

function normalizeMovimentacao(
  movimentacao: EstoqueMovimentacao,
): EstoqueMovimentacao {
  const tipo: EstoqueMovimentacaoTipo = ["entrada", "saida", "ajuste"].includes(
    movimentacao.tipo,
  )
    ? movimentacao.tipo
    : "ajuste";
  const origem: EstoqueMovimentacaoOrigem = [
    "xml_nf",
    "manual",
    "os",
    "ajuste",
  ].includes(movimentacao.origem)
    ? movimentacao.origem
    : "ajuste";

  return {
    id: movimentacao.id || createMovimentacaoId(),
    produto_id: movimentacao.produto_id || "",
    produto_nome: movimentacao.produto_nome || "Produto sem nome",
    tipo,
    quantidade: Number(movimentacao.quantidade || 0),
    valor_unitario: Number(movimentacao.valor_unitario || 0),
    origem,
    nota_fiscal_id: movimentacao.nota_fiscal_id || "",
    os_codigo: movimentacao.os_codigo || "",
    observacao: movimentacao.observacao || "",
    created_at: movimentacao.created_at || new Date().toISOString(),
  };
}

function normalizeNotaFiscal(nota: NotaFiscalImportada): NotaFiscalImportada {
  return {
    id: nota.id || createNotaFiscalId(),
    chave_acesso: nota.chave_acesso || "",
    numero: nota.numero || "",
    serie: nota.serie || "",
    data_emissao: nota.data_emissao || "",
    fornecedor_nome: nota.fornecedor_nome || "",
    fornecedor_cnpj: nota.fornecedor_cnpj || "",
    valor_total: Number(nota.valor_total || 0),
    created_at: nota.created_at || new Date().toISOString(),
  };
}

function migrateLegacyEstoqueIfNeeded() {
  if (localStorage.getItem(PRODUTOS_KEY)) {
    return;
  }

  const legacyItems = readArray<EstoqueItem>(LEGACY_ESTOQUE_KEY);

  if (!legacyItems.length) {
    return;
  }

  const produtos = legacyItems.map((item) =>
    normalizeProduto({
      id: item.id || createProdutoId(),
      nome: item.nome,
      categoria: "Geral",
      unidade: "un",
      estoque_atual: Number(item.quantidade || 0),
      estoque_minimo: 1,
      valor_custo_medio: Number(item.valorUnitario || 0),
      ativo: true,
    }),
  );
  const movimentacoes = legacyItems.flatMap((item) =>
    (item.historicoMovimentacao || []).map((movimentacao) =>
      normalizeMovimentacao({
        id: movimentacao.id,
        produto_id: item.id,
        produto_nome: item.nome,
        tipo: movimentacao.tipo,
        quantidade: movimentacao.quantidade,
        valor_unitario: movimentacao.valorUnitario,
        origem: movimentacao.osId ? "os" : "manual",
        nota_fiscal_id: "",
        os_codigo: movimentacao.osId,
        observacao: movimentacao.descricao,
        created_at: movimentacao.data,
      }),
    ),
  );

  saveProdutos(produtos);
  saveMovimentacoes(movimentacoes);
}

export function getProdutosEstoque(): ProdutoEstoque[] {
  migrateLegacyEstoqueIfNeeded();
  return readArray<ProdutoEstoque>(PRODUTOS_KEY).map(normalizeProduto);
}

export function getEstoqueMovimentacoes(): EstoqueMovimentacao[] {
  migrateLegacyEstoqueIfNeeded();
  return readArray<EstoqueMovimentacao>(MOVIMENTACOES_KEY)
    .map(normalizeMovimentacao)
    .sort(
      (first, second) =>
        new Date(second.created_at).getTime() -
        new Date(first.created_at).getTime(),
    );
}

export function getNotasFiscaisImportadas(): NotaFiscalImportada[] {
  return readArray<NotaFiscalImportada>(NOTAS_FISCAIS_KEY).map(normalizeNotaFiscal);
}

export function criarProdutoEstoque(
  produto: Omit<ProdutoEstoque, "id"> & { id?: string },
) {
  const newProduto = normalizeProduto({
    ...produto,
    id: produto.id || createProdutoId(),
  });
  saveProdutos([newProduto, ...getProdutosEstoque()]);
  return newProduto;
}

export function atualizarProdutoEstoque(
  produtoId: string,
  updates: Partial<Omit<ProdutoEstoque, "id">>,
) {
  let updatedProduto: ProdutoEstoque | undefined;
  const produtos = getProdutosEstoque().map((produto) => {
    if (produto.id !== produtoId) {
      return produto;
    }

    updatedProduto = normalizeProduto({
      ...produto,
      ...updates,
      id: produto.id,
    });
    return updatedProduto;
  });

  saveProdutos(produtos);
  return updatedProduto;
}

function registrarMovimentacao(input: EstoqueMovimentacao) {
  const movimentacoes = getEstoqueMovimentacoes();

  if (movimentacoes.some((movimentacao) => movimentacao.id === input.id)) {
    return;
  }

  saveMovimentacoes([normalizeMovimentacao(input), ...movimentacoes]);
}

export function registrarEntradaProduto(input: RegistrarEntradaProdutoInput) {
  const quantidade = Math.max(Number(input.quantidade || 0), 0);
  const valorUnitario = Math.max(Number(input.valorUnitario || 0), 0);

  if (!input.produtoId || quantidade <= 0) {
    return getProdutosEstoque();
  }

  let targetProduto: ProdutoEstoque | undefined;
  const produtos = getProdutosEstoque().map((produto) => {
    if (produto.id !== input.produtoId) {
      return produto;
    }

    const estoqueAtual = Number(produto.estoque_atual || 0);
    const custoAtual = Number(produto.valor_custo_medio || 0);
    const novoEstoque = estoqueAtual + quantidade;
    const novoMedio =
      novoEstoque > 0
        ? (estoqueAtual * custoAtual + quantidade * valorUnitario) / novoEstoque
        : valorUnitario;

    targetProduto = normalizeProduto({
      ...produto,
      estoque_atual: novoEstoque,
      valor_custo_medio: novoMedio,
    });
    return targetProduto;
  });

  if (!targetProduto) {
    return produtos;
  }

  saveProdutos(produtos);
  registrarMovimentacao({
    id: input.movimentacaoId || createMovimentacaoId(),
    produto_id: targetProduto.id,
    produto_nome: targetProduto.nome,
    tipo: "entrada",
    quantidade,
    valor_unitario: valorUnitario,
    origem: input.origem,
    nota_fiscal_id: input.notaFiscalId || "",
    os_codigo: input.osCodigo || "",
    observacao: input.observacao || "",
    created_at: input.createdAt || new Date().toISOString(),
  });
  return produtos;
}

export function salvarNotaFiscalImportada(
  nota: Omit<NotaFiscalImportada, "id" | "created_at">,
) {
  const newNota = normalizeNotaFiscal({
    ...nota,
    id: createNotaFiscalId(),
    created_at: new Date().toISOString(),
  });

  saveNotasFiscais([newNota, ...getNotasFiscaisImportadas()]);
  return newNota;
}

export function baixarProdutoPorOS(input: {
  nome: string;
  quantidade: number;
  osCodigo: string;
  observacao?: string;
  movimentacaoId?: string;
}) {
  const quantidade = Math.max(Number(input.quantidade || 0), 0);

  if (!input.nome.trim() || quantidade <= 0) {
    return;
  }

  const produtos = getProdutosEstoque();
  const targetProduto = produtos.find(
    (produto) => normalizeText(produto.nome) === normalizeText(input.nome),
  );

  if (!targetProduto || targetProduto.estoque_atual <= 0) {
    return;
  }

  const updatedProduto = {
    ...targetProduto,
    estoque_atual: targetProduto.estoque_atual - quantidade,
  };

  saveProdutos(
    produtos.map((produto) =>
      produto.id === targetProduto.id ? normalizeProduto(updatedProduto) : produto,
    ),
  );
  registrarMovimentacao({
    id: input.movimentacaoId || createMovimentacaoId(),
    produto_id: targetProduto.id,
    produto_nome: targetProduto.nome,
    tipo: "saida",
    quantidade,
    valor_unitario: targetProduto.valor_custo_medio,
    origem: "os",
    nota_fiscal_id: "",
    os_codigo: input.osCodigo,
    observacao: input.observacao || "",
    created_at: new Date().toISOString(),
  });
}

export function reverterBaixaProdutoPorOS(input: {
  nome: string;
  quantidade: number;
  osCodigo: string;
  origem?: EstoqueMovimentacaoOrigem;
  observacao?: string;
  movimentacaoId?: string;
}) {
  const quantidade = Math.max(Number(input.quantidade || 0), 0);

  if (!input.nome.trim() || quantidade <= 0) {
    return;
  }

  const produtos = getProdutosEstoque();
  const targetProduto = produtos.find(
    (produto) => normalizeText(produto.nome) === normalizeText(input.nome),
  );

  if (!targetProduto) {
    return;
  }

  saveProdutos(
    produtos.map((produto) =>
      produto.id === targetProduto.id
        ? normalizeProduto({
            ...produto,
            estoque_atual: produto.estoque_atual + quantidade,
          })
        : produto,
    ),
  );
  registrarMovimentacao({
    id: input.movimentacaoId || createMovimentacaoId(),
    produto_id: targetProduto.id,
    produto_nome: targetProduto.nome,
    tipo: "entrada",
    quantidade,
    valor_unitario: targetProduto.valor_custo_medio,
    origem: input.origem || "os",
    nota_fiscal_id: "",
    os_codigo: input.osCodigo,
    observacao: input.observacao || "",
    created_at: new Date().toISOString(),
  });
}

export function getEstoque(): EstoqueItem[] {
  const movimentacoes = getEstoqueMovimentacoes();

  return getProdutosEstoque().map((produto) => ({
    id: produto.id,
    nome: produto.nome,
    quantidade: produto.estoque_atual,
    valorUnitario: produto.valor_custo_medio,
    fornecedor: "",
    dataEntrada: "",
    osId: "",
    historicoMovimentacao: movimentacoes
      .filter((movimentacao) => movimentacao.produto_id === produto.id)
      .map((movimentacao) => ({
        id: movimentacao.id,
        tipo: movimentacao.tipo,
        quantidade: movimentacao.quantidade,
        valorUnitario: movimentacao.valor_unitario,
        fornecedor: "",
        osId: movimentacao.os_codigo,
        compraId: "",
        descricao: movimentacao.observacao,
        data: movimentacao.created_at,
      })),
  }));
}

export function addItemEstoque(input: EstoqueInput) {
  const existingProduto = getProdutosEstoque().find(
    (produto) => normalizeText(produto.nome) === normalizeText(input.nome),
  );
  const produto =
    existingProduto ||
    criarProdutoEstoque({
      nome: input.nome,
      categoria: "Geral",
      unidade: "un",
      estoque_atual: 0,
      estoque_minimo: 1,
      valor_custo_medio: Number(input.valorUnitario || 0),
      ativo: true,
    });

  return registrarEntradaProduto({
    produtoId: produto.id,
    quantidade: input.quantidade,
    valorUnitario: input.valorUnitario,
    origem: "manual",
    osCodigo: input.osId,
    observacao: input.descricao,
    createdAt: input.dataEntrada,
    movimentacaoId: input.movimentacaoId,
  });
}

export function updateItemEstoque(item: EstoqueItem) {
  return atualizarProdutoEstoque(item.id, {
    nome: item.nome,
    estoque_atual: item.quantidade,
    valor_custo_medio: item.valorUnitario,
  });
}

export function removeItemEstoque(itemId: string) {
  const produtos = getProdutosEstoque().filter((produto) => produto.id !== itemId);
  saveProdutos(produtos);
  return getEstoque();
}

export function registrarSaidaEstoque(input: EstoqueSaidaInput) {
  baixarProdutoPorOS({
    nome: input.nome,
    quantidade: input.quantidade,
    osCodigo: input.osId,
    observacao: input.descricao || "Saída para uso em OS",
    movimentacaoId: `saida-${input.osId}-${input.compraId || normalizeText(input.nome)}`,
  });
  return getEstoque();
}
