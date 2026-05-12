import { supabase } from "../lib/supabase";

type UsuarioOficinaRow = {
  oficina_id: string | null;
};

export async function getOficinaId(): Promise<string | null> {
  if (!supabase) {
    return null;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data } = await supabase
    .from("usuarios")
    .select("oficina_id")
    .eq("auth_user_id", user.id)
    .single<UsuarioOficinaRow>();

  return data?.oficina_id ?? null;
}
