import { supabase } from './supabase'

export async function testarSupabase() {
  if (!supabase) {
    console.warn('Supabase nao configurado.')
    return
  }

  const { data, error } = await supabase
    .from('usuarios')
    .select('*')

  if (error) {
    console.error('❌ Erro Supabase:', error)
  } else {
    console.log('✅ Dados Supabase:', data)
  }
}
