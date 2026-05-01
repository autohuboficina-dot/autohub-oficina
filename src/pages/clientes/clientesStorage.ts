export type ClienteVeiculo = {
  id: string;
  marca: string;
  modelo: string;
  ano: string;
  motor: string;
  combustivel: string;
  placa: string;
  chassiVin: string;
  observacoes: string;
};

export type ClienteTipo = "Pessoa física" | "Empresa" | "Frota";

export type Cliente = {
  id: string;
  tipo: ClienteTipo;
  nome: string;
  telefone: string;
  documento: string;
  email: string;
  cidade: string;
  observacoes: string;
  veiculos: ClienteVeiculo[];
  quantidadeVeiculos: number;
  criadoEm: string;
  atualizadoEm: string;
};

const STORAGE_KEY = "autohub:clientes";

export function createClienteVeiculoId() {
  return `VEI-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function createClienteId() {
  return `CLI-${Date.now()}`;
}

function normalizeCliente(cliente: Cliente): Cliente {
  const veiculos = Array.isArray(cliente.veiculos) ? cliente.veiculos : [];

  return {
    ...cliente,
    tipo: cliente.tipo || "Pessoa física",
    veiculos,
    quantidadeVeiculos: veiculos.length,
    criadoEm: cliente.criadoEm || new Date().toISOString(),
    atualizadoEm: cliente.atualizadoEm || new Date().toISOString(),
  };
}

export function getClientes(): Cliente[] {
  const storedClientes = localStorage.getItem(STORAGE_KEY);

  if (!storedClientes) {
    return [];
  }

  try {
    const parsedClientes = JSON.parse(storedClientes) as Cliente[];
    return Array.isArray(parsedClientes)
      ? parsedClientes.map(normalizeCliente)
      : [];
  } catch {
    return [];
  }
}

function saveClientes(clientes: Cliente[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clientes));
}

export function saveCliente(
  cliente: Omit<Cliente, "id" | "criadoEm" | "atualizadoEm">,
) {
  const now = new Date().toISOString();
  const veiculos = cliente.veiculos || [];
  const newCliente: Cliente = {
    ...cliente,
    id: createClienteId(),
    veiculos,
    quantidadeVeiculos: veiculos.length,
    criadoEm: now,
    atualizadoEm: now,
  };

  saveClientes([...getClientes(), newCliente]);
  return newCliente;
}

export function updateCliente(cliente: Cliente) {
  const veiculos = cliente.veiculos || [];
  const updatedCliente: Cliente = {
    ...cliente,
    veiculos,
    quantidadeVeiculos: veiculos.length,
    atualizadoEm: new Date().toISOString(),
  };
  const clientes = getClientes().map((currentCliente) =>
    currentCliente.id === cliente.id ? updatedCliente : currentCliente,
  );

  saveClientes(clientes);
  return updatedCliente;
}

export function deleteCliente(clienteId: string) {
  saveClientes(getClientes().filter((cliente) => cliente.id !== clienteId));
}
