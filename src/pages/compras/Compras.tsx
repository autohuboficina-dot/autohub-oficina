import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import BackButton from "../../components/ui/BackButton";
import { useAuth } from "../../contexts/useAuth";
import { formatPhone, onlyDigits } from "../../utils/formatters";
import {
  getCotacoes,
  getCotacoesSupabase,
  saveCotacao,
  saveCotacaoSupabase,
  selectCotacaoFornecedorSupabase,
  updateCotacao,
  type CotacaoFornecedorResponse,
  type CotacaoPecaEscolha,
  type CotacaoPecaItem,
  type CotacaoPeca,
  type CotacaoPecaRespostaItem,
  type CotacaoStatus,
} from "../../services/cotacoesService";
import {
  getFornecedores,
  type Fornecedor,
} from "../../services/fornecedoresService";
import {
  getServiceOrderSupabase,
  getStoredOrders,
  saveStoredOrders,
  updateServiceOrderStatusWithTimeline,
  type ServiceOrder,
} from "../../services/osService";
import { addItemEstoque } from "../../services/estoqueService";
import { getConfiguracoesOficina } from "../../services/configuracoesService";

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

function createWhatsappUrlFromPhone(phoneValue: string, message: string) {
  const phone = getWhatsAppPhone(phoneValue);

  if (!phone) {
    return "";
  }

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function createWhatsappUrl(fornecedor: Fornecedor, message: string) {
  return createWhatsappUrlFromPhone(fornecedor.whatsapp, message);
}

function getOrderVehicle(order?: ServiceOrder) {
  return {
    marca: order?.veiculoDados.marca || order?.veiculoMarca || "",
    modelo: order?.veiculoDados.modelo || order?.veiculoModelo || "",
    ano: order?.veiculoDados.ano || order?.veiculoAno || "",
    motor: order?.veiculoDados.motor || order?.veiculoMotor || "",
    combustivel:
      order?.veiculoDados.combustivel || order?.veiculoCombustivel || "",
    placa:
      order?.veiculoDados.placa || order?.veiculoPlaca || order?.placa || "",
    chassi: order?.veiculoDados.chassiVin || order?.veiculoChassi || "",
  };
}

function getOrderPhotos(order?: ServiceOrder) {
  return (order?.fotosOs || []).filter(
    (photo) =>
      photo.visibilidade === "Fornecedor" || photo.visibilidade === "Ambos",
  );
}

function getOrderParts(order?: ServiceOrder): CotacaoPecaItem[] {
  return (order?.pecasNecessarias || [])
    .filter((part) => part.peca.trim())
    .map((part) => ({
      id: `peca-${part.id}`,
      peca: part.peca,
      quantidade: part.quantidade || 1,
      observacao: "",
    }));
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

function calculateBudget(order: ServiceOrder) {
  const totalPecas = order.pecasNecessarias.reduce(
    (total, part) => total + Number(part.valorTotal || 0),
    0,
  );
  const totalMaoDeObra = order.servicosMaoDeObra.reduce(
    (total, service) => total + Number(service.valor || 0),
    0,
  );
  const subtotal = totalPecas + totalMaoDeObra;
  const descontoAplicado =
    order.orcamento.descontoTipo === "percent"
      ? (subtotal * Math.min(Number(order.orcamento.descontoValor || 0), 100)) /
        100
      : Math.min(Number(order.orcamento.descontoValor || 0), subtotal);

  return {
    ...order.orcamento,
    totalPecas,
    totalMaoDeObra,
    descontoAplicado,
    totalFinal: Math.max(subtotal - descontoAplicado, 0),
  };
}

function upsertPartFromCotacao(
  order: ServiceOrder,
  cotacao: CotacaoPeca,
  cotacaoPart: CotacaoPecaItem,
  response: CotacaoFornecedorResponse,
  itemResponse: CotacaoPecaRespostaItem,
): ServiceOrder {
  const quantity = Math.max(Number(itemResponse.quantidade || cotacaoPart.quantidade || 1), 1);
  const valorUnitario = Number(itemResponse.preco || 0);
  const valorTotal = valorUnitario * quantity;
  const currentParts = Array.isArray(order.pecasNecessarias)
    ? order.pecasNecessarias
    : [];
  const numericPartId = Number(String(cotacaoPart.id).replace(/^peca-/, ""));
  const existingPart = currentParts.find(
    (part) =>
      part.cotacaoPecaId === cotacaoPart.id ||
      (Number.isFinite(numericPartId) && part.id === numericPartId) ||
      (part.compraId === cotacao.id && part.peca === cotacaoPart.peca),
  );
  const nextPartId =
    currentParts.reduce((max, part) => Math.max(max, Number(part.id || 0)), 0) +
    1;
  const updatedPart = {
    ...existingPart,
    id: existingPart?.id || nextPartId,
    peca: existingPart?.peca || cotacaoPart.peca || itemResponse.nomePeca,
    quantidade: quantity,
    valorUnitario,
    valorTotal,
    compraId: cotacao.id,
    cotacaoPecaId: cotacaoPart.id,
    cotacaoFornecedorEscolhido: response.fornecedorNome,
    cotacaoPrecoEscolhido: valorUnitario,
    cotacaoMarcaEscolhida: itemResponse.marca,
    cotacaoObservacaoEscolhida: itemResponse.observacaoFornecedor,
    cotacaoDataEscolha: new Date().toISOString(),
  };
  const pecasNecessarias = existingPart
    ? currentParts.map((part) =>
        part.id === existingPart.id ? updatedPart : part,
      )
    : [...currentParts, updatedPart];
  const updatedOrder = {
    ...order,
    pecasNecessarias,
    cotacaoFornecedorEscolhido: response.fornecedorNome,
    cotacaoPrecoFinalPeca: valorUnitario,
    cotacaoIdEscolhida: cotacao.id,
  };

  return {
    ...updatedOrder,
    orcamento: calculateBudget(updatedOrder),
  };
}

function getResponseForPart(
  response: CotacaoFornecedorResponse,
  pecaId: string,
) {
  return response.itemResponses.find((item) => item.pecaId === pecaId);
}

function getChoiceForPart(cotacao: CotacaoPeca, pecaId: string) {
  return cotacao.pecasEscolhidas.find((choice) => choice.pecaId === pecaId);
}

function getCotacaoStatusAfterChoice(
  cotacao: CotacaoPeca,
  choices: CotacaoPecaEscolha[],
): CotacaoStatus {
  const selectedCount = cotacao.pecas.filter((part) =>
    choices.some((choice) => choice.pecaId === part.id),
  ).length;

  if (selectedCount >= cotacao.pecas.length && cotacao.pecas.length > 0) {
    return "Fornecedor escolhido";
  }

  if (selectedCount > 0) {
    return "Cotação parcial";
  }

  return cotacao.status === "Cotação enviada"
    ? "Resposta recebida"
    : cotacao.status;
}

export default function Compras() {
  const [searchParams] = useSearchParams();
  const { oficina_id } = useAuth();
  const osId = searchParams.get("osId") || "";
  const [fornecedores] = useState<Fornecedor[]>(() => getFornecedores());
  const [oficinaConfig] = useState(() => getConfiguracoesOficina());
  const [orders] = useState<ServiceOrder[]>(() => getStoredOrders());
  const [linkedOrderFromSupabase, setLinkedOrderFromSupabase] =
    useState<ServiceOrder>();
  const localLinkedOrder = useMemo(
    () => orders.find((order) => order.id === osId || order.codigo === osId),
    [orders, osId],
  );
  const linkedOrder = linkedOrderFromSupabase ?? localLinkedOrder;
  const initialPiece =
    linkedOrder?.pecasNecessarias.find((part) => part.peca.trim())?.peca || "";
  const initialObservation = linkedOrder
    ? [
        `OS ${linkedOrder.id}`,
        linkedOrder.problemaRelatado || linkedOrder.servicoInicial,
        linkedOrder.diagnostico.solucaoRecomendada,
      ]
        .filter(Boolean)
        .join(" - ")
    : "";
  const [cotacoes, setCotacoes] = useState<CotacaoPeca[]>(() => getCotacoes());
  const [selectedFornecedorId, setSelectedFornecedorId] = useState("");
  const [item, setItem] = useState(initialPiece);
  const [quantidade, setQuantidade] = useState("1");
  const [urgencia, setUrgencia] = useState<"Normal" | "Urgente">("Normal");
  const [observacoes, setObservacoes] = useState(initialObservation);
  const [feedback, setFeedback] = useState("");

  const selectedFornecedor = useMemo(
    () =>
      fornecedores.find(
        (fornecedor) => fornecedor.id === selectedFornecedorId,
      ),
    [fornecedores, selectedFornecedorId],
  );

  const inputClass =
    "w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none transition focus:border-sky-500";
  const labelClass = "mb-2 block text-sm font-medium text-slate-300";

  const linkedOrderVehicle = useMemo(
    () => getOrderVehicle(linkedOrder),
    [linkedOrder],
  );
  const linkedOrderPhotos = useMemo(
    () => getOrderPhotos(linkedOrder),
    [linkedOrder],
  );
  const linkedOrderParts = useMemo(
    () => getOrderParts(linkedOrder),
    [linkedOrder],
  );

  useEffect(() => {
    let isMounted = true;

    async function loadCotacoes() {
      if (!oficina_id) {
        return;
      }

      const loadedCotacoes = await getCotacoesSupabase(oficina_id);

      if (isMounted) {
        setCotacoes(loadedCotacoes);
      }
    }

    void loadCotacoes();

    return () => {
      isMounted = false;
    };
  }, [oficina_id]);

  useEffect(() => {
    let isMounted = true;

    async function loadLinkedOrder() {
      if (!oficina_id || !osId) {
        return;
      }

      const loadedOrder = await getServiceOrderSupabase(oficina_id, osId);

      if (isMounted && loadedOrder) {
        setLinkedOrderFromSupabase(loadedOrder);
      }
    }

    void loadLinkedOrder();

    return () => {
      isMounted = false;
    };
  }, [oficina_id, osId]);

  async function handleQuoteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFornecedor) {
      setFeedback("Selecione um fornecedor antes de enviar a cotação.");
      return;
    }

    if (!getWhatsAppPhone(selectedFornecedor.whatsapp)) {
      setFeedback("O fornecedor selecionado não possui WhatsApp válido.");
      return;
    }

    if (linkedOrder && linkedOrderParts.length === 0) {
      setFeedback(
        "Esta OS não possui peças salvas para cotação. Adicione e salve as peças antes de solicitar.",
      );
      return;
    }

    if (!linkedOrder && !item.trim()) {
      setFeedback("Informe o item para solicitar cotação.");
      return;
    }

    const quoteItems = linkedOrder
      ? linkedOrderParts
      : [
          {
            id: "peca-manual-1",
            peca: item.trim(),
            quantidade: Math.max(Number(quantidade || 1), 1),
            observacao: "",
          },
        ];
    const mainQuoteItem = quoteItems[0];
    const cotacaoObservacao = linkedOrder
      ? [
          observacoes.trim(),
          `OS ${linkedOrder.codigo || linkedOrder.id}`,
          linkedOrder.problemaRelatado || linkedOrder.servicoInicial,
          linkedOrder.diagnostico.solucaoRecomendada,
        ]
          .filter(Boolean)
          .join(" - ")
      : observacoes.trim();
    const cotacaoPayload = {
      osId: linkedOrder?.id || "",
      oficinaNome: oficinaConfig.nomeOficina,
      fornecedorId: selectedFornecedor.id,
      fornecedorNome: selectedFornecedor.nome,
      fornecedorWhatsapp: selectedFornecedor.whatsapp,
      peca: mainQuoteItem.peca,
      quantidade: mainQuoteItem.quantidade,
      pecas: quoteItems,
      urgencia,
      observacao: cotacaoObservacao,
      fotos: linkedOrderPhotos,
      clienteNome: linkedOrder?.clienteDados.nome || linkedOrder?.cliente || "",
      clienteTelefone:
        linkedOrder?.clienteDados.telefone ||
        linkedOrder?.clienteTelefone ||
        linkedOrder?.telefone ||
        "",
      veiculo: linkedOrderVehicle,
    };
    let newCotacao: CotacaoPeca;

    try {
      newCotacao = oficina_id
        ? await saveCotacaoSupabase(oficina_id, cotacaoPayload)
        : saveCotacao(cotacaoPayload);
    } catch (error) {
      setFeedback(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar a cotação.",
      );
      return;
    }
    if (linkedOrder) {
      const updatedOrders = getStoredOrders().map((order) =>
        order.id === linkedOrder.id || order.codigo === linkedOrder.id
          ? updateServiceOrderStatusWithTimeline(order, "AGUARDANDO_COTACAO", {
              tipo: "cotacao_solicitada",
              titulo: "Cotação solicitada",
              descricao: `Cotação ${newCotacao.id} enviada para ${selectedFornecedor.nome}.`,
              usuarioResponsavel: "Compras",
            })
          : order,
      );
      saveStoredOrders(updatedOrders);
    }
    const responseLink = `${window.location.origin}/fornecedor/cotacao/${newCotacao.id}`;
    const message = [
      `${oficinaConfig.nomeOficina} - solicitação de cotação`,
      "",
      `Olá, ${selectedFornecedor.nome}.`,
      linkedOrder ? `OS: ${linkedOrder.id}` : "",
      linkedOrder
        ? `Cliente: ${linkedOrder.clienteDados.nome || linkedOrder.cliente}`
        : "",
      `Veículo: ${
        [
          linkedOrderVehicle.marca,
          linkedOrderVehicle.modelo,
          linkedOrderVehicle.ano,
        ]
          .filter(Boolean)
          .join(" ") || "não informado"
      }`,
      `Motor: ${linkedOrderVehicle.motor || "não informado"}`,
      `Combustível: ${linkedOrderVehicle.combustivel || "não informado"}`,
      `Placa: ${linkedOrderVehicle.placa || "não informada"}`,
      `Chassi/VIN: ${linkedOrderVehicle.chassi || "não informado"}`,
      "",
      "Peças solicitadas:",
      ...quoteItems.map(
        (quoteItem) =>
          `- ${quoteItem.peca} | Quantidade: ${quoteItem.quantidade}`,
      ),
      linkedOrderPhotos.length
        ? `Fotos técnicas disponíveis no link da cotação: ${responseLink}.`
        : "",
      "",
      `Responda a cotação neste link: ${responseLink}`,
    ]
      .filter(Boolean)
      .join("\n");
    const whatsappUrl = createWhatsappUrl(selectedFornecedor, message);

    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    setCotacoes((currentCotacoes) => [newCotacao, ...currentCotacoes]);
    setFeedback(`Cotação enviada para ${selectedFornecedor.nome}.`);
  }

  async function handleChooseSupplier(
    cotacao: CotacaoPeca,
    cotacaoPart: CotacaoPecaItem,
    response: CotacaoFornecedorResponse,
    itemResponse: CotacaoPecaRespostaItem,
  ) {
    if (getChoiceForPart(cotacao, cotacaoPart.id)) {
      setFeedback("Esta peça já tem fornecedor escolhido e não pode ser alterada.");
      return;
    }

    const hasLinkedOrder = Boolean(cotacao.osId);
    const dataEscolha = new Date().toISOString();
    const nextChoice: CotacaoPecaEscolha = {
      pecaId: cotacaoPart.id,
      nomePeca: itemResponse.nomePeca || cotacaoPart.peca,
      quantidade: Number(itemResponse.quantidade || cotacaoPart.quantidade || 1),
      fornecedorId: response.fornecedorId,
      fornecedorNome: response.fornecedorNome,
      preco: Number(itemResponse.preco || 0),
      marca: itemResponse.marca,
      observacao: itemResponse.observacaoFornecedor,
      dataEscolha,
    };
    const nextChoices = [
      ...cotacao.pecasEscolhidas.filter(
        (choice) => choice.pecaId !== cotacaoPart.id,
      ),
      nextChoice,
    ];
    const nextStatus = getCotacaoStatusAfterChoice(cotacao, nextChoices);
    const totalSelectedValue = nextChoices.reduce(
      (total, choice) => total + choice.preco * choice.quantidade,
      0,
    );
    const nextCotacao = {
      ...cotacao,
      status: nextStatus,
      fornecedorEscolhidoId: response.fornecedorId,
      fornecedorEscolhidoNome: response.fornecedorNome,
      precoFinalPeca: Number(itemResponse.preco || 0),
      fornecedorSelecionado: response.fornecedorNome,
      valorSelecionado: totalSelectedValue,
      marcaSelecionada: itemResponse.marca,
      prazoSelecionado: "",
      pecasEscolhidas: nextChoices,
    };
    let updatedCotacao: CotacaoPeca;

    try {
      updatedCotacao = await selectCotacaoFornecedorSupabase(
        nextCotacao,
        nextChoice,
      );
    } catch (error) {
      setFeedback(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar a escolha no Supabase.",
      );
      return;
    }

    if (hasLinkedOrder) {
      const updatedOrders = getStoredOrders().map((order) =>
        order.id === cotacao.osId || order.codigo === cotacao.osId
          ? updateServiceOrderStatusWithTimeline(
              upsertPartFromCotacao(
                order,
                cotacao,
                cotacaoPart,
                response,
                itemResponse,
              ),
              "COTACAO_RECEBIDA",
              {
                tipo: "cotacao_escolhida",
                titulo: "Fornecedor escolhido",
                descricao: `${response.fornecedorNome} escolhido para ${cotacaoPart.peca}.`,
                usuarioResponsavel: "Compras",
              },
            )
          : order,
      );
      saveStoredOrders(updatedOrders);
    }

    setCotacoes((currentCotacoes) =>
      currentCotacoes.map((currentCotacao) =>
        currentCotacao.id === cotacao.id ? updatedCotacao : currentCotacao,
      ),
    );
    setFeedback("Fornecedor selecionado com sucesso.");
  }

  function handleConfirmPurchase(cotacao: CotacaoPeca) {
    const linkedCotacaoOrder = cotacao.osId
      ? getStoredOrders().find(
          (storedOrder) =>
            storedOrder.id === cotacao.osId || storedOrder.codigo === cotacao.osId,
        )
      : undefined;

    if (linkedCotacaoOrder?.statusAprovacao !== "confirmado_oficina") {
      setFeedback(
        "A compra só pode ser confirmada após validação da oficina com o cliente.",
      );
      return;
    }

    if (
      linkedCotacaoOrder.exigeEntrada &&
      linkedCotacaoOrder.statusEntrada !== "paga"
    ) {
      setFeedback(
        "A compra só pode ser confirmada após o pagamento da entrada.",
      );
      return;
    }

    if (cotacao.status !== "Aprovada pelo cliente") {
      setFeedback(
        "Só é possível confirmar a compra depois que o item estiver aprovado e validado pela oficina.",
      );
      return;
    }

    if (!cotacao.fornecedorEscolhidoId || !cotacao.valorSelecionado) {
      setFeedback("Escolha um fornecedor antes de confirmar a compra.");
      return;
    }

    const fornecedor = fornecedores.find(
      (currentFornecedor) =>
        currentFornecedor.id === cotacao.fornecedorEscolhidoId,
    );
    const fornecedorWhatsapp =
      fornecedor?.whatsapp ||
      (cotacao.fornecedorId === cotacao.fornecedorEscolhidoId
        ? cotacao.fornecedorWhatsapp
        : "");

    if (!fornecedorWhatsapp) {
      setFeedback("Fornecedor escolhido não foi encontrado.");
      return;
    }

    const vehicleText = [
      cotacao.veiculo.marca,
      cotacao.veiculo.modelo,
      cotacao.veiculo.placa,
    ]
      .filter(Boolean)
      .join("/");
    const message = `Olá, orçamento aprovado pelo cliente. Pode separar a peça ${cotacao.peca} para o veículo ${vehicleText || "informado na OS"}? Valor combinado: ${formatCurrency(cotacao.valorSelecionado)}. Prazo: ${cotacao.prazoSelecionado || "a combinar"}.`;
    const whatsappUrl = createWhatsappUrlFromPhone(fornecedorWhatsapp, message);

    if (!whatsappUrl) {
      setFeedback("O fornecedor escolhido não possui WhatsApp válido.");
      return;
    }

    const updatedCotacao = updateCotacao({
      ...cotacao,
      status: "Compra confirmada com fornecedor",
    });
    addItemEstoque({
      nome: cotacao.peca,
      quantidade: cotacao.quantidade,
      valorUnitario: cotacao.valorSelecionado,
      fornecedor:
        cotacao.fornecedorSelecionado ||
        cotacao.fornecedorEscolhidoNome ||
        cotacao.fornecedorNome,
      osId: cotacao.osId,
      compraId: cotacao.id,
      movimentacaoId: `entrada-compra-${cotacao.id}`,
      descricao: `Compra confirmada com fornecedor para ${cotacao.osId || "compra avulsa"}.`,
    });

    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    setCotacoes((currentCotacoes) =>
      currentCotacoes.map((currentCotacao) =>
        currentCotacao.id === cotacao.id ? updatedCotacao : currentCotacao,
      ),
    );
    setFeedback("Compra confirmada com o fornecedor selecionado.");
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <BackButton className="mb-4" />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold">Compras</h2>
          <p className="mt-2 text-slate-400">
            Solicite, compare e confirme cotações de peças vinculadas às OS.
          </p>
          <p className="mt-2 rounded-lg border border-sky-400/20 bg-sky-500/10 px-3 py-2 text-sm text-sky-100">
            As compras vinculadas à OS podem ser resolvidas diretamente na tela
            da OS. Esta tela serve para acompanhamento geral.
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-300">
          <span className="font-semibold text-sky-300">{cotacoes.length}</span>{" "}
          cotação(ões)
        </div>
      </div>
      </div>

      {feedback && (
        <div className="mb-6 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-200">
          {feedback}
        </div>
      )}

      <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-sm shadow-slate-950/20 sm:p-6">
        <h3 className="text-xl font-bold">Solicitar cotação</h3>

        {linkedOrder ? (
          <div className="mt-5 grid gap-4 rounded-xl border border-sky-400/20 bg-sky-500/10 p-4 md:grid-cols-2">
            <div>
              <span className="text-xs uppercase text-sky-200">
                OS vinculada
              </span>
              <p className="mt-1 font-semibold text-slate-100">
                {linkedOrder.id}
              </p>
              <p className="mt-1 text-sm text-slate-300">
                Cliente: {linkedOrder.clienteDados.nome || linkedOrder.cliente}
              </p>
              <p className="mt-1 text-sm text-slate-400">
                Telefone:{" "}
                {formatPhone(
                  linkedOrder.clienteDados.telefone ||
                    linkedOrder.clienteTelefone ||
                    linkedOrder.telefone,
                ) || "-"}
              </p>
            </div>

            <div>
              <span className="text-xs uppercase text-sky-200">
                Veículo bloqueado
              </span>
              <p className="mt-1 font-semibold text-slate-100">
                {[
                  linkedOrderVehicle.marca,
                  linkedOrderVehicle.modelo,
                  linkedOrderVehicle.ano,
                ]
                  .filter(Boolean)
                  .join(" ") || "Veículo não informado"}
              </p>
              <p className="mt-1 text-sm text-slate-300">
                Motor {linkedOrderVehicle.motor || "-"} ·{" "}
                {linkedOrderVehicle.combustivel || "-"} · Placa{" "}
                {linkedOrderVehicle.placa || "-"} · Chassi{" "}
                {linkedOrderVehicle.chassi || "-"}
              </p>
            </div>

            <div className="md:col-span-2">
              <span className="text-xs uppercase text-sky-200">
                Peças da OS
              </span>
              {linkedOrderParts.length > 0 ? (
                <div className="mt-2 grid gap-2">
                  {linkedOrderParts.map((part, index) => (
                    <div
                      key={`${part.peca}-${index}`}
                      className="rounded-lg border border-sky-400/20 bg-slate-950/60 px-3 py-2 text-sm text-slate-200"
                    >
                      {part.peca} · Qtd. {part.quantidade}
                      {part.observacao ? ` · ${part.observacao}` : ""}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-2 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                  Esta OS ainda não possui peças cadastradas. Adicione e salve
                  as peças na OS antes de enviar a cotação.
                </div>
              )}
            </div>

            {linkedOrderPhotos.length > 0 && (
              <div className="md:col-span-2">
                <span className="text-xs uppercase text-sky-200">
                  Fotos vinculadas
                </span>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  {linkedOrderPhotos.map((photo) => (
                    <figure
                      key={photo.id}
                      className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950"
                    >
                      <img
                        src={photo.dataUrl}
                        alt={photo.titulo}
                        className="h-32 w-full object-cover"
                      />
                      <figcaption className="p-3 text-xs text-slate-400">
                        <strong className="block text-slate-200">
                          {photo.titulo}
                        </strong>
                        {photo.tipo} · {photo.visibilidade}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : osId ? (
          <div className="mt-5 rounded-xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">
            A OS informada na URL não foi encontrada no localStorage.
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-400">
            Para vincular uma compra à OS, use o botão "Solicitar cotação" na
            tela de detalhes da ordem de serviço.
          </div>
        )}

        <form className="mt-5 grid gap-5" onSubmit={handleQuoteSubmit}>
          <div>
            <label className={labelClass}>Fornecedor</label>
            <select
              className={inputClass}
              value={selectedFornecedorId}
              onChange={(event) => setSelectedFornecedorId(event.target.value)}
            >
              <option value="">Selecione um fornecedor</option>
              {fornecedores.map((fornecedor) => (
                <option key={fornecedor.id} value={fornecedor.id}>
                  {fornecedor.nome} - {fornecedor.categoria}
                </option>
              ))}
            </select>
          </div>

          {selectedFornecedor && (
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm">
              <p className="font-medium text-slate-100">
                {selectedFornecedor.nome}
              </p>
              <p className="mt-1 text-slate-400">
                WhatsApp:{" "}
                {formatPhone(selectedFornecedor.whatsapp) || "não informado"}
              </p>
              {selectedFornecedor.observacoes && (
                <p className="mt-1 text-slate-500">
                  {selectedFornecedor.observacoes}
                </p>
              )}
            </div>
          )}

          {linkedOrder && (
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className={labelClass}>Cliente</label>
                <input
                  className={`${inputClass} cursor-not-allowed text-slate-400`}
                  value={linkedOrder.clienteDados.nome || linkedOrder.cliente}
                  readOnly
                />
              </div>

              <div>
                <label className={labelClass}>Veículo</label>
                <input
                  className={`${inputClass} cursor-not-allowed text-slate-400`}
                  value={
                    [
                      linkedOrderVehicle.marca,
                      linkedOrderVehicle.modelo,
                      linkedOrderVehicle.ano,
                      linkedOrderVehicle.motor,
                      linkedOrderVehicle.combustivel,
                      linkedOrderVehicle.placa,
                      linkedOrderVehicle.chassi,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Veículo não informado"
                  }
                  readOnly
                />
              </div>
            </div>
          )}

          {linkedOrder ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-100">
                    Peças da OS para cotação
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    A cotação será criada com as peças salvas na OS.
                  </p>
                </div>
                <span className="rounded-full bg-sky-500/15 px-3 py-1 text-xs font-semibold text-sky-200 ring-1 ring-sky-400/30">
                  {linkedOrderParts.length} peça(s)
                </span>
              </div>
              <div className="mt-3 grid gap-2">
                {linkedOrderParts.length ? (
                  linkedOrderParts.map((part) => (
                    <div
                      key={part.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm"
                    >
                      <span className="font-medium text-slate-100">
                        {part.peca}
                      </span>
                      <span className="text-slate-400">
                        Quantidade: {part.quantidade}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                    Nenhuma peça salva nesta OS para cotação.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-[1fr_160px_180px]">
              <div>
                <label className={labelClass}>Item / peça</label>
                <input
                  className={inputClass}
                  placeholder="Pastilha de freio, filtro, pneu..."
                  value={item}
                  onChange={(event) => setItem(event.target.value)}
                />
              </div>

              <div>
                <label className={labelClass}>Quantidade</label>
                <input
                  className={inputClass}
                  min="1"
                  type="number"
                  value={quantidade}
                  onChange={(event) => setQuantidade(event.target.value)}
                />
              </div>

              <div>
                <label className={labelClass}>Urgência</label>
                <select
                  className={inputClass}
                  value={urgencia}
                  onChange={(event) =>
                    setUrgencia(
                      event.target.value === "Urgente" ? "Urgente" : "Normal",
                    )
                  }
                >
                  <option>Normal</option>
                  <option>Urgente</option>
                </select>
              </div>
            </div>
          )}

          <div>
            <label className={labelClass}>Observações</label>
            <textarea
              rows={4}
              className={inputClass}
              placeholder="Marca preferida, prazo, aplicação do veículo..."
              value={observacoes}
              onChange={(event) => setObservacoes(event.target.value)}
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-400"
            >
              Enviar cotação por WhatsApp
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-sm shadow-slate-950/20 sm:p-6">
        <div className="mb-5">
          <h3 className="text-xl font-bold">Cotações enviadas</h3>
          <p className="mt-1 text-sm text-slate-400">
            Compare respostas, adicione a peça ao orçamento e confirme a compra
            somente após aprovação do cliente.
          </p>
        </div>

        <div className="grid gap-3">
          {cotacoes.length ? (
            cotacoes.map((cotacao) => {
              const canConfirm =
                cotacao.status === "Aprovada pelo cliente" &&
                Boolean(cotacao.fornecedorEscolhidoId);
              const selectedChoices = cotacao.pecasEscolhidas;

              return (
                <article
                  key={cotacao.id}
                  className="rounded-xl border border-slate-800 bg-slate-950 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h4 className="font-semibold text-slate-100">
                        {cotacao.peca}
                      </h4>
                      <p className="mt-1 text-sm text-slate-400">
                        OS {cotacao.osId || "avulsa"} · Qtd.{" "}
                        {cotacao.quantidade} · {cotacao.urgencia}
                      </p>
                    </div>

                    <span className={getCotacaoStatusBadgeClass(cotacao.status)}>
                      {cotacao.status}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
                    <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                      <span className="text-xs uppercase text-slate-500">
                        Cliente / OS
                      </span>
                      <p className="mt-1 text-slate-300">
                        {cotacao.osId || "Sem OS vinculada"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                      <span className="text-xs uppercase text-slate-500">
                        Veículo
                      </span>
                      <p className="mt-1 text-slate-300">
                        {[
                          cotacao.veiculo.marca,
                          cotacao.veiculo.modelo,
                          cotacao.veiculo.placa,
                        ]
                          .filter(Boolean)
                          .join(" ") || "-"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                      <span className="text-xs uppercase text-slate-500">
                        Enviada em
                      </span>
                      <p className="mt-1 text-slate-300">
                        {formatDate(cotacao.enviadaEm)}
                      </p>
                    </div>
                  </div>

                  {cotacao.observacao && (
                    <p className="mt-3 text-sm text-slate-400">
                      {cotacao.observacao}
                    </p>
                  )}

                  {selectedChoices.length > 0 && (
                    <div className="mt-4 rounded-lg border border-emerald-400/20 bg-emerald-500/10 p-3 text-sm text-emerald-100">
                      <p className="mb-3 text-xs font-semibold uppercase text-emerald-200/80">
                        Fornecedor escolhido
                      </p>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold">
                          {selectedChoices.length} de {cotacao.pecas.length}{" "}
                          peça(s) com fornecedor escolhido
                        </span>
                        <span>
                          Total selecionado:{" "}
                          <strong>{formatCurrency(cotacao.valorSelecionado)}</strong>
                        </span>
                      </div>
                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                        {selectedChoices.map((choice) => (
                          <div
                            key={`${choice.pecaId}-${choice.fornecedorId}`}
                            className="rounded-lg border border-emerald-400/20 bg-slate-950/50 px-3 py-2"
                          >
                            <p className="font-medium">{choice.nomePeca}</p>
                            <p className="mt-1 text-xs text-emerald-100/80">
                          {choice.fornecedorNome} · Preço unitário:{" "}
                          {formatCurrency(choice.preco)} · Total:{" "}
                          {formatCurrency(choice.preco * choice.quantidade)} ·{" "}
                              {choice.marca || "Marca não informada"}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {canConfirm && (
                    <div className="mt-4 flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleConfirmPurchase(cotacao)}
                        className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400"
                      >
                        Confirmar compra com fornecedor
                      </button>
                    </div>
                  )}

                  <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h5 className="font-semibold text-slate-100">
                          Respostas recebidas
                        </h5>
                        <p className="mt-1 text-sm text-slate-400">
                          As respostas entram pelo link público enviado ao fornecedor.
                        </p>
                      </div>
                      <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-200">
                        {cotacao.responses.length} resposta(s)
                      </span>
                    </div>
                    {!cotacao.responses.length && (
                      <p className="mt-3 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-400">
                        Aguardando resposta do fornecedor
                      </p>
                    )}
                  </div>

                  {cotacao.responses.length > 0 && (
                    <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                      <div className="mb-4">
                        <h5 className="font-semibold text-slate-100">
                          Comparar cotações
                        </h5>
                        <p className="mt-1 text-sm text-slate-400">
                          Escolha uma resposta vencedora para cada peça.
                        </p>
                      </div>

                      <div className="grid gap-4">
                        {cotacao.pecas.map((cotacaoPart) => {
                          const partOptions = cotacao.responses
                            .map((response) => ({
                              response,
                              itemResponse: getResponseForPart(
                                response,
                                cotacaoPart.id,
                              ),
                            }))
                            .filter(
                              (
                                option,
                              ): option is {
                                response: CotacaoFornecedorResponse;
                                itemResponse: CotacaoPecaRespostaItem;
                              } => Boolean(option.itemResponse),
                            );
                          const bestPrice = partOptions.length
                            ? Math.min(
                                ...partOptions.map(
                                  (option) => option.itemResponse.preco,
                                ),
                              )
                            : 0;
                          const selectedChoice = getChoiceForPart(
                            cotacao,
                            cotacaoPart.id,
                          );

                          return (
                            <div
                              key={cotacaoPart.id}
                              className="rounded-xl border border-slate-800 bg-slate-950 p-4"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div>
                                  <p className="font-semibold text-slate-100">
                                    {cotacaoPart.peca}
                                  </p>
                                  <p className="mt-1 text-sm text-slate-400">
                                    Quantidade: {cotacaoPart.quantidade}
                                  </p>
                                </div>
                                {selectedChoice && (
                                  <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-200 ring-1 ring-emerald-400/30">
                                    Escolhido: {selectedChoice.fornecedorNome}
                                  </span>
                                )}
                              </div>

                              {partOptions.length ? (
                                <div className="mt-4 grid gap-3">
                                  {partOptions.map(
                                    ({ response, itemResponse }) => {
                                      const isBestPrice =
                                        itemResponse.preco === bestPrice;
                                      const isSelected =
                                        selectedChoice?.fornecedorId ===
                                        response.fornecedorId;

                                      return (
                                        <div
                                          key={`${cotacaoPart.id}-${response.fornecedorId}-${itemResponse.dataHora}`}
                                          className={`grid gap-3 rounded-lg border p-3 md:grid-cols-[1.2fr_110px_140px_140px_1fr_1.2fr_auto] md:items-center ${
                                            isSelected
                                              ? "border-emerald-400/40 bg-emerald-500/10"
                                              : "border-slate-800 bg-slate-900"
                                          }`}
                                        >
                                          <div>
                                            <span className="text-xs uppercase text-slate-500">
                                              Fornecedor
                                            </span>
                                            <p className="mt-1 font-medium text-slate-100">
                                              {response.fornecedorNome}
                                            </p>
                                          </div>
                                          <div>
                                            <span className="text-xs uppercase text-slate-500">
                                              Quantidade
                                            </span>
                                            <p className="mt-1 text-sm font-semibold text-slate-100">
                                              {itemResponse.quantidade}
                                            </p>
                                          </div>
                                          <div>
                                            <span className="text-xs uppercase text-slate-500">
                                              Preço unitário
                                            </span>
                                            <p
                                              className={
                                                isBestPrice
                                                  ? "mt-1 inline-flex rounded-full bg-emerald-500/15 px-2 py-1 text-xs font-semibold text-emerald-200 ring-1 ring-emerald-400/30"
                                                  : "mt-1 text-sm text-slate-300"
                                              }
                                            >
                                              {formatCurrency(itemResponse.preco)}
                                            </p>
                                          </div>
                                          <div>
                                            <span className="text-xs uppercase text-slate-500">
                                              Total
                                            </span>
                                            <p className="mt-1 text-sm font-semibold text-slate-100">
                                              {formatCurrency(
                                                itemResponse.preco *
                                                  itemResponse.quantidade,
                                              )}
                                            </p>
                                          </div>
                                          <div>
                                            <span className="text-xs uppercase text-slate-500">
                                              Marca
                                            </span>
                                            <p className="mt-1 text-sm text-slate-300">
                                              {itemResponse.marca || "-"}
                                            </p>
                                          </div>
                                          <div>
                                            <span className="text-xs uppercase text-slate-500">
                                              Observação
                                            </span>
                                            <p className="mt-1 text-sm text-slate-300">
                                              {itemResponse.observacaoFornecedor ||
                                                "-"}
                                            </p>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              void handleChooseSupplier(
                                                cotacao,
                                                cotacaoPart,
                                                response,
                                                itemResponse,
                                              )
                                            }
                                            disabled={
                                              Boolean(selectedChoice) ||
                                              cotacao.status ===
                                                "Compra confirmada com fornecedor"
                                            }
                                            className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                                          >
                                            {isSelected
                                              ? "Escolhido"
                                              : "Escolher este fornecedor"}
                                          </button>
                                        </div>
                                      );
                                    },
                                  )}
                                </div>
                              ) : (
                                <p className="mt-4 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-400">
                                  Nenhum fornecedor respondeu esta peça ainda.
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </article>
              );
            })
          ) : (
            <p className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-400">
              Nenhuma cotação enviada ainda.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
