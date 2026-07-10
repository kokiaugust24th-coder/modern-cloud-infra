import { useEffect, useState } from 'react'
import { getSession, type Session } from './lib/auth'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    getSession()
      .then(setSession)
      .finally(() => setChecked(true))
  }, [])

  return (
    <main style={{ fontFamily: 'sans-serif', padding: '2rem' }}>
      <h1>Phase 0 環境</h1>
      <p>Cloudflare Pages + Supabase 構成の起点アプリです。</p>
      <p>
        認証状態: {!checked ? '確認中...' : session ? `ログイン中 (${session.email})` : '未ログイン'}
      </p>
    </main>
  )
}

export default App
