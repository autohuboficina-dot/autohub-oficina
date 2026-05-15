import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import BackButton from "../../components/ui/BackButton";
import { useToast } from "../../components/Toast";
import { useAuth } from "../../contexts/useAuth";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import { formatCpfCnpj, formatPhone, onlyDigits } from "../../utils/formatters";
import {
  getClientes,
  getClientesSupabase,
  type Cliente,
} from "../../services/clientesService";
import {
  calculatePaymentSimulation,
  getConfiguracoesOficina,
} from "../../services/configuracoesService";
import { baixarProdutoPorOS } from "../../services/estoqueService";
import { getChecklistConfig } from "../../services/checklistConfigService";
import {
  createServiceOrderTimelineEvent,
  createServiceOrderId,
  createNextOrderCode,
  createServiceOrderSupabase,
  getStoredOrders,
  getStoredOrdersSupabase,
  saveStoredOrders,
  type ChecklistStatus,
  type ServiceOrder,
  type ServiceOrderPhoto,
} from "../../services/osService";
import ServiceOrderPhotosSection from "./ServiceOrderPhotosSection";

type PartLine = {
  id: number;
  name: string;
  quantity: string;
  unitValue: string;
  generatedFromChecklist?: string;
};

type LaborLine = {
  id: number;
  service: string;
  description: string;
  value: string;
};

type ChecklistFormState = Record<
  string,
  {
    status: ChecklistStatus;
    observacaoTecnica: string;
  }
>;

function createInitialChecklistState(checklistItems: string[]) {
  return checklistItems.reduce<ChecklistFormState>((state, item) => {
    state[item] = { status: "", observacaoTecnica: "" };
    return state;
  }, {});
}

function toNumber(value: string) {
  return Number(value || 0);
}

function registerInitialStockExit(order: ServiceOrder) {
  order.pecasNecessarias.forEach((part) => {
    if (part.peca_cliente || part.baixaProcessada) {
      return;
    }

    baixarProdutoPorOS({
      nome: part.peca,
      quantidade: part.quantidade,
      osCodigo: order.codigo,
      observacao: `Peça adicionada à OS ${order.codigo}.`,
      movimentacaoId: `os-saida-${order.codigo}-${part.id}-0-${part.quantidade}`,
    });
    part.baixaProcessada = true;
  });
}

function getSingleVehicleId(clientes: Cliente[], clienteId: string) {
  const cliente = clientes.find((currentCliente) => currentCliente.id === clienteId);

  return cliente?.veiculos.length === 1 ? cliente.veiculos[0].id : "";
}

export default function OSNew() {
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const clienteIdParam = searchParams.get("clienteId") || "";
  const { oficina_id } = useAuth();
  const [clientes, setClientes] = useState<Cliente[]>(() => getClientes());
  const [oficinaConfig] = useState(() => getConfiguracoesOficina());
  const [checklistItems] = useState(() => getChecklistConfig());
  const [selectedClienteId, setSelectedClienteId] = useState(() => {
    return getClientes().some((cliente) => cliente.id === clienteIdParam)
      ? clienteIdParam
      : "";
  });
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [problemReport, setProblemReport] = useState("");
  const [defectFound, setDefectFound] = useState("");
  const [probableCause, setProbableCause] = useState("");
  const [recommendedSolution, setRecommendedSolution] = useState("");
  const [checklistState, setChecklistState] = useState<ChecklistFormState>(
    () => createInitialChecklistState(checklistItems),
  );
  const [partLines, setPartLines] = useState<PartLine[]>([
    { id: 1, name: "", quantity: "1", unitValue: "" },
  ]);
  const [laborLines, setLaborLines] = useState<LaborLine[]>([
    { id: 1, service: "", description: "", value: "" },
  ]);
  const [discountValue, setDiscountValue] = useState("");
  const [discountType, setDiscountType] = useState<"money" | "percent">(
    "money",
  );
  const [paymentMethod, setPaymentMethod] = useState("");
  const [requiresDeposit, setRequiresDeposit] = useState(false);
  const [depositType, setDepositType] = useState<"valor" | "percentual">(
    "valor",
  );
  const [depositValue, setDepositValue] = useState("");
  const [depositPercent, setDepositPercent] = useState("");
  const [photos, setPhotos] = useState<ServiceOrderPhoto[]>([]);
  const [savedOrderId, setSavedOrderId] = useState("");
  const [savedBudgetToken, setSavedBudgetToken] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadClientes() {
      const loadedClientes = oficina_id
        ? await getClientesSupabase(oficina_id)
        : getClientes();

      if (isMounted) {
        setClientes(loadedClientes);

        if (
          clienteIdParam &&
          loadedClientes.some((cliente) => cliente.id === clienteIdParam)
        ) {
          setSelectedClienteId(clienteIdParam);
          setSelectedVehicleId(getSingleVehicleId(loadedClientes, clienteIdParam));
        }
      }
    }

    loadClientes();

    return () => {
      isMounted = false;
    };
  }, [clienteIdParam, oficina_id]);

  const selectedCliente = useMemo(
    () => clientes.find((cliente) => cliente.id === selectedClienteId),
    [clientes, selectedClienteId],
  );
  const selectedVehicle = useMemo(
    () =>
      selectedCliente?.veiculos.find((veiculo) => veiculo.id === selectedVehicleId),
    [selectedCliente, selectedVehicleId],
  );

  const inputClass =
    "w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none transition focus:border-sky-500";
  const compactInputClass =
    "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none transition focus:border-sky-500";
  const labelClass = "mb-2 block text-sm font-medium text-slate-300";
  const sectionClass =
    "rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-sm shadow-slate-950/20 sm:p-6";
  const subTitleClass =
    "mb-4 border-b border-slate-800 pb-2 text-base font-semibold text-sky-300";

  const totals = useMemo(() => {
    const partsTotal = partLines.reduce((total, line) => {
      return total + Number(line.quantity || 0) * Number(line.unitValue || 0);
    }, 0);
    const laborTotal = laborLines.reduce((total, line) => {
      return total + Number(line.value || 0);
    }, 0);
    const subtotal = partsTotal + laborTotal;
    const discountNumber = Number(discountValue || 0);
    const discountAmount =
      discountType === "percent"
        ? (subtotal * Math.min(discountNumber, 100)) / 100
        : discountNumber;
    const finalTotal = Math.max(subtotal - discountAmount, 0);

    return { partsTotal, laborTotal, discountAmount, finalTotal };
  }, [discountType, discountValue, laborLines, partLines]);
  const depositSummary = useMemo(() => {
    if (!requiresDeposit) {
      return {
        entradaCalculada: 0,
        saldoRestante: totals.finalTotal,
      };
    }

    const entradaCalculada =
      depositType === "percentual"
        ? (totals.finalTotal * Math.min(Number(depositPercent || 0), 100)) / 100
        : Number(depositValue || 0);
    const safeEntrada = Math.min(Math.max(entradaCalculada, 0), totals.finalTotal);

    return {
      entradaCalculada: safeEntrada,
      saldoRestante: Math.max(totals.finalTotal - safeEntrada, 0),
    };
  }, [depositPercent, depositType, depositValue, requiresDeposit, totals.finalTotal]);
  const paymentOptions = useMemo(() => {
    const regras = oficinaConfig.regrasPagamento;
    const baseArgs = [
      totals.finalTotal,
      depositSummary.entradaCalculada,
      requiresDeposit,
      regras,
    ] as const;

    return {
      pix: calculatePaymentSimulation(...baseArgs, "Pix"),
      dinheiro: calculatePaymentSimulation(...baseArgs, "Dinheiro"),
      debito: calculatePaymentSimulation(...baseArgs, "Débito"),
      credito: Array.from({ length: regras.credito.maxParcelas }, (_, index) =>
        calculatePaymentSimulation(...baseArgs, "Crédito", index + 1),
      ),
    };
  }, [depositSummary.entradaCalculada, oficinaConfig.regrasPagamento, requiresDeposit, totals.finalTotal]);

  function formatCurrency(value: number) {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function addPartLine() {
    setPartLines((lines) => [
      ...lines,
      {
        id: Math.max(0, ...lines.map((line) => line.id)) + 1,
        name: "",
        quantity: "1",
        unitValue: "",
      },
    ]);
  }

  function addLaborLine() {
    setLaborLines((lines) => [
      ...lines,
      {
        id: Math.max(0, ...lines.map((line) => line.id)) + 1,
        service: "",
        description: "",
        value: "",
      },
    ]);
  }

  function updatePartLine(
    id: number,
    field: keyof Omit<PartLine, "id">,
    value: string,
  ) {
    setPartLines((lines) =>
      lines.map((line) => (line.id === id ? { ...line, [field]: value } : line)),
    );
  }

  function updateLaborLine(
    id: number,
    field: keyof Omit<LaborLine, "id">,
    value: string,
  ) {
    setLaborLines((lines) =>
      lines.map((line) => (line.id === id ? { ...line, [field]: value } : line)),
    );
  }

  function updateChecklistStatus(item: string, status: ChecklistStatus) {
    const observacaoTecnica = checklistState[item]?.observacaoTecnica ?? "";
    setChecklistState((currentState) => ({
      ...currentState,
      [item]: {
        ...currentState[item],
        status,
      },
    }));
    syncChecklistSuggestion(item, status, observacaoTecnica);
  }

  function updateChecklistObservation(item: string, observacaoTecnica: string) {
    const status = checklistState[item]?.status ?? "";
    setChecklistState((currentState) => ({
      ...currentState,
      [item]: {
        ...currentState[item],
        observacaoTecnica,
      },
    }));
    syncChecklistSuggestion(item, status, observacaoTecnica);
  }

  function syncChecklistSuggestion(
    item: string,
    status: ChecklistStatus,
    observacaoTecnica: string,
  ) {
    if (status !== "Trocar" || !observacaoTecnica.trim()) {
      return;
    }

    setPartLines((lines) => {
      if (
        lines.some(
          (line) =>
            line.generatedFromChecklist === item ||
            line.name.toLowerCase().includes(item.toLowerCase()),
        )
      ) {
        return lines;
      }

      return [
        ...lines,
        {
          id: Math.max(0, ...lines.map((line) => line.id)) + 1,
          name: `${item}: ${observacaoTecnica.trim()}`,
          quantity: "1",
          unitValue: "0",
          generatedFromChecklist: item,
        },
      ];
    });
  }

  function removePartLine(lineId: number) {
    setPartLines((lines) => lines.filter((line) => line.id !== lineId));
  }

  function createBudgetLink(publicToken: string) {
    if (typeof window === "undefined") {
      return `/orcamento/${publicToken}`;
    }

    return `${window.location.origin}/orcamento/${publicToken}`;
  }

  async function handleSaveOrder() {
    setFormError("");

    if (!oficina_id) {
      setFormError("Não foi possível identificar a oficina do usuário logado.");
      return;
    }

    if (!selectedCliente) {
      setFormError("Selecione um cliente antes de salvar a OS.");
      return;
    }

    if (!selectedVehicle) {
      setFormError("Selecione um veículo do cliente antes de salvar a OS.");
      return;
    }

    try {
      const currentOrders = await getStoredOrdersSupabase(oficina_id);
      const nextOrderCode = createNextOrderCode(currentOrders);
      const now = new Date().toISOString();
      const vehicleDescription = [
        selectedVehicle?.marca,
        selectedVehicle?.modelo,
        selectedVehicle?.ano,
      ]
        .filter(Boolean)
        .join(" ");
      const checklistInicial = checklistItems.map((item) => ({
        item,
        status: checklistState[item]?.status ?? "",
        observacaoTecnica: checklistState[item]?.observacaoTecnica.trim() ?? "",
      }));
      const pecasNecessarias = partLines.map((line) => {
        const quantidade = toNumber(line.quantity);
        const valorUnitario = toNumber(line.unitValue);

        return {
          id: line.id,
          peca: line.name.trim(),
          quantidade,
          valorUnitario,
          valorTotal: quantidade * valorUnitario,
          origemChecklist: line.generatedFromChecklist,
        };
      });
      const servicosMaoDeObra = laborLines.map((line) => ({
        id: line.id,
        servico: line.service.trim(),
        descricao: line.description.trim(),
        valor: toNumber(line.value),
      }));
      const clienteTelefone = onlyDigits(selectedCliente?.telefone || "");
      const clienteDocumento = onlyDigits(selectedCliente?.documento || "");
      const newOrder: ServiceOrder = {
        id: createServiceOrderId(),
        codigo: nextOrderCode,
        criadoEm: now,
        updatedAt: now,
        version: 1,
        cliente: selectedCliente.nome,
        telefone: clienteTelefone,
        veiculo: vehicleDescription,
        placa: selectedVehicle.placa,
        servicoInicial: problemReport.trim(),
        observacao: [defectFound, probableCause, recommendedSolution]
          .filter(Boolean)
          .join(" | "),
        status: "ABERTA",
        timeline: [
          createServiceOrderTimelineEvent({
            tipo: "criacao",
            titulo: "OS criada",
            descricao: `Ordem de serviço ${nextOrderCode} criada.`,
            usuarioResponsavel: "Atendimento",
            statusAnterior: "",
            statusNovo: "ABERTA",
          }),
        ],
        statusAprovacao: "pendente",
        itensAprovados: [],
        dataDecisaoAprovacao: "",
        dataPreAprovacao: "",
        dataConfirmacaoOficina: "",
        confirmacaoOficina: false,
        decisaoCliente: "",
        observacaoAprovacao: "",
        exigeEntrada: requiresDeposit,
        tipoEntrada: depositType,
        valorEntrada: toNumber(depositValue),
        percentualEntrada: toNumber(depositPercent),
        entradaCalculada: depositSummary.entradaCalculada,
        saldoRestante: depositSummary.saldoRestante,
        statusEntrada: requiresDeposit ? "pendente" : "nao_exige",
        dataPagamentoEntrada: "",
        valorEntradaPago: 0,
        formaPagamentoEscolhida: "",
        parcelasEscolhidas: 1,
        valorFinalPagamento: 0,
        descontoAplicado: 0,
        taxaAplicada: 0,
        descontoPagamentoAplicado: 0,
        taxaPagamentoAplicada: 0,
        clienteId: selectedCliente.id,
        clienteNome: selectedCliente.nome,
        clienteTelefone,
        veiculoId: selectedVehicle.id,
        km_entrada: "",
        proxima_revisao_km: "",
        proxima_revisao_data: "",
        veiculoTipo: selectedVehicle.tipo_veiculo || "Carro",
        veiculoMarca: selectedVehicle.marca,
        veiculoModelo: selectedVehicle.modelo,
        veiculoAno: selectedVehicle.ano,
        veiculoMotor: selectedVehicle.motor,
        veiculoCombustivel: selectedVehicle.combustivel,
        veiculoPlaca: selectedVehicle.placa,
        veiculoChassi: selectedVehicle.chassiVin,
        clienteDados: {
          nome: selectedCliente.nome,
          telefone: clienteTelefone,
          cpf: clienteDocumento.length <= 11 ? clienteDocumento : "",
          cnpj: clienteDocumento.length > 11 ? clienteDocumento : "",
          email: selectedCliente.email,
        },
        veiculoDados: {
          tipo_veiculo: selectedVehicle.tipo_veiculo || "Carro",
          marca: selectedVehicle.marca,
          modelo: selectedVehicle.modelo,
          ano: selectedVehicle.ano,
          placa: selectedVehicle.placa,
          motor: selectedVehicle.motor,
          combustivel: selectedVehicle.combustivel,
          chassiVin: selectedVehicle.chassiVin,
          kmAtual: "",
        },
        problemaRelatado: problemReport.trim(),
        diagnostico: {
          defeitoEncontrado: defectFound.trim(),
          causaProvavel: probableCause.trim(),
          solucaoRecomendada: recommendedSolution.trim(),
        },
        observacoes_tecnicas: "",
        checklistInicial,
        pecasNecessarias,
        servicosMaoDeObra,
        fotosOs: photos,
        orcamento: {
          totalPecas: totals.partsTotal,
          totalMaoDeObra: totals.laborTotal,
          descontoValor: toNumber(discountValue),
          descontoTipo: discountType,
          descontoAplicado: totals.discountAmount,
          formaPagamento: paymentMethod,
          totalFinal: totals.finalTotal,
        },
      };
      const savedOrder = await createServiceOrderSupabase(oficina_id, newOrder);
      registerInitialStockExit(savedOrder);
      saveStoredOrders([
        ...getStoredOrders().filter((order) => order.id !== savedOrder.id),
        savedOrder,
      ]);
      setSavedOrderId(savedOrder.codigo);
      setSavedBudgetToken(savedOrder.orcamento.publicToken || "");
      setSaveMessage(`OS ${savedOrder.codigo} salva com sucesso.`);
      toast.success(`OS ${savedOrder.codigo} criada com sucesso!`);
      await new Promise((resolve) => window.setTimeout(resolve, 800));
      navigate("/os");
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Não foi possível salvar a OS.";

      console.error("[OSNew:create] Falha ao salvar OS.", error);
      setFormError(errorMessage);

      if (errorMessage.startsWith("OS criada,")) {
        toast.error("OS criada parcialmente. Verifique os itens.");
        return;
      }

      toast.error(errorMessage);
    }
  }

  const { execute: executeSaveOrder, loading: savingOrder } = useAsyncAction(
    handleSaveOrder,
    {
      errorMessage: "Erro ao criar OS",
    },
  );

  return (
    <div className="max-w-6xl">
      <toast.ToastContainer />
      <div className="mb-6">
        <BackButton className="mb-4" />
        <div>
          <h2 className="text-3xl font-bold">Nova Ordem de Serviço</h2>
          <p className="mt-2 text-slate-400">
            Cadastro guiado para entrada, diagnóstico e orçamento.
          </p>
        </div>
      </div>

      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          void executeSaveOrder();
        }}
      >
        {formError && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-200">
            {formError}
          </div>
        )}

        <section className={sectionClass}>
          <div className="mb-6">
            <span className="text-sm font-semibold uppercase text-sky-400">
              Etapa 1
            </span>
            <h3 className="mt-1 text-2xl font-bold">Entrada do veículo</h3>
          </div>

          <div className="space-y-6">
            <div>
              <h4 className={subTitleClass}>Cliente</h4>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className={labelClass}>Selecione o cliente</label>
                  <select
                    className={inputClass}
                    value={selectedClienteId}
                    onChange={(event) => {
                      const clienteId = event.target.value;

                      setSelectedClienteId(clienteId);
                      setSelectedVehicleId(getSingleVehicleId(clientes, clienteId));
                    }}
                  >
                    <option value="" disabled>
                      Selecione
                    </option>
                    {clientes.map((cliente) => (
                      <option key={cliente.id} value={cliente.id}>
                        {cliente.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                  <span className="text-xs uppercase text-slate-500">
                    Contato
                  </span>
                  <p className="mt-1 font-medium">
                    {selectedCliente
                      ? formatPhone(selectedCliente.telefone) || "-"
                      : "Selecione um cliente"}
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    {selectedCliente?.documento
                      ? formatCpfCnpj(selectedCliente.documento)
                      : selectedCliente?.email || ""}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h4 className={subTitleClass}>Veículo do cliente</h4>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className={labelClass}>Selecione o veículo</label>
                  <select
                    className={inputClass}
                    value={selectedVehicleId}
                    onChange={(event) => setSelectedVehicleId(event.target.value)}
                    disabled={!selectedCliente}
                  >
                    <option value="" disabled>
                      {selectedCliente
                        ? "Selecione"
                        : "Selecione um cliente primeiro"}
                    </option>
                    {selectedCliente?.veiculos.map((veiculo) => (
                      <option key={veiculo.id} value={veiculo.id}>
                        {[veiculo.marca, veiculo.modelo, veiculo.ano]
                          .filter(Boolean)
                          .join(" ") || "Veículo sem identificação"}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                  <span className="text-xs uppercase text-slate-500">
                    Dados do veículo
                  </span>
                  <p className="mt-1 font-medium">
                    {selectedVehicle
                      ? [selectedVehicle.marca, selectedVehicle.modelo, selectedVehicle.ano]
                          .filter(Boolean)
                          .join(" ")
                      : "Selecione um veículo"}
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    {selectedVehicle
                      ? `Placa ${selectedVehicle.placa || "-"} · Motor ${
                          selectedVehicle.motor || "-"
                        } · ${selectedVehicle.combustivel || "-"}`
                      : ""}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={sectionClass}>
          <span className="text-sm font-semibold uppercase text-sky-400">
            Etapa 2
          </span>
          <h3 className="mt-1 text-2xl font-bold">
            Problema relatado pelo cliente
          </h3>

          <label className={`${labelClass} mt-5`}>
            O que o cliente percebeu?
          </label>
          <textarea
            rows={4}
            className={inputClass}
            placeholder="Ex: barulho ao frear, luz acesa no painel, perda de potência."
            value={problemReport}
            onChange={(event) => setProblemReport(event.target.value)}
          />
        </section>

        <section className={sectionClass}>
          <span className="text-sm font-semibold uppercase text-sky-400">
            Etapa 3
          </span>
          <h3 className="mt-1 text-2xl font-bold">Diagnóstico da oficina</h3>

          <div className="mt-5 grid gap-5 lg:grid-cols-3">
            <div>
              <label className={labelClass}>Defeito encontrado</label>
              <textarea
                rows={4}
                className={inputClass}
                placeholder="Ex: pastilhas gastas e disco riscado."
                value={defectFound}
                onChange={(event) => setDefectFound(event.target.value)}
              />
            </div>

            <div>
              <label className={labelClass}>Causa provável</label>
              <textarea
                rows={4}
                className={inputClass}
                placeholder="Ex: desgaste natural por uso."
                value={probableCause}
                onChange={(event) => setProbableCause(event.target.value)}
              />
            </div>

            <div>
              <label className={labelClass}>Solução recomendada</label>
              <textarea
                rows={4}
                className={inputClass}
                placeholder="Ex: trocar pastilhas e revisar fluido."
                value={recommendedSolution}
                onChange={(event) => setRecommendedSolution(event.target.value)}
              />
            </div>
          </div>
        </section>

        <section className={sectionClass}>
          <span className="text-sm font-semibold uppercase text-sky-400">
            Etapa 4
          </span>
          <h3 className="mt-1 text-2xl font-bold">Checklist inicial</h3>

          <div className="mt-5 grid gap-0">
            {checklistItems.map((item) => (
              <div
                key={item}
                className="grid gap-3 border-t border-slate-800 py-4 text-sm text-slate-200 md:grid-cols-[minmax(110px,1fr)_180px_minmax(180px,1.5fr)] md:items-center"
              >
                <span className="font-medium">{item}</span>

                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`checklist-${item}`}
                      value="OK"
                      checked={checklistState[item]?.status === "OK"}
                      onChange={() => updateChecklistStatus(item, "OK")}
                      className="h-4 w-4 border-slate-600 bg-slate-900 accent-sky-500"
                    />
                    OK
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`checklist-${item}`}
                      value="Trocar"
                      checked={checklistState[item]?.status === "Trocar"}
                      onChange={() => updateChecklistStatus(item, "Trocar")}
                      className="h-4 w-4 border-slate-600 bg-slate-900 accent-sky-500"
                    />
                    Trocar
                  </label>
                </div>

                <input
                  className={compactInputClass}
                  placeholder="Observação técnica"
                  value={checklistState[item]?.observacaoTecnica ?? ""}
                  onChange={(event) =>
                    updateChecklistObservation(item, event.target.value)
                  }
                />
              </div>
            ))}
          </div>
        </section>

        <ServiceOrderPhotosSection
          photos={photos}
          onChange={setPhotos}
          sectionClass={sectionClass}
          labelClass={labelClass}
          inputClass={inputClass}
        />

        <section className={sectionClass}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-sm font-semibold uppercase text-sky-400">
                Etapa 5
              </span>
              <h3 className="mt-1 text-2xl font-bold">Peças necessárias</h3>
            </div>

            <button
              type="button"
              onClick={addPartLine}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
            >
              Adicionar peça
            </button>
          </div>

          <div className="grid gap-0">
            {partLines.map((line, index) => {
              const lineTotal =
                Number(line.quantity || 0) * Number(line.unitValue || 0);

              return (
                <div
                  key={line.id}
                  className="grid gap-3 border-t border-slate-800 py-4 md:grid-cols-[minmax(160px,2fr)_100px_130px_130px]"
                >
                  <div>
                    <label className={labelClass}>Peça {index + 1}</label>
                    <input
                      className={compactInputClass}
                      placeholder="Pastilha de freio"
                      value={line.name}
                      onChange={(event) =>
                        updatePartLine(line.id, "name", event.target.value)
                      }
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Quantidade</label>
                    <input
                      type="number"
                      min="0"
                      className={compactInputClass}
                      value={line.quantity}
                      onChange={(event) =>
                        updatePartLine(line.id, "quantity", event.target.value)
                      }
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Valor unitário</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className={compactInputClass}
                      placeholder="0,00"
                      value={line.unitValue}
                      onChange={(event) =>
                        updatePartLine(line.id, "unitValue", event.target.value)
                      }
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Valor total</label>
                    <div className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm font-semibold text-slate-100">
                      {formatCurrency(lineTotal)}
                    </div>
                  </div>
                  <div className="md:col-span-4">
                    <button
                      type="button"
                      onClick={() => removePartLine(line.id)}
                      className="rounded-lg border border-red-400/40 px-3 py-2 text-xs font-semibold text-red-200 hover:bg-red-500/10"
                    >
                      Remover peça
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={addPartLine}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
            >
              Adicionar peça
            </button>
          </div>
        </section>

        <section className={sectionClass}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-sm font-semibold uppercase text-sky-400">
                Etapa 6
              </span>
              <h3 className="mt-1 text-2xl font-bold">
                Serviços / mão de obra
              </h3>
            </div>

            <button
              type="button"
              onClick={addLaborLine}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
            >
              Adicionar outro serviço
            </button>
          </div>

          <div className="grid gap-0">
            {laborLines.map((line) => (
              <div
                key={line.id}
              className="grid gap-3 border-t border-slate-800 py-4 md:grid-cols-[minmax(150px,1.2fr)_minmax(180px,2fr)_130px]"
            >
              <div>
                  <label className={labelClass}>Serviço</label>
                <input
                  className={compactInputClass}
                  placeholder="Troca de pastilhas"
                    value={line.service}
                    onChange={(event) =>
                      updateLaborLine(line.id, "service", event.target.value)
                    }
                  />
              </div>

              <div>
                  <label className={labelClass}>Observação</label>
                <input
                  className={compactInputClass}
                  placeholder="Remover rodas, substituir e testar"
                    value={line.description}
                    onChange={(event) =>
                      updateLaborLine(line.id, "description", event.target.value)
                    }
                  />
              </div>

              <div>
                  <label className={labelClass}>Valor da mão de obra</label>
                <input
                  type="number"
                    min="0"
                    step="0.01"
                    className={compactInputClass}
                    placeholder="0,00"
                    value={line.value}
                    onChange={(event) =>
                      updateLaborLine(line.id, "value", event.target.value)
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={sectionClass}>
          <span className="text-sm font-semibold uppercase text-sky-400">
            Etapa 7
          </span>
          <h3 className="mt-1 text-2xl font-bold">Resumo do orçamento</h3>

          <div className="mt-5 grid gap-6 lg:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-slate-400">Total de peças</span>
                <strong>{formatCurrency(totals.partsTotal)}</strong>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-slate-400">
                  Total de mão de obra
                </span>
                <strong>{formatCurrency(totals.laborTotal)}</strong>
              </div>

              <div className="flex items-center justify-between gap-4 border-t border-slate-800 pt-3">
                <span className="text-sm text-slate-400">Desconto aplicado</span>
                <strong>{formatCurrency(totals.discountAmount)}</strong>
              </div>

              <div className="flex items-center justify-between gap-4 border-t border-slate-800 pt-3">
                <span className="text-base font-semibold">Total final</span>
                <strong className="text-xl text-sky-300">
                  {formatCurrency(totals.finalTotal)}
                </strong>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm">
                <p className="font-semibold text-slate-100">
                  Entrada/sinal: {formatCurrency(depositSummary.entradaCalculada)}
                </p>
                <p className="mt-1 text-slate-400">
                  Saldo restante: {formatCurrency(depositSummary.saldoRestante)}
                </p>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_130px]">
                <div>
                  <label className={labelClass}>Desconto</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={compactInputClass}
                    placeholder="0"
                    value={discountValue}
                    onChange={(event) => setDiscountValue(event.target.value)}
                  />
                </div>

                <div>
                  <label className={labelClass}>Tipo</label>
                  <select
                    className={compactInputClass}
                    value={discountType}
                    onChange={(event) =>
                      setDiscountType(
                        event.target.value === "percent" ? "percent" : "money",
                      )
                    }
                  >
                    <option value="money">R$</option>
                    <option value="percent">%</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={labelClass}>Forma de pagamento</label>
                <select
                  className={inputClass}
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                >
                  <option value="" disabled>
                    Selecione
                  </option>
                  <option>Pix</option>
                  <option>Dinheiro</option>
                  <option>Débito</option>
                  <option>Crédito</option>
                </select>
              </div>

              <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 p-4">
                <label className="flex items-center gap-3 text-sm font-semibold text-amber-100">
                  <input
                    type="checkbox"
                    checked={requiresDeposit}
                    onChange={(event) => setRequiresDeposit(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-900 accent-amber-500"
                  />
                  Exigir entrada/sinal para iniciar o serviço
                </label>

                {requiresDeposit && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div>
                      <label className={labelClass}>Tipo da entrada</label>
                      <select
                        className={compactInputClass}
                        value={depositType}
                        onChange={(event) =>
                          setDepositType(
                            event.target.value === "percentual"
                              ? "percentual"
                              : "valor",
                          )
                        }
                      >
                        <option value="valor">Valor fixo</option>
                        <option value="percentual">Percentual</option>
                      </select>
                    </div>

                    {depositType === "valor" ? (
                      <div>
                        <label className={labelClass}>Valor da entrada</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className={compactInputClass}
                          value={depositValue}
                          onChange={(event) => setDepositValue(event.target.value)}
                        />
                      </div>
                    ) : (
                      <div>
                        <label className={labelClass}>Percentual</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          className={compactInputClass}
                          value={depositPercent}
                          onChange={(event) =>
                            setDepositPercent(event.target.value)
                          }
                        />
                      </div>
                    )}

                    <div className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm">
                      <span className="text-xs uppercase text-slate-500">
                        Entrada / saldo
                      </span>
                      <p className="mt-1 font-semibold text-slate-100">
                        {formatCurrency(depositSummary.entradaCalculada)}
                      </p>
                      <p className="text-xs text-slate-400">
                        Saldo {formatCurrency(depositSummary.saldoRestante)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950 p-4">
            <h4 className="font-semibold text-slate-100">
              Formas de pagamento disponíveis
            </h4>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                <span className="text-xs uppercase text-slate-500">Pix</span>
                <p className="mt-1 font-semibold">{formatCurrency(paymentOptions.pix.valorFinalPagamento)}</p>
                <p className="text-xs text-slate-500">Desconto {formatCurrency(paymentOptions.pix.descontoAplicado)}</p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                <span className="text-xs uppercase text-slate-500">Dinheiro</span>
                <p className="mt-1 font-semibold">{formatCurrency(paymentOptions.dinheiro.valorFinalPagamento)}</p>
                <p className="text-xs text-slate-500">Desconto {formatCurrency(paymentOptions.dinheiro.descontoAplicado)}</p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                <span className="text-xs uppercase text-slate-500">Débito</span>
                <p className="mt-1 font-semibold">{formatCurrency(paymentOptions.debito.valorFinalPagamento)}</p>
                <p className="text-xs text-slate-500">Desconto {formatCurrency(paymentOptions.debito.descontoAplicado)}</p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                <span className="text-xs uppercase text-slate-500">Crédito</span>
                <p className="mt-1 font-semibold">
                  até {oficinaConfig.regrasPagamento.credito.maxParcelas}x
                </p>
                <p className="text-xs text-slate-500">
                  {oficinaConfig.regrasPagamento.credito.parcelasSemJuros}x sem juros
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="sticky bottom-0 -mx-2 flex flex-wrap items-center justify-end gap-3 border-t border-slate-800 bg-slate-950/95 px-2 py-4 backdrop-blur">
          {saveMessage && (
            <span className="mr-auto text-sm font-medium text-emerald-400">
              {saveMessage}
            </span>
          )}

          {savedOrderId && (
            <>
              <button
                type="button"
                onClick={() => navigate(`/compras?osId=${savedOrderId}`)}
                className="rounded-xl bg-amber-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-amber-400"
              >
                Solicitar cotação
              </button>

              <button
                type="button"
                onClick={() => {
                  if (savedBudgetToken) {
                    window.open(
                      createBudgetLink(savedBudgetToken),
                      "_blank",
                      "noopener,noreferrer",
                    );
                    return;
                  }

                  navigate(`/os/${savedOrderId}`);
                }}
                className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-400"
              >
                Enviar orçamento
              </button>
            </>
          )}

          <button
            type="submit"
            disabled={savingOrder}
            className="rounded-xl bg-sky-500 px-6 py-3 font-semibold text-white hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savingOrder ? "Salvando..." : "Salvar OS"}
          </button>
        </div>
      </form>
    </div>
  );
}
