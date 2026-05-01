import { normalizeRole, type UserRole } from "../accessControl";
import {
  deleteUsuario,
  getConfiguracoesOficina,
  getUsuarios,
  saveConfiguracoesOficina,
  saveUsuario,
  updateUsuario,
  type OficinaConfiguracoes,
  type UsuarioSistema,
} from "../pages/configuracoes/configuracoesStorage";

const ROLE_STORAGE_KEY = "autohub:perfil";

export type {
  DescontoPagamento,
  OficinaConfiguracoes,
  RegrasPagamento,
  UsuarioSistema,
  UsuarioStatus,
} from "../pages/configuracoes/configuracoesStorage";

export {
  calculatePaymentSimulation,
  defaultOficinaConfiguracoes,
  deleteUsuario,
  getConfiguracoesOficina,
  getUsuarios,
  saveConfiguracoesOficina,
  saveUsuario,
  updateUsuario,
} from "../pages/configuracoes/configuracoesStorage";

export function getAll() {
  return getConfiguracoesOficina();
}

export function getById(id: "oficina") {
  return id === "oficina" ? getConfiguracoesOficina() : undefined;
}

export function create(config: OficinaConfiguracoes) {
  return saveConfiguracoesOficina(config);
}

export function update(config: OficinaConfiguracoes) {
  return saveConfiguracoesOficina(config);
}

export function remove() {
  return saveConfiguracoesOficina(getConfiguracoesOficina());
}

export function getCurrentRole() {
  if (typeof window === "undefined") {
    return "admin";
  }

  return normalizeRole(localStorage.getItem(ROLE_STORAGE_KEY));
}

export function updateCurrentRole(role: UserRole) {
  localStorage.setItem(ROLE_STORAGE_KEY, role);
  return role;
}

export const usuariosService = {
  getAll: getUsuarios,
  getById(id: string) {
    return getUsuarios().find((usuario) => usuario.id === id);
  },
  create(
    usuario: Omit<UsuarioSistema, "id" | "criadoEm" | "atualizadoEm">,
  ) {
    return saveUsuario(usuario);
  },
  update: updateUsuario,
  remove: deleteUsuario,
};

export const configuracoesService = {
  getAll,
  getById,
  create,
  update,
  remove,
  getCurrentRole,
  updateCurrentRole,
};
