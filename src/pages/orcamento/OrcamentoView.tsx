import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import BackButton from "../../components/ui/BackButton";
import { formatPhone, onlyDigits } from "../../utils/formatters";
import {
  getBudgetApprovalBadgeClass,
  getBudgetApprovalLabel,
  getServiceOrderStatusForBudgetDecision,
  getStoredOrders,
  saveStoredOrders,
  updateServiceOrderStatusWithTimeline,
  type BudgetApprovalStatus,
  type ServiceOrder,
} from "../../services/osService";
import { getCotacoes, updateCotacao } from "../../services/cotacoesService";
import {
  calculatePaymentSimulation,
  getConfiguracoesOficina,
} from "../../services/configuracoesService";

type ApprovalItem = {
  id: string;
  tipo: "Peça" | "Serviço";
  titulo: string;
  detalhe: string;
  valor: number;
};

type ChecklistVisualStatus = "OK" | "Atenção" | "Trocar";

const CHECKLIST_BUDGET_TERMS: Record<string, string[]> = {
  freio: ["freio", "pastilha", "disco", "fluido"],
  pneus: ["pneu", "pneus", "roda", "alinhamento", "balanceamento"],
  oleo: ["oleo", "filtro", "lubrificante"],
  suspensao: ["suspensao", "amortecedor", "bandeja", "pivo", "bieleta"],
  bateria: ["bateria", "alternador"],
  iluminacao: ["iluminacao", "lampada", "farol", "lanterna", "luz"],
};

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatAnswerDate(value: string) {
  const date = new Date(value);

  if (!value || Number.isNaN(date.getTime())) {
    return "data indisponível";
  }

  return new Intl.DateTimeFormat("pt-BR").format(date);
}

function getApprovalItems(order: ServiceOrder): ApprovalItem[] {
  const parts = order.pecasNecessarias
    .filter((part) => part.peca.trim() || part.valorTotal > 0)
    .map((part) => ({
      id: `peca-${part.id}`,
      tipo: "Peça" as const,
      titulo: part.peca || "Peça sem descrição",
      detalhe: `${part.quantidade} x ${formatCurrency(part.valorUnitario)}`,
      valor: part.valorTotal,
    }));

  const labor = order.servicosMaoDeObra
    .filter((service) => service.servico.trim() || service.valor > 0)
    .map((service) => ({
      id: `servico-${service.id}`,
      tipo: "Serviço" as const,
      titulo: service.servico || "Serviço sem descrição",
      detalhe: service.descricao || "Sem descrição",
      valor: service.valor,
    }));

  return [...parts, ...labor];
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getChecklistVisualStatus(status: string): ChecklistVisualStatus {
  if (status === "OK") {
    return "OK";
  }

  if (status === "Trocar") {
    return "Trocar";
  }

  return "Atenção";
}

function getChecklistStatusClass(status: ChecklistVisualStatus) {
  const classes: Record<ChecklistVisualStatus, string> = {
    OK: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
    Atenção: "border-yellow-400/30 bg-yellow-500/10 text-yellow-200",
    Trocar: "border-red-400/30 bg-red-500/10 text-red-200",
  };

  return `inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${classes[status]}`;
}

function getChecklistCardClass(status: ChecklistVisualStatus) {
  const classes: Record<ChecklistVisualStatus, string> = {
    OK: "border-emerald-400/20 bg-slate-950",
    Atenção: "border-yellow-400/20 bg-slate-950",
    Trocar: "border-red-400/30 bg-red-500/5",
  };

  return `rounded-xl border p-5 ${classes[status]}`;
}

function getChecklistRelatedBudgetItems(
  checklistItem: string,
  approvalItems: ApprovalItem[],
) {
  const itemKey = normalizeSearchText(checklistItem);
  const terms = CHECKLIST_BUDGET_TERMS[itemKey] ?? [itemKey];

  return approvalItems.filter((item) => {
    const budgetText = normalizeSearchText(`${item.titulo} ${item.detalhe}`);
    return terms.some((term) => term && budgetText.includes(term));
  });
}

function calculateSelectedTotals(
  order: ServiceOrder,
  approvalItems: ApprovalItem[],
  selectedItemIds: string[],
) {
  if (!approvalItems.length) {
    return {
      partsTotal: order.orcamento.totalPecas,
      laborTotal: order.orcamento.totalMaoDeObra,
      discountAmount: order.orcamento.descontoAplicado,
      finalTotal: order.orcamento.totalFinal,
    };
  }

  const selectedItems = approvalItems.filter((item) =>
    selectedItemIds.includes(item.id),
  );
  const partsTotal = selectedItems
    .filter((item) => item.tipo === "Peça")
    .reduce((total, item) => total + item.valor, 0);
  const laborTotal = selectedItems
    .filter((item) => item.tipo === "Serviço")
    .reduce((total, item) => total + item.valor, 0);
  const subtotal = partsTotal + laborTotal;
  const discountAmount =
    order.orcamento.descontoTipo === "percent"
      ? (subtotal * Math.min(order.orcamento.descontoValor, 100)) / 100
      : Math.min(
          order.orcamento.descontoValor || order.orcamento.descontoAplicado,
          subtotal,
        );

  return {
    partsTotal,
    laborTotal,
    discountAmount,
    finalTotal: Math.max(subtotal - discountAmount, 0),
  };
}

function syncLinkedCotacoesApproval(
  order: ServiceOrder,
  approvedItemIds: string[],
) {
  const cotacoes = getCotacoes();

  order.pecasNecessarias
    .filter((part) => part.compraId)
    .forEach((part) => {
      const cotacao = cotacoes.find(
        (currentCotacao) => currentCotacao.id === part.compraId,
      );

      if (!cotacao || cotacao.status === "Compra confirmada com fornecedor") {
        return;
      }

      const wasApproved = approvedItemIds.includes(`peca-${part.id}`);

      updateCotacao({
        ...cotacao,
        status: wasApproved
          ? "Aguardando aprovação do cliente"
          : "Não aprovada pelo cliente",
      });
    });
}

export default function OrcamentoView() {
  const { id } = useParams();
  const [orders, setOrders] = useState<ServiceOrder[]>(() => getStoredOrders());
  const [oficinaConfig] = useState(() => getConfiguracoesOficina());
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [isEditingItems, setIsEditingItems] = useState(false);
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<
    "Pix" | "Dinheiro" | "Débito" | "Crédito"
  >("Pix");
  const [selectedInstallments, setSelectedInstallments] = useState(1);
  const [feedback, setFeedback] = useState("");

  const order = useMemo(
    () =>
      orders.find(
        (storedOrder) => storedOrder.id === id || storedOrder.codigo === id,
      ),
    [id, orders],
  );

  const approvalItems = useMemo(
    () => (order ? getApprovalItems(order) : []),
    [order],
  );
  const hasDecision = Boolean(
    order && order.statusAprovacao !== "pendente",
  );
  const defaultSelectedItemIds = useMemo(() => {
    if (!order) {
      return [];
    }

    return order.statusAprovacao !== "pendente"
      ? order.itensAprovados
      : approvalItems.map((item) => item.id);
  }, [approvalItems, order]);
  const activeSelectedItemIds = selectedItemIds.length
    ? selectedItemIds
    : defaultSelectedItemIds;
  const canEditItems = !hasDecision && isEditingItems;
  const selectedTotals = useMemo(
    () =>
      order
        ? calculateSelectedTotals(order, approvalItems, activeSelectedItemIds)
        : {
            partsTotal: 0,
            laborTotal: 0,
            discountAmount: 0,
            finalTotal: 0,
          },
    [activeSelectedItemIds, approvalItems, order],
  );
  const paymentSimulation = useMemo(
    () =>
      order
        ? calculatePaymentSimulation(
            selectedTotals.finalTotal,
            order.entradaCalculada,
            order.exigeEntrada,
            oficinaConfig.regrasPagamento,
            selectedPaymentMethod,
            selectedInstallments,
          )
        : {
            saldoBase: 0,
            descontoAplicado: 0,
            taxaAplicada: 0,
            valorFinalPagamento: 0,
            parcelas: 1,
            valorParcela: 0,
          },
    [
      oficinaConfig.regrasPagamento,
      order,
      selectedInstallments,
      selectedPaymentMethod,
      selectedTotals.finalTotal,
    ],
  );
  const customerPhotos = useMemo(
    () =>
      (order?.fotosOs || []).filter(
        (photo) =>
          photo.visibilidade === "Cliente" || photo.visibilidade === "Ambos",
      ),
    [order],
  );

  function toggleApprovalItem(itemId: string) {
    if (!canEditItems) {
      return;
    }

    setSelectedItemIds((currentItems) => {
      const baseItems = currentItems.length ? currentItems : defaultSelectedItemIds;
      return baseItems.includes(itemId)
        ? baseItems.filter((currentItem) => currentItem !== itemId)
        : [...baseItems, itemId];
    });
  }

  function removeApprovalItem(itemId: string) {
    if (!canEditItems) {
      return;
    }

    setSelectedItemIds((currentItems) => {
      const baseItems = currentItems.length ? currentItems : defaultSelectedItemIds;
      return baseItems.filter((currentItem) => currentItem !== itemId);
    });
  }

  function hasConcurrentOrderChange() {
    if (!order) {
      return false;
    }

    const currentOrder = getStoredOrders().find(
      (storedOrder) => storedOrder.id === order.id,
    );

    return Boolean(
      currentOrder?.updatedAt &&
        order.updatedAt &&
        (currentOrder.updatedAt !== order.updatedAt ||
          currentOrder.version !== order.version),
    );
  }

  function handleApproveBudget() {
    if (!order || hasDecision || isSubmittingDecision) {
      return;
    }

    if (hasConcurrentOrderChange()) {
      setFeedback(
        "Este orçamento foi atualizado pela oficina. Recarregue a página antes de responder.",
      );
      return;
    }

    setIsSubmittingDecision(true);
    const allItemIds = approvalItems.map((item) => item.id);
    const hasPartialSelection =
      approvalItems.length > 0 &&
      activeSelectedItemIds.length < approvalItems.length;
    const statusAprovacao: BudgetApprovalStatus = hasPartialSelection
      ? "pre_aprovado_parcial"
      : "pre_aprovado";
    const itensAprovados =
      statusAprovacao === "pre_aprovado" ? allItemIds : activeSelectedItemIds;
    const dataDecisaoAprovacao = new Date().toISOString();

    const updatedOrders = orders.map((storedOrder) => {
      if (storedOrder.id !== order.id) {
        return storedOrder;
      }

      const updatedOrder = {
        ...storedOrder,
        statusAprovacao,
        itensAprovados,
        dataDecisaoAprovacao,
        dataPreAprovacao: dataDecisaoAprovacao,
        confirmacaoOficina: false,
        dataConfirmacaoOficina: "",
        decisaoCliente: statusAprovacao,
        formaPagamentoEscolhida: selectedPaymentMethod,
        parcelasEscolhidas: paymentSimulation.parcelas,
        valorFinalPagamento: paymentSimulation.valorFinalPagamento,
        descontoAplicado: paymentSimulation.descontoAplicado,
        taxaAplicada: paymentSimulation.taxaAplicada,
        descontoPagamentoAplicado: paymentSimulation.descontoAplicado,
        taxaPagamentoAplicada: paymentSimulation.taxaAplicada,
        entradaCalculada: order.entradaCalculada,
        saldoRestante: paymentSimulation.saldoBase,
        observacaoAprovacao:
          statusAprovacao === "pre_aprovado_parcial"
            ? "Cliente pré-aprovou parcialmente os itens."
            : "",
      };

      return updateServiceOrderStatusWithTimeline(
        updatedOrder,
        getServiceOrderStatusForBudgetDecision(updatedOrder, statusAprovacao),
        {
          tipo:
            statusAprovacao === "pre_aprovado_parcial"
              ? "cliente_aprovou_parcialmente"
              : "cliente_aprovou",
          titulo:
            statusAprovacao === "pre_aprovado_parcial"
              ? "Cliente pré-aprovou parcialmente"
              : "Cliente pré-aprovou orçamento",
          descricao:
            statusAprovacao === "pre_aprovado_parcial"
              ? "Cliente selecionou parte dos itens do orçamento."
              : "Cliente pré-aprovou todos os itens do orçamento.",
          usuarioResponsavel: "Cliente",
        },
      );
    });

    saveStoredOrders(updatedOrders);
    syncLinkedCotacoesApproval(order, itensAprovados);
    setOrders(updatedOrders);
    setIsEditingItems(false);
    setFeedback(
      "Seu orçamento foi pré-aprovado com sucesso. Após sua pré-aprovação, entraremos em contato por segurança antes de iniciar o serviço.",
    );
  }

  function handleRejectBudget() {
    if (!order || hasDecision || isSubmittingDecision) {
      return;
    }

    if (hasConcurrentOrderChange()) {
      setFeedback(
        "Este orçamento foi atualizado pela oficina. Recarregue a página antes de responder.",
      );
      return;
    }

    setIsSubmittingDecision(true);
    const statusAprovacao: BudgetApprovalStatus = "recusado";
    const dataDecisaoAprovacao = new Date().toISOString();

    const updatedOrders = orders.map((storedOrder) => {
      if (storedOrder.id !== order.id) {
        return storedOrder;
      }

      const updatedOrder = {
        ...storedOrder,
        statusAprovacao,
        itensAprovados: [],
        dataDecisaoAprovacao,
        dataPreAprovacao: "",
        confirmacaoOficina: false,
        dataConfirmacaoOficina: "",
        decisaoCliente: statusAprovacao,
        observacaoAprovacao: "Cliente recusou o orçamento.",
      };

      return updateServiceOrderStatusWithTimeline(
        updatedOrder,
        getServiceOrderStatusForBudgetDecision(updatedOrder, statusAprovacao),
        {
          tipo: "cliente_recusou",
          titulo: "Cliente recusou orçamento",
          descricao: "Cliente recusou o orçamento pelo link público.",
          usuarioResponsavel: "Cliente",
        },
      );
    });

    saveStoredOrders(updatedOrders);
    syncLinkedCotacoesApproval(order, []);
    setOrders(updatedOrders);
    setIsEditingItems(false);
    setFeedback("Orçamento recusado com sucesso");
  }

  function handleRequestRevision() {
    if (!order || hasDecision || isSubmittingDecision) {
      return;
    }

    if (hasConcurrentOrderChange()) {
      setFeedback(
        "Este orçamento foi atualizado pela oficina. Recarregue a página antes de responder.",
      );
      return;
    }

    setIsSubmittingDecision(true);
    const statusAprovacao: BudgetApprovalStatus = "revisao";
    const dataDecisaoAprovacao = new Date().toISOString();
    const updatedOrders = orders.map((storedOrder) => {
      if (storedOrder.id !== order.id) {
        return storedOrder;
      }

      const updatedOrder = {
        ...storedOrder,
        statusAprovacao,
        itensAprovados: [],
        dataDecisaoAprovacao,
        dataPreAprovacao: "",
        confirmacaoOficina: false,
        dataConfirmacaoOficina: "",
        decisaoCliente: statusAprovacao,
        observacaoAprovacao: "Cliente solicitou revisão do orçamento.",
      };

      return updateServiceOrderStatusWithTimeline(
        updatedOrder,
        getServiceOrderStatusForBudgetDecision(updatedOrder, statusAprovacao),
        {
          tipo: "cliente_pediu_revisao",
          titulo: "Cliente solicitou revisão",
          descricao: "Cliente pediu revisão do orçamento pelo link público.",
          usuarioResponsavel: "Cliente",
        },
      );
    });

    saveStoredOrders(updatedOrders);
    setOrders(updatedOrders);
    setIsEditingItems(false);
    setFeedback("Solicitação de revisão enviada com sucesso.");
  }

  function getWhatsAppPhone(value: string) {
    const digits = onlyDigits(value);

    if (!digits) {
      return "";
    }

    if (digits.startsWith("55")) {
      return digits;
    }

    if (digits.length === 10 || digits.length === 11) {
      return `55${digits}`;
    }

    return digits;
  }

  if (!order) {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-3xl items-center">
        <section className="w-full rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-3xl font-bold">Orçamento não encontrado</h2>
          <p className="mt-2 text-slate-400">
            Confira se o link enviado pela oficina está correto.
          </p>
        </section>
      </div>
    );
  }

  const answeredText = `Orçamento respondido em ${formatAnswerDate(
    order.dataDecisaoAprovacao,
  )}`;
  const approvedItemsCount = activeSelectedItemIds.length;
  const canApprove =
    !hasDecision && (!approvalItems.length || activeSelectedItemIds.length > 0);
  const serviceCount = approvalItems.filter((item) => item.tipo === "Serviço").length;
  const partCount = approvalItems.filter((item) => item.tipo === "Peça").length;
  const whatsappPhone = getWhatsAppPhone(oficinaConfig.whatsapp);
  const whatsappMessage = `Olá, tenho uma dúvida sobre o orçamento ${order.id}.`;
  const whatsappLink = whatsappPhone
    ? `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(whatsappMessage)}`
    : "";

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-8">
      <BackButton />

      <header className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-sm shadow-slate-950/20">
        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_280px] lg:p-8">
          <div>
            <span className="text-sm font-semibold uppercase text-sky-400">
              Orçamento {order.id}
            </span>
            <h1 className="mt-2 text-4xl font-bold tracking-normal text-white">
              Seu orçamento está pronto
            </h1>
            <div className="mt-4 inline-flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-100">
              <span>Valor total: {formatCurrency(selectedTotals.finalTotal)}</span>
              <span className="text-emerald-300/60">|</span>
              <span>
                {serviceCount} {serviceCount === 1 ? "serviço" : "serviços"}
              </span>
              <span className="text-emerald-300/60">|</span>
              <span>
                {partCount} {partCount === 1 ? "peça" : "peças"}
              </span>
            </div>
            {order.exigeEntrada && (
              <div className="mt-3 flex flex-wrap gap-3 text-sm text-amber-100">
                <span className="rounded-full bg-amber-500/15 px-3 py-1 ring-1 ring-amber-400/30">
                  Entrada: {formatCurrency(order.entradaCalculada)}
                </span>
                <span className="rounded-full bg-slate-800 px-3 py-1 text-slate-200">
                  Saldo restante: {formatCurrency(order.saldoRestante)}
                </span>
              </div>
            )}
            <p className="mt-3 max-w-2xl text-base text-slate-300">
              Olá, {order.cliente}. Revise os itens recomendados para o seu{" "}
              {order.veiculo || "veículo"} e aprove apenas o que deseja
              autorizar neste momento.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <span className="text-xs uppercase text-slate-500">Cliente</span>
                <p className="mt-1 font-semibold text-slate-100">
                  {order.cliente}
                </p>
                <p className="text-sm text-slate-400">
                  {formatPhone(order.telefone)}
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <span className="text-xs uppercase text-slate-500">Veículo</span>
                <p className="mt-1 font-semibold text-slate-100">
                  {order.veiculo}
                </p>
                <p className="text-sm text-slate-400">
                  Placa {order.placa || "-"}
                </p>
              </div>
            </div>
          </div>

          <aside className="rounded-xl border border-sky-400/20 bg-sky-500/10 p-5">
            <span className="text-xs uppercase text-sky-200">Oficina</span>
            <p className="mt-2 text-xl font-bold text-white">
              {oficinaConfig.nomeOficina}
            </p>
            <p className="mt-1 text-sm text-slate-300">
              Telefone/WhatsApp:{" "}
              {formatPhone(oficinaConfig.whatsapp) || "A combinar"}
            </p>
            {oficinaConfig.textoPadraoOrcamento && (
              <p className="mt-3 text-sm text-slate-300">
                {oficinaConfig.textoPadraoOrcamento}
              </p>
            )}
            <div className="mt-4">
              <span className={getBudgetApprovalBadgeClass(order.statusAprovacao)}>
                {getBudgetApprovalLabel(order.statusAprovacao)}
              </span>
            </div>
          </aside>
        </div>
      </header>

      {(feedback || hasDecision) && (
        <section className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-5">
          <p className="font-semibold text-emerald-100">
            {feedback || answeredText}
          </p>
          {hasDecision && (
            <p className="mt-1 text-sm text-emerald-200/80">
              {answeredText}. Decisão do cliente:{" "}
              {getBudgetApprovalLabel(order.statusAprovacao)}.
            </p>
          )}
        </section>
      )}

      <section className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-emerald-100">
              Dúvidas? Fale com a oficina no WhatsApp
            </h2>
            <p className="mt-1 text-sm text-emerald-100/80">
              {formatPhone(oficinaConfig.whatsapp) || "WhatsApp não configurado"}
            </p>
          </div>

          {whatsappLink && (
            <a
              href={whatsappLink}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl bg-emerald-500 px-5 py-3 text-center text-sm font-semibold text-white hover:bg-emerald-400"
            >
              Abrir WhatsApp
            </a>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="text-xl font-bold text-sky-300">Serviço inicial</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <span className="text-xs uppercase text-slate-500">
              Problema relatado
            </span>
            <p className="mt-2 whitespace-pre-wrap text-slate-200">
              {order.problemaRelatado || order.servicoInicial || "Não informado"}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <span className="text-xs uppercase text-slate-500">
              Solução recomendada
            </span>
            <p className="mt-2 whitespace-pre-wrap text-slate-200">
              {order.diagnostico.solucaoRecomendada ||
                order.observacao ||
                "Não informado"}
            </p>
          </div>
        </div>

        {(order.diagnostico.defeitoEncontrado ||
          order.diagnostico.causaProvavel) && (
          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-4">
            <span className="text-xs uppercase text-slate-500">
              Explicação da oficina
            </span>
            <p className="mt-2 whitespace-pre-wrap text-slate-200">
              {[
                order.diagnostico.defeitoEncontrado
                  ? `Defeito encontrado: ${order.diagnostico.defeitoEncontrado}`
                  : "",
                order.diagnostico.causaProvavel
                  ? `Causa provável: ${order.diagnostico.causaProvavel}`
                  : "",
              ]
                .filter(Boolean)
                .join("\n")}
            </p>
          </div>
        )}
      </section>

      {customerPhotos.length > 0 && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-xl font-bold text-sky-300">Fotos da OS</h2>
          <p className="mt-1 text-sm text-slate-400">
            Imagens liberadas pela oficina para ajudar na análise do orçamento.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {customerPhotos.map((photo) => (
              <figure
                key={photo.id}
                className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950"
              >
                <img
                  src={photo.dataUrl}
                  alt={photo.titulo}
                  className="h-56 w-full object-cover"
                />
                <figcaption className="p-4 text-sm text-slate-400">
                  <strong className="block text-slate-100">{photo.titulo}</strong>
                  {photo.tipo}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-sky-300">
              Checklist inicial
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Condição geral observada pela oficina, separada dos valores do
              orçamento.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {order.checklistInicial.length ? (
            order.checklistInicial.map((item) => {
              const visualStatus = getChecklistVisualStatus(item.status);
              const isReplacement = visualStatus === "Trocar";
              const relatedBudgetItems = getChecklistRelatedBudgetItems(
                item.item,
                approvalItems,
              );

              return (
                <div
                  key={item.item}
                  className={getChecklistCardClass(visualStatus)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="block text-base font-semibold text-slate-100">
                        {item.item}
                      </span>
                      <span className="mt-1 block text-xs uppercase tracking-wide text-slate-500">
                        Avaliação técnica
                      </span>
                    </div>

                    <span className={getChecklistStatusClass(visualStatus)}>
                      {visualStatus}
                    </span>
                  </div>

                  {item.observacaoTecnica ? (
                    <div
                      className={`mt-4 rounded-lg border p-3 text-sm ${
                        isReplacement
                          ? "border-red-400/30 bg-red-500/10 text-red-100"
                          : "border-slate-800 bg-slate-950 text-slate-400"
                      }`}
                    >
                      {isReplacement && (
                        <span className="mb-1 block text-xs font-semibold uppercase text-red-200">
                          Observação técnica
                        </span>
                      )}
                      <p>{item.observacaoTecnica}</p>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-slate-500">
                      Sem observação técnica.
                    </p>
                  )}

                  {relatedBudgetItems.length > 0 && (
                    <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-800 pt-4">
                      <span className="inline-flex rounded-full bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-200 ring-1 ring-sky-400/30">
                        Incluído no orçamento
                      </span>
                      <a
                        href="#orcamento-itens"
                        className="text-xs font-semibold text-sky-300 hover:text-sky-200"
                      >
                        Ver no orçamento
                      </a>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <p className="text-sm text-slate-400">Checklist não preenchido.</p>
          )}
        </div>
      </section>

      <section
        id="orcamento-itens"
        className="scroll-mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-sky-300">
              Peças e serviços
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {canEditItems
                ? "Desmarque ou remova os itens que não deseja aprovar."
                : hasDecision
                  ? "A resposta já foi enviada e os itens não podem mais ser alterados."
                  : "Use Ajustar itens para editar o que será aprovado."}
            </p>
          </div>

          <span className="rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-200">
            {approvedItemsCount} de {approvalItems.length} item(ns)
          </span>
        </div>

        <div className="mt-5 grid gap-3">
          {approvalItems.length ? (
            approvalItems.map((item) => {
              const isSelected = activeSelectedItemIds.includes(item.id);

              return (
                <div
                  key={item.id}
                  className={`rounded-xl border p-4 transition ${
                    isSelected
                      ? "border-slate-700 bg-slate-950"
                      : "border-slate-800 bg-slate-950/60 opacity-70"
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                    <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-900 accent-sky-500 disabled:cursor-not-allowed"
                        checked={isSelected}
                        disabled={!canEditItems}
                        onChange={() => toggleApprovalItem(item.id)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="inline-flex rounded-full bg-slate-800 px-2 py-1 text-xs text-slate-300">
                          {item.tipo}
                        </span>
                        <span
                          className={`mt-2 block text-sm font-semibold ${
                            isSelected
                              ? "text-slate-100"
                              : "text-slate-500 line-through"
                          }`}
                        >
                          {item.titulo}
                        </span>
                        <span className="mt-1 block text-sm text-slate-400">
                          {item.detalhe}
                        </span>
                      </span>
                    </label>

                    <div className="flex items-center justify-between gap-3 sm:min-w-[190px] sm:justify-end">
                      <strong className="text-sm text-slate-100">
                        {formatCurrency(item.valor)}
                      </strong>
                      {canEditItems && isSelected && (
                        <button
                          type="button"
                          onClick={() => removeApprovalItem(item.id)}
                          className="rounded-lg border border-red-400/30 px-3 py-2 text-xs font-semibold text-red-200 hover:bg-red-500/10"
                        >
                          Remover
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-400">
              Nenhuma peça ou serviço foi informado neste orçamento.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-sky-400/20 bg-slate-900 p-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-center">
          <div className="grid gap-3">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-slate-400">Peças selecionadas</span>
              <strong>{formatCurrency(selectedTotals.partsTotal)}</strong>
            </div>
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-slate-400">Serviços selecionados</span>
              <strong>{formatCurrency(selectedTotals.laborTotal)}</strong>
            </div>
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-slate-400">Desconto aplicado</span>
              <strong>{formatCurrency(selectedTotals.discountAmount)}</strong>
            </div>
            <p className="text-sm text-slate-400">
              Forma de pagamento: {order.orcamento.formaPagamento || "A combinar"}
            </p>

            {order.exigeEntrada && (
              <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                <p className="font-semibold">
                  Para iniciar o serviço, será necessário o pagamento de entrada
                  no valor de {formatCurrency(order.entradaCalculada)}.
                </p>
                <p className="mt-1">
                  Saldo restante: {formatCurrency(order.saldoRestante)}.
                </p>
                {oficinaConfig.politicaEntradaSinal && (
                  <p className="mt-2 text-xs text-amber-100/80">
                    {oficinaConfig.politicaEntradaSinal}
                  </p>
                )}
              </div>
            )}
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
              <h3 className="font-semibold text-slate-100">
                Escolha a forma de pagamento
              </h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {(["Pix", "Dinheiro", "Débito", "Crédito"] as const).map(
                  (paymentMethod) => (
                    <label
                      key={paymentMethod}
                      className={`rounded-lg border p-3 text-sm ${
                        selectedPaymentMethod === paymentMethod
                          ? "border-sky-400 bg-sky-500/10 text-sky-100"
                          : "border-slate-800 bg-slate-900 text-slate-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="payment-method"
                        className="mr-2 accent-sky-500"
                        checked={selectedPaymentMethod === paymentMethod}
                        disabled={hasDecision || isSubmittingDecision}
                        onChange={() => setSelectedPaymentMethod(paymentMethod)}
                      />
                      {paymentMethod}
                    </label>
                  ),
                )}
              </div>

              {selectedPaymentMethod === "Crédito" && (
                <div className="mt-4">
                  <label className="mb-2 block text-sm font-medium text-slate-300">
                    Parcelas
                  </label>
                  <select
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none transition focus:border-sky-500"
                    value={selectedInstallments}
                    disabled={hasDecision || isSubmittingDecision}
                    onChange={(event) =>
                      setSelectedInstallments(Number(event.target.value))
                    }
                  >
                    {Array.from(
                      { length: oficinaConfig.regrasPagamento.credito.maxParcelas },
                      (_, index) => {
                        const installments = index + 1;
                        const optionSimulation = calculatePaymentSimulation(
                          selectedTotals.finalTotal,
                          order.entradaCalculada,
                          order.exigeEntrada,
                          oficinaConfig.regrasPagamento,
                          "Crédito",
                          installments,
                        );

                        return (
                          <option key={installments} value={installments}>
                            {installments}x de{" "}
                            {formatCurrency(optionSimulation.valorParcela)}
                            {installments <=
                            oficinaConfig.regrasPagamento.credito.parcelasSemJuros
                              ? " sem juros"
                              : ""}
                          </option>
                        );
                      },
                    )}
                  </select>
                </div>
              )}

              <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900 p-3 text-sm">
                <p className="text-slate-400">
                  Base para pagamento: {formatCurrency(paymentSimulation.saldoBase)}
                </p>
                <p className="mt-1 text-slate-400">
                  Desconto: {formatCurrency(paymentSimulation.descontoAplicado)} ·
                  Taxa: {formatCurrency(paymentSimulation.taxaAplicada)}
                </p>
                <p className="mt-2 text-lg font-bold text-white">
                  Valor final da forma escolhida:{" "}
                  {formatCurrency(paymentSimulation.valorFinalPagamento)}
                </p>
                {selectedPaymentMethod === "Crédito" && (
                  <p className="mt-1 text-sm text-slate-400">
                    {paymentSimulation.parcelas}x de{" "}
                    {formatCurrency(paymentSimulation.valorParcela)}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-sky-400/30 bg-sky-500/10 p-5 text-center">
              <span className="text-sm font-medium text-sky-100">
              Total pré-aprovado
            </span>
            <strong className="mt-2 block text-4xl font-bold text-white">
              {formatCurrency(selectedTotals.finalTotal)}
            </strong>
          </div>
        </div>
      </section>

      {!hasDecision ? (
        <section className="sticky bottom-0 -mx-4 border-t border-slate-800 bg-slate-950/95 px-4 py-4 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:px-5">
          <p className="mb-3 text-center text-sm font-semibold text-slate-200">
            Revise os itens abaixo e escolha como deseja prosseguir:
          </p>
          <div className="mb-4 rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm font-medium text-amber-100">
            Importante: Após sua pré-aprovação, entraremos em contato por
            segurança antes de iniciar o serviço.
          </div>

          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center">
            <button
              type="button"
              onClick={handleApproveBudget}
              disabled={!canApprove || isSubmittingDecision}
              className="rounded-2xl bg-emerald-500 px-8 py-4 text-base font-bold text-white shadow-lg shadow-emerald-950/40 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-[260px]"
            >
              {isSubmittingDecision ? "Processando..." : "Pré-aprovar orçamento"}
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedItemIds((currentItems) =>
                  currentItems.length ? currentItems : defaultSelectedItemIds,
                );
                setIsEditingItems((currentValue) => !currentValue);
                setFeedback("");
              }}
              disabled={isSubmittingDecision}
              className="rounded-xl border border-sky-400/40 px-5 py-3 text-sm font-semibold text-sky-200 hover:bg-sky-500/10"
            >
              Ajustar itens (modo edição)
            </button>

            <button
              type="button"
              onClick={handleRejectBudget}
              disabled={isSubmittingDecision}
              className="rounded-xl border border-red-400/40 px-5 py-3 text-sm font-semibold text-red-200 hover:bg-red-500/10"
            >
              Recusar
            </button>

            <button
              type="button"
              onClick={handleRequestRevision}
              disabled={isSubmittingDecision}
              className="rounded-xl border border-cyan-400/40 px-5 py-3 text-sm font-semibold text-cyan-200 hover:bg-cyan-500/10"
            >
              Solicitar revisão
            </button>
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-xl font-bold text-sky-300">Resposta enviada</h2>
          <p className="mt-2 text-slate-300">
            {answeredText}. Decisão do cliente:{" "}
            {getBudgetApprovalLabel(order.statusAprovacao)}.
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {order.statusAprovacao === "pre_aprovado" ||
            order.statusAprovacao === "pre_aprovado_parcial"
              ? "Após sua pré-aprovação, entraremos em contato por segurança antes de iniciar o serviço."
              : `Para qualquer alteração, fale com ${oficinaConfig.nomeOficina} pelo WhatsApp ${formatPhone(oficinaConfig.whatsapp) || "da oficina"}.`}
          </p>
        </section>
      )}
    </div>
  );
}
