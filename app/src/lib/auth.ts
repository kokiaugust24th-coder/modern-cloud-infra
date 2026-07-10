import { supabase } from './supabaseClient'

export interface Session {
  userId: string
  email: string | null
}

// アプリ本体は Supabase の型やクライアントに直接依存せず、この薄い抽象化層を経由する。
// 認証基盤を移行する場合(例: Cognito)はこのファイルの実装のみを差し替える。
// (workload-portability: 認証の抽象化)
export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession()
  const session = data.session
  if (!session) return null
  return { userId: session.user.id, email: session.user.email ?? null }
}

export async function signInWithPassword(email: string, password: string): Promise<Session> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return { userId: data.user.id, email: data.user.email ?? null }
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}
