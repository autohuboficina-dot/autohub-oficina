import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import BackButton from "../../components/ui/BackButton";
import { useAuth } from "../../contexts/useAuth";
import { formatCpfCnpj, formatPhone, onlyDigits } from "../../utils/formatters";
import { vehicleBrands, vehicleModelsByBrand } from "../vehicleCatalog";
import {
  createClienteVeiculoId,
  ESTADOS_UF,
  TIPOS_VEICULO,
  getClientes,
  getClientesSupabase,
  saveClienteSupabase,
  updateClienteSupabase,
  deleteClienteSupabase,
  type Cliente,
  type ClienteTipo,
  type ClienteVeiculo,
  type EstadoUF,
} from "../../services/clientesService";

type ClienteForm = {
  tipo: ClienteTipo;
  nome: string;
  telefone: string;
  documento: string;
  email: string;
  cidade: string;
  estado: EstadoUF;
  observacoes: string;
  veiculos: ClienteVeiculo[];
};

function createEmptyVehicle(): ClienteVeiculo {
  return {
    id: createClienteVeiculoId(),
    tipo_veiculo: "Carro",
    marca: "",
    modelo: "",
    ano: "",
    motor: "",
    combustivel: "",
    placa: "",
    chassiVin: "",
    observacoes: "",
  };
}

function createBlankForm(): ClienteForm {
  return {
    tipo: "Pessoa física",
    nome: "",
    telefone: "",
    documento: "",
    email: "",
    cidade: "",
    estado: "SP",
    observacoes: "",
    veiculos: [createEmptyVehicle()],
  };
}

function normalizePlate(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

export default function Clientes() {
  const navigate = useNavigate();
  const { oficina_id } = useAuth();
  const [clientes, setClientes] = useState<Cliente[]>(() => getClientes());
  const [form, setForm] = useState<ClienteForm>(createBlankForm);
  const [showForm, setShowForm] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [search, setSearch] = useState("");
  const [formError, setFormError] = useState("");
  const [isLoadingClientes, setIsLoadingClientes] = useState(Boolean(oficina_id));
  const [clientesLoadMessage, setClientesLoadMessage] = useState("");

  const isEditing = Boolean(editingCliente);
  const filteredClientes = useMemo(() => {
    const query = search.trim().toLowerCase();
    const queryDigits = onlyDigits(query);
    const queryPlate = normalizePlate(query);

    if (!query) {
      return clientes;
    }

    return clientes.filter((cliente) => {
      const vehiclePlateMatch = cliente.veiculos.some((veiculo) =>
        normalizePlate(veiculo.placa).includes(queryPlate),
      );

      return (
        cliente.nome.toLowerCase().includes(query) ||
        onlyDigits(cliente.telefone).includes(queryDigits) ||
        onlyDigits(cliente.documento).includes(queryDigits) ||
        vehiclePlateMatch
      );
    });
  }, [clientes, search]);

  const inputClass =
    "w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none transition focus:border-sky-500";
  const labelClass = "mb-2 block text-sm font-medium text-slate-300";
  const sectionClass =
    "rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-sm shadow-slate-950/20 sm:p-6";

  async function refreshClientes() {
    if (!oficina_id) {
      setFormError("Não foi possível identificar a oficina do usuário logado.");
      setClientes(getClientes());
      return;
    }

    setIsLoadingClientes(true);
    const loadedClientes = await getClientesSupabase(oficina_id);
    setClientes(loadedClientes);
    setClientesLoadMessage(
      loadedClientes.length === 0 ? "Nenhum cliente cadastrado ainda." : "",
    );
    setIsLoadingClientes(false);
  }

  useEffect(() => {
    let isMounted = true;

    async function loadClientes() {
      if (!oficina_id) {
        setFormError("Não foi possível identificar a oficina do usuário logado.");
        setClientes(getClientes());
        setIsLoadingClientes(false);
        return;
      }

      setIsLoadingClientes(true);
      const loadedClientes = await getClientesSupabase(oficina_id);

      if (isMounted) {
        setClientes(loadedClientes);
        setClientesLoadMessage(
          loadedClientes.length === 0 ? "Nenhum cliente cadastrado ainda." : "",
        );
        setIsLoadingClientes(false);
      }
    }

    loadClientes();

    return () => {
      isMounted = false;
    };
  }, [oficina_id]);

  function resetForm() {
    setForm(createBlankForm());
    setEditingCliente(null);
    setShowForm(false);
    setFormError("");
  }

  function handleNewCliente() {
    setForm(createBlankForm());
    setEditingCliente(null);
    setSelectedCliente(null);
    setFormError("");
    setShowForm(true);
  }

  function handleEditCliente(cliente: Cliente) {
    setForm({
      tipo: cliente.tipo,
      nome: cliente.nome,
      telefone: formatPhone(cliente.telefone),
      documento: formatCpfCnpj(cliente.documento),
      email: cliente.email,
      cidade: cliente.cidade,
      estado: cliente.estado || "SP",
      observacoes: cliente.observacoes,
      veiculos: cliente.veiculos.length ? cliente.veiculos : [createEmptyVehicle()],
    });
    setEditingCliente(cliente);
    setSelectedCliente(null);
    setFormError("");
    setShowForm(true);
  }

  async function handleDeleteCliente(cliente: Cliente) {
    const shouldDelete = window.confirm(`Excluir cliente ${cliente.nome}?`);

    if (!shouldDelete) {
      return;
    }

    if (!oficina_id) {
      setFormError("Não foi possível identificar a oficina do usuário logado.");
      return;
    }

    try {
      await deleteClienteSupabase(oficina_id, cliente.id);
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Não foi possível excluir o cliente.",
      );
      return;
    }
    if (selectedCliente?.id === cliente.id) {
      setSelectedCliente(null);
    }
    if (editingCliente?.id === cliente.id) {
      resetForm();
    }
    await refreshClientes();
  }

  function updateVehicle(
    vehicleId: string,
    field: keyof Omit<ClienteVeiculo, "id">,
    value: string,
  ) {
    setForm((currentForm) => ({
      ...currentForm,
      veiculos: currentForm.veiculos.map((veiculo) =>
        veiculo.id === vehicleId ? { ...veiculo, [field]: value } : veiculo,
      ),
    }));
  }

  function addVehicle() {
    setForm((currentForm) => ({
      ...currentForm,
      veiculos: [...currentForm.veiculos, createEmptyVehicle()],
    }));
  }

  function removeVehicle(vehicleId: string) {
    setForm((currentForm) => ({
      ...currentForm,
      veiculos:
        currentForm.veiculos.length > 1
          ? currentForm.veiculos.filter((veiculo) => veiculo.id !== vehicleId)
          : currentForm.veiculos,
    }));
  }

  function validateForm(veiculos: ClienteVeiculo[]) {
    const documento = onlyDigits(form.documento);
    const duplicateDocument =
      documento &&
      clientes.some(
        (cliente) =>
          cliente.id !== editingCliente?.id &&
          onlyDigits(cliente.documento) === documento,
      );

    if (!form.nome.trim()) {
      return "Informe o nome ou razão social do cliente.";
    }

    if (duplicateDocument) {
      return "Já existe um cliente cadastrado com este CPF/CNPJ.";
    }

    const invalidVehicle = veiculos.find(
      (veiculo) => !veiculo.modelo.trim() || !veiculo.placa.trim(),
    );

    if (invalidVehicle) {
      return "Informe modelo e placa para todos os veículos.";
    }

    const formPlates = veiculos.map((veiculo) => normalizePlate(veiculo.placa));
    const hasRepeatedPlateInForm = formPlates.some(
      (plate, index) => formPlates.indexOf(plate) !== index,
    );

    if (hasRepeatedPlateInForm) {
      return "Há placas duplicadas neste cliente.";
    }

    const existingPlates = clientes
      .filter((cliente) => cliente.id !== editingCliente?.id)
      .flatMap((cliente) =>
        cliente.veiculos.map((veiculo) => normalizePlate(veiculo.placa)),
      );
    const duplicatePlate = formPlates.some((plate) => existingPlates.includes(plate));

    if (duplicatePlate) {
      return "Já existe um veículo cadastrado com uma das placas informadas.";
    }

    return "";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!oficina_id) {
      setFormError("Não foi possível identificar a oficina do usuário logado.");
      return;
    }

    const veiculos = form.veiculos.map((veiculo) => ({
      ...veiculo,
      tipo_veiculo: veiculo.tipo_veiculo || "Carro",
      marca: veiculo.marca.trim(),
      modelo: veiculo.modelo.trim(),
      ano: veiculo.ano.trim(),
      motor: veiculo.motor.trim(),
      combustivel: veiculo.combustivel,
      placa: normalizePlate(veiculo.placa),
      chassiVin: veiculo.chassiVin.trim().toUpperCase(),
      observacoes: veiculo.observacoes.trim(),
    }));
    const validationError = validateForm(veiculos);

    if (validationError) {
      setFormError(validationError);
      return;
    }

    const clienteData = {
      ...form,
      nome: form.nome.trim(),
      telefone: onlyDigits(form.telefone),
      documento: onlyDigits(form.documento),
      email: form.email.trim(),
      cidade: form.cidade.trim(),
      estado: form.estado,
      observacoes: form.observacoes.trim(),
      veiculos,
      quantidadeVeiculos: veiculos.length,
    };

    try {
      if (editingCliente) {
        await updateClienteSupabase(oficina_id, {
          ...editingCliente,
          ...clienteData,
        });
      } else {
        await saveClienteSupabase(oficina_id, clienteData);
      }
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar o cliente.",
      );
      return;
    }

    resetForm();
    await refreshClientes();
  }

  return (
    <div className="max-w-7xl">
      <div className="mb-6">
        {(showForm || selectedCliente) && <BackButton className="mb-4" />}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold">Clientes</h2>
          <p className="mt-2 text-slate-400">
            Cadastro completo de clientes, veículos e histórico de atendimento.
          </p>
        </div>

        <button
          type="button"
          onClick={handleNewCliente}
          className="rounded-lg bg-sky-500 px-4 py-2 font-medium text-white hover:bg-sky-400"
        >
          Novo cliente
        </button>
      </div>
      </div>

      {!showForm && (
        <section className={`${sectionClass} mb-6`}>
          <label className={labelClass}>Buscar cliente</label>
          <input
            className={inputClass}
            placeholder="Nome, telefone, CPF/CNPJ ou placa"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </section>
      )}

      {showForm && (
        <section className={`${sectionClass} mb-6`}>
          <datalist id="client-vehicle-brands">
            {vehicleBrands.map((brand) => (
              <option key={brand} value={brand} />
            ))}
          </datalist>

          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-2xl font-bold">
                {isEditing ? "Editar cliente" : "Novo cliente"}
              </h3>
              <p className="mt-1 text-sm text-slate-400">
                Preencha os dados do cliente e cadastre seus veículos.
              </p>
            </div>

            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
            >
              Cancelar
            </button>
          </div>

          {formError && (
            <div className="mb-5 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {formError}
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className={labelClass}>Tipo de cliente</label>
                <select
                  className={inputClass}
                  value={form.tipo}
                  onChange={(event) =>
                    setForm((currentForm) => ({
                      ...currentForm,
                      tipo: event.target.value as ClienteTipo,
                    }))
                  }
                >
                  <option>Pessoa física</option>
                  <option>Empresa</option>
                  <option>Frota</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>Nome/Razão social</label>
                <input
                  className={inputClass}
                  placeholder="Nome do cliente"
                  value={form.nome}
                  onChange={(event) =>
                    setForm((currentForm) => ({
                      ...currentForm,
                      nome: event.target.value,
                    }))
                  }
                />
              </div>

              <div>
                <label className={labelClass}>Telefone/WhatsApp</label>
                <input
                  className={inputClass}
                  inputMode="numeric"
                  placeholder="(00) 00000-0000"
                  value={form.telefone}
                  onChange={(event) =>
                    setForm((currentForm) => ({
                      ...currentForm,
                      telefone: formatPhone(event.target.value),
                    }))
                  }
                />
              </div>

              <div>
                <label className={labelClass}>CPF/CNPJ</label>
                <input
                  className={inputClass}
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  value={form.documento}
                  onChange={(event) =>
                    setForm((currentForm) => ({
                      ...currentForm,
                      documento: formatCpfCnpj(event.target.value),
                    }))
                  }
                />
              </div>

              <div>
                <label className={labelClass}>E-mail</label>
                <input
                  type="email"
                  className={inputClass}
                  placeholder="cliente@email.com"
                  value={form.email}
                  onChange={(event) =>
                    setForm((currentForm) => ({
                      ...currentForm,
                      email: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-[7fr_3fr]">
                <div>
                  <label className={labelClass}>Cidade</label>
                  <input
                    className={inputClass}
                    placeholder="São Paulo"
                    value={form.cidade}
                    onChange={(event) =>
                      setForm((currentForm) => ({
                        ...currentForm,
                        cidade: event.target.value,
                      }))
                    }
                  />
                </div>

                <div>
                  <label className={labelClass}>Estado</label>
                  <select
                    className={inputClass}
                    value={form.estado}
                    onChange={(event) =>
                      setForm((currentForm) => ({
                        ...currentForm,
                        estado: event.target.value as EstadoUF,
                      }))
                    }
                  >
                    {ESTADOS_UF.map((estado) => (
                      <option key={estado}>{estado}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="md:col-span-2 lg:col-span-3">
                <label className={labelClass}>Observações</label>
                <textarea
                  rows={4}
                  className={inputClass}
                  placeholder="Preferências, histórico, horários de contato..."
                  value={form.observacoes}
                  onChange={(event) =>
                    setForm((currentForm) => ({
                      ...currentForm,
                      observacoes: event.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-xl font-semibold">Veículos do cliente</h4>
                  <p className="mt-1 text-sm text-slate-400">
                    Modelo e placa são obrigatórios para cada veículo.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={addVehicle}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
                >
                  Adicionar veículo
                </button>
              </div>

              <div className="grid gap-5">
                {form.veiculos.map((veiculo, index) => {
                  const modelSuggestions = vehicleModelsByBrand[veiculo.marca] ?? [];
                  const modelDatalistId = `vehicle-models-${veiculo.id}`;

                  return (
                    <div
                      key={veiculo.id}
                      className="rounded-xl border border-slate-800 bg-slate-900 p-4"
                    >
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <h5 className="font-semibold text-sky-300">
                          Veículo {index + 1}
                        </h5>

                        <button
                          type="button"
                          onClick={() => removeVehicle(veiculo.id)}
                          disabled={form.veiculos.length === 1}
                          className="rounded bg-red-500/20 px-3 py-1 text-xs text-red-200 hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Remover
                        </button>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <div>
                          <label className={labelClass}>Tipo de veículo</label>
                          <select
                            className={inputClass}
                            value={veiculo.tipo_veiculo || "Carro"}
                            onChange={(event) =>
                              updateVehicle(
                                veiculo.id,
                                "tipo_veiculo",
                                event.target.value,
                              )
                            }
                          >
                            {TIPOS_VEICULO.map((tipo) => (
                              <option key={tipo}>{tipo}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className={labelClass}>Marca</label>
                          <input
                            className={inputClass}
                            list="client-vehicle-brands"
                            placeholder="Honda"
                            value={veiculo.marca}
                            onChange={(event) =>
                              updateVehicle(veiculo.id, "marca", event.target.value)
                            }
                          />
                        </div>

                        <div>
                          <label className={labelClass}>Modelo</label>
                          <input
                            className={inputClass}
                            list={modelDatalistId}
                            placeholder="Civic"
                            value={veiculo.modelo}
                            onChange={(event) =>
                              updateVehicle(veiculo.id, "modelo", event.target.value)
                            }
                          />
                          <datalist id={modelDatalistId}>
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
                            value={veiculo.ano}
                            onChange={(event) =>
                              updateVehicle(veiculo.id, "ano", event.target.value)
                            }
                          />
                        </div>

                        <div>
                          <label className={labelClass}>Motor</label>
                          <input
                            className={inputClass}
                            placeholder="2.0"
                            value={veiculo.motor}
                            onChange={(event) =>
                              updateVehicle(veiculo.id, "motor", event.target.value)
                            }
                          />
                        </div>

                        <div>
                          <label className={labelClass}>Combustível</label>
                          <select
                            className={inputClass}
                            value={veiculo.combustivel}
                            onChange={(event) =>
                              updateVehicle(
                                veiculo.id,
                                "combustivel",
                                event.target.value,
                              )
                            }
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
                          <label className={labelClass}>Placa</label>
                          <input
                            className={inputClass}
                            placeholder="ABC1D23"
                            value={veiculo.placa}
                            onChange={(event) =>
                              updateVehicle(
                                veiculo.id,
                                "placa",
                                event.target.value.toUpperCase(),
                              )
                            }
                          />
                        </div>

                        <div>
                          <label className={labelClass}>Chassi/VIN</label>
                          <input
                            className={inputClass}
                            placeholder="Identificação"
                            value={veiculo.chassiVin}
                            onChange={(event) =>
                              updateVehicle(
                                veiculo.id,
                                "chassiVin",
                                event.target.value.toUpperCase(),
                              )
                            }
                          />
                        </div>

                        <div className="md:col-span-2 lg:col-span-4">
                          <label className={labelClass}>
                            Observações do veículo
                          </label>
                          <textarea
                            rows={3}
                            className={inputClass}
                            placeholder="Histórico, avarias, acessórios..."
                            value={veiculo.observacoes}
                            onChange={(event) =>
                              updateVehicle(
                                veiculo.id,
                                "observacoes",
                                event.target.value,
                              )
                            }
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-slate-700 px-6 py-3 font-semibold text-slate-200 hover:bg-slate-800"
              >
                Cancelar
              </button>

              <button
                type="submit"
                className="rounded-xl bg-sky-500 px-6 py-3 font-semibold text-white hover:bg-sky-400"
              >
                {isEditing ? "Salvar alterações" : "Salvar cliente"}
              </button>
            </div>
          </form>
        </section>
      )}

      {!showForm && (
      <section className={sectionClass}>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xl font-semibold">Clientes cadastrados</h3>
          <span className="rounded-lg bg-slate-950 px-3 py-1 text-sm text-slate-400">
            {filteredClientes.length} de {clientes.length} registro(s)
          </span>
        </div>

        {isLoadingClientes && (
          <div className="mb-4 rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-400">
            Carregando clientes...
          </div>
        )}

        {clientesLoadMessage && !isLoadingClientes && clientes.length === 0 && (
          <div className="mb-4 rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-400">
            {clientesLoadMessage}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-400">
              <tr>
                <th className="py-3 text-left">Nome</th>
                <th className="py-3 text-left">Telefone</th>
                <th className="py-3 text-left">CPF/CNPJ</th>
                <th className="py-3 text-left">Veículos</th>
                <th className="py-3 text-left">Ação</th>
              </tr>
            </thead>

            <tbody>
              {filteredClientes.map((cliente) => (
                <tr key={cliente.id} className="border-t border-slate-800">
                  <td className="w-[28%] py-3 pr-4 font-medium text-slate-100">
                    {cliente.nome || "Sem nome"}
                  </td>
                  <td className="w-[16%] pr-4 text-slate-300">
                    {formatPhone(cliente.telefone) || "-"}
                  </td>
                  <td className="w-[18%] pr-4 text-slate-300">
                    {formatCpfCnpj(cliente.documento) || "-"}
                  </td>
                  <td className="w-[10%] pr-4 text-slate-300">
                    {cliente.veiculos.length}
                  </td>
                  <td className="w-[28%] py-3">
                    <div className="flex max-w-full flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedCliente(cliente)}
                        className="whitespace-nowrap rounded bg-slate-800 px-3 py-1 text-xs text-slate-100 hover:bg-slate-700"
                      >
                        Ver detalhes
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`/clientes/${cliente.id}`)}
                        className="whitespace-nowrap rounded bg-slate-800 px-3 py-1 text-xs text-slate-100 hover:bg-slate-700"
                      >
                        Histórico
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`/os/nova?clienteId=${cliente.id}`)}
                        className="whitespace-nowrap rounded bg-emerald-500/20 px-3 py-1 text-xs text-emerald-200 hover:bg-emerald-500/30"
                      >
                        Nova OS
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEditCliente(cliente)}
                        className="whitespace-nowrap rounded bg-sky-500 px-3 py-1 text-xs text-white hover:bg-sky-400"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCliente(cliente)}
                        className="whitespace-nowrap rounded bg-red-500/20 px-3 py-1 text-xs text-red-200 hover:bg-red-500/30"
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredClientes.length === 0 && (
          <div className="mt-6 rounded-xl border border-dashed border-slate-700 bg-slate-950 p-6 text-center text-slate-400">
            Nenhum cliente encontrado.
          </div>
        )}
      </section>
      )}

      {selectedCliente && (
        <section className={`${sectionClass} mt-6`}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-2xl font-bold">{selectedCliente.nome}</h3>
              <p className="mt-1 text-sm text-slate-400">
                Detalhes do cliente selecionado.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setSelectedCliente(null)}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
            >
              Fechar
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
              <span className="text-xs uppercase text-slate-500">Tipo</span>
              <p className="mt-1 font-medium">{selectedCliente.tipo}</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
              <span className="text-xs uppercase text-slate-500">Telefone</span>
              <p className="mt-1 font-medium">
                {formatPhone(selectedCliente.telefone) || "-"}
              </p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
              <span className="text-xs uppercase text-slate-500">CPF/CNPJ</span>
              <p className="mt-1 font-medium">
                {formatCpfCnpj(selectedCliente.documento) || "-"}
              </p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
              <span className="text-xs uppercase text-slate-500">E-mail</span>
              <p className="mt-1 font-medium">{selectedCliente.email || "-"}</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
              <span className="text-xs uppercase text-slate-500">Cidade</span>
              <p className="mt-1 font-medium">
                {[selectedCliente.cidade, selectedCliente.estado].filter(Boolean).join(" - ") ||
                  "-"}
              </p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
              <span className="text-xs uppercase text-slate-500">Veículos</span>
              <p className="mt-1 font-medium">{selectedCliente.veiculos.length}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {selectedCliente.veiculos.map((veiculo) => (
              <div
                key={veiculo.id}
                className="rounded-xl border border-slate-800 bg-slate-950 p-4"
              >
                <h4 className="font-semibold text-sky-300">
                  {[veiculo.marca, veiculo.modelo, veiculo.ano]
                    .filter(Boolean)
                    .join(" ") || "Veículo sem identificação"}
                </h4>
                <div className="mt-3 grid gap-2 text-sm text-slate-300">
                  <p>
                    <strong>Placa:</strong> {veiculo.placa || "-"}
                  </p>
                  <p>
                    <strong>Motor:</strong> {veiculo.motor || "-"}
                  </p>
                  <p>
                    <strong>Combustível:</strong> {veiculo.combustivel || "-"}
                  </p>
                  <p>
                    <strong>Chassi/VIN:</strong> {veiculo.chassiVin || "-"}
                  </p>
                  <p className="whitespace-pre-wrap">
                    <strong>Obs.:</strong> {veiculo.observacoes || "-"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
