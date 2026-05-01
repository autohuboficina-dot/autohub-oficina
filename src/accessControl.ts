export const USER_ROLES = [
  "admin",
  "mecanico",
  "atendimento",
  "compras",
  "financeiro",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  mecanico: "Mecânico",
  atendimento: "Atendimento",
  compras: "Compras",
  financeiro: "Financeiro",
};

export function normalizeRole(value: string | null): UserRole {
  return USER_ROLES.includes(value as UserRole) ? (value as UserRole) : "admin";
}
