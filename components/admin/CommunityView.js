import { useState, useEffect } from 'react'
import { sectionStyle, sectionTitle } from '../../constants/dashboard'

const L = {
  ko: {
    loading: '커뮤니티 데이터 불러오는 중...',
    empty: '아직 커뮤니티 활동이 없습니다.',
    note: '* 내부/시드 계정 제외, 선택한 기간 기준',
    posts: '게시글', comments: '댓글', likes: '좋아요', authors: '참여자',
    postViews: '글 조회', listViews: '목록 방문', writeClicks: '글쓰기 클릭',
    navClicks: '탭/네비 클릭', follows: '회사 팔로우',
    avgComments: '글당 평균 댓글',
    followTitle: '회사 팔로우 TOP',
    thCompany: '회사', thFollows: '팔로우', thUnfollows: '언팔', thNet: '순증',
    funnelTitle: '유입 퍼널',
    fNav: '탭/네비 클릭', fList: '목록 방문', fPost: '글 클릭', fWrite: '글쓰기 클릭', fCreate: '작성 완료',
    fNavToList: '탭 경유 유입', fOfList: '목록 대비',
    catTitle: '카테고리별 게시글',
    topTitle: '인기 게시글 TOP',
    dailyTitle: '일별 상세',
    thDate: '날짜', thPosts: '글', thComments: '댓글', thLikes: '좋아요',
    thPostViews: '글조회', thWriteClicks: '글쓰기', thListViews: '목록방문', thNavClicks: '탭클릭',
    thTitle: '제목', thCat: '카테고리', thLike: '♥', thComment: '💬', thView: '👁',
    anon: '익명',
    cats: { ask_company: '회사 질문', daily: '일상', job_change: '이직' },
    noTracking: '* 조회/클릭 이벤트는 트래킹 시작 이후부터 집계됩니다.',
  },
  en: {
    loading: 'Loading community data...',
    empty: 'No community activity yet.',
    note: '* Excludes internal/seed accounts, within selected range',
    posts: 'Posts', comments: 'Comments', likes: 'Likes', authors: 'Authors',
    postViews: 'Post Views', listViews: 'List Views', writeClicks: 'Write Clicks',
    navClicks: 'Tab/Nav Clicks', follows: 'Company Follows',
    avgComments: 'Avg Comments / Post',
    followTitle: 'Top Followed Companies',
    thCompany: 'Company', thFollows: 'Follows', thUnfollows: 'Unfollows', thNet: 'Net',
    funnelTitle: 'Entry Funnel',
    fNav: 'Tab/Nav Click', fList: 'List View', fPost: 'Post Click', fWrite: 'Write Click', fCreate: 'Posted',
    fNavToList: 'via tab/nav', fOfList: 'of list views',
    catTitle: 'Posts by Category',
    topTitle: 'Top Posts',
    dailyTitle: 'Daily Detail',
    thDate: 'Date', thPosts: 'Posts', thComments: 'Comments', thLikes: 'Likes',
    thPostViews: 'Views', thWriteClicks: 'Write', thListViews: 'List Views', thNavClicks: 'Tab Clicks',
    thTitle: 'Title', thCat: 'Category', thLike: '♥', thComment: '💬', thView: '👁',
    anon: 'Anon',
    cats: { ask_company: 'Ask Company', daily: 'Daily', job_change: 'Job Change' },
    noTracking: '* View/click events are counted from when tracking started.',
  },
}

const CAT_COLORS = { ask_company: '#3b82f6', daily: '#10b981', job_change: '#8b5cf6' }

const CARD = [
  { key: 'totalPosts', color: '#ff6000' },
  { key: 'totalComments', color: '#3b82f6' },
  { key: 'totalLikes', color: '#ef4444' },
  { key: 'uniqueAuthors', color: '#8b5cf6' },
  { key: 'navClicks', color: '#ec4899' },
  { key: 'postViews', color: '#06b6d4' },
  { key: 'writeClicks', color: '#f59e0b' },
  { key: 'follows', color: '#14b8a6' },
]
const CARD_LABEL = {
  totalPosts: 'posts', totalComments: 'comments', totalLikes: 'likes',
  uniqueAuthors: 'authors', navClicks: 'navClicks', postViews: 'postViews', writeClicks: 'writeClicks',
  follows: 'follows',
}

export default function CommunityView({ token, lang = 'ko', dateRange }) {
  const t = L[lang] || L.ko
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      try {
        const qs = dateRange ? `?from=${dateRange.from}&to=${dateRange.to}` : ''
        const res = await fetch(`/api/admin/community${qs}`, { headers: { Authorization: `Bearer ${token}` } })
        if (res.ok && active) setData(await res.json())
      } catch (e) { console.error(e) }
      if (active) setLoading(false)
    }
    if (token) load()
    return () => { active = false }
  }, [token, dateRange?.from, dateRange?.to])

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>{t.loading}</div>
  if (!data || !data.summary) return <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>{t.empty}</div>

  const { summary, daily, byCategory, topPosts, funnel, topFollowedCompanies = [] } = data
  const maxCat = Math.max(1, ...byCategory.map(c => c.posts))
  const catName = (k) => t.cats[k] || k

  const fmtPct = (v) => (v == null ? '—' : `${v}%`)
  const funnelSteps = funnel ? [
    { label: t.fNav, value: funnel.navClicks, conv: null, color: '#ec4899' },
    { label: t.fList, value: funnel.listViews, conv: funnel.navToList, convLabel: t.fNavToList, color: '#9CA3AF' },
    { label: t.fPost, value: funnel.postClicks, conv: funnel.postRate, convLabel: t.fOfList, color: '#06b6d4' },
    { label: t.fWrite, value: funnel.writeClicks, conv: funnel.writeRate, convLabel: t.fOfList, color: '#f59e0b' },
    { label: t.fCreate, value: funnel.created, conv: funnel.createRate, convLabel: t.fOfList, color: '#ff6000' },
  ] : []

  return (
    <>
      {/* Summary cards */}
      <div className="adm-metric-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 12 }}>
        {CARD.map(c => (
          <div key={c.key} style={{ background: '#fff', border: '2px solid #e5e7eb', borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>{t[CARD_LABEL[c.key]]}</div>
            <div className="adm-metric-value" style={{ fontSize: 28, fontWeight: 700, color: c.color }}>{summary[c.key]}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: '#aaa', marginBottom: 24 }}>
        {t.note} · {t.avgComments}: <strong>{summary.avgCommentsPerPost}</strong>
        {!summary.hasEventTracking && <span style={{ marginLeft: 8 }}>{t.noTracking}</span>}
      </div>

      {/* Entry funnel */}
      {funnel && (
        <div style={{ ...sectionStyle, marginBottom: 24 }}>
          <h3 style={sectionTitle}>{t.funnelTitle}</h3>
          <div style={{ display: 'flex', alignItems: 'stretch', gap: 6, flexWrap: 'wrap' }}>
            {funnelSteps.map((s, i) => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '1 1 0', minWidth: 110 }}>
                <div style={{ flex: 1, background: '#fafafa', border: '1px solid #eee', borderRadius: 10, padding: '12px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
                  {s.conv != null && (
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>{fmtPct(s.conv)} <span style={{ color: '#cbcbcb' }}>{s.convLabel}</span></div>
                  )}
                </div>
                {i < funnelSteps.length - 1 && <span style={{ color: '#d1d5db', fontSize: 16 }}>→</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category + Top posts */}
      <div className="adm-grid-2col">
        <div style={sectionStyle}>
          <h3 style={sectionTitle}>{t.catTitle}</h3>
          {byCategory.length === 0 ? (
            <div style={{ color: '#aaa', fontSize: 13 }}>—</div>
          ) : byCategory.map(c => (
            <div key={c.key} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 3 }}>
                <span>{catName(c.key)}</span>
                <span style={{ fontWeight: 600 }}>{c.posts}</span>
              </div>
              <div style={{ height: 8, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(c.posts / maxCat) * 100}%`, background: CAT_COLORS[c.key] || '#888', borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </div>

        <div style={sectionStyle}>
          <h3 style={sectionTitle}>{t.topTitle}</h3>
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {topPosts.length === 0 ? (
              <div style={{ color: '#aaa', fontSize: 13 }}>—</div>
            ) : topPosts.map((p, i) => (
              <a key={p.id} href={`/community/${p.id}`} target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid #f3f3f3', fontSize: 13, textDecoration: 'none', color: '#111' }}>
                <span style={{ color: '#999', width: 18, textAlign: 'right', fontSize: 11, flexShrink: 0 }}>{i + 1}</span>
                <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 600, color: CAT_COLORS[p.category] || '#888' }}>{catName(p.category)}</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{p.title}</span>
                <span style={{ flexShrink: 0, color: '#ef4444', fontSize: 12 }}>{t.thLike} {p.like_count}</span>
                <span style={{ flexShrink: 0, color: '#3b82f6', fontSize: 12 }}>{t.thComment} {p.comment_count}</span>
                <span style={{ flexShrink: 0, color: '#999', fontSize: 12 }}>{t.thView} {p.view_count}</span>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Top followed companies */}
      {topFollowedCompanies.length > 0 && (
        <div style={{ ...sectionStyle, marginBottom: 24 }}>
          <h3 style={sectionTitle}>{t.followTitle}</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  {[t.thCompany, t.thFollows, t.thUnfollows, t.thNet].map((h, i) => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: i === 0 ? 'left' : 'right', fontWeight: 600, color: '#374151' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topFollowedCompanies.map((c, i) => (
                  <tr key={c.company} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={{ padding: '6px 12px' }}>
                      <a href={`/companies/${encodeURIComponent(c.company)}`} target="_blank" rel="noopener noreferrer" style={{ color: '#111', textDecoration: 'none' }}>{c.company}</a>
                    </td>
                    <td style={{ padding: '6px 12px', textAlign: 'right', color: '#14b8a6', fontWeight: 600 }}>{c.follows}</td>
                    <td style={{ padding: '6px 12px', textAlign: 'right', color: '#9CA3AF' }}>{c.unfollows || '-'}</td>
                    <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600, color: c.net >= 0 ? '#111' : '#ef4444' }}>{c.net > 0 ? `+${c.net}` : c.net}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Daily detail */}
      <div style={sectionStyle}>
        <h3 style={sectionTitle}>{t.dailyTitle}</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                {[t.thDate, t.thPosts, t.thComments, t.thLikes, t.thNavClicks, t.thPostViews, t.thListViews, t.thWriteClicks, t.thFollows].map((h, i) => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: i === 0 ? 'left' : 'right', fontWeight: 600, color: '#374151' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {daily.map((d, i) => (
                <tr key={d.date} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ padding: '6px 12px' }}>{d.date}</td>
                  <td style={{ padding: '6px 12px', textAlign: 'right', color: '#ff6000', fontWeight: 600 }}>{d.posts || '-'}</td>
                  <td style={{ padding: '6px 12px', textAlign: 'right', color: '#3b82f6' }}>{d.comments || '-'}</td>
                  <td style={{ padding: '6px 12px', textAlign: 'right', color: '#ef4444' }}>{d.likes || '-'}</td>
                  <td style={{ padding: '6px 12px', textAlign: 'right', color: '#ec4899' }}>{d.navClicks || '-'}</td>
                  <td style={{ padding: '6px 12px', textAlign: 'right', color: '#06b6d4' }}>{d.postViews || '-'}</td>
                  <td style={{ padding: '6px 12px', textAlign: 'right', color: '#9CA3AF' }}>{d.listViews || '-'}</td>
                  <td style={{ padding: '6px 12px', textAlign: 'right', color: '#f59e0b' }}>{d.writeClicks || '-'}</td>
                  <td style={{ padding: '6px 12px', textAlign: 'right', color: '#14b8a6' }}>{d.follows || '-'}</td>
                </tr>
              ))}
              <tr style={{ borderTop: '2px solid #e5e7eb', fontWeight: 700 }}>
                <td style={{ padding: '8px 12px' }}>{lang === 'ko' ? '합계' : 'Total'}</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', color: '#ff6000' }}>{summary.totalPosts}</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', color: '#3b82f6' }}>{summary.totalComments}</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', color: '#ef4444' }}>{summary.totalLikes}</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', color: '#ec4899' }}>{summary.navClicks}</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', color: '#06b6d4' }}>{summary.postViews}</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', color: '#9CA3AF' }}>{summary.listViews}</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', color: '#f59e0b' }}>{summary.writeClicks}</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', color: '#14b8a6' }}>{summary.follows}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
