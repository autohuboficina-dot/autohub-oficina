import { useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import {
  getCotacoes,
  saveCotacao,
  updateCotacao,
  type CotacaoFornecedorResponse,
  type CotacaoPeca,
  type CotacaoStatus,
} from "./comprasStorage";
import {
  getFornecedores,
  type Fornecedor,
} from "../fornecedores/fornecedoresStorage";
import {
  getStoredOrders,
  saveStoredOrders,
  type ServiceOrder,
} from "../os/osStorage";
import { addItemEstoque } from "../estoque/estoqueStorage";
import { getConfiguracoesOficina } from "../configuracoes/configuracoesStorage";

type ResponseFormState = {
  fornecedorId: string;
  preco: string;
  prazo: string;
  marca: string;
  observacao: string;
};

const initialResponseForm: ResponseFormState = {
  fornecedorId: "",
  preco: "",
  prazo: "",
  marca: "",
  observacao: "",
};

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
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
    placa:
      order?.veiculoDados.placa || order?.veiculoPlaca || order?.placa || "",
  };
}

function getOrderPhotos(order?: ServiceOrder) {
  const maybeOrderWithPhotos = order as
    | (ServiceOrder & {
        fotos?: string[];
        fotosOrcamento?: string[];
        fotosVeiculo?: string[];
      })
    | undefined;

  return [
    ...(maybeOrderWithPhotos?.fotos || []),
    ...(maybeOrderWithPhotos?.fotosOrcamento || []),
    ...(maybeOrderWithPhotos?.fotosVeiculo || []),
  ];
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

function getPrazoNumber(value: string) {
  const match = value.match(/\d+/);
  return match ? Number(match[0]) : Number.POSITIVE_INFINITY;
}

function getCotacaoStatusBadgeClass(status: CotacaoStatus) {
  const classes: Record<CotacaoStatus, string> = {
    "Cotação enviada": "bg-sky-500/15 text-sky-200 ring-sky-400/30",
    "Resposta recebida": "bg-cyan-500/15 text-cyan-200 ring-cyan-400/30",
    "Fornecedor escolhido":
      "bg-violet-500/15 text-violet-200 ring-violet-400/30",
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
  response: CotacaoFornecedorResponse,
): ServiceOrder {
  const quantity = Math.max(Number(cotacao.quantidade || 1), 1);
  const valorTotal = response.preco * quantity;
  const currentParts = Array.isArray(order.pecasNecessarias)
    ? order.pecasNecessarias
    : [];
  const existingPart = currentParts.find((part) => part.compraId === cotacao.id);
  const nextPartId =
    currentParts.reduce((max, part) => Math.max(max, Number(part.id || 0)), 0) +
    1;
  const updatedPart = {
    id: existingPart?.id || nextPartId,
    peca: cotacao.peca,
    quantidade: quantity,
    valorUnitario: response.preco,
    valorTotal,
    compraId: cotacao.id,
  };
  const pecasNecessarias = existingPart
    ? currentParts.map((part) =>
        part.compraId === cotacao.id ? updatedPart : part,
      )
    : [...currentParts, updatedPart];
  const updatedOrder = {
    ...order,
    pecasNecessarias,
    cotacaoFornecedorEscolhido: response.fornecedorNome,
    cotacaoPrecoFinalPeca: response.preco,
    cotacaoIdEscolhida: cotacao.id,
  };

  return {
    ...updatedOrder,
    orcamento: calculateBudget(updatedOrder),
  };
}

export default function Compras() {
  const [searchParams] = useSearchParams();
  const osId = searchParams.get("osId") || "";
  const [fornecedores] = useState<Fornecedor[]>(() => getFornecedores());
  const [oficinaConfig] = useState(() => getConfiguracoesOficina());
  const [orders] = useState<ServiceOrder[]>(() => getStoredOrders());
  const linkedOrder = useMemo(
    () => orders.find((order) => order.id === osId || order.codigo === osId),
    [orders, osId],
  );
  const linkedOrderVehicle = useMemo(
    () => getOrderVehicle(linkedOrder),
    [linkedOrder],
  );
  const linkedOrderPhotos = useMemo(
    () => getOrderPhotos(linkedOrder),
    [linkedOrder],
  );
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
  const [activeResponseCotacaoId, setActiveResponseCotacaoId] = useState("");
  const [responseForm, setResponseForm] =
    useState<ResponseFormState>(initialResponseForm);

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

  function handleQuoteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFornecedor) {
      setFeedback("Selecione um fornecedor antes de enviar a cotação.");
      return;
    }

    if (!item.trim()) {
      setFeedback("Informe o item para solicitar cotação.");
      return;
    }

    if (!getWhatsAppPhone(selectedFornecedor.whatsapp)) {
      setFeedback("O fornecedor selecionado não possui WhatsApp válido.");
      return;
    }

    const newCotacao = saveCotacao({
      osId: linkedOrder?.id || "",
      fornecedorId: selectedFornecedor.id,
      fornecedorNome: selectedFornecedor.nome,
      fornecedorWhatsapp: selectedFornecedor.whatsapp,
      peca: item.trim(),
      quantidade: Math.max(Number(quantidade || 1), 1),
      urgencia,
      observacao: observacoes.trim(),
      fotos: linkedOrderPhotos,
      veiculo: linkedOrderVehicle,
    });
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
      `Placa: ${linkedOrderVehicle.placa || "não informada"}`,
      "",
      `Peça solicitada: ${item.trim()}.`,
      `Quantidade: ${quantidade || "1"}.`,
      `Urgência: ${urgencia}.`,
      observacoes.trim() ? `Observações: ${observacoes.trim()}.` : "",
      linkedOrderPhotos.length
        ? `Fotos vinculadas na OS: ${linkedOrderPhotos.join(", ")}.`
        : "",
      "",
      `Responda a cotação neste link: ${responseLink}`,
    ]
      .filter(Boolean)
      .join("\n");
    const whatsappUrl = createWhatsappUrl(selectedFornecedor, message);

    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    setCotacoes(getCotacoes());
    setFeedback(`Cotação enviada para ${selectedFornecedor.nome}.`);
  }

  function handleOpenResponseForm(cotacao: CotacaoPeca) {
    setActiveResponseCotacaoId((currentId) =>
      currentId === cotacao.id ? "" : cotacao.id,
    );
    setResponseForm({
      ...initialResponseForm,
      fornecedorId: cotacao.fornecedorId,
    });
    setFeedback("");
  }

  function handleAddResponse(cotacao: CotacaoPeca) {
    const fornecedor = fornecedores.find(
      (currentFornecedor) => currentFornecedor.id === responseForm.fornecedorId,
    );
    const preco = Number(responseForm.preco || 0);

    if (!fornecedor) {
      setFeedback("Selecione o fornecedor que respondeu a cotação.");
      return;
    }

    if (!preco || preco <= 0) {
      setFeedback("Informe um preço válido para a resposta.");
      return;
    }

    const updatedCotacao = updateCotacao({
      ...cotacao,
      status:
        cotacao.status === "Cotação enviada"
          ? "Resposta recebida"
          : cotacao.status,
      responses: [
        ...cotacao.responses,
        {
          fornecedorId: fornecedor.id,
          fornecedorNome: fornecedor.nome,
          preco,
          prazo: responseForm.prazo.trim(),
          marca: responseForm.marca.trim(),
          observacao: responseForm.observacao.trim(),
          dataResposta: new Date().toISOString(),
        },
      ],
    });

    setCotacoes((currentCotacoes) =>
      currentCotacoes.map((currentCotacao) =>
        currentCotacao.id === cotacao.id ? updatedCotacao : currentCotacao,
      ),
    );
    setResponseForm(initialResponseForm);
    setActiveResponseCotacaoId("");
    setFeedback("Resposta do fornecedor adicionada.");
  }

  function handleChooseSupplier(
    cotacao: CotacaoPeca,
    response: CotacaoFornecedorResponse,
  ) {
    const hasLinkedOrder = Boolean(cotacao.osId);
    const updatedCotacao = updateCotacao({
      ...cotacao,
      status: hasLinkedOrder
        ? "Aguardando aprovação do cliente"
        : "Fornecedor escolhido",
      fornecedorEscolhidoId: response.fornecedorId,
      fornecedorEscolhidoNome: response.fornecedorNome,
      precoFinalPeca: response.preco,
      fornecedorSelecionado: response.fornecedorNome,
      valorSelecionado: response.preco,
      marcaSelecionada: response.marca,
      prazoSelecionado: response.prazo,
    });

    if (cotacao.osId) {
      const updatedOrders = getStoredOrders().map((order) =>
        order.id === cotacao.osId || order.codigo === cotacao.osId
          ? upsertPartFromCotacao(order, cotacao, response)
          : order,
      );
      saveStoredOrders(updatedOrders);
    }

    setCotacoes((currentCotacoes) =>
      currentCotacoes.map((currentCotacao) =>
        currentCotacao.id === cotacao.id ? updatedCotacao : currentCotacao,
      ),
    );
    setFeedback(
      cotacao.osId
        ? `Fornecedor escolhido e peça adicionada ao orçamento da OS ${cotacao.osId}.`
        : `Fornecedor escolhido: ${response.fornecedorNome}.`,
    );
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
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold">Compras</h2>
          <p className="mt-2 text-slate-400">
            Solicite, compare e confirme cotações de peças vinculadas às OS.
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-300">
          <span className="font-semibold text-sky-300">{cotacoes.length}</span>{" "}
          cotação(ões)
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
                Motor {linkedOrderVehicle.motor || "-"} · Placa{" "}
                {linkedOrderVehicle.placa || "-"}
              </p>
            </div>

            {linkedOrderPhotos.length > 0 && (
              <div className="md:col-span-2">
                <span className="text-xs uppercase text-sky-200">
                  Fotos vinculadas
                </span>
                <p className="mt-1 break-words text-sm text-slate-300">
                  {linkedOrderPhotos.join(", ")}
                </p>
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
                WhatsApp: {selectedFornecedor.whatsapp || "não informado"}
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
                      linkedOrderVehicle.placa,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Veículo não informado"
                  }
                  readOnly
                />
              </div>
            </div>
          )}

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
              const bestPrice = cotacao.responses.length
                ? Math.min(...cotacao.responses.map((response) => response.preco))
                : 0;
              const bestDeadline = cotacao.responses.length
                ? Math.min(
                    ...cotacao.responses.map((response) =>
                      getPrazoNumber(response.prazo),
                    ),
                  )
                : Number.POSITIVE_INFINITY;
              const canConfirm =
                cotacao.status === "Aprovada pelo cliente" &&
                Boolean(cotacao.fornecedorEscolhidoId);

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

                  {cotacao.fornecedorSelecionado && (
                    <div className="mt-4 grid gap-3 rounded-lg border border-emerald-400/20 bg-emerald-500/10 p-3 text-sm text-emerald-100 md:grid-cols-3">
                      <span>
                        Fornecedor:{" "}
                        <strong>{cotacao.fornecedorSelecionado}</strong>
                      </span>
                      <span>
                        Valor:{" "}
                        <strong>{formatCurrency(cotacao.valorSelecionado)}</strong>
                      </span>
                      <span>
                        Prazo: <strong>{cotacao.prazoSelecionado || "-"}</strong>
                      </span>
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenResponseForm(cotacao)}
                      className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
                    >
                      Adicionar resposta do fornecedor
                    </button>
                    {canConfirm && (
                      <button
                        type="button"
                        onClick={() => handleConfirmPurchase(cotacao)}
                        className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400"
                      >
                        Confirmar compra com fornecedor
                      </button>
                    )}
                  </div>

                  {activeResponseCotacaoId === cotacao.id && (
                    <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900 p-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label className={labelClass}>Fornecedor</label>
                          <select
                            className={inputClass}
                            value={responseForm.fornecedorId}
                            onChange={(event) =>
                              setResponseForm((currentState) => ({
                                ...currentState,
                                fornecedorId: event.target.value,
                              }))
                            }
                          >
                            <option value="">Selecione</option>
                            {fornecedores.map((fornecedor) => (
                              <option key={fornecedor.id} value={fornecedor.id}>
                                {fornecedor.nome}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className={labelClass}>Preço</label>
                          <input
                            className={inputClass}
                            type="number"
                            min="0"
                            step="0.01"
                            value={responseForm.preco}
                            onChange={(event) =>
                              setResponseForm((currentState) => ({
                                ...currentState,
                                preco: event.target.value,
                              }))
                            }
                          />
                        </div>

                        <div>
                          <label className={labelClass}>Prazo</label>
                          <input
                            className={inputClass}
                            placeholder="Ex: 2 dias"
                            value={responseForm.prazo}
                            onChange={(event) =>
                              setResponseForm((currentState) => ({
                                ...currentState,
                                prazo: event.target.value,
                              }))
                            }
                          />
                        </div>

                        <div>
                          <label className={labelClass}>Marca da peça</label>
                          <input
                            className={inputClass}
                            placeholder="Marca informada pelo fornecedor"
                            value={responseForm.marca}
                            onChange={(event) =>
                              setResponseForm((currentState) => ({
                                ...currentState,
                                marca: event.target.value,
                              }))
                            }
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className={labelClass}>Observação</label>
                          <input
                            className={inputClass}
                            placeholder="Condição, frete, disponibilidade..."
                            value={responseForm.observacao}
                            onChange={(event) =>
                              setResponseForm((currentState) => ({
                                ...currentState,
                                observacao: event.target.value,
                              }))
                            }
                          />
                        </div>
                      </div>

                      <div className="mt-4 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleAddResponse(cotacao)}
                          className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-400"
                        >
                          Salvar resposta
                        </button>
                      </div>
                    </div>
                  )}

                  {cotacao.responses.length > 0 && (
                    <div className="mt-4 overflow-hidden rounded-xl border border-slate-800">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-900 text-slate-400">
                          <tr>
                            <th className="px-3 py-3 text-left">Fornecedor</th>
                            <th className="px-3 py-3 text-left">Preço</th>
                            <th className="px-3 py-3 text-left">Prazo</th>
                            <th className="px-3 py-3 text-left">Marca</th>
                            <th className="px-3 py-3 text-left">Ação</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cotacao.responses.map((response) => {
                            const isBestPrice = response.preco === bestPrice;
                            const isBestDeadline =
                              getPrazoNumber(response.prazo) === bestDeadline;
                            const isSelected =
                              response.fornecedorId ===
                              cotacao.fornecedorEscolhidoId;

                            return (
                              <tr
                                key={`${response.fornecedorId}-${response.dataResposta}`}
                                className="border-t border-slate-800"
                              >
                                <td className="px-3 py-3 text-slate-100">
                                  <p className="font-medium">
                                    {response.fornecedorNome}
                                  </p>
                                  {response.observacao && (
                                    <p className="mt-1 text-xs text-slate-500">
                                      {response.observacao}
                                    </p>
                                  )}
                                </td>
                                <td className="px-3 py-3">
                                  <span
                                    className={
                                      isBestPrice
                                        ? "rounded-full bg-emerald-500/15 px-2 py-1 text-xs font-semibold text-emerald-200 ring-1 ring-emerald-400/30"
                                        : "text-slate-300"
                                    }
                                  >
                                    {formatCurrency(response.preco)}
                                  </span>
                                </td>
                                <td className="px-3 py-3">
                                  <span
                                    className={
                                      isBestDeadline
                                        ? "rounded-full bg-sky-500/15 px-2 py-1 text-xs font-semibold text-sky-200 ring-1 ring-sky-400/30"
                                        : "text-slate-300"
                                    }
                                  >
                                    {response.prazo || "-"}
                                  </span>
                                </td>
                                <td className="px-3 py-3 text-slate-300">
                                  {response.marca || "-"}
                                </td>
                                <td className="px-3 py-3">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleChooseSupplier(cotacao, response)
                                    }
                                    disabled={
                                      isSelected ||
                                      cotacao.status ===
                                        "Compra confirmada com fornecedor"
                                    }
                                    className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {isSelected
                                      ? "Escolhido"
                                      : "Escolher fornecedor"}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
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
