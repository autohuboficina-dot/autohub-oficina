import { useMemo, useState, type FormEvent } from "react";
import BackButton from "../../components/ui/BackButton";
import {
  getCotacoes,
  saveCotacao,
  updateCotacao,
  type CotacaoPeca,
  type CotacaoPecaEscolha,
  type CotacaoStatus,
} from "../../services/cotacoesService";
import {
  getFornecedores,
  type Fornecedor,
} from "../../services/fornecedoresService";
import { getConfiguracoesOficina } from "../../services/configuracoesService";
import { addItemEstoque } from "../../services/estoqueService";

type CompraAvulsaForm = {
  fornecedorId: string;
  item: string;
  quantidade: string;
  valorUnitario: string;
  observacoes: string;
};

const blankCompraAvulsaForm: CompraAvulsaForm = {
  fornecedorId: "",
  item: "",
  quantidade: "1",
  valorUnitario: "",
  observacoes: "",
};

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

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function getCotacaoStatusBadgeClass(status: CotacaoStatus) {
  const classes: Record<CotacaoStatus, string> = {
    "Cotação enviada": "bg-sky-500/15 text-sky-200 ring-sky-400/30",
    "Resposta recebida": "bg-cyan-500/15 text-cyan-200 ring-cyan-400/30",
    "Fornecedor escolhido":
      "bg-violet-500/15 text-violet-200 ring-violet-400/30",
    "Cotação parcial": "bg-amber-500/15 text-amber-200 ring-amber-400/30",
    "Cotação concluída":
      "bg-emerald-500/15 text-emerald-200 ring-emerald-400/30",
    "Aguardando aprovação do cliente":
      "bg-amber-500/15 text-amber-200 ring-amber-400/30",
    "Aprovada pelo cliente":
      "bg-emerald-500/15 text-emerald-200 ring-emerald-400/30",
    "Não aprovada pelo cliente": "bg-red-500/15 text-red-200 ring-red-400/30",
    "Compra confirmada com fornecedor":
      "bg-green-500/15 text-green-200 ring-green-400/30",
    Cancelada: "bg-slate-700/70 text-slate-200 ring-slate-500/30",
  };

  return `rounded-full px-2 py-1 text-xs font-medium ring-1 ${classes[status]}`;
}

function getConfirmedValue(cotacao: CotacaoPeca) {
  if (cotacao.pecasEscolhidas.length > 0) {
    return cotacao.pecasEscolhidas.reduce(
      (total, escolha) => total + escolha.preco * escolha.quantidade,
      0,
    );
  }

  if (cotacao.valorSelecionado > 0) {
    return cotacao.valorSelecionado;
  }

  if (cotacao.precoFinalPeca > 0) {
    return cotacao.precoFinalPeca * Math.max(cotacao.quantidade, 1);
  }

  return null;
}

function getFornecedorName(cotacao: CotacaoPeca) {
  return (
    cotacao.fornecedorEscolhidoNome ||
    cotacao.fornecedorSelecionado ||
    cotacao.fornecedorNome ||
    "Fornecedor não informado"
  );
}

export default function Compras() {
  const [fornecedores] = useState<Fornecedor[]>(() => getFornecedores());
  const [oficinaConfig] = useState(() => getConfiguracoesOficina());
  const [cotacoes, setCotacoes] = useState<CotacaoPeca[]>(() => getCotacoes());
  const [showCompraAvulsaForm, setShowCompraAvulsaForm] = useState(false);
  const [compraAvulsaForm, setCompraAvulsaForm] =
    useState<CompraAvulsaForm>(blankCompraAvulsaForm);
  const [feedback, setFeedback] = useState("");

  const selectedFornecedor = useMemo(
    () =>
      fornecedores.find(
        (fornecedor) => fornecedor.id === compraAvulsaForm.fornecedorId,
      ),
    [compraAvulsaForm.fornecedorId, fornecedores],
  );

  const sortedCotacoes = useMemo(
    () =>
      [...cotacoes].sort(
        (first, second) =>
          new Date(second.enviadaEm).getTime() -
          new Date(first.enviadaEm).getTime(),
      ),
    [cotacoes],
  );

  const inputClass =
    "w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none transition focus:border-sky-500";
  const labelClass = "mb-2 block text-sm font-medium text-slate-300";
  const sectionClass =
    "rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-sm shadow-slate-950/20 sm:p-6";

  function updateCompraAvulsaField(
    field: keyof CompraAvulsaForm,
    value: string,
  ) {
    setCompraAvulsaForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  function resetCompraAvulsaForm() {
    setCompraAvulsaForm(blankCompraAvulsaForm);
    setShowCompraAvulsaForm(false);
  }

  function handleCompraAvulsaSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback("");

    if (!selectedFornecedor) {
      setFeedback("Selecione um fornecedor antes de registrar a compra.");
      return;
    }

    if (!compraAvulsaForm.item.trim()) {
      setFeedback("Informe o item ou peça da compra avulsa.");
      return;
    }

    const quantidade = Math.max(Number(compraAvulsaForm.quantidade || 1), 1);
    const valorUnitario = Number(compraAvulsaForm.valorUnitario || 0);

    if (valorUnitario <= 0) {
      setFeedback("Informe um valor unitário maior que zero.");
      return;
    }

    const pecaId = "peca-avulsa-1";
    const escolha: CotacaoPecaEscolha = {
      pecaId,
      nomePeca: compraAvulsaForm.item.trim(),
      quantidade,
      fornecedorId: selectedFornecedor.id,
      fornecedorNome: selectedFornecedor.nome,
      preco: valorUnitario,
      marca: "",
      observacao: compraAvulsaForm.observacoes.trim(),
      dataEscolha: new Date().toISOString(),
    };
    const cotacao = saveCotacao({
      osId: null,
      oficinaNome: oficinaConfig.nomeOficina,
      fornecedorId: selectedFornecedor.id,
      fornecedorNome: selectedFornecedor.nome,
      fornecedorWhatsapp: selectedFornecedor.whatsapp,
      peca: compraAvulsaForm.item.trim(),
      quantidade,
      pecas: [
        {
          id: pecaId,
          peca: compraAvulsaForm.item.trim(),
          quantidade,
          observacao: compraAvulsaForm.observacoes.trim(),
        },
      ],
      urgencia: "Normal",
      observacao: compraAvulsaForm.observacoes.trim(),
      fotos: [],
      clienteNome: "",
      clienteTelefone: "",
      veiculo: {
        marca: "",
        modelo: "",
        ano: "",
        motor: "",
        combustivel: "",
        placa: "",
        chassi: "",
      },
    });
    const confirmedCotacao = updateCotacao({
      ...cotacao,
      status: "Compra confirmada com fornecedor",
      fornecedorEscolhidoId: selectedFornecedor.id,
      fornecedorEscolhidoNome: selectedFornecedor.nome,
      precoFinalPeca: valorUnitario,
      fornecedorSelecionado: selectedFornecedor.nome,
      valorSelecionado: valorUnitario * quantidade,
      pecasEscolhidas: [escolha],
    });

    addItemEstoque({
      nome: compraAvulsaForm.item.trim(),
      quantidade,
      valorUnitario,
      fornecedor: selectedFornecedor.nome,
      compraId: confirmedCotacao.id,
      movimentacaoId: `entrada-compra-${confirmedCotacao.id}`,
      descricao: "Compra avulsa para reposição de estoque.",
    });

    setCotacoes((currentCotacoes) => [confirmedCotacao, ...currentCotacoes]);
    setFeedback("Compra avulsa registrada com sucesso.");
    resetCompraAvulsaForm();
  }

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <BackButton className="mb-4" />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold">Compras</h2>
            <p className="mt-2 text-slate-400">
              Histórico de cotações e compras avulsas para reposição de estoque.
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-300">
            <span className="font-semibold text-sky-300">
              {cotacoes.length}
            </span>{" "}
            registro(s)
          </div>
        </div>
      </div>

      {feedback && (
        <div className="mb-6 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-200">
          {feedback}
        </div>
      )}

      <section className={`${sectionClass} mb-6`}>
        <div className="mb-5">
          <h3 className="text-xl font-bold">Histórico de cotações</h3>
          <p className="mt-1 text-sm text-slate-400">
            Acompanhe todas as cotações vinculadas às ordens de serviço.
          </p>
        </div>

        {sortedCotacoes.length === 0 ? (
          <p className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-400">
            Nenhuma cotação registrada ainda. As cotações são criadas na tela de
            cada OS.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="text-slate-400">
                <tr>
                  <th className="py-3 pr-4 text-left">OS</th>
                  <th className="py-3 pr-4 text-left">Peça</th>
                  <th className="py-3 pr-4 text-left">Fornecedor</th>
                  <th className="py-3 pr-4 text-left">Status</th>
                  <th className="py-3 pr-4 text-left">Data de envio</th>
                  <th className="py-3 text-left">Valor confirmado</th>
                </tr>
              </thead>
              <tbody>
                {sortedCotacoes.map((cotacao) => {
                  const confirmedValue = getConfirmedValue(cotacao);

                  return (
                    <tr key={cotacao.id} className="border-t border-slate-800">
                      <td className="py-3 pr-4 font-medium text-slate-100">
                        {cotacao.osId || "Compra avulsa"}
                      </td>
                      <td className="py-3 pr-4 text-slate-300">
                        {cotacao.peca || "Peça não informada"}
                      </td>
                      <td className="py-3 pr-4 text-slate-300">
                        {getFornecedorName(cotacao)}
                      </td>
                      <td className="py-3 pr-4">
                        <span className={getCotacaoStatusBadgeClass(cotacao.status)}>
                          {cotacao.status}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-slate-300">
                        {formatDate(cotacao.enviadaEm)}
                      </td>
                      <td className="py-3 font-semibold text-slate-100">
                        {confirmedValue === null
                          ? "-"
                          : formatCurrency(confirmedValue)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={sectionClass}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold">Compra avulsa</h3>
            <p className="mt-1 text-sm text-slate-400">
              Para reposição de estoque sem vínculo com OS.
            </p>
          </div>

          {!showCompraAvulsaForm && (
            <button
              type="button"
              onClick={() => setShowCompraAvulsaForm(true)}
              className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-400"
            >
              Nova compra avulsa
            </button>
          )}
        </div>

        {showCompraAvulsaForm && (
          <form className="mt-6 grid gap-5" onSubmit={handleCompraAvulsaSubmit}>
            <div>
              <label className={labelClass}>Fornecedor</label>
              <select
                className={inputClass}
                value={compraAvulsaForm.fornecedorId}
                onChange={(event) =>
                  updateCompraAvulsaField("fornecedorId", event.target.value)
                }
              >
                <option value="">Selecione um fornecedor</option>
                {fornecedores.map((fornecedor) => (
                  <option key={fornecedor.id} value={fornecedor.id}>
                    {fornecedor.nome} - {fornecedor.categoria}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-5 md:grid-cols-[1fr_160px_180px]">
              <div>
                <label className={labelClass}>Item / peça</label>
                <input
                  className={inputClass}
                  placeholder="Filtro, óleo, pastilha..."
                  value={compraAvulsaForm.item}
                  onChange={(event) =>
                    updateCompraAvulsaField("item", event.target.value)
                  }
                />
              </div>

              <div>
                <label className={labelClass}>Quantidade</label>
                <input
                  className={inputClass}
                  min="1"
                  type="number"
                  value={compraAvulsaForm.quantidade}
                  onChange={(event) =>
                    updateCompraAvulsaField("quantidade", event.target.value)
                  }
                />
              </div>

              <div>
                <label className={labelClass}>Valor unitário</label>
                <input
                  className={inputClass}
                  min="0"
                  step="0.01"
                  type="number"
                  value={compraAvulsaForm.valorUnitario}
                  onChange={(event) =>
                    updateCompraAvulsaField("valorUnitario", event.target.value)
                  }
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>
                Observações <span className="text-slate-500">(opcional)</span>
              </label>
              <textarea
                rows={4}
                className={inputClass}
                placeholder="Condição comercial, lote, previsão de entrega..."
                value={compraAvulsaForm.observacoes}
                onChange={(event) =>
                  updateCompraAvulsaField("observacoes", event.target.value)
                }
              />
            </div>

            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={resetCompraAvulsaForm}
                className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-800"
              >
                Cancelar
              </button>

              <button
                type="submit"
                className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-400"
              >
                Registrar compra
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
