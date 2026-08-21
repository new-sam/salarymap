import { useState, useEffect } from 'react'
import Head from 'next/head'
import { supabase } from '../../lib/supabaseClient'
import AdminLayout from '../../components/admin/AdminLayout'
import LangScoresSection, { LangBaseMatrix } from '../../components/admin/LangScoresSection'

/* /admin/lang-scores — 본문은 components/admin/LangScoresSection 으로 옮겼다.
   같은 화면을 유진 작업실 > 어학 정보 수집 탭 안에서도 보여주는데, 두 벌로 두면
   칩 기준·등급 판정이 갈라진다.

   이 URL 을 남겨두는 이유: 슬랙·문서에 이미 링크가 돌아다니고, 명단이 길어 전체 화면으로
   보고 싶을 때가 있다. 좌측 내비에서는 뺐다(유진 작업실 안으로 들어갔다). */
export default function AdminLangScores() {
  const [token, setToken] = useState(null)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setToken(session?.access_token || null))
  }, [])

  return (
    <AdminLayout>
      <Head><title>어학 점수 · FYI Admin</title></Head>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 16px 60px' }}>
        {/* 모수 교차표를 맨 위에 — 유진 작업실 탭과 순서를 같게 둔다. */}
        <LangBaseMatrix token={token} />
        <LangScoresSection token={token} />
      </div>
    </AdminLayout>
  )
}
