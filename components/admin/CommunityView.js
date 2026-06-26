import { sectionStyle, sectionTitle } from '../../constants/dashboard'
import { useAdmin } from '../../lib/adminSwr'
import UserAssetCards from './UserAssetCards'

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
    thTitle: '제목', thCat: '카테고리', thLike: '좋아요', thComment: '댓글', thView: '조회',
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
    thTitle: 'Title', thCat: 'Category', thLike: 'Likes', thComment: 'Comments', thView: 'Views',
    anon: 'Anon',
    cats: { ask_company: 'Ask Company', daily: 'Daily', job_change: 'Job Change' },
    noTracking: '* View/click events are counted from when tracking started.',
  },
}

const CAT_COLORS = { ask_company: '#3b82f6', daily: '#10b981', job_change: '#8b5cf6' }

const CARD_LABEL = {
  totalPosts: 'posts', totalComments: 'comments', totalLikes: 'likes',
  uniqueAuthors: 'authors', navClicks: 'navClicks', postViews: 'postViews', writeClicks: 'writeClicks',
  follows: 'follows',
}

export default function CommunityView({ token, lang = 'ko', dateRange }) {
  const t = L[lang] || L.ko
  const qs = dateRange ? `?from=${dateRange.from}&to=${dateRange.to}` : ''
  const { data, isLoading: loading } = useAdmin(`/api/admin/community${qs}`, token)

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
      <UserAssetCards token={token} keys={['userFollows', 'subscriptions']} />
      {/* 핵심 활동 */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: '#8B95A1', letterSpacing: '0.02em', marginBottom: 10 }}>{lang === 'ko' ? '핵심 활동' : 'Core activity'}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
          {['totalPosts', 'totalComments', 'totalLikes', 'uniqueAuthors'].map(k => (
            <div key={k} style={{ background: '#fff', border: '1px solid #EEF0F2', borderLeft: '3px solid #ff4400', borderRadius: 12, padding: '15px 17px' }}>
              <div style={{ fontSize: 12.5, color: '#6B7280', marginBottom: 6, fontWeight: 600 }}>{t[CARD_LABEL[k]]}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#191F28', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', lineHeight: 1.05 }}>{summary[k]}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 참여 · 유입 */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: '#8B95A1', letterSpacing: '0.02em', marginBottom: 10 }}>{lang === 'ko' ? '참여 · 유입' : 'Engagement'}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(116px, 1fr))', gap: 8 }}>
          {['postViews', 'writeClicks', 'navClicks', 'follows'].map(k => (
            <div key={k} style={{ background: '#F8FAFB', border: '1px solid #EEF1F3', borderRadius: 10, padding: '11px 13px' }}>
              <div style={{ fontSize: 11.5, color: '#8B95A1', marginBottom: 4, fontWeight: 600 }}>{t[CARD_LABEL[k]]}</div>
              <div style={{ fontSize: 19, fontWeight: 700, color: '#4E5968', fontVariantNumeric: 'tabular-nums' }}>{summary[k]}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ fontSize: 11, color: '#ADB5BD', marginBottom: 24 }}>
        {t.note} · {t.avgComments}: <strong style={{ color: '#6B7280' }}>{summary.avgCommentsPerPost}</strong>
        {!summary.hasEventTracking && <span style={{ marginLeft: 8 }}>{t.noTracking}</span>}
      </div>

      {/* Entry funnel */}
      {funnel && (
        <div style={{ ...sectionStyle, marginBottom: 24 }}>
          <h3 style={sectionTitle}>{t.funnelTitle}</h3>
          <div style={{ display: 'flex', alignItems: 'stretch', gap: 6, flexWrap: 'wrap' }}>
            {funnelSteps.map((s, i) => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '1 1 0', minWidth: 110 }}>
                <div style={{ flex: 1, alignSelf: 'stretch', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: '#fafafa', border: '1px solid #eee', borderRadius: 10, padding: '12px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: i === funnelSteps.length - 1 ? '#ff4400' : '#191F28' }}>{s.value}</div>
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
                <span style={{ flexShrink: 0, color: '#868E96', fontSize: 11.5, fontVariantNumeric: 'tabular-nums' }}>{t.thLike} {p.like_count}</span>
                <span style={{ flexShrink: 0, color: '#868E96', fontSize: 11.5, fontVariantNumeric: 'tabular-nums' }}>{t.thComment} {p.comment_count}</span>
                <span style={{ flexShrink: 0, color: '#868E96', fontSize: 11.5, fontVariantNumeric: 'tabular-nums' }}>{t.thView} {p.view_count}</span>
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
                <tr style={{ borderBottom: '1px solid #EEF0F2', background: '#FAFBFC' }}>
                  {[t.thCompany, t.thFollows, t.thUnfollows, t.thNet].map((h, i) => (
                    <th key={h} style={{ padding: '9px 12px', textAlign: i === 0 ? 'left' : 'right', fontWeight: 700, color: '#8B95A1', fontSize: 11.5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topFollowedCompanies.map((c, i) => (
                  <tr key={c.company} style={{ borderBottom: '1px solid #F7F8FA' }}>
                    <td style={{ padding: '7px 12px' }}>
                      <a href={`/companies/${encodeURIComponent(c.company)}`} target="_blank" rel="noopener noreferrer" style={{ color: '#191F28', textDecoration: 'none' }}>{c.company}</a>
                    </td>
                    <td style={{ padding: '7px 12px', textAlign: 'right', color: '#191F28', fontWeight: 600 }}>{c.follows}</td>
                    <td style={{ padding: '7px 12px', textAlign: 'right', color: '#ADB5BD' }}>{c.unfollows || '-'}</td>
                    <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 600, color: c.net >= 0 ? '#191F28' : '#DC2626' }}>{c.net > 0 ? `+${c.net}` : c.net}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Daily detail — 최근 날짜 먼저(역순), 합계 상단, 색 중립 */}
      <div style={sectionStyle}>
        <h3 style={sectionTitle}>{t.dailyTitle}</h3>
        <div style={{ overflowX: 'auto', border: '1px solid #F2F4F6', borderRadius: 10 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {[t.thDate, t.thPosts, t.thComments, t.thLikes, t.thNavClicks, t.thPostViews, t.thListViews, t.thWriteClicks, t.thFollows].map((h, i) => (
                  <th key={h} style={{ background: '#FAFBFC', padding: '9px 12px', textAlign: i === 0 ? 'left' : 'right', fontWeight: 700, color: '#8B95A1', fontSize: 11.5, whiteSpace: 'nowrap', borderBottom: '1px solid #EEF0F2' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr style={{ fontWeight: 700, borderBottom: '1px solid #EEF0F2', background: '#FCFCFD' }}>
                <td style={{ padding: '9px 12px' }}>{lang === 'ko' ? '합계' : 'Total'}</td>
                {['totalPosts', 'totalComments', 'totalLikes', 'navClicks', 'postViews', 'listViews', 'writeClicks', 'follows'].map(k => (
                  <td key={k} style={{ padding: '9px 12px', textAlign: 'right', color: '#191F28', fontVariantNumeric: 'tabular-nums' }}>{summary[k]}</td>
                ))}
              </tr>
              {[...daily].sort((a, b) => (a.date < b.date ? 1 : -1)).map((d) => (
                <tr key={d.date} style={{ borderBottom: '1px solid #F7F8FA' }}>
                  <td style={{ padding: '7px 12px', color: '#4E5968', whiteSpace: 'nowrap' }}>{d.date}</td>
                  {['posts', 'comments', 'likes', 'navClicks', 'postViews', 'listViews', 'writeClicks', 'follows'].map(k => (
                    <td key={k} style={{ padding: '7px 12px', textAlign: 'right', color: d[k] ? '#191F28' : '#C7CDD4', fontVariantNumeric: 'tabular-nums' }}>{d[k] || '-'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
