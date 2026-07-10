import { supabase } from '../supabaseClient'

export interface Profile {
  id: string
  displayName: string
  createdAt: string
}

// データストアへのアクセスはこのファイルに集約する。
// UI・ビジネスロジックから supabase クライアントを直接呼び出してはならない。
// (workload-portability: データアクセス層の分離。移行時はこの層のみ書き換える)
export const profileRepository = {
  async getById(id: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, created_at')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    if (!data) return null
    return { id: data.id, displayName: data.display_name, createdAt: data.created_at }
  },

  async upsertDisplayName(id: string, displayName: string): Promise<void> {
    const { error } = await supabase.from('profiles').upsert({ id, display_name: displayName })
    if (error) throw error
  },
}
