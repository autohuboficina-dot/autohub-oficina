import {
  deleteCliente,
  getClientes,
  saveCliente,
  updateCliente,
  type Cliente,
} from "../pages/clientes/clientesStorage";

export type {
  Cliente,
  ClienteTipo,
  ClienteVeiculo,
} from "../pages/clientes/clientesStorage";

export {
  createClienteVeiculoId,
  deleteCliente,
  getClientes,
  saveCliente,
  updateCliente,
} from "../pages/clientes/clientesStorage";

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
};
