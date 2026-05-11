import { useMemo, useState, type FormEvent } from "react";
import type { UserRole } from "../../accessControl";
import { getCotacoes } from "../../services/cotacoesService";
import { getStoredOrders } from "../../services/osService";
import {
  deleteLancamento,
  getLancamentos,
  LANCAMENTO_CATEGORIAS,
  LANCAMENTO_STATUS,
  LANCAMENTO_TIPOS,
  saveLancamento,
  updateLancamento,
  type LancamentoCategoria,
  type LancamentoFinanceiro,
  type LancamentoStatus,
  type LancamentoTipo,
} from "../../services/financeiroService";

type FinanceiroProps = {
  role: UserRole;
};

type FinanceMetric = {
  label: string;
  value: string;
  hint: string;
  tone?: "sky" | "emerald" | "amber" | "red" | "violet";
};

type LancamentoFormState = {
  tipo: LancamentoTipo;
  descricao: string;
  valor: string;
  data: string;
  status: LancamentoStatus;
  categoria: LancamentoCategoria;
};

const initialFormState: LancamentoFormState = {
  tipo: "Entrada",
  descricao: "",
  valor: "",
  data: new Date().toISOString().slice(0, 10),
  status: "Pendente",
  categoria: "Outros",
};

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

  return new Intl.DateTimeFormat("pt-BR").format(date);
}

function getCardClass(tone: FinanceMetric["tone"] = "sky") {
  const classes = {
    sky: "border-sky-400/20 bg-sky-500/10 text-sky-200",
    emerald: "border-emerald-400/20 bg-emerald-500/10 text-emerald-200",
    amber: "border-amber-400/20 bg-amber-500/10 text-amber-200",
    red: "border-red-400/20 bg-red-500/10 text-red-200",
    violet: "border-violet-400/20 bg-violet-500/10 text-violet-200",
  };

  return classes[tone];
}

function getStatusBadgeClass(status: LancamentoStatus) {
  return status === "Pago"
    ? "bg-emerald-500/15 text-emerald-200 ring-emerald-400/30"
    : "bg-amber-500/15 text-amber-200 ring-amber-400/30";
}

function getTypeBadgeClass(tipo: LancamentoTipo) {
  return tipo === "Entrada"
    ? "bg-sky-500/15 text-sky-200 ring-sky-400/30"
    : "bg-red-500/15 text-red-200 ring-red-400/30";
}

function getCotacaoTotal(cotacao: ReturnType<typeof getCotacoes>[number]) {
  return (
    Number(cotacao.valorSelecionado || cotacao.precoFinalPeca || 0) *
    Math.max(Number(cotacao.quantidade || 1), 1)
  );
}

function syncAutomaticLancamentos() {
  const orders = getStoredOrders();
  const cotacoes = getCotacoes();
  let lancamentos = getLancamentos();

  orders
    .filter((order) => order.statusAprovacao === "confirmado_oficina")
    .forEach((order) => {
      const baseDate =
        order.dataConfirmacaoOficina || order.dataDecisaoAprovacao || order.criadoEm;
      const paymentTotal =
        order.valorFinalPagamento ||
        (order.exigeEntrada ? order.saldoRestante : order.orcamento.totalFinal);
      const installments =
        order.formaPagamentoEscolhida === "Crédito"
          ? Math.max(order.parcelasEscolhidas || 1, 1)
          : 1;
      const saldoEntries = Array.from({ length: installments }, (_, index) => ({
        origemId:
          installments > 1
            ? `${order.id}:saldo-${index + 1}`
            : order.exigeEntrada
              ? `${order.id}:saldo`
              : order.id,
        descricao:
          installments > 1
            ? `Parcela ${index + 1}/${installments} da ${order.id} - ${order.cliente}`
            : order.exigeEntrada
              ? `Saldo restante da ${order.id} - ${order.cliente}`
              : `Receita prevista da ${order.id} - ${order.cliente}`,
        valor: paymentTotal / installments,
        status: "Pendente" as const,
        data: baseDate,
      }));
      const orderEntries = [
        ...(order.exigeEntrada
          ? [
              {
                origemId: `${order.id}:entrada`,
                descricao: `Entrada/sinal da ${order.id} - ${order.cliente}`,
                valor: Number(order.entradaCalculada || 0),
                status:
                  order.statusEntrada === "paga"
                    ? ("Pago" as const)
                    : ("Pendente" as const),
                data: order.dataPagamentoEntrada || baseDate,
              },
            ]
          : []),
        ...saldoEntries,
      ];

      orderEntries
        .filter((entry) => entry.valor > 0)
        .forEach((entry) => {
          const existingLancamento =
            lancamentos.find(
              (lancamento) =>
                lancamento.origem === "OS" &&
                lancamento.origemId === entry.origemId,
            ) ||
            lancamentos.find(
              (lancamento) =>
                order.exigeEntrada &&
                entry.origemId.endsWith(":entrada") &&
                lancamento.origem === "OS" &&
                lancamento.origemId === order.id,
            );
          const lancamentoData = {
            tipo: "Entrada" as const,
            descricao: `${entry.descricao}${
              order.descontoAplicado ||
              order.descontoPagamentoAplicado ||
              order.taxaAplicada ||
              order.taxaPagamentoAplicada
                ? ` (desconto ${formatCurrency(order.descontoAplicado || order.descontoPagamentoAplicado)}, taxa ${formatCurrency(order.taxaAplicada || order.taxaPagamentoAplicada)})`
                : ""
            }`,
            valor: entry.valor,
            data: entry.data,
            status:
              entry.origemId.endsWith(":entrada")
                ? entry.status
                : existingLancamento?.status || entry.status,
            categoria: "Mão de obra" as const,
            origem: "OS" as const,
            origemId: entry.origemId,
          };

          if (existingLancamento) {
            updateLancamento({
              ...existingLancamento,
              ...lancamentoData,
            });
          } else {
            saveLancamento(lancamentoData);
          }

          lancamentos = getLancamentos();
        });
    });

  cotacoes
    .filter((cotacao) => cotacao.status === "Compra confirmada com fornecedor")
    .forEach((cotacao) => {
      const existingLancamento = lancamentos.find(
        (lancamento) =>
          lancamento.origem === "Compra" && lancamento.origemId === cotacao.id,
      );
      const lancamentoData = {
        tipo: "Saída" as const,
        descricao: `Compra de ${cotacao.peca} - ${cotacao.fornecedorSelecionado || cotacao.fornecedorNome}`,
        valor: getCotacaoTotal(cotacao),
        data: cotacao.enviadaEm,
        status: existingLancamento?.status || "Pendente",
        categoria: "Peças" as const,
        origem: "Compra" as const,
        origemId: cotacao.id,
      };

      if (existingLancamento) {
        updateLancamento({
          ...existingLancamento,
          ...lancamentoData,
        });
      } else {
        saveLancamento(lancamentoData);
      }

      lancamentos = getLancamentos();
    });

  return getLancamentos();
}

function createMetrics(lancamentos: LancamentoFinanceiro[]): FinanceMetric[] {
  const orders = getStoredOrders();
  const cotacoes = getCotacoes();
  const receitaPrevista = lancamentos
    .filter((lancamento) => lancamento.tipo === "Entrada")
    .reduce((total, lancamento) => total + lancamento.valor, 0);
  const receitaAprovada = lancamentos
    .filter(
      (lancamento) =>
        lancamento.tipo === "Entrada" && lancamento.origem === "OS",
    )
    .reduce((total, lancamento) => total + lancamento.valor, 0);
  const receitaRecebida = lancamentos
    .filter(
      (lancamento) =>
        lancamento.tipo === "Entrada" && lancamento.status === "Pago",
    )
    .reduce((total, lancamento) => total + lancamento.valor, 0);
  const contasAReceber = lancamentos
    .filter(
      (lancamento) =>
        lancamento.tipo === "Entrada" && lancamento.status === "Pendente",
    )
    .reduce((total, lancamento) => total + lancamento.valor, 0);
  const comprasConfirmadas = lancamentos
    .filter(
      (lancamento) =>
        lancamento.tipo === "Saída" && lancamento.origem === "Compra",
    )
    .reduce((total, lancamento) => total + lancamento.valor, 0);
  const contasAPagar = lancamentos
    .filter(
      (lancamento) =>
        lancamento.tipo === "Saída" && lancamento.status === "Pendente",
    )
    .reduce((total, lancamento) => total + lancamento.valor, 0);
  const custosPecas = lancamentos
    .filter(
      (lancamento) =>
        lancamento.tipo === "Saída" && lancamento.categoria === "Peças",
    )
    .reduce((total, lancamento) => total + lancamento.valor, 0);
  const descontos = orders
    .filter((order) => order.statusAprovacao === "confirmado_oficina")
    .reduce(
      (total, order) => total + Number(order.orcamento.descontoAplicado || 0),
      0,
    );
  const lucroEstimado = receitaAprovada - comprasConfirmadas - descontos;
  const finalizedOrders = orders.filter((order) => order.status === "FINALIZADA");
  const approvedOrders = orders.filter(
    (order) => order.statusAprovacao === "confirmado_oficina",
  );
  const ticketAverage =
    approvedOrders.length > 0 ? receitaAprovada / approvedOrders.length : 0;

  return [
    {
      label: "Receita prevista",
      value: formatCurrency(receitaPrevista),
      hint: "Entradas previstas de OS e lançamentos manuais",
      tone: "sky",
    },
    {
      label: "Receita recebida",
      value: formatCurrency(receitaRecebida),
      hint: "Entradas marcadas como pagas",
      tone: "emerald",
    },
    {
      label: "Contas a receber",
      value: formatCurrency(contasAReceber),
      hint: "Entradas ainda pendentes",
      tone: "amber",
    },
    {
      label: "Contas a pagar",
      value: formatCurrency(contasAPagar),
      hint: "Saídas ainda pendentes",
      tone: "red",
    },
    {
      label: "Lucro estimado",
      value: formatCurrency(lucroEstimado),
      hint: "Receita aprovada - compras confirmadas - descontos",
      tone: lucroEstimado >= 0 ? "emerald" : "red",
    },
    {
      label: "Ticket médio",
      value: formatCurrency(ticketAverage),
      hint: "Média das OS com aprovação confirmada",
      tone: "violet",
    },
    {
      label: "OS finalizadas",
      value: String(finalizedOrders.length),
      hint: "Serviços encerrados",
      tone: "sky",
    },
    {
      label: "Custos de peças",
      value: formatCurrency(custosPecas),
      hint: `${cotacoes.filter((cotacao) => cotacao.status === "Compra confirmada com fornecedor").length} compra(s) confirmada(s)`,
      tone: "red",
    },
  ];
}

export default function Financeiro({ role }: FinanceiroProps) {
  const [lancamentos, setLancamentos] = useState<LancamentoFinanceiro[]>(() =>
    syncAutomaticLancamentos(),
  );
  const [form, setForm] = useState<LancamentoFormState>(initialFormState);
  const [feedback, setFeedback] = useState("");
  const metrics = useMemo(() => createMetrics(lancamentos), [lancamentos]);
  const sortedLancamentos = useMemo(
    () =>
      [...lancamentos].sort(
        (firstLancamento, secondLancamento) =>
          new Date(secondLancamento.data).getTime() -
          new Date(firstLancamento.data).getTime(),
      ),
    [lancamentos],
  );
  const ordersWithDeposit = useMemo(
    () =>
      getStoredOrders().filter(
        (order) => order.statusAprovacao === "confirmado_oficina" && order.exigeEntrada,
      ),
    [],
  );
  const inputClass =
    "w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none transition focus:border-sky-500";
  const labelClass = "mb-2 block text-sm font-medium text-slate-300";

  function refreshLancamentos() {
    setLancamentos(syncAutomaticLancamentos());
  }

  function handleSaveManualLancamento(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.descricao.trim()) {
      setFeedback("Informe uma descrição para o lançamento.");
      return;
    }

    const valor = Number(form.valor || 0);

    if (!valor || valor <= 0) {
      setFeedback("Informe um valor válido para o lançamento.");
      return;
    }

    saveLancamento({
      tipo: form.tipo,
      descricao: form.descricao.trim(),
      valor,
      data: form.data || new Date().toISOString(),
      status: form.status,
      categoria: form.categoria,
      origem: "Manual",
      origemId: "",
    });
    setForm(initialFormState);
    refreshLancamentos();
    setFeedback("Lançamento manual salvo.");
  }

  function handleToggleStatus(lancamento: LancamentoFinanceiro) {
    updateLancamento({
      ...lancamento,
      status: lancamento.status === "Pago" ? "Pendente" : "Pago",
    });
    refreshLancamentos();
    setFeedback(
      lancamento.status === "Pago"
        ? "Lançamento marcado como pendente."
        : "Lançamento marcado como pago.",
    );
  }

  function handleDeleteLancamento(lancamento: LancamentoFinanceiro) {
    deleteLancamento(lancamento.id);
    refreshLancamentos();
    setFeedback("Lançamento removido.");
  }

  if (role !== "admin" && role !== "financeiro") {
    return (
      <div className="max-w-3xl">
        <section className="rounded-2xl border border-red-400/20 bg-red-500/10 p-6">
          <span className="text-sm font-semibold uppercase text-red-200">
            Acesso restrito
          </span>
          <h2 className="mt-2 text-3xl font-bold">
            Acesso restrito ao administrador
          </h2>
          <p className="mt-2 text-slate-300">
            Troque o perfil temporário para Admin para visualizar os indicadores
            financeiros.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="max-w-7xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="text-sm font-semibold uppercase text-sky-400">
            Controle financeiro
          </span>
          <h2 className="mt-1 text-3xl font-bold">Financeiro</h2>
          <p className="mt-2 text-slate-400">
            Entradas, saídas, contas pendentes e lucro estimado da oficina.
          </p>
        </div>

        <button
          type="button"
          onClick={refreshLancamentos}
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
        >
          Atualizar dados
        </button>
      </div>

      {feedback && (
        <div className="mb-6 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-200">
          {feedback}
        </div>
      )}

      <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <article
            key={metric.label}
            className={`rounded-2xl border p-5 shadow-sm shadow-slate-950/20 ${getCardClass(
              metric.tone,
            )}`}
          >
            <span className="text-xs font-semibold uppercase opacity-80">
              {metric.label}
            </span>
            <strong className="mt-3 block text-2xl text-white">
              {metric.value}
            </strong>
            <p className="mt-2 text-sm text-slate-300">{metric.hint}</p>
          </article>
        ))}
      </section>

      {ordersWithDeposit.length > 0 && (
        <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-sm shadow-slate-950/20 sm:p-6">
          <h3 className="text-xl font-bold">Entradas e saldos de OS</h3>
          <p className="mt-1 text-sm text-slate-400">
            Acompanhamento das OS confirmadas pela oficina que exigem sinal.
          </p>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {ordersWithDeposit.map((order) => (
              <article
                key={order.id}
                className="rounded-xl border border-slate-800 bg-slate-950 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-100">
                      {order.id} - {order.cliente}
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                      Entrada {formatCurrency(order.entradaCalculada)} · Saldo{" "}
                      {formatCurrency(order.saldoRestante)}
                    </p>
                  </div>
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ring-1 ${
                      order.statusEntrada === "paga"
                        ? "bg-emerald-500/15 text-emerald-200 ring-emerald-400/30"
                        : "bg-amber-500/15 text-amber-200 ring-amber-400/30"
                    }`}
                  >
                    {order.statusEntrada === "paga" ? "Entrada paga" : "Entrada pendente"}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-sm shadow-slate-950/20 sm:p-6">
        <h3 className="text-xl font-bold">Lançamento manual</h3>
        <p className="mt-1 text-sm text-slate-400">
          Use para entradas e saídas que não vêm de OS ou compras.
        </p>

        <form
          className="mt-5 grid gap-4 lg:grid-cols-[150px_1fr_160px_160px_160px_180px_auto]"
          onSubmit={handleSaveManualLancamento}
        >
          <div>
            <label className={labelClass}>Tipo</label>
            <select
              className={inputClass}
              value={form.tipo}
              onChange={(event) =>
                setForm((currentForm) => ({
                  ...currentForm,
                  tipo: event.target.value as LancamentoTipo,
                }))
              }
            >
              {LANCAMENTO_TIPOS.map((tipo) => (
                <option key={tipo}>{tipo}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Descrição</label>
            <input
              className={inputClass}
              value={form.descricao}
              onChange={(event) =>
                setForm((currentForm) => ({
                  ...currentForm,
                  descricao: event.target.value,
                }))
              }
            />
          </div>

          <div>
            <label className={labelClass}>Valor</label>
            <input
              className={inputClass}
              min="0"
              step="0.01"
              type="number"
              value={form.valor}
              onChange={(event) =>
                setForm((currentForm) => ({
                  ...currentForm,
                  valor: event.target.value,
                }))
              }
            />
          </div>

          <div>
            <label className={labelClass}>Data</label>
            <input
              className={inputClass}
              type="date"
              value={form.data}
              onChange={(event) =>
                setForm((currentForm) => ({
                  ...currentForm,
                  data: event.target.value,
                }))
              }
            />
          </div>

          <div>
            <label className={labelClass}>Status</label>
            <select
              className={inputClass}
              value={form.status}
              onChange={(event) =>
                setForm((currentForm) => ({
                  ...currentForm,
                  status: event.target.value as LancamentoStatus,
                }))
              }
            >
              {LANCAMENTO_STATUS.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Categoria</label>
            <select
              className={inputClass}
              value={form.categoria}
              onChange={(event) =>
                setForm((currentForm) => ({
                  ...currentForm,
                  categoria: event.target.value as LancamentoCategoria,
                }))
              }
            >
              {LANCAMENTO_CATEGORIAS.map((categoria) => (
                <option key={categoria}>{categoria}</option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-lg bg-sky-500 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-400"
            >
              Salvar
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-sm shadow-slate-950/20 sm:p-6">
        <div className="mb-5">
          <h3 className="text-xl font-bold">Movimentações</h3>
          <p className="mt-1 text-sm text-slate-400">
            OS confirmadas geram entrada prevista; compras confirmadas geram
            saída prevista.
          </p>
        </div>

        {sortedLancamentos.length ? (
          <div className="overflow-hidden rounded-xl border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-950 text-slate-400">
                <tr>
                  <th className="px-4 py-3 text-left">Data</th>
                  <th className="px-4 py-3 text-left">Tipo</th>
                  <th className="px-4 py-3 text-left">Origem</th>
                  <th className="px-4 py-3 text-left">Descrição</th>
                  <th className="px-4 py-3 text-left">Valor</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Ações</th>
                </tr>
              </thead>
              <tbody>
                {sortedLancamentos.map((lancamento) => (
                  <tr key={lancamento.id} className="border-t border-slate-800">
                    <td className="px-4 py-3 text-slate-300">
                      {formatDate(lancamento.data)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ring-1 ${getTypeBadgeClass(
                          lancamento.tipo,
                        )}`}
                      >
                        {lancamento.tipo}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      <p>{lancamento.origem}</p>
                      {lancamento.origemId && (
                        <p className="mt-1 text-xs text-slate-500">
                          {lancamento.origemId}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-100">
                        {lancamento.descricao}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {lancamento.categoria}
                      </p>
                    </td>
                    <td
                      className={`px-4 py-3 font-semibold ${
                        lancamento.tipo === "Entrada"
                          ? "text-emerald-200"
                          : "text-red-200"
                      }`}
                    >
                      {formatCurrency(lancamento.valor)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ring-1 ${getStatusBadgeClass(
                          lancamento.status,
                        )}`}
                      >
                        {lancamento.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(lancamento)}
                          className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                        >
                          {lancamento.status === "Pago"
                            ? "Marcar pendente"
                            : "Marcar pago"}
                        </button>
                        {lancamento.origem === "Manual" && (
                          <button
                            type="button"
                            onClick={() => handleDeleteLancamento(lancamento)}
                            className="rounded-lg border border-red-400/40 px-3 py-2 text-xs font-semibold text-red-200 hover:bg-red-500/10"
                          >
                            Excluir
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-400">
            Nenhuma movimentação financeira ainda.
          </p>
        )}
      </section>
    </div>
  );
}
