import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { normalizeRole } from "../accessControl";
import { supabase } from "../lib/supabase";
import {
  AuthContext,
  type AuthContextValue,
  type UsuarioAuth,
} from "./authContextValue";

type AuthProviderProps = {
  children: ReactNode;
};

async function fetchUsuario(authUserId: string) {
  const client = supabase;

  if (!client) {
    return null;
  }

  const { data, error } = await client
    .from("usuarios")
    .select("id, oficina_id, nome, email, perfil, status")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    ...data,
    perfil: normalizeRole(data.perfil),
  } as UsuarioAuth;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [usuario, setUsuario] = useState<UsuarioAuth | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(supabase));

  const refreshAuth = useCallback(async () => {
    const client = supabase;

    if (!client) {
      setUser(null);
      setUsuario(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const {
      data: { user: authUser },
    } = await client.auth.getUser();

    setUser(authUser);
    setUsuario(authUser ? await fetchUsuario(authUser.id) : null);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const client = supabase;

    if (!client) {
      return undefined;
    }

    const activeClient = client;
    let isMounted = true;

    async function loadInitialAuth() {
      const {
        data: { user: authUser },
      } = await activeClient.auth.getUser();

      if (!isMounted) {
        return;
      }

      const usuarioData = authUser ? await fetchUsuario(authUser.id) : null;

      if (!isMounted) {
        return;
      }

      setUser(authUser);
      setUsuario(usuarioData);
      setIsLoading(false);
    }

    loadInitialAuth();

    const {
      data: { subscription },
    } = activeClient.auth.onAuthStateChange(() => {
      refreshAuth();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [refreshAuth]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      usuario,
      perfil: usuario?.perfil ?? null,
      oficina_id: usuario?.oficina_id ?? null,
      isLoading,
      isAuthenticated: Boolean(user),
      refreshAuth,
    }),
    [isLoading, refreshAuth, user, usuario],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
