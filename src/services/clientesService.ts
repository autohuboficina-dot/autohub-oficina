import {
  deleteCliente,
  getClientes,
  saveCliente,
  updateCliente,
  TIPOS_VEICULO,
  type Cliente,
  type ClienteTipo,
  type ClienteVeiculo,
  type TipoVeiculo,
} from "../pages/clientes/clientesStorage";
import { supabase } from "../lib/supabase";

type ClienteSupabaseRow = {
  id: string;
  tipo: string | null;
  nome: string;
  telefone: string | null;
  documento: string | null;
  email: string | null;
  cidade: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
};

type VeiculoSupabaseRow = {
  id: string;
  cliente_id: string;
  tipo_veiculo?: string | null;
  marca: string | null;
  modelo: string;
  ano: string | null;
  motor: string | null;
  combustivel: string | null;
  placa: string | null;
  chassi_vin: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
};

function toDbClienteTipo(tipo: ClienteTipo) {
  return tipo === "Pessoa física" ? "Pessoa fisica" : tipo;
}

function fromDbClienteTipo(tipo: string | null): ClienteTipo {
  if (tipo === "Empresa" || tipo === "Frota") {
    return tipo;
  }

  return "Pessoa física";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function logSupabaseFallback(scope: string, error: unknown) {
  console.error(`[Supabase:${scope}] Usando fallback localStorage.`, error);
}

function mapVeiculoFromSupabase(row: VeiculoSupabaseRow): ClienteVeiculo {
  const tipoVeiculo = TIPOS_VEICULO.includes(row.tipo_veiculo as TipoVeiculo)
    ? (row.tipo_veiculo as TipoVeiculo)
    : "Carro";

  return {
    id: row.id,
    tipo_veiculo: tipoVeiculo,
    marca: row.marca ?? "",
    modelo: row.modelo ?? "",
    ano: row.ano ?? "",
    motor: row.motor ?? "",
    combustivel: row.combustivel ?? "",
    placa: row.placa ?? "",
    chassiVin: row.chassi_vin ?? "",
    observacoes: row.observacoes ?? "",
  };
}

function mapClienteFromSupabase(
  row: ClienteSupabaseRow,
  veiculos: ClienteVeiculo[],
): Cliente {
  return {
    id: row.id,
    tipo: fromDbClienteTipo(row.tipo),
    nome: row.nome,
    telefone: row.telefone ?? "",
    documento: row.documento ?? "",
    email: row.email ?? "",
    cidade: row.cidade ?? "",
    estado: "SP",
    observacoes: row.observacoes ?? "",
    veiculos,
    quantidadeVeiculos: veiculos.length,
    criadoEm: row.created_at,
    atualizadoEm: row.updated_at,
  };
}

function mapClienteToSupabase(
  oficinaId: string,
  cliente: Omit<Cliente, "id" | "criadoEm" | "atualizadoEm"> | Cliente,
) {
  return {
    oficina_id: oficinaId,
    tipo: toDbClienteTipo(cliente.tipo),
    nome: cliente.nome,
    telefone: cliente.telefone,
    documento: cliente.documento,
    email: cliente.email,
    cidade: cliente.cidade,
    observacoes: cliente.observacoes,
  };
}

function mapVeiculoToSupabase(
  oficinaId: string,
  clienteId: string,
  veiculo: ClienteVeiculo,
) {
  const { tipo_veiculo, ...veiculoSemTipo } = veiculo;
  void tipo_veiculo;

  return {
    oficina_id: oficinaId,
    cliente_id: clienteId,
    marca: veiculoSemTipo.marca,
    modelo: veiculoSemTipo.modelo,
    ano: veiculoSemTipo.ano,
    motor: veiculoSemTipo.motor,
    combustivel: veiculoSemTipo.combustivel,
    placa: veiculoSemTipo.placa,
    chassi_vin: veiculoSemTipo.chassiVin,
    observacoes: veiculoSemTipo.observacoes,
  };
}

async function getVeiculosByClienteIds(clienteIds: string[]) {
  if (!supabase || !clienteIds.length) {
    return [];
  }

  const { data, error } = await supabase
    .from("veiculos")
    .select(
      "id, cliente_id, marca, modelo, ano, motor, combustivel, placa, chassi_vin, observacoes, created_at, updated_at",
    )
    .in("cliente_id", clienteIds)
    .returns<VeiculoSupabaseRow[]>();

  if (error || !data) {
    throw error ?? new Error("Não foi possível buscar veículos.");
  }

  return data;
}

async function saveVeiculosSupabase(
  oficinaId: string,
  clienteId: string,
  veiculos: ClienteVeiculo[],
) {
  const client = supabase;

  if (!client) {
    return veiculos;
  }

  const { data: storedVeiculos, error: storedError } = await client
    .from("veiculos")
    .select(
      "id, cliente_id, marca, modelo, ano, motor, combustivel, placa, chassi_vin, observacoes, created_at, updated_at",
    )
    .eq("oficina_id", oficinaId)
    .eq("cliente_id", clienteId)
    .returns<VeiculoSupabaseRow[]>();

  if (storedError) {
    throw storedError;
  }

  const storedIds = new Set((storedVeiculos ?? []).map((veiculo) => veiculo.id));
  const formUuidIds = new Set(
    veiculos.filter((veiculo) => isUuid(veiculo.id)).map((veiculo) => veiculo.id),
  );
  const idsToDelete = [...storedIds].filter((id) => !formUuidIds.has(id));

  if (idsToDelete.length) {
    const { error } = await client
      .from("veiculos")
      .delete()
      .eq("oficina_id", oficinaId)
      .eq("cliente_id", clienteId)
      .in("id", idsToDelete);

    if (error) {
      throw error;
    }
  }

  await Promise.all(
    veiculos.map(async (veiculo) => {
      const payload = mapVeiculoToSupabase(oficinaId, clienteId, veiculo);

      if (isUuid(veiculo.id) && storedIds.has(veiculo.id)) {
        const { error } = await client
          .from("veiculos")
          .update(payload)
          .eq("oficina_id", oficinaId)
          .eq("cliente_id", clienteId)
          .eq("id", veiculo.id);

        if (error) {
          throw error;
        }
        return;
      }

      const { error } = await client.from("veiculos").insert(payload);

      if (error) {
        throw error;
      }
    }),
  );

  const { data, error } = await client
    .from("veiculos")
    .select(
      "id, cliente_id, marca, modelo, ano, motor, combustivel, placa, chassi_vin, observacoes, created_at, updated_at",
    )
    .eq("oficina_id", oficinaId)
    .eq("cliente_id", clienteId)
    .order("created_at", { ascending: true })
    .returns<VeiculoSupabaseRow[]>();

  if (error || !data) {
    throw error ?? new Error("Não foi possível atualizar veículos.");
  }

  return data.map(mapVeiculoFromSupabase);
}

export type {
  Cliente,
  ClienteTipo,
  ClienteVeiculo,
  EstadoUF,
} from "../pages/clientes/clientesStorage";

export {
  createClienteVeiculoId,
  deleteCliente,
  ESTADOS_UF,
  getClientes,
  saveCliente,
  TIPOS_VEICULO,
  updateCliente,
} from "../pages/clientes/clientesStorage";

export async function getClientesSupabase(oficinaId: string) {
  const localClientes = getClientes();

  if (!supabase) {
    return localClientes;
  }

  const { data, error } = await supabase
    .from("clientes")
    .select(
      "id, tipo, nome, telefone, documento, email, cidade, observacoes, created_at, updated_at",
    )
    .eq("oficina_id", oficinaId)
    .order("nome", { ascending: true })
    .returns<ClienteSupabaseRow[]>();

  if (error || !data) {
    logSupabaseFallback("clientes:list", error);
    return localClientes;
  }

  if (data.length === 0 && localClientes.length > 0) {
    logSupabaseFallback(
      "clientes:list",
      "Supabase retornou lista vazia; mantendo dados locais existentes.",
    );
    return localClientes;
  }

  try {
    const veiculos = await getVeiculosByClienteIds(data.map((cliente) => cliente.id));
    const veiculosByCliente = veiculos.reduce<Record<string, ClienteVeiculo[]>>(
      (groupedVeiculos, veiculo) => {
        groupedVeiculos[veiculo.cliente_id] = [
          ...(groupedVeiculos[veiculo.cliente_id] ?? []),
          mapVeiculoFromSupabase(veiculo),
        ];
        return groupedVeiculos;
      },
      {},
    );

    return data.map((cliente) =>
      mapClienteFromSupabase(cliente, veiculosByCliente[cliente.id] ?? []),
    );
  } catch (fetchVehiclesError) {
    logSupabaseFallback("clientes:veiculos:list", fetchVehiclesError);
    return localClientes;
  }
}

export async function getClienteByIdSupabase(
  oficinaId: string,
  clienteId: string,
) {
  const localCliente = getClientes().find((cliente) => cliente.id === clienteId);

  if (!supabase) {
    return localCliente;
  }

  const { data, error } = await supabase
    .from("clientes")
    .select(
      "id, tipo, nome, telefone, documento, email, cidade, observacoes, created_at, updated_at",
    )
    .eq("oficina_id", oficinaId)
    .eq("id", clienteId)
    .maybeSingle<ClienteSupabaseRow>();

  if (error || !data) {
    logSupabaseFallback("clientes:getById", error);
    return localCliente;
  }

  try {
    const veiculos = await getVeiculosByClienteIds([data.id]);
    return mapClienteFromSupabase(data, veiculos.map(mapVeiculoFromSupabase));
  } catch (fetchVehiclesError) {
    logSupabaseFallback("clientes:veiculos:getById", fetchVehiclesError);
    return localCliente;
  }
}

export async function saveClienteSupabase(
  oficinaId: string,
  cliente: Omit<Cliente, "id" | "criadoEm" | "atualizadoEm">,
) {
  if (!oficinaId) {
    throw new Error("Não foi possível identificar a oficina do usuário logado.");
  }

  if (!supabase) {
    return saveCliente(cliente);
  }

  const { data, error } = await supabase
    .from("clientes")
    .insert(mapClienteToSupabase(oficinaId, cliente))
    .select(
      "id, tipo, nome, telefone, documento, email, cidade, observacoes, created_at, updated_at",
    )
    .single<ClienteSupabaseRow>();

  if (error || !data) {
    console.error("[Supabase:clientes:create] Falha ao criar cliente.", error);
    throw new Error("Não foi possível salvar o cliente no Supabase.");
  }

  try {
    const veiculos = await saveVeiculosSupabase(
      oficinaId,
      data.id,
      cliente.veiculos,
    );
    return mapClienteFromSupabase(data, veiculos);
  } catch (saveVehiclesError) {
    console.error(
      "[Supabase:clientes:veiculos:create] Falha ao salvar veículos.",
      saveVehiclesError,
    );
    throw new Error("Cliente criado, mas não foi possível salvar os veículos.", {
      cause: saveVehiclesError,
    });
  }
}

export async function updateClienteSupabase(oficinaId: string, cliente: Cliente) {
  if (!oficinaId) {
    throw new Error("Não foi possível identificar a oficina do usuário logado.");
  }

  if (!supabase || !isUuid(cliente.id)) {
    return updateCliente(cliente);
  }

  const { data, error } = await supabase
    .from("clientes")
    .update(mapClienteToSupabase(oficinaId, cliente))
    .eq("oficina_id", oficinaId)
    .eq("id", cliente.id)
    .select(
      "id, tipo, nome, telefone, documento, email, cidade, observacoes, created_at, updated_at",
    )
    .single<ClienteSupabaseRow>();

  if (error || !data) {
    console.error("[Supabase:clientes:update] Falha ao atualizar cliente.", error);
    throw new Error("Não foi possível atualizar o cliente no Supabase.");
  }

  try {
    const veiculos = await saveVeiculosSupabase(
      oficinaId,
      cliente.id,
      cliente.veiculos,
    );
    return mapClienteFromSupabase(data, veiculos);
  } catch (saveVehiclesError) {
    console.error(
      "[Supabase:clientes:veiculos:update] Falha ao atualizar veículos.",
      saveVehiclesError,
    );
    throw new Error("Cliente atualizado, mas não foi possível salvar os veículos.", {
      cause: saveVehiclesError,
    });
  }
}

export async function deleteClienteSupabase(oficinaId: string, clienteId: string) {
  if (!oficinaId || !supabase || !isUuid(clienteId)) {
    deleteCliente(clienteId);
    return;
  }

  const { error } = await supabase
    .from("clientes")
    .delete()
    .eq("oficina_id", oficinaId)
    .eq("id", clienteId);

  if (error) {
    console.error("[Supabase:clientes:delete] Falha ao excluir cliente.", error);
    throw new Error("Não foi possível excluir o cliente no Supabase.");
  }
}

export function getAll() {
  return getClientes();
}

export function getById(id: string) {
  return getClientes().find((cliente) => cliente.id === id);
}

export function create(
  cliente: Omit<Cliente, "id" | "criadoEm" | "atualizadoEm">,
) {
  return saveCliente(cliente);
}

export function update(cliente: Cliente) {
  return updateCliente(cliente);
}

export function remove(id: string) {
  return deleteCliente(id);
}

export const clientesService = {
  getAll,
  getById,
  create,
  update,
  remove,
  getClientesSupabase,
  getClienteByIdSupabase,
  saveClienteSupabase,
  updateClienteSupabase,
  deleteClienteSupabase,
};
