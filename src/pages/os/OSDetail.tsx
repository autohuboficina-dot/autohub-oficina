import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getStoredOrders,
  saveStoredOrders,
  type ChecklistStatus,
  type ServiceOrder,
} from "./osStorage";

const checklistItems = [
  "Freio",
  "Pneus",
  "Óleo",
  "Suspensão",
  "Bateria",
  "Iluminação",
];

const vehicleModelsByBrand: Record<string, string[]> = {
  Chevrolet: ["Onix", "Onix Plus", "Tracker", "S10", "Spin", "Cruze"],
  Fiat: ["Argo", "Cronos", "Mobi", "Pulse", "Strada", "Toro", "Uno"],
  Ford: ["EcoSport", "Fiesta", "Focus", "Ka", "Ranger", "Territory"],
  Honda: ["Civic", "City", "Fit", "HR-V", "WR-V"],
  Hyundai: ["Creta", "HB20", "HB20S", "Tucson"],
  Jeep: ["Compass", "Commander", "Renegade"],
  Nissan: ["Kicks", "March", "Sentra", "Versa", "Frontier"],
  Renault: ["Captur", "Duster", "Kwid", "Logan", "Sandero", "Oroch"],
  Toyota: ["Corolla", "Corolla Cross", "Etios", "Hilux", "SW4", "Yaris"],
  Volkswagen: ["Gol", "Jetta", "Nivus", "Polo", "Saveiro", "T-Cross", "Virtus"],
};

const vehicleBrands = Object.keys(vehicleModelsByBrand);

type PartLine = {
  id: number;
  name: string;
  quantity: string;
  unitValue: string;
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

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function formatPhone(value: string) {
  const digits = onlyDigits(value).slice(0, 11);

  if (digits.length <= 2) {
    return digits ? `(${digits}` : "";
  }

  if (digits.length <= 7) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatCpf(value: string) {
  const digits = onlyDigits(value).slice(0, 11);

  if (digits.length <= 3) {
    return digits;
  }

  if (digits.length <= 6) {
    return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  }

  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }

  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(
    6,
    9,
  )}-${digits.slice(9)}`;
}

function formatCnpj(value: string) {
  const digits = onlyDigits(value).slice(0, 14);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 5) {
    return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  }

  if (digits.length <= 8) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  }

  if (digits.length <= 12) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(
      5,
      8,
    )}/${digits.slice(8)}`;
  }

  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(
    5,
    8,
  )}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function toNumber(value: string) {
  return Number(value || 0);
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function createChecklistState(order?: ServiceOrder) {
  return checklistItems.reduce<ChecklistFormState>((state, item) => {
    const storedItem = order?.checklistInicial.find(
      (checklistItem) => checklistItem.item === item,
    );
    state[item] = {
      status: storedItem?.status ?? "",
      observacaoTecnica: storedItem?.observacaoTecnica ?? "",
    };
    return state;
  }, {});
}

function createPartLines(order?: ServiceOrder): PartLine[] {
  if (!order?.pecasNecessarias.length) {
    return [{ id: 1, name: "", quantity: "1", unitValue: "" }];
  }

  return order.pecasNecessarias.map((part) => ({
    id: part.id,
    name: part.peca,
    quantity: String(part.quantidade),
    unitValue: String(part.valorUnitario),
  }));
}

function createLaborLines(order?: ServiceOrder): LaborLine[] {
  if (!order?.servicosMaoDeObra.length) {
    return [{ id: 1, service: "", description: "", value: "" }];
  }

  return order.servicosMaoDeObra.map((labor) => ({
    id: labor.id,
    service: labor.servico,
    description: labor.descricao,
    value: String(labor.valor),
  }));
}

export default function OSDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const storedOrders = useMemo(() => getStoredOrders(), []);
  const order = useMemo(
    () =>
      storedOrders.find(
        (storedOrder) => storedOrder.id === id || storedOrder.codigo === id,
      ),
    [id, storedOrders],
  );

  const [clientName, setClientName] = useState(
    order?.clienteDados.nome || order?.cliente || "",
  );
  const [clientPhone, setClientPhone] = useState(
    order?.clienteDados.telefone || order?.telefone || "",
  );
  const [clientCpf, setClientCpf] = useState(order?.clienteDados.cpf || "");
  const [clientCnpj, setClientCnpj] = useState(order?.clienteDados.cnpj || "");
  const [clientEmail, setClientEmail] = useState(order?.clienteDados.email || "");
  const [vehicleBrand, setVehicleBrand] = useState(order?.veiculoDados.marca || "");
  const [vehicleModel, setVehicleModel] = useState(order?.veiculoDados.modelo || "");
  const [vehicleYear, setVehicleYear] = useState(order?.veiculoDados.ano || "");
  const [vehiclePlate, setVehiclePlate] = useState(
    order?.veiculoDados.placa || order?.placa || "",
  );
  const [vehicleMotor, setVehicleMotor] = useState(order?.veiculoDados.motor || "");
  const [vehicleFuel, setVehicleFuel] = useState(
    order?.veiculoDados.combustivel || "",
  );
  const [vehicleVin, setVehicleVin] = useState(
    order?.veiculoDados.chassiVin || "",
  );
  const [vehicleKm, setVehicleKm] = useState(order?.veiculoDados.kmAtual || "");
  const [status, setStatus] = useState(order?.status || "Em diagnóstico");
  const [problemReport, setProblemReport] = useState(
    order?.problemaRelatado || order?.servicoInicial || "",
  );
  const [defectFound, setDefectFound] = useState(
    order?.diagnostico.defeitoEncontrado || "",
  );
  const [probableCause, setProbableCause] = useState(
    order?.diagnostico.causaProvavel || "",
  );
  const [recommendedSolution, setRecommendedSolution] = useState(
    order?.diagnostico.solucaoRecomendada || "",
  );
  const [checklistState, setChecklistState] = useState<ChecklistFormState>(() =>
    createChecklistState(order),
  );
  const [partLines, setPartLines] = useState<PartLine[]>(() =>
    createPartLines(order),
  );
  const [laborLines, setLaborLines] = useState<LaborLine[]>(() =>
    createLaborLines(order),
  );
  const [discountValue, setDiscountValue] = useState(
    order ? String(order.orcamento.descontoValor) : "",
  );
  const [discountType, setDiscountType] = useState<"money" | "percent">(
    order?.orcamento.descontoTipo ?? "money",
  );
  const [paymentMethod, setPaymentMethod] = useState(
    order?.orcamento.formaPagamento || "",
  );
  const [saveMessage, setSaveMessage] = useState("");

  const modelSuggestions = vehicleModelsByBrand[vehicleBrand] ?? [];

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
      return total + toNumber(line.quantity) * toNumber(line.unitValue);
    }, 0);
    const laborTotal = laborLines.reduce((total, line) => {
      return total + toNumber(line.value);
    }, 0);
    const subtotal = partsTotal + laborTotal;
    const discountNumber = toNumber(discountValue);
    const discountAmount =
      discountType === "percent"
        ? (subtotal * Math.min(discountNumber, 100)) / 100
        : discountNumber;
    const finalTotal = Math.max(subtotal - discountAmount, 0);

    return { partsTotal, laborTotal, discountAmount, finalTotal };
  }, [discountType, discountValue, laborLines, partLines]);

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
    lineId: number,
    field: keyof Omit<PartLine, "id">,
    value: string,
  ) {
    setPartLines((lines) =>
      lines.map((line) =>
        line.id === lineId ? { ...line, [field]: value } : line,
      ),
    );
  }

  function updateLaborLine(
    lineId: number,
    field: keyof Omit<LaborLine, "id">,
    value: string,
  ) {
    setLaborLines((lines) =>
      lines.map((line) =>
        line.id === lineId ? { ...line, [field]: value } : line,
      ),
    );
  }

  function updateChecklistStatus(item: string, itemStatus: ChecklistStatus) {
    setChecklistState((currentState) => ({
      ...currentState,
      [item]: {
        ...currentState[item],
        status: itemStatus,
      },
    }));
  }

  function updateChecklistObservation(item: string, observacaoTecnica: string) {
    setChecklistState((currentState) => ({
      ...currentState,
      [item]: {
        ...currentState[item],
        observacaoTecnica,
      },
    }));
  }

  function handleSaveChanges() {
    if (!order) {
      return;
    }

    const vehicleDescription = [vehicleBrand, vehicleModel, vehicleYear]
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
      };
    });
    const servicosMaoDeObra = laborLines.map((line) => ({
      id: line.id,
      servico: line.service.trim(),
      descricao: line.description.trim(),
      valor: toNumber(line.value),
    }));
    const updatedOrder: ServiceOrder = {
      ...order,
      id: order.id,
      codigo: order.codigo,
      cliente: clientName.trim() || "Cliente sem nome",
      telefone: clientPhone.trim(),
      veiculo: vehicleDescription || "Veículo não informado",
      placa: vehiclePlate.trim(),
      servicoInicial: problemReport.trim(),
      observacao: [defectFound, probableCause, recommendedSolution]
        .filter(Boolean)
        .join(" | "),
      status,
      clienteDados: {
        nome: clientName.trim(),
        telefone: clientPhone.trim(),
        cpf: clientCpf.trim(),
        cnpj: clientCnpj.trim(),
        email: clientEmail.trim(),
      },
      veiculoDados: {
        marca: vehicleBrand.trim(),
        modelo: vehicleModel.trim(),
        ano: vehicleYear.trim(),
        placa: vehiclePlate.trim(),
        motor: vehicleMotor.trim(),
        combustivel: vehicleFuel,
        chassiVin: vehicleVin.trim(),
        kmAtual: vehicleKm.trim(),
      },
      problemaRelatado: problemReport.trim(),
      diagnostico: {
        defeitoEncontrado: defectFound.trim(),
        causaProvavel: probableCause.trim(),
        solucaoRecomendada: recommendedSolution.trim(),
      },
      checklistInicial,
      pecasNecessarias,
      servicosMaoDeObra,
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

    const updatedOrders = getStoredOrders().map((storedOrder) =>
      storedOrder.id === order.id ? updatedOrder : storedOrder,
    );
    saveStoredOrders(updatedOrders);
    setSaveMessage("Alterações salvas.");
  }

  if (!order) {
    return (
      <div>
        <button
          onClick={() => navigate("/os")}
          className="mb-6 rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
        >
          Voltar para OS
        </button>

        <section className={sectionClass}>
          <h2 className="text-3xl font-bold">OS não encontrada</h2>
          <p className="mt-2 text-slate-400">
            Não existe ordem de serviço salva para o ID informado.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold">Detalhe da OS {order.id}</h2>
          <p className="mt-2 text-slate-400">
            Edite os dados completos da ordem de serviço.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate("/os")}
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
        >
          Voltar
        </button>
      </div>

      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          handleSaveChanges();
        }}
      >
        <section className={sectionClass}>
          <div className="mb-6">
            <span className="text-sm font-semibold uppercase text-sky-400">
              Etapa 1
            </span>
            <h3 className="mt-1 text-2xl font-bold">Entrada do veículo</h3>
          </div>

          <div className="space-y-6">
            <div>
              <h4 className={subTitleClass}>Dados do cliente</h4>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className={labelClass}>Nome</label>
                  <input
                    className={inputClass}
                    placeholder="Nome completo"
                    value={clientName}
                    onChange={(event) => setClientName(event.target.value)}
                  />
                </div>

                <div>
                  <label className={labelClass}>Telefone</label>
                  <input
                    className={inputClass}
                    inputMode="numeric"
                    placeholder="(00) 00000-0000"
                    value={clientPhone}
                    onChange={(event) =>
                      setClientPhone(formatPhone(event.target.value))
                    }
                  />
                </div>

                <div>
                  <label className={labelClass}>CPF opcional</label>
                  <input
                    className={inputClass}
                    inputMode="numeric"
                    placeholder="000.000.000-00"
                    value={clientCpf}
                    onChange={(event) => setClientCpf(formatCpf(event.target.value))}
                  />
                </div>

                <div>
                  <label className={labelClass}>CNPJ opcional</label>
                  <input
                    className={inputClass}
                    inputMode="numeric"
                    placeholder="00.000.000/0000-00"
                    value={clientCnpj}
                    onChange={(event) =>
                      setClientCnpj(formatCnpj(event.target.value))
                    }
                  />
                </div>

                <div>
                  <label className={labelClass}>E-mail opcional</label>
                  <input
                    type="email"
                    className={inputClass}
                    placeholder="cliente@email.com"
                    value={clientEmail}
                    onChange={(event) => setClientEmail(event.target.value)}
                  />
                </div>

                <div>
                  <label className={labelClass}>Status da OS</label>
                  <select
                    className={inputClass}
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                  >
                    <option>Em diagnóstico</option>
                    <option>Aguardando aprovação</option>
                    <option>Aprovada</option>
                    <option>Em execução</option>
                    <option>Finalizada</option>
                    <option>Cancelada</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <h4 className={subTitleClass}>Dados do veículo</h4>

              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className={labelClass}>Marca</label>
                  <input
                    className={inputClass}
                    list="vehicle-brands"
                    placeholder="Honda"
                    value={vehicleBrand}
                    onChange={(event) => setVehicleBrand(event.target.value)}
                  />
                  <datalist id="vehicle-brands">
                    {vehicleBrands.map((brand) => (
                      <option key={brand} value={brand} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className={labelClass}>Modelo</label>
                  <input
                    className={inputClass}
                    list="vehicle-models"
                    placeholder="Civic"
                    value={vehicleModel}
                    onChange={(event) => setVehicleModel(event.target.value)}
                  />
                  <datalist id="vehicle-models">
                    {modelSuggestions.map((model) => (
                      <option key={model} value={model} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className={labelClass}>Ano</label>
                  <input
                    className={inputClass}
                    placeholder="2018"
                    value={vehicleYear}
                    onChange={(event) => setVehicleYear(event.target.value)}
                  />
                </div>

                <div>
                  <label className={labelClass}>Placa</label>
                  <input
                    className={inputClass}
                    placeholder="ABC1D23"
                    value={vehiclePlate}
                    onChange={(event) => setVehiclePlate(event.target.value)}
                  />
                </div>

                <div>
                  <label className={labelClass}>Motor</label>
                  <input
                    className={inputClass}
                    placeholder="2.0"
                    value={vehicleMotor}
                    onChange={(event) => setVehicleMotor(event.target.value)}
                  />
                </div>

                <div>
                  <label className={labelClass}>Combustível</label>
                  <select
                    className={inputClass}
                    value={vehicleFuel}
                    onChange={(event) => setVehicleFuel(event.target.value)}
                  >
                    <option value="" disabled>
                      Selecione
                    </option>
                    <option>Flex</option>
                    <option>Gasolina</option>
                    <option>Etanol</option>
                    <option>Diesel</option>
                    <option>Elétrico</option>
                    <option>Híbrido</option>
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Chassi/VIN opcional</label>
                  <input
                    className={inputClass}
                    placeholder="Identificação"
                    value={vehicleVin}
                    onChange={(event) => setVehicleVin(event.target.value)}
                  />
                </div>

                <div>
                  <label className={labelClass}>Km atual</label>
                  <input
                    className={inputClass}
                    inputMode="numeric"
                    placeholder="000.000"
                    value={vehicleKm}
                    onChange={(event) => setVehicleKm(event.target.value)}
                  />
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
                      name={`detail-checklist-${item}`}
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
                      name={`detail-checklist-${item}`}
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
              const lineTotal = toNumber(line.quantity) * toNumber(line.unitValue);

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
                </div>
              );
            })}
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
              Adicionar serviço
            </button>
          </div>

          <div className="grid gap-0">
            {laborLines.map((line, index) => (
              <div
                key={line.id}
                className="grid gap-3 border-t border-slate-800 py-4 md:grid-cols-[minmax(150px,1.2fr)_minmax(180px,2fr)_130px]"
              >
                <div>
                  <label className={labelClass}>Serviço {index + 1}</label>
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
                  <label className={labelClass}>Descrição</label>
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
                  <label className={labelClass}>Valor</label>
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
            </div>
          </div>
        </section>

        <div className="sticky bottom-0 -mx-2 flex flex-wrap items-center justify-end gap-3 border-t border-slate-800 bg-slate-950/95 px-2 py-4 backdrop-blur">
          {saveMessage && (
            <span className="mr-auto text-sm font-medium text-emerald-400">
              {saveMessage}
            </span>
          )}

          <button
            type="button"
            onClick={() => navigate("/os")}
            className="rounded-xl border border-slate-700 px-6 py-3 font-semibold text-slate-200 hover:bg-slate-800"
          >
            Voltar
          </button>

          <button
            type="submit"
            className="rounded-xl bg-sky-500 px-6 py-3 font-semibold text-white hover:bg-sky-400"
          >
            Salvar alterações
          </button>
        </div>
      </form>
    </div>
  );
}
