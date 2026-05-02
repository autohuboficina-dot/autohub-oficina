import { createContext } from "react";
import type { User } from "@supabase/supabase-js";
import type { UserRole } from "../accessControl";

export type UsuarioAuth = {
  id: string;
  oficina_id: string;
  nome: string;
  email: string;
  perfil: UserRole;
  status: string;
};

export type AuthContextValue = {
  user: User | null;
  usuario: UsuarioAuth | null;
  perfil: UserRole | null;
  oficina_id: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  refreshAuth: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
