import { useMemo, useState, type DragEvent, type FormEvent } from "react";
import { useToast } from "../../components/Toast";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import {
  atualizarProdutoEstoque,
  criarProdutoEstoque,
  getEstoqueMovimentacoes,
  getNotasFiscaisImportadas,
  getProdutosEstoque,
  registrarEntradaProduto,
  salvarNotaFiscalImportada,
  type EstoqueMovimentacao,
  type EstoqueMovimentacaoOrigem,
  type EstoqueMovimentacaoTipo,
  type NotaFiscalImportada,
  type ProdutoEstoque,
} from "../../services/estoqueService";

type TabId = "produtos" | "movimentacoes" | "xml" | "manual";
type XmlItemAction = "criar" | "vincular" | "ignorar";

type ParsedXmlItem = {
  id: string;
  descricao: string;
  quantidade: number;
  unidade: string;
  valorUnitario: number;
  action: XmlItemAction;
  nomeProduto: string;
  categoria: string;
  produtoId: string;
};

type ParsedNotaFiscal = {
  chaveAcesso: string;
  numero: string;
  serie: string;
  dataEmissao: string;
  fornecedorNome: string;
  fornecedorCnpj: string;
  valorTotal: number;
  itens: ParsedXmlItem[];
};

const tabs: { id: TabId; label: string }[] = [
  { id: "produtos", label: "Produtos" },
  { id: "movimentacoes", label: "Movimentações" },
  { id: "xml", label: "Importar XML" },
  { id: "manual", label: "Entrada manual" },
];

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(value: string) {
  const date = new Date(value);

  if (!value || Number.isNaN(date.getTime())) {
    return "Data indisponível";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function getTodayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function getElementText(parent: Element | Document, selector: string) {
  return parent.querySelector(selector)?.textContent?.trim() || "";
}

function parseNumber(value: string) {
  return Number(value.replace(",", ".") || 0);
}

function parseNotaFiscalXml(xmlText: string): ParsedNotaFiscal {
  const document = new DOMParser().parseFromString(xmlText, "text/xml");
  const parserError = document.querySelector("parsererror");

  if (parserError) {
    throw new Error("Não foi possível ler o XML informado.");
  }

  const infNFe = document.querySelector("infNFe");
  const rawId = infNFe?.getAttribute("Id") || "";
  const chaveAcesso = rawId.replace(/^NFe/i, "").replace(/\D/g, "");

  if (chaveAcesso.length !== 44) {
    throw new Error("Não foi possível identificar a chave de acesso da NF-e.");
  }

  const emit = document.querySelector("emit");
  const itens = Array.from(document.querySelectorAll("det")).map((det, index) => {
    const prod = det.querySelector("prod");
    const descricao = getElementText(prod || det, "xProd");

    return {
      id: `item-${index + 1}`,
      descricao,
      quantidade: parseNumber(getElementText(prod || det, "qCom")),
      unidade: getElementText(prod || det, "uCom") || "un",
      valorUnitario: parseNumber(getElementText(prod || det, "vUnCom")),
      action: "criar" as const,
      nomeProduto: descricao,
      categoria: "",
      produtoId: "",
    };
  });

  return {
    chaveAcesso,
    numero: getElementText(document, "ide > nNF"),
    serie: getElementText(document, "ide > serie"),
    dataEmissao:
      getElementText(document, "ide > dhEmi") || getElementText(document, "ide > dEmi"),
    fornecedorNome: emit ? getElementText(emit, "xNome") : "",
    fornecedorCnpj: emit ? getElementText(emit, "CNPJ") : "",
    valorTotal: parseNumber(getElementText(document, "total > ICMSTot > vNF")),
    itens,
  };
}

function createProdutoDraft() {
  return {
    nome: "",
    categoria: "",
    unidade: "un",
    estoque_minimo: "1",
  };
}

export default function Estoque() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<TabId>("produtos");
  const [produtos, setProdutos] = useState<ProdutoEstoque[]>(() =>
    getProdutosEstoque(),
  );
  const [movimentacoes, setMovimentacoes] = useState<EstoqueMovimentacao[]>(() =>
    getEstoqueMovimentacoes(),
  );
  const [notasFiscais, setNotasFiscais] = useState<NotaFiscalImportada[]>(() =>
    getNotasFiscaisImportadas(),
  );
  const [feedback, setFeedback] = useState("");
  const [editingProductId, setEditingProductId] = useState("");
  const [productDraft, setProductDraft] = useState(createProdutoDraft);
  const [isNewProductOpen, setIsNewProductOpen] = useState(false);
  const [movementTypeFilter, setMovementTypeFilter] = useState<
    EstoqueMovimentacaoTipo | ""
  >("");
  const [movementOriginFilter, setMovementOriginFilter] = useState<
    EstoqueMovimentacaoOrigem | ""
  >("");
  const [xmlError, setXmlError] = useState("");
  const [parsedNota, setParsedNota] = useState<ParsedNotaFiscal | null>(null);
  const [manualForm, setManualForm] = useState({
    produtoId: "",
    criarNovo: false,
    nome: "",
    categoria: "",
    unidade: "un",
    quantidade: "1",
    valorUnitario: "",
    fornecedor: "",
    data: getTodayInputValue(),
    observacao: "",
  });

  const filteredMovimentacoes = useMemo(
    () =>
      movimentacoes.filter((movimentacao) => {
        const typeMatch =
          !movementTypeFilter || movimentacao.tipo === movementTypeFilter;
        const originMatch =
          !movementOriginFilter || movimentacao.origem === movementOriginFilter;

        return typeMatch && originMatch;
      }),
    [movementOriginFilter, movementTypeFilter, movimentacoes],
  );
  const lowStockCount = produtos.filter(
    (produto) => produto.estoque_atual <= produto.estoque_minimo,
  ).length;
  const totalValue = produtos.reduce(
    (total, produto) =>
      total + produto.estoque_atual * produto.valor_custo_medio,
    0,
  );

  const inputClass =
    "w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none transition focus:border-sky-500";
  const labelClass = "mb-2 block text-sm font-medium text-slate-300";
  const sectionClass =
    "rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-sm shadow-slate-950/20 sm:p-6";

  function refreshEstoque() {
    setProdutos(getProdutosEstoque());
    setMovimentacoes(getEstoqueMovimentacoes());
    setNotasFiscais(getNotasFiscaisImportadas());
  }

  function openNewProductForm() {
    setProductDraft(createProdutoDraft());
    setEditingProductId("");
    setIsNewProductOpen(true);
  }

  function openEditProductForm(produto: ProdutoEstoque) {
    setProductDraft({
      nome: produto.nome,
      categoria: produto.categoria,
      unidade: produto.unidade,
      estoque_minimo: String(produto.estoque_minimo),
    });
    setEditingProductId(produto.id);
    setIsNewProductOpen(false);
  }

  function handleProductSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!productDraft.nome.trim()) {
      setFeedback("Informe o nome do produto.");
      return;
    }

    if (editingProductId) {
      atualizarProdutoEstoque(editingProductId, {
        nome: productDraft.nome.trim(),
        categoria: productDraft.categoria.trim() || "Geral",
        estoque_minimo: Number(productDraft.estoque_minimo || 0),
      });
      setFeedback("Produto atualizado.");
    } else {
      criarProdutoEstoque({
        nome: productDraft.nome.trim(),
        categoria: productDraft.categoria.trim() || "Geral",
        unidade: productDraft.unidade.trim() || "un",
        estoque_atual: 0,
        estoque_minimo: Number(productDraft.estoque_minimo || 1),
        valor_custo_medio: 0,
        ativo: true,
      });
      setFeedback("Produto criado.");
    }

    setProductDraft(createProdutoDraft());
    setEditingProductId("");
    setIsNewProductOpen(false);
    refreshEstoque();
    toast.success("Produto salvo!");
  }

  function cancelProductForm() {
    setProductDraft(createProdutoDraft());
    setEditingProductId("");
    setIsNewProductOpen(false);
  }

  function handleXmlText(xmlText: string) {
    setXmlError("");
    setFeedback("");

    try {
      const nota = parseNotaFiscalXml(xmlText);
      const isDuplicated = notasFiscais.some(
        (storedNota) => storedNota.chave_acesso === nota.chaveAcesso,
      );

      if (isDuplicated) {
        setParsedNota(null);
        setXmlError("Esta nota fiscal já foi importada anteriormente.");
        return;
      }

      setParsedNota(nota);
    } catch (error) {
      setParsedNota(null);
      setXmlError(
        error instanceof Error ? error.message : "Não foi possível importar o XML.",
      );
    }
  }

  function handleXmlFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".xml")) {
      setXmlError("Selecione um arquivo XML válido.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => handleXmlText(String(reader.result || ""));
    reader.onerror = () => setXmlError("Não foi possível ler o arquivo XML.");
    reader.readAsText(file);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    const file = event.dataTransfer.files[0];

    if (file) {
      handleXmlFile(file);
    }
  }

  function updateXmlItem(itemId: string, updates: Partial<ParsedXmlItem>) {
    setParsedNota((currentNota) =>
      currentNota
        ? {
            ...currentNota,
            itens: currentNota.itens.map((item) =>
              item.id === itemId ? { ...item, ...updates } : item,
            ),
          }
        : currentNota,
    );
  }

  function handleConfirmXmlImport() {
    if (!parsedNota) {
      return;
    }

    const nota = salvarNotaFiscalImportada({
      chave_acesso: parsedNota.chaveAcesso,
      numero: parsedNota.numero,
      serie: parsedNota.serie,
      data_emissao: parsedNota.dataEmissao,
      fornecedor_nome: parsedNota.fornecedorNome,
      fornecedor_cnpj: parsedNota.fornecedorCnpj,
      valor_total: parsedNota.valorTotal,
    });

    parsedNota.itens
      .filter((item) => item.action !== "ignorar")
      .forEach((item) => {
        const produto =
          item.action === "criar"
            ? criarProdutoEstoque({
                nome: item.nomeProduto.trim() || item.descricao,
                categoria: item.categoria.trim() || "Geral",
                unidade: item.unidade || "un",
                estoque_atual: 0,
                estoque_minimo: 1,
                valor_custo_medio: item.valorUnitario,
                ativo: true,
              })
            : produtos.find((produtoItem) => produtoItem.id === item.produtoId);

        if (!produto) {
          return;
        }

        registrarEntradaProduto({
          produtoId: produto.id,
          quantidade: item.quantidade,
          valorUnitario: item.valorUnitario,
          origem: "xml_nf",
          notaFiscalId: nota.id,
          observacao: `NF ${parsedNota.numero || parsedNota.chaveAcesso}`,
        });
      });

    setParsedNota(null);
    setFeedback("Nota fiscal importada com sucesso.");
    refreshEstoque();
    toast.success("Nota fiscal importada!");
  }

  function handleManualSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const quantidade = Math.max(Number(manualForm.quantidade || 0), 0);
    const valorUnitario = Math.max(Number(manualForm.valorUnitario || 0), 0);

    if (quantidade <= 0 || valorUnitario <= 0) {
      setFeedback("Informe quantidade e valor unitário válidos.");
      return;
    }

    const produto = manualForm.criarNovo
      ? criarProdutoEstoque({
          nome: manualForm.nome.trim(),
          categoria: manualForm.categoria.trim() || "Geral",
          unidade: manualForm.unidade.trim() || "un",
          estoque_atual: 0,
          estoque_minimo: 1,
          valor_custo_medio: valorUnitario,
          ativo: true,
        })
      : produtos.find((produtoItem) => produtoItem.id === manualForm.produtoId);

    if (!produto || !produto.nome.trim()) {
      setFeedback("Selecione ou crie um produto para registrar a entrada.");
      return;
    }

    registrarEntradaProduto({
      produtoId: produto.id,
      quantidade,
      valorUnitario,
      origem: "manual",
      observacao: [manualForm.fornecedor.trim(), manualForm.observacao.trim()]
        .filter(Boolean)
        .join(" - "),
      createdAt: new Date(`${manualForm.data}T12:00:00`).toISOString(),
    });
    setManualForm({
      produtoId: "",
      criarNovo: false,
      nome: "",
      categoria: "",
      unidade: "un",
      quantidade: "1",
      valorUnitario: "",
      fornecedor: "",
      data: getTodayInputValue(),
      observacao: "",
    });
    setFeedback("Entrada manual registrada.");
    refreshEstoque();
    toast.success("Lançamento registrado!");
  }

  const { execute: executeProductSubmit, loading: savingProduct } =
    useAsyncAction(handleProductSubmit, {
      errorMessage: "Erro ao salvar produto",
    });
  const { execute: executeXmlImport, loading: importingXml } = useAsyncAction(
    async () => {
      handleConfirmXmlImport();
    },
    {
      errorMessage: "Erro ao importar XML",
    },
  );
  const { execute: executeManualSubmit, loading: savingManualEntry } =
    useAsyncAction(handleManualSubmit, {
      errorMessage: "Erro ao registrar",
    });

  return (
    <div className="max-w-7xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold">Estoque</h2>
          <p className="mt-2 text-slate-400">
            Produtos, movimentações, notas fiscais e entradas manuais.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm">
            <span className="text-slate-500">Produtos</span>
            <strong className="mt-1 block text-2xl text-white">
              {produtos.length}
            </strong>
          </div>
          <div className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm">
            <span className="text-red-200">Estoque baixo</span>
            <strong className="mt-1 block text-2xl text-white">
              {lowStockCount}
            </strong>
          </div>
          <div className="rounded-xl border border-sky-400/20 bg-sky-500/10 px-4 py-3 text-sm">
            <span className="text-sky-200">Valor em estoque</span>
            <strong className="mt-1 block text-2xl text-white">
              {formatCurrency(totalValue)}
            </strong>
          </div>
        </div>
      </div>

      {feedback && (
        <div className="mb-6 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-200">
          {feedback}
        </div>
      )}

      <div className="mb-6 flex gap-2 overflow-x-auto border-b border-slate-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition ${
              activeTab === tab.id
                ? "border-sky-400 bg-slate-900 text-sky-100"
                : "border-transparent text-slate-400 hover:bg-slate-900/70 hover:text-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "produtos" && (
        <section className={sectionClass}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold">Produtos</h3>
              <p className="mt-1 text-sm text-slate-400">
                Lista de produtos em autohub:produtos.
              </p>
            </div>
            <button
              type="button"
              onClick={openNewProductForm}
              className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-400"
            >
              Novo produto
            </button>
          </div>

          {(isNewProductOpen || editingProductId) && (
            <form
              className="mb-6 grid gap-4 rounded-xl border border-slate-800 bg-slate-950 p-4 md:grid-cols-4"
              onSubmit={(event) => {
                void executeProductSubmit(event);
              }}
            >
              <div>
                <label className={labelClass}>Nome</label>
                <input
                  className={inputClass}
                  value={productDraft.nome}
                  onChange={(event) =>
                    setProductDraft((draft) => ({
                      ...draft,
                      nome: event.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className={labelClass}>Categoria</label>
                <input
                  className={inputClass}
                  value={productDraft.categoria}
                  onChange={(event) =>
                    setProductDraft((draft) => ({
                      ...draft,
                      categoria: event.target.value,
                    }))
                  }
                />
              </div>
              {!editingProductId && (
                <div>
                  <label className={labelClass}>Unidade</label>
                  <input
                    className={inputClass}
                    value={productDraft.unidade}
                    onChange={(event) =>
                      setProductDraft((draft) => ({
                        ...draft,
                        unidade: event.target.value,
                      }))
                    }
                  />
                </div>
              )}
              <div>
                <label className={labelClass}>Estoque mínimo</label>
                <input
                  className={inputClass}
                  type="number"
                  min="0"
                  value={productDraft.estoque_minimo}
                  onChange={(event) =>
                    setProductDraft((draft) => ({
                      ...draft,
                      estoque_minimo: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="flex items-end gap-3 md:col-span-4">
                <button
                  type="submit"
                  disabled={savingProduct}
                  className="rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingProduct
                    ? "Salvando..."
                    : editingProductId
                      ? "Salvar produto"
                      : "Cadastrar produto"}
                </button>
                <button
                  type="button"
                  onClick={cancelProductForm}
                  className="rounded-lg border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-800"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="text-slate-400">
                <tr>
                  <th className="py-3 pr-4 text-left">Nome</th>
                  <th className="py-3 pr-4 text-left">Categoria</th>
                  <th className="py-3 pr-4 text-left">Unidade</th>
                  <th className="py-3 pr-4 text-left">Estoque atual</th>
                  <th className="py-3 pr-4 text-left">Estoque mínimo</th>
                  <th className="py-3 pr-4 text-left">Custo médio</th>
                  <th className="py-3 text-left">Ações</th>
                </tr>
              </thead>
              <tbody>
                {produtos.map((produto) => (
                  <tr key={produto.id} className="border-t border-slate-800">
                    <td className="py-3 pr-4">
                      <p className="font-semibold text-slate-100">
                        {produto.nome}
                      </p>
                      {produto.estoque_atual <= produto.estoque_minimo && (
                        <span className="mt-1 inline-flex rounded-full bg-red-500/15 px-2 py-1 text-xs font-semibold text-red-200 ring-1 ring-red-400/30">
                          Estoque baixo
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-slate-300">
                      {produto.categoria}
                    </td>
                    <td className="py-3 pr-4 text-slate-300">
                      {produto.unidade}
                    </td>
                    <td className="py-3 pr-4 text-slate-300">
                      {produto.estoque_atual}
                    </td>
                    <td className="py-3 pr-4 text-slate-300">
                      {produto.estoque_minimo}
                    </td>
                    <td className="py-3 pr-4 text-slate-300">
                      {formatCurrency(produto.valor_custo_medio)}
                    </td>
                    <td className="py-3">
                      <button
                        type="button"
                        onClick={() => openEditProductForm(produto)}
                        className="rounded bg-slate-800 px-3 py-1 text-xs text-slate-100 hover:bg-slate-700"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === "movimentacoes" && (
        <section className={sectionClass}>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold">Movimentações</h3>
              <p className="mt-1 text-sm text-slate-400">
                Histórico em ordem cronológica reversa.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <select
                className={inputClass}
                value={movementTypeFilter}
                onChange={(event) =>
                  setMovementTypeFilter(
                    event.target.value as EstoqueMovimentacaoTipo | "",
                  )
                }
              >
                <option value="">Todos os tipos</option>
                <option value="entrada">Entrada</option>
                <option value="saida">Saída</option>
                <option value="ajuste">Ajuste</option>
              </select>
              <select
                className={inputClass}
                value={movementOriginFilter}
                onChange={(event) =>
                  setMovementOriginFilter(
                    event.target.value as EstoqueMovimentacaoOrigem | "",
                  )
                }
              >
                <option value="">Todas as origens</option>
                <option value="xml_nf">XML NF</option>
                <option value="manual">Manual</option>
                <option value="os">OS</option>
                <option value="ajuste">Ajuste</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="text-slate-400">
                <tr>
                  <th className="py-3 pr-4 text-left">Data</th>
                  <th className="py-3 pr-4 text-left">Produto</th>
                  <th className="py-3 pr-4 text-left">Tipo</th>
                  <th className="py-3 pr-4 text-left">Qtd</th>
                  <th className="py-3 pr-4 text-left">Valor unit.</th>
                  <th className="py-3 pr-4 text-left">Origem</th>
                  <th className="py-3 text-left">OS</th>
                </tr>
              </thead>
              <tbody>
                {filteredMovimentacoes.map((movimentacao) => (
                  <tr key={movimentacao.id} className="border-t border-slate-800">
                    <td className="py-3 pr-4 text-slate-300">
                      {formatDate(movimentacao.created_at)}
                    </td>
                    <td className="py-3 pr-4 font-medium text-slate-100">
                      {movimentacao.produto_nome}
                    </td>
                    <td className="py-3 pr-4 text-slate-300">
                      {movimentacao.tipo}
                    </td>
                    <td className="py-3 pr-4 text-slate-300">
                      {movimentacao.quantidade}
                    </td>
                    <td className="py-3 pr-4 text-slate-300">
                      {formatCurrency(movimentacao.valor_unitario)}
                    </td>
                    <td className="py-3 pr-4 text-slate-300">
                      {movimentacao.origem}
                    </td>
                    <td className="py-3 text-slate-300">
                      {movimentacao.os_codigo || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === "xml" && (
        <section className={sectionClass}>
          <h3 className="text-xl font-bold">Importar XML</h3>
          <p className="mt-1 text-sm text-slate-400">
            Importe uma NF-e, confira os itens e confirme a entrada no estoque.
          </p>

          <label
            className="mt-5 flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-950 p-6 text-center hover:border-sky-400"
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
          >
            <span className="font-semibold text-slate-100">
              Arraste o XML aqui
            </span>
            <span className="mt-2 text-sm text-slate-400">
              ou clique para selecionar arquivo XML
            </span>
            <input
              type="file"
              accept=".xml"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];

                if (file) {
                  handleXmlFile(file);
                }
              }}
            />
          </label>

          {xmlError && (
            <p className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {xmlError}
            </p>
          )}

          {parsedNota && (
            <div className="mt-6 space-y-5">
              <div className="grid gap-4 rounded-xl border border-slate-800 bg-slate-950 p-4 md:grid-cols-3">
                <div>
                  <span className="text-xs uppercase text-slate-500">NF</span>
                  <p className="mt-1 font-semibold">
                    {parsedNota.numero || "-"} / Série {parsedNota.serie || "-"}
                  </p>
                </div>
                <div>
                  <span className="text-xs uppercase text-slate-500">
                    Emissão
                  </span>
                  <p className="mt-1 font-semibold">
                    {formatDate(parsedNota.dataEmissao)}
                  </p>
                </div>
                <div>
                  <span className="text-xs uppercase text-slate-500">
                    Valor total
                  </span>
                  <p className="mt-1 font-semibold">
                    {formatCurrency(parsedNota.valorTotal)}
                  </p>
                </div>
                <div className="md:col-span-3">
                  <span className="text-xs uppercase text-slate-500">
                    Fornecedor
                  </span>
                  <p className="mt-1 font-semibold">
                    {parsedNota.fornecedorNome || "-"} ·{" "}
                    {parsedNota.fornecedorCnpj || "-"}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px] text-sm">
                  <thead className="text-slate-400">
                    <tr>
                      <th className="py-3 pr-4 text-left">Descrição</th>
                      <th className="py-3 pr-4 text-left">Qtd</th>
                      <th className="py-3 pr-4 text-left">Unidade</th>
                      <th className="py-3 pr-4 text-left">Valor unit.</th>
                      <th className="py-3 text-left">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedNota.itens.map((item) => (
                      <tr key={item.id} className="border-t border-slate-800">
                        <td className="py-3 pr-4 text-slate-100">
                          {item.descricao}
                          {item.action === "criar" && (
                            <div className="mt-3 grid gap-2 md:grid-cols-2">
                              <input
                                className={inputClass}
                                value={item.nomeProduto}
                                onChange={(event) =>
                                  updateXmlItem(item.id, {
                                    nomeProduto: event.target.value,
                                  })
                                }
                              />
                              <input
                                className={inputClass}
                                placeholder="Categoria"
                                value={item.categoria}
                                onChange={(event) =>
                                  updateXmlItem(item.id, {
                                    categoria: event.target.value,
                                  })
                                }
                              />
                            </div>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-slate-300">
                          {item.quantidade}
                        </td>
                        <td className="py-3 pr-4 text-slate-300">
                          {item.unidade}
                        </td>
                        <td className="py-3 pr-4 text-slate-300">
                          {formatCurrency(item.valorUnitario)}
                        </td>
                        <td className="py-3">
                          <div className="grid gap-2">
                            <select
                              className={inputClass}
                              value={item.action}
                              onChange={(event) =>
                                updateXmlItem(item.id, {
                                  action: event.target.value as XmlItemAction,
                                })
                              }
                            >
                              <option value="criar">Criar novo produto</option>
                              <option value="vincular">Vincular a existente</option>
                              <option value="ignorar">Ignorar este item</option>
                            </select>
                            {item.action === "vincular" && (
                              <select
                                className={inputClass}
                                value={item.produtoId}
                                onChange={(event) =>
                                  updateXmlItem(item.id, {
                                    produtoId: event.target.value,
                                  })
                                }
                              >
                                <option value="">Selecione um produto</option>
                                {produtos.map((produto) => (
                                  <option key={produto.id} value={produto.id}>
                                    {produto.nome}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => void executeXmlImport()}
                  disabled={importingXml}
                  className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {importingXml ? "Importando..." : "Confirmar entrada no estoque"}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {activeTab === "manual" && (
        <section className={sectionClass}>
          <h3 className="text-xl font-bold">Entrada manual</h3>
          <p className="mt-1 text-sm text-slate-400">
            Registre reposições sem XML de nota fiscal.
          </p>

          <form
            className="mt-6 grid gap-5"
            onSubmit={(event) => {
              void executeManualSubmit(event);
            }}
          >
            <div>
              <label className={labelClass}>Produto</label>
              <select
                className={inputClass}
                value={manualForm.criarNovo ? "novo" : manualForm.produtoId}
                onChange={(event) => {
                  const value = event.target.value;
                  setManualForm((form) => ({
                    ...form,
                    criarNovo: value === "novo",
                    produtoId: value === "novo" ? "" : value,
                  }));
                }}
              >
                <option value="">Selecione um produto</option>
                <option value="novo">Criar novo produto</option>
                {produtos.map((produto) => (
                  <option key={produto.id} value={produto.id}>
                    {produto.nome}
                  </option>
                ))}
              </select>
            </div>

            {manualForm.criarNovo && (
              <div className="grid gap-5 md:grid-cols-3">
                <div>
                  <label className={labelClass}>Nome</label>
                  <input
                    className={inputClass}
                    value={manualForm.nome}
                    onChange={(event) =>
                      setManualForm((form) => ({
                        ...form,
                        nome: event.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <label className={labelClass}>Categoria</label>
                  <input
                    className={inputClass}
                    value={manualForm.categoria}
                    onChange={(event) =>
                      setManualForm((form) => ({
                        ...form,
                        categoria: event.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <label className={labelClass}>Unidade</label>
                  <input
                    className={inputClass}
                    value={manualForm.unidade}
                    onChange={(event) =>
                      setManualForm((form) => ({
                        ...form,
                        unidade: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            )}

            <div className="grid gap-5 md:grid-cols-4">
              <div>
                <label className={labelClass}>Quantidade</label>
                <input
                  className={inputClass}
                  type="number"
                  min="0"
                  value={manualForm.quantidade}
                  onChange={(event) =>
                    setManualForm((form) => ({
                      ...form,
                      quantidade: event.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className={labelClass}>Valor unitário</label>
                <input
                  className={inputClass}
                  type="number"
                  min="0"
                  step="0.01"
                  value={manualForm.valorUnitario}
                  onChange={(event) =>
                    setManualForm((form) => ({
                      ...form,
                      valorUnitario: event.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className={labelClass}>Fornecedor</label>
                <input
                  className={inputClass}
                  value={manualForm.fornecedor}
                  onChange={(event) =>
                    setManualForm((form) => ({
                      ...form,
                      fornecedor: event.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className={labelClass}>Data</label>
                <input
                  className={inputClass}
                  type="date"
                  value={manualForm.data}
                  onChange={(event) =>
                    setManualForm((form) => ({
                      ...form,
                      data: event.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Observação</label>
              <textarea
                className={inputClass}
                rows={4}
                value={manualForm.observacao}
                onChange={(event) =>
                  setManualForm((form) => ({
                    ...form,
                    observacao: event.target.value,
                  }))
                }
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingManualEntry}
                className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingManualEntry ? "Registrando..." : "Registrar entrada"}
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
