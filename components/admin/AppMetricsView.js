import { useState } from 'react'
import { useRouter } from 'next/router'
import ModerationView from './ModerationView'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import MetricChart from '../DashboardCharts'
import { useAdmin } from '../../lib/adminSwr'

// 앱(모바일) 행동지표 뷰 — /api/admin/app-metrics 집계를 렌더.
// 전략 톱라인(회의브리프: D7 잔존 · 글당 답글 · 푸시 재방문)을 최상단에 고정하고,
// 서브탭으로 리텐션 / 커뮤니티 / 전환 / 푸시 / 세그먼트를 분리.

const sectionStyle = { background: '#fff', border: '1px solid #EEF0F2', borderRadius: 14, padding: 20, marginBottom: 20 }
const sectionTitle = { fontSize: 15, fontWeight: 700, color: '#191F28', margin: '0 0 16px 0' }
const thStyle = { padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '2px solid #e5e7eb' }
const tdStyle = { padding: '8px 12px' }

const L = {
  ko: {
    loading: '앱 지표 불러오는 중...', empty: '앱 이벤트 데이터가 아직 없습니다.',
    metaLine: (m) => `집계: ${m.from} ~ ${m.to} · 범위 내 이벤트 ${m.rangeEvents.toLocaleString()}건 (앱 누적 ${m.totalAppEvents.toLocaleString()}건, ${m.appEventStart}~)`,
    toplineTitle: '전략 톱라인 — 한 달 뒤 볼 숫자 3개',
    webPromoTitle: '웹 → 앱 다운로드 유도 (웹 모달)',
    webPromoCtr: '다운로드 버튼 클릭률', webPromoCtrSub: '모달 본 사람 중 스토어로 이동',
    webPromoImp: '모달 노출', webPromoClick: '다운로드 클릭',
    d7: '앱 D7 잔존율', d7sub: '다시 오는가 (최우선)',
    cpp: '글당 답글 수', cppSub: '커뮤니티 생존 (0이면 사망)',
    pushRe: '푸시 재방문', pushReSub: '엔진이 도는가',
    tabs: { overview: '요약', retention: '리텐션', users: '유저분석', community: '커뮤니티', conversion: '전환', push: '푸시', segments: '세그먼트', reports: '신고/피드백' },
    // 요약(Overview)
    ovTitle: '핵심 지표 요약', ovD7: 'D7 잔존', ovStick: '스티키니스(DAU/MAU)', ovWau: 'WAU', ovMau: 'MAU',
    ovNew: '신규 유저(기간)', ovAct: '액티베이션 전환', ovQr: 'Quick Ratio(최근주)', ovCpp: '글당 답글',
    ovSalary: '연봉 제출', ovApply: '지원 완료', ovResume: '이력서 제출', ovResumePublic: '이력서 공개 전환', ovCumSub: '앱 누적', ovPush: '푸시 재방문', ovPower: '파워유저(2일+)',
    ovCurveTitle: '리텐션 커브 (D0~D14)', ovGrowthTitle: '주간 WAU 분해',
    tsNewRet: '신규 vs 재방문 (일별)', tsConvert: '핵심 전환 추이 (일별)', tsCommunity: '커뮤니티 활동 추이 (일별)',
    tsJobs: '채용 퍼널 추이 (일별)', tsPush: '푸시 추이 (일별)',
    // 스티키니스 / 리텐션 커브 / 그로스 어카운팅
    stickTitle: '스티키니스 (참여 밀도)', dauMau: 'DAU/MAU', wauMau: 'WAU/MAU', avgDau: '평균 DAU',
    stickNote: 'DAU/MAU = 한 달 활성유저가 한 달 중 며칠 들어오는지. 20%+면 습관 형성(주 1.4회+).',
    curveTitle: '언바운드 리텐션 커브', curveNote: '설치 후 N일째에도 활성인 비율. 평평해지는 지점 = 충성 코어. D1 급락 후 평탄화가 정상.',
    growthTitle: '그로스 어카운팅 (주간 WAU 분해)',
    gwWeek: '주차', gwNew: '신규', gwRet: '유지', gwRes: '부활', gwChurn: '이탈', gwWau: 'WAU', gwQr: 'Quick Ratio',
    growthNote: 'WAU = 신규+유지+부활. Quick Ratio = (신규+부활)/이탈. 1 초과면 성장, 미만이면 축소. (데이터 누적될수록 정확)',
    // 유저분석 — 액티베이션 / 깊이 / 채택
    actTitle: '신규유저 액티베이션 퍼널', actSub: (w, n) => `최초 ${w}일 내 행동 · 코호트 ${n}명`,
    actSignup: '신규 가입', actView: '핵심 탐색', actEngage: '적극 탐색', actConvert: '핵심 액션',
    actNote: '설치 직후 며칠이 잔존을 결정. 핵심 액션(연봉/지원/글작성/이력서)까지 도달한 비율이 액티베이션.',
    powerTitle: '인게이지먼트 깊이 (파워유저 곡선)', powerSub: '기간 내 활성 일수 분포', powerDays: (d) => `${d}일`,
    powerNote: '활성일수가 많을수록 파워유저. 1일만 보이는 유저가 대부분이면 일회성 유입.',
    featTitle: '기능 채택률', featSub: (n) => `활성유저 ${n}명 대비`, featCombo: '사용 기능 수 분포', featComboItem: (n) => `${n}개 기능`,
    featNote: '활성유저 중 각 기능을 한 번이라도 쓴 비율. 여러 기능을 쓰는 유저일수록 잔존이 높음.',
    dau: 'DAU (최근일)', wau: 'WAU (7일)', mau: 'MAU (30일)',
    cohortTitle: '주간 코호트 리텐션 (client_id 기준)', week: '가입 주차', users: '유저',
    cohortNote: '* 영속 익명 디바이스(client_id) 기준. 앱 재설치 시 새 ID 발급(동일인 신규로 카운트). 로그인 유저는 user_id로 보완.',
    dauTitle: '일별 활성 유저 (신규/재방문)', newU: '신규', retU: '재방문',
    funnelTitle: '커뮤니티 참여 퍼널', funnelUserNote: '괄호=동일유저(client_id) 도달 수',
    fView: '진입', fClick: '글 클릭', fViewPost: '상세 도달', fEngage: '가벼운 참여', fCreate: '글 작성',
    ctr: '글 클릭률', engageRate: '참여 전환율', writeConv: '작성 전환율',
    supplyTitle: '콘텐츠 공급 & 건강도', posts: '신규 글', comments: '신규 댓글',
    anonPost: '익명 글 비율', anonComment: '익명 댓글 비율',
    roles: '작성자 / 반응자 / 열람자 (1% 법칙)', creators: '작성자', reactors: '반응자', viewers: '열람자',
    catTitle: '카테고리 · 검색 인사이트', catViewed: '소비된 카테고리(상세 조회)', searches: '인기 검색어',
    jobsTitle: '채용 지원 퍼널', jView: '채용 진입', jCard: '공고 열람', jApply: '지원 시도', jSubmit: '지원 완료',
    viewRate: '열람률', applyRate: '지원 시도율', submitRate: '지원 완료율', saveRate: '저장률',
    submitLeak: '↑ 로그인·이력서 게이트 누수 지점',
    salaryTitle: '연봉 제출 (앱 핵심 전환)', salaryCount: '제출 수', salaryUsers: '제출 유저(고유)',
    byRole: '직군 분포', byExp: '연차 분포',
    resumeTitle: '이력서 등록', resumeUploads: '업로드 수', resumeUsers: '업로드 유저', uploadToApply: '업로드→지원 전환',
    resumePublic: '공개 전환', resumePublicSub: '기업 공개 · 앱 누적',
    pushTitle: '푸시 (재참여 엔진)', pushSent: '발송', pushCtr: '클릭률(클릭/발송)', pushClicks: '클릭(재방문)', pushClickUsers: '클릭 유저', pushReceived: '수신(포그라운드)',
    pushByCat: '푸시 종류별 클릭', pushNote: '⚠ 클릭률 = 클릭/발송. 발송 수는 서버 발송 로그(push_sent)에서 집계되며 배포 시점부터 누적됩니다(이전 발송분은 분모에 없음). 수신은 OS 한계로 앱 실행 중(포그라운드)만 잡힙니다.',
    osTitle: 'OS 분포', verTitle: '앱 버전 분포 (릴리스 코호트)',
    count: '건', noData: '데이터 없음',
  },
  en: {
    loading: 'Loading app metrics...', empty: 'No app events yet.',
    metaLine: (m) => `Range: ${m.from} ~ ${m.to} · ${m.rangeEvents.toLocaleString()} events in range (${m.totalAppEvents.toLocaleString()} app events total, since ${m.appEventStart})`,
    toplineTitle: 'Strategy Topline — 3 numbers for next month',
    webPromoTitle: 'Web → App download prompt (web modal)',
    webPromoCtr: 'Download button CTR', webPromoCtrSub: 'Of those who saw the modal, went to store',
    webPromoImp: 'Modal impressions', webPromoClick: 'Download clicks',
    d7: 'App D7 Retention', d7sub: 'Do they come back (top priority)',
    cpp: 'Replies per Post', cppSub: 'Community survival (0 = dead)',
    pushRe: 'Push Re-engagement', pushReSub: 'Is the engine running',
    tabs: { overview: 'Overview', retention: 'Retention', users: 'Users', community: 'Community', conversion: 'Conversion', push: 'Push', segments: 'Segments', reports: 'Reports' },
    ovTitle: 'Key Metrics', ovD7: 'D7 Retention', ovStick: 'Stickiness(DAU/MAU)', ovWau: 'WAU', ovMau: 'MAU',
    ovNew: 'New users (range)', ovAct: 'Activation', ovQr: 'Quick Ratio(last wk)', ovCpp: 'Replies/post',
    ovSalary: 'Salary submits', ovApply: 'Applications', ovResume: 'Resume uploads', ovResumePublic: 'Resume made public', ovCumSub: 'app · cumulative', ovPush: 'Push returns', ovPower: 'Power users(2d+)',
    ovCurveTitle: 'Retention Curve (D0–D14)', ovGrowthTitle: 'Weekly WAU breakdown',
    tsNewRet: 'New vs Returning (daily)', tsConvert: 'Key conversions (daily)', tsCommunity: 'Community activity (daily)',
    tsJobs: 'Jobs funnel (daily)', tsPush: 'Push (daily)',
    stickTitle: 'Stickiness (engagement density)', dauMau: 'DAU/MAU', wauMau: 'WAU/MAU', avgDau: 'Avg DAU',
    stickNote: 'DAU/MAU = how many days a month an active user opens the app. 20%+ = habit (1.4×/week+).',
    curveTitle: 'Unbounded Retention Curve', curveNote: '% still active on day N after install. Flattening point = loyal core. Sharp D1 drop then flattening is normal.',
    growthTitle: 'Growth Accounting (weekly WAU)',
    gwWeek: 'Week', gwNew: 'New', gwRet: 'Retained', gwRes: 'Resurrected', gwChurn: 'Churned', gwWau: 'WAU', gwQr: 'Quick Ratio',
    growthNote: 'WAU = new+retained+resurrected. Quick Ratio = (new+resurrected)/churned. >1 grows, <1 shrinks. (More accurate as data accrues)',
    actTitle: 'New-user Activation Funnel', actSub: (w, n) => `Actions within first ${w}d · cohort ${n}`,
    actSignup: 'Signup', actView: 'Core browse', actEngage: 'Active browse', actConvert: 'Key action',
    actNote: 'The first days decide retention. Reaching a key action (salary/apply/post/resume) = activation.',
    powerTitle: 'Engagement Depth (power-user curve)', powerSub: 'Active-days distribution', powerDays: (d) => `${d}d`,
    powerNote: 'More active days = power users. Mostly 1-day users = drive-by traffic.',
    featTitle: 'Feature Adoption', featSub: (n) => `of ${n} active users`, featCombo: '# features used', featComboItem: (n) => `${n} features`,
    featNote: 'Share of active users touching each feature. Multi-feature users retain better.',
    dau: 'DAU (latest)', wau: 'WAU (7d)', mau: 'MAU (30d)',
    cohortTitle: 'Weekly Cohort Retention (by client_id)', week: 'Signup week', users: 'Users',
    cohortNote: '* By persistent anonymous device (client_id). Reinstall issues a new ID. Logged-in users supplemented by user_id.',
    dauTitle: 'Daily Active Users (new/returning)', newU: 'New', retU: 'Returning',
    funnelTitle: 'Community Engagement Funnel', funnelUserNote: '(parens) = unique users (client_id) reached',
    fView: 'Enter', fClick: 'Post click', fViewPost: 'Post detail', fEngage: 'Light engage', fCreate: 'Create post',
    ctr: 'Post CTR', engageRate: 'Engagement rate', writeConv: 'Write conversion',
    supplyTitle: 'Content Supply & Health', posts: 'New posts', comments: 'New comments',
    anonPost: 'Anon post rate', anonComment: 'Anon comment rate',
    roles: 'Creators / Reactors / Viewers (1% rule)', creators: 'Creators', reactors: 'Reactors', viewers: 'Viewers',
    catTitle: 'Category & Search Insights', catViewed: 'Consumed categories (detail views)', searches: 'Top searches',
    jobsTitle: 'Job Application Funnel', jView: 'Jobs enter', jCard: 'Card view', jApply: 'Apply attempt', jSubmit: 'Apply complete',
    viewRate: 'View rate', applyRate: 'Apply-attempt rate', submitRate: 'Apply-complete rate', saveRate: 'Save rate',
    submitLeak: '↑ login/resume gate leak point',
    salaryTitle: 'Salary Submission (core conversion)', salaryCount: 'Submissions', salaryUsers: 'Unique submitters',
    byRole: 'By role', byExp: 'By experience',
    resumeTitle: 'Resume Upload', resumeUploads: 'Uploads', resumeUsers: 'Upload users', uploadToApply: 'Upload→apply conv',
    resumePublic: 'Public conversions', resumePublicSub: 'Made public · app, cumulative',
    pushTitle: 'Push (re-engagement engine)', pushSent: 'Sent', pushCtr: 'CTR (clicks/sent)', pushClicks: 'Clicks (returns)', pushClickUsers: 'Click users', pushReceived: 'Received (foreground)',
    pushByCat: 'Clicks by push type', pushNote: '⚠ CTR = clicks/sent. Sent count comes from server push logs (push_sent) and accumulates from deploy time (earlier sends are not in the denominator). Received only fires in foreground (OS limit).',
    osTitle: 'OS Breakdown', verTitle: 'App Version Breakdown (release cohort)',
    count: '', noData: 'No data',
  },
}

function Card({ label, value, sub, big, color = '#191F28' }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #EEF0F2', borderRadius: 12, padding: '15px 18px' }}>
      <div style={{ fontSize: 12, color: '#8B95A1', marginBottom: 6, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: big ? 30 : 23, fontWeight: 800, color, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{value}</div>
      {sub != null && <div style={{ fontSize: 11.5, color: '#ADB5BD', marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

// 라벨 + 막대 + 값 (분포/퍼널용 경량 바)
function BarRow({ label, value, max, suffix = '', color = '#4F46E5', note }) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
      <div style={{ width: 130, fontSize: 12, color: '#374151', flexShrink: 0, textAlign: 'right' }}>{label}</div>
      <div style={{ flex: 1, background: '#f3f4f6', borderRadius: 4, height: 20, position: 'relative' }}>
        <div style={{ width: `${pct}%`, background: color, height: '100%', borderRadius: 4 }} />
      </div>
      <div style={{ width: 110, fontSize: 12, fontWeight: 600, color: '#111', flexShrink: 0 }}>
        {value.toLocaleString()}{suffix}{note ? <span style={{ color: '#9CA3AF', fontWeight: 400 }}> {note}</span> : null}
      </div>
    </div>
  )
}

function rateColor(r) {
  const v = parseFloat(r); if (isNaN(v)) return '#ccc'
  if (v >= 50) return '#065F46'; if (v >= 30) return '#10B981'; if (v >= 15) return '#F59E0B'; return '#EF4444'
}
function rateBg(r) {
  const v = parseFloat(r); if (isNaN(v)) return '#f9fafb'
  if (v >= 50) return '#D1FAE5'; if (v >= 30) return '#ECFDF5'; if (v >= 15) return '#FFFBEB'; return '#FEF2F2'
}

// 분포 → 가로 막대 차트(recharts). 카테고리/검색어/직군 등 모든 분포에 공용.
function DistTable({ rows, t, color = '#6B7280' }) {
  if (!rows || !rows.length) return <div style={{ color: '#9CA3AF', fontSize: 13 }}>{t.noData}</div>
  return <BarDist rows={rows} color={color} />
}

// ===== 앰플리튜드식 차트 컴포넌트 =====
const chartCard = { background: '#fff', border: '1px solid #EEF0F2', borderRadius: 14, padding: 16 }
const chartCardTitle = { fontSize: 14, fontWeight: 700, margin: '0 0 2px 0', color: '#191F28' }
const chartCardSub = { fontSize: 11, color: '#9CA3AF', marginBottom: 8 }

// 색 점 + 라벨 범례 (차트 하단)
function ChartLegend({ metrics }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 8, fontSize: 12, color: '#6B7280' }}>
      {metrics.map(m => (
        <span key={m.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: m.color }} />{m.label}
        </span>
      ))}
    </div>
  )
}

// 시계열 차트 카드 — DashboardCharts의 MetricChart(area) 재사용 + 범례.
function TsCard({ title, sub, data, metrics, lang, dualAxis = false, chartKey, onOpen }) {
  return (
    <div style={{ ...chartCard, cursor: onOpen ? 'pointer' : 'default' }} onClick={onOpen ? () => onOpen(chartKey) : undefined}>
      <h4 style={chartCardTitle}>{title}</h4>
      {sub && <div style={chartCardSub}>{sub}</div>}
      <MetricChart daily={aggregateBy(data, metrics, 'day')} metrics={metrics} lang={lang} dualAxis={dualAxis} lineType="linear" dots={false} avgLabel={lang === 'en' ? 'avg' : '평균'} />
      <ChartLegend metrics={metrics} />
    </div>
  )
}

// 일/주/월 집계. 일은 최근 30일(이벤트 없던 날도 빈칸으로 표시), 주(월~일)·월은 기간 합산.
function aggregateBy(rows, metrics, gran) {
  const sorted = [...rows].sort((a, b) => (a.date < b.date ? -1 : 1))
  if (gran === 'day') {
    if (!sorted.length) return []
    const map = {}
    for (const d of sorted) map[d.date] = d
    const end = new Date(sorted[sorted.length - 1].date + 'T00:00:00')
    const out = []
    for (let i = 29; i >= 0; i--) {
      const dt = new Date(end); dt.setDate(end.getDate() - i)
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
      if (map[key]) { out.push(map[key]); continue }
      // 없는 날: 차트는 0으로 채워 선이 이어지게, 표는 '-'(_empty 플래그)
      const e = { date: key, _empty: true }
      metrics.forEach(m => { e[m.dataKey] = 0 })
      out.push(e)
    }
    return out
  }
  // 주(월~일)·월: 최근 윈도우(주 ~12개 / 월 ~6개)를 연속 생성. 이벤트 없던 기간도 _empty로 표시.
  if (!sorted.length) return []
  const map = {}
  for (const d of sorted) map[d.date] = d
  const lastDate = new Date(sorted[sorted.length - 1].date + 'T00:00:00')
  const pad = (n) => String(n).padStart(2, '0')
  const periodKey = (dt) => {
    if (gran === 'month') return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}`
    const mon = new Date(dt); mon.setDate(dt.getDate() - ((dt.getDay() + 6) % 7))
    return `${mon.getFullYear()}-${pad(mon.getMonth() + 1)}-${pad(mon.getDate())}`
  }
  const windowDays = gran === 'month' ? 183 : 84
  const buckets = {}
  const order = []
  for (let i = windowDays - 1; i >= 0; i--) {
    const dt = new Date(lastDate); dt.setDate(lastDate.getDate() - i)
    const pkey = periodKey(dt)
    if (!buckets[pkey]) { buckets[pkey] = { date: pkey, _empty: true }; metrics.forEach(m => { buckets[pkey][m.dataKey] = 0 }); order.push(pkey) }
    const row = map[`${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`]
    if (row) { buckets[pkey]._empty = false; metrics.forEach(m => { if (row[m.dataKey] != null) buckets[pkey][m.dataKey] += row[m.dataKey] }) }
  }
  return order.map(k => buckets[k])
}

// 그래프 클릭 시 한 뎁스 깊은 상세 페이지 — App Store Connect식: 뒤로 + 제목 + 일/주/월 토글 + 직선 차트 + 일별 표.
function ChartDetail({ title, data, metrics, lang, onBack }) {
  const [gran, setGran] = useState('day')
  const view = aggregateBy(data || [], metrics, gran)
  const rows = [...view].sort((a, b) => (a.date < b.date ? 1 : -1))
  const single = metrics.length === 1
  const mth = { padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#8B95A1', fontSize: 12, whiteSpace: 'nowrap' }
  const mtd = { padding: '9px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }
  const sum = (key) => view.reduce((s, d) => s + (d[key] ?? 0), 0)
  const GRANS = [['day', '일'], ['week', '주'], ['month', '월']]
  return (
    <div>
      <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #E5E8EB', background: '#fff', borderRadius: 9, padding: '7px 13px', fontSize: 13, fontWeight: 600, color: '#4E5968', cursor: 'pointer', marginBottom: 16 }}>← 뒤로</button>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: '#191F28', margin: '0 0 2px' }}>{title}</h2>
          {single && <div style={{ fontSize: 30, fontWeight: 800, color: '#191F28', letterSpacing: '-0.02em' }}>{sum(metrics[0].dataKey).toLocaleString()}</div>}
        </div>
        <div style={{ display: 'flex', gap: 2, background: '#F2F4F6', borderRadius: 9, padding: 3 }}>
          {GRANS.map(([k, label]) => (
            <button key={k} onClick={() => setGran(k)} style={{
              padding: '6px 14px', borderRadius: 6, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', border: 'none',
              background: gran === k ? '#fff' : 'transparent', color: gran === k ? '#ff4400' : '#86868b',
              boxShadow: gran === k ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
            }}>{label}</button>
          ))}
        </div>
      </div>
      <div style={{ ...chartCard, marginBottom: 16 }}>
        <MetricChart daily={view} metrics={metrics} lang={lang} lineType="linear" dots={false} avgLabel={lang === 'en' ? 'avg' : '평균'} />
        <ChartLegend metrics={metrics} />
      </div>
      <div style={{ ...chartCard, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #EEF0F2' }}>
              <th style={{ ...mth, textAlign: 'left' }}>날짜</th>
              {metrics.map(m => <th key={m.dataKey} style={mth}>{m.label}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid #EEF0F2', fontWeight: 700 }}>
              <td style={{ ...mtd, textAlign: 'left', color: '#191F28' }}>합계</td>
              {metrics.map(m => <td key={m.dataKey} style={{ ...mtd, color: '#191F28' }}>{sum(m.dataKey).toLocaleString()}</td>)}
            </tr>
            {rows.map(d => (
              <tr key={d.date} style={{ borderBottom: '1px solid #F7F8FA' }}>
                <td style={{ ...mtd, textAlign: 'left', color: '#4E5968' }}>{d.date}</td>
                {metrics.map(m => {
                  const v = d._empty ? null : d[m.dataKey]
                  return <td key={m.dataKey} style={{ ...mtd, color: v == null ? '#C7CDD4' : '#191F28' }}>{v == null ? '-' : v.toLocaleString()}</td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// 분포 가로 막대 차트
function BarDist({ rows, color = '#6B7280', height }) {
  if (!rows || !rows.length) return <div style={{ color: '#9CA3AF', fontSize: 13 }}>—</div>
  const data = rows.map(r => ({ name: String(r.name), count: r.count }))
  const h = height || Math.max(120, data.length * 30 + 16)
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 36, left: 8, bottom: 4 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="name" width={130} fontSize={12} tickLine={false} axisLine={false} />
        <Tooltip cursor={{ fill: '#f9fafb' }} />
        <Bar dataKey="count" fill={color} radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 11, fill: '#374151' }} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// 퍼널 가로 막대 — 단계별 값 + 전환율 라벨(우측).
function FunnelChart({ steps, color = '#4F46E5' }) {
  const max = Math.max(1, ...steps.map(s => s.value || 0))
  return (
    <div>
      {steps.map(s => {
        const pct = Math.max(2, ((s.value || 0) / max) * 100)
        return (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 110, fontSize: 12, color: '#374151', flexShrink: 0, textAlign: 'right' }}>{s.label}</div>
            <div style={{ flex: 1, background: '#f3f4f6', borderRadius: 4, height: 26, position: 'relative' }}>
              <div style={{ width: `${pct}%`, background: color, height: '100%', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 8 }}>
                <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>{(s.value || 0).toLocaleString()}</span>
              </div>
            </div>
            <div style={{ width: 56, fontSize: 12, fontWeight: 600, color: s.rate != null ? rateColor(s.rate) : '#9CA3AF', flexShrink: 0 }}>
              {s.rate != null ? `${s.rate}%` : ''}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// 시계열을 앱 이벤트 시작일(meta.appEventStart) 이후로만 자른다. 앱 출시 전 구간은
// 어차피 데이터가 없으니 안 그린다. 시작일 이후의 0인 날은 그대로 보존(실제 0).
function clampToStart(rows, start) {
  if (!start) return rows || []
  return (rows || []).filter(r => r.date >= start)
}

export default function AppMetricsView({ token, dateRange, lang }) {
  const t = L[lang === 'en' ? 'en' : 'ko']
  // 종료일이 기본값(어제)이면 오늘까지 포함해 조회한다 → 어제까지는 완결 집계,
  // 오늘은 30초 폴링으로 갱신되는 실시간 부분일로 함께 보인다.
  // (사용자가 과거 종료일을 직접 고른 경우엔 그 선택을 존중)
  const pad = (n) => String(n).padStart(2, '0')
  const ymd = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
  const today = ymd(Date.now())
  const yesterday = ymd(Date.now() - 86400000)
  const effectiveTo = dateRange.to >= yesterday ? today : dateRange.to
  // 백그라운드 자동 폴링(30초): keepPreviousData로 화면 깜빡임 없이 데이터만 교체.
  const { data, isLoading: loading } = useAdmin(
    `/api/admin/app-metrics?from=${dateRange.from}&to=${effectiveTo}`,
    token,
    { refreshInterval: 30000 },
  )
  const [sub, setSub] = useState('overview')
  const router = useRouter()

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>{t.loading}</div>
  if (!data || !data.meta.totalAppEvents) return <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>{t.empty}</div>

  const { meta, topline, retention, community, conversion, push, segments, daily, webAppPromo } = data
  // 분석가 모듈(부분 배포 대비 기본값). 백엔드 갱신 후엔 항상 채워짐.
  const analytics = data.analytics || {
    stickiness: {}, newUsersInRange: 0, retentionCurve: [], activation: {},
    growth: { weeks: [], latest: null },
    depth: { powerCurve: [], featureAdoption: [], featureCountDist: [], rangeClients: 0, featureDenom: 0, multiDayRate: null },
  }
  const cppNum = parseFloat(topline.commentsPerPost)
  const SUB_TABS = ['overview', 'retention', 'users', 'community', 'conversion', 'push', 'segments', 'reports']

  // 시계열: 일별 이벤트 카운트(daily) + 일별 활성유저(dauSeries)를 날짜축으로 0-채움 병합.
  const dauByDate = Object.fromEntries((retention.dauSeries || []).map(d => [d.date, d]))
  const ts = clampToStart((daily || []).map(d => ({
    date: d.date,
    active: dauByDate[d.date]?.active || 0,
    newU: dauByDate[d.date]?.new || 0,
    returning: dauByDate[d.date]?.returning || 0,
    submit_salary: d.submit_salary || 0,
    submit_application: d.submit_application || 0,
    resume_upload: d.resume_upload || 0,
    view_community: d.view_community || 0,
    create_community_post: d.create_community_post || 0,
    create_community_comment: d.create_community_comment || 0,
    view_jobs_page: d.view_jobs_page || 0,
    click_job_card: d.click_job_card || 0,
    click_apply_button: d.click_apply_button || 0,
    push_click: d.push_click || 0,
    push_received: d.push_received || 0,
  })), meta.appEventStart)
  // 시계열 metric 정의 (key=dataKey=label=color)
  const M = (dataKey, label, color) => ({ key: dataKey, dataKey, label, color })
  const series = {
    dau: [M('active', 'DAU', '#ff4400')],
    newRet: [M('returning', t.retU, '#ff4400'), M('newU', t.newU, '#3F3F46')],
    convert: [M('submit_salary', t.ovSalary, '#ff4400'), M('submit_application', t.ovApply, '#3F3F46'), M('resume_upload', t.resumeUploads, '#A1A1AA')],
    community: [M('view_community', t.fView, '#ff4400'), M('create_community_post', t.posts, '#3F3F46'), M('create_community_comment', t.comments, '#A1A1AA')],
    jobs: [M('view_jobs_page', t.jView, '#ff4400'), M('click_job_card', t.jCard, '#3F3F46'), M('click_apply_button', t.jApply, '#A1A1AA')],
    push: [M('push_sent', t.pushSent, '#ff4400'), M('push_click', t.pushClicks, '#3F3F46'), M('push_received', t.pushReceived, '#A1A1AA')],
  }

  // 그래프 클릭 → URL(?chart=)로 한 뎁스 더 깊은 상세 페이지. 뒤로가기로 복귀.
  const goChart = (key) => router.push({ pathname: router.pathname, query: { ...router.query, chart: key } }, undefined, { shallow: true })
  const backFromChart = () => { const q = { ...router.query }; delete q.chart; router.push({ pathname: router.pathname, query: q }, undefined, { shallow: true }) }
  const CHARTS = {
    dau: { title: t.dauTitle, metrics: series.dau },
    newRet: { title: t.tsNewRet, metrics: series.newRet },
    convert: { title: t.tsConvert, metrics: series.convert },
    community: { title: t.tsCommunity, metrics: series.community },
    jobs: { title: t.tsJobs, metrics: series.jobs },
    push: { title: t.tsPush, metrics: series.push },
  }
  const openChart = CHARTS[router.query.chart]
  if (openChart) {
    return <ChartDetail title={openChart.title} data={ts} metrics={openChart.metrics} lang={lang} onBack={backFromChart} />
  }

  return (
    <>
      {/* 서브탭 (상단) */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 22, borderBottom: '1px solid #EEF0F2', overflowX: 'auto', overflowY: 'hidden' }}>
        {SUB_TABS.map(k => (
          <button key={k} onClick={() => setSub(k)} style={{
            padding: '9px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', background: 'none',
            borderBottom: sub === k ? '2px solid #ff4400' : '2px solid transparent', marginBottom: -1,
            color: sub === k ? '#ff4400' : '#8B95A1', whiteSpace: 'nowrap', flexShrink: 0,
          }}>{t.tabs[k]}</button>
        ))}
      </div>

      {/* ── 요약(Overview) — 앰플리튜드식 스코어카드 + 차트 그리드 ── */}
      {sub === 'overview' && (() => {
        const g = analytics.growth.latest
        const qrNum = g ? parseFloat(g.quickRatio) : NaN
        const cards = [
          { label: t.ovD7, value: `${topline.d7.rate}%`, color: rateColor(topline.d7.rate) },
          { label: t.ovStick, value: analytics.stickiness.dauMau != null ? `${analytics.stickiness.dauMau}%` : '-', color: '#2563EB' },
          { label: t.ovWau, value: retention.wau, color: '#2563EB' },
          { label: t.ovMau, value: retention.mau, color: '#10B981' },
          { label: t.ovNew, value: analytics.newUsersInRange, color: '#0EA5E9' },
          { label: t.ovAct, value: analytics.activation.convertRate != null ? `${analytics.activation.convertRate}%` : '-', color: rateColor(analytics.activation.convertRate) },
          { label: t.ovQr, value: g && g.quickRatio != null ? g.quickRatio : '-', color: isNaN(qrNum) ? '#9CA3AF' : qrNum >= 1 ? '#10B981' : '#EF4444' },
          { label: t.ovCpp, value: topline.commentsPerPost, color: cppNum < 1 ? '#EF4444' : '#10B981' },
          { label: t.ovSalary, value: conversion.salary.count, color: '#059669' },
          { label: t.ovApply, value: conversion.jobs.submit, color: '#2563EB' },
          { label: t.ovResume, value: conversion.resume.appSubmitted, color: '#2563EB', sub: t.ovCumSub },
          { label: t.ovResumePublic, value: conversion.resume.appPublic, color: '#EA580C', sub: t.ovCumSub },
          { label: t.ovPush, value: push.clicks, color: '#8B5CF6' },
          { label: t.ovPower, value: analytics.depth.multiDayRate != null ? `${analytics.depth.multiDayRate}%` : '-', color: '#7C3AED' },
        ]
        return (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
              {cards.map(c => <Card key={c.label} label={c.label} value={c.value} sub={c.sub} color={c.color} />)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: 16 }}>
              <TsCard title={t.dauTitle} data={ts} metrics={series.dau} lang={lang} chartKey="dau" onOpen={goChart} />
              <TsCard title={t.tsNewRet} data={ts} metrics={series.newRet} lang={lang} chartKey="newRet" onOpen={goChart} />
              <TsCard title={t.tsConvert} data={ts} metrics={series.convert} lang={lang} chartKey="convert" onOpen={goChart} />
              <TsCard title={t.tsCommunity} data={ts} metrics={series.community} lang={lang} chartKey="community" onOpen={goChart} />
              <div style={chartCard}>
                <h4 style={chartCardTitle}>{t.curveTitle}</h4>
                <div style={chartCardSub}>{t.ovCurveTitle}</div>
                <RetentionCurveChart curve={analytics.retentionCurve} />
              </div>
              <div style={chartCard}>
                <h4 style={chartCardTitle}>{t.growthTitle}</h4>
                <div style={chartCardSub}>{t.ovGrowthTitle}</div>
                <GrowthChart weeks={analytics.growth.weeks} t={t} />
              </div>
            </div>

            {/* 전략 톱라인 (요약 하단으로 이동) */}
            <div style={{ ...sectionStyle, marginTop: 20 }}>
              <h3 style={sectionTitle}>{t.toplineTitle}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                <Card big label={t.d7} value={`${topline.d7.rate}%`} sub={`${t.d7sub} · ${topline.d7.retained}/${topline.d7.eligible}`} />
                <Card big label={t.cpp} value={topline.commentsPerPost} sub={t.cppSub} />
                <Card big label={t.pushRe} value={push.clicks.toLocaleString()} sub={`${t.pushReSub} · ${push.clickUsers} users`} />
              </div>
            </div>

            {/* 웹 → 앱 다운로드 유도 */}
            {webAppPromo && (
              <div style={sectionStyle}>
                <h3 style={sectionTitle}>{t.webPromoTitle}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                  <Card big label={t.webPromoCtr} value={webAppPromo.ctr != null ? `${webAppPromo.ctr}%` : '-'} sub={`${t.webPromoCtrSub} · ${webAppPromo.clicks.toLocaleString()}/${webAppPromo.impressions.toLocaleString()}`} />
                  <Card label={t.webPromoImp} value={webAppPromo.impressions.toLocaleString()} />
                  <Card label={t.webPromoClick} value={webAppPromo.clicks.toLocaleString()} />
                </div>
              </div>
            )}
          </>
        )
      })()}

      {/* ── 리텐션 ── */}
      {sub === 'retention' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
            <Card label={t.dau} value={retention.dau} color="#374151" />
            <Card label={t.wau} value={retention.wau} color="#2563EB" />
            <Card label={t.mau} value={retention.mau} color="#10B981" />
            <Card label="D1" value={`${retention.d1.rate}%`} sub={`${retention.d1.retained}/${retention.d1.eligible}`} color="#F59E0B" />
            <Card label="D7" value={`${retention.d7.rate}%`} sub={`${retention.d7.retained}/${retention.d7.eligible}`} color="#8B5CF6" />
            <Card label="D30" value={`${retention.d30.rate}%`} sub={`${retention.d30.retained}/${retention.d30.eligible}`} color="#EF4444" />
          </div>

          {retention.dauSeries.length > 0 && (
            <div style={sectionStyle}>
              <h3 style={sectionTitle}>{t.dauTitle}</h3>
              <DauChart series={clampToStart(retention.dauSeries, meta.appEventStart)} t={t} />
            </div>
          )}

          <div style={sectionStyle}>
            <h3 style={sectionTitle}>{t.cohortTitle}</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr>
                  <th style={thStyle}>{t.week}</th><th style={{ ...thStyle, textAlign: 'right' }}>{t.users}</th>
                  {['W1', 'W2', 'W3', 'W4'].map(w => <th key={w} style={{ ...thStyle, textAlign: 'center' }}>{w}</th>)}
                </tr></thead>
                <tbody>
                  {retention.cohorts.map((c, i) => (
                    <tr key={c.week} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 ? '#fafafa' : '#fff' }}>
                      <td style={{ ...tdStyle, fontWeight: 500 }}>{c.week}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{c.total}</td>
                      {c.weeks.map((w, wi) => (
                        <td key={wi} style={{ ...tdStyle, textAlign: 'center', fontWeight: 600, background: w ? rateBg(w.rate) : '#f9fafb', color: w ? rateColor(w.rate) : '#ccc' }}>
                          {w ? `${w.rate}%` : '-'}
                          {w && <div style={{ fontSize: 10, fontWeight: 400, color: '#9CA3AF' }}>{w.retained}/{w.eligible}</div>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 12 }}>{t.cohortNote}</div>
          </div>

          <div style={sectionStyle}>
            <h3 style={sectionTitle}>{t.stickTitle}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
              <Card label={t.dauMau} value={analytics.stickiness.dauMau != null ? `${analytics.stickiness.dauMau}%` : '-'} color="#2563EB" />
              <Card label={t.wauMau} value={analytics.stickiness.wauMau != null ? `${analytics.stickiness.wauMau}%` : '-'} color="#8B5CF6" />
              <Card label={t.avgDau} value={analytics.stickiness.avgDau} color="#374151" />
            </div>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 12 }}>{t.stickNote}</div>
          </div>

          <div style={sectionStyle}>
            <h3 style={sectionTitle}>{t.curveTitle}</h3>
            <RetentionCurveChart curve={analytics.retentionCurve} />
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 12 }}>{t.curveNote}</div>
          </div>

          <div style={sectionStyle}>
            <h3 style={sectionTitle}>{t.growthTitle}</h3>
            <GrowthChart weeks={analytics.growth.weeks} t={t} />
            <div style={{ marginTop: 16 }}>
              <GrowthTable weeks={analytics.growth.weeks} t={t} />
            </div>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 12 }}>{t.growthNote}</div>
          </div>
        </>
      )}

      {/* ── 유저분석 (액티베이션 / 깊이 / 채택) ── */}
      {sub === 'users' && (
        <>
          <div style={sectionStyle}>
            <h3 style={sectionTitle}>{t.actTitle}</h3>
            <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 12 }}>{t.actSub(analytics.activation.window, analytics.activation.cohort)}</div>
            <FunnelChart color="#0EA5E9" steps={[
              { label: t.actSignup, value: analytics.activation.cohort, rate: null },
              { label: t.actView, value: analytics.activation.view, rate: analytics.activation.viewRate },
              { label: t.actEngage, value: analytics.activation.engage, rate: analytics.activation.engageRate },
              { label: t.actConvert, value: analytics.activation.convert, rate: analytics.activation.convertRate },
            ]} />
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 8 }}>{t.actNote}</div>
          </div>

          <div style={sectionStyle}>
            <h3 style={sectionTitle}>{t.powerTitle}</h3>
            <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 12 }}>{t.powerSub} · {(analytics.depth.rangeClients || 0).toLocaleString()} users</div>
            {(() => {
              const pc = analytics.depth.powerCurve
              if (!pc.length) return <div style={{ color: '#9CA3AF', fontSize: 13 }}>{t.noData}</div>
              const max = Math.max(1, ...pc.map(b => b.count))
              return pc.map(b => <BarRow key={b.name} label={t.powerDays(b.name)} value={b.count} max={max} color="#7C3AED" />)
            })()}
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 8 }}>{t.powerNote}</div>
          </div>

          <div style={sectionStyle}>
            <h3 style={sectionTitle}>{t.featTitle}</h3>
            <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 12 }}>{t.featSub(analytics.depth.featureDenom)}</div>
            {(() => {
              const fa = analytics.depth.featureAdoption
              if (!fa.length) return <div style={{ color: '#9CA3AF', fontSize: 13 }}>{t.noData}</div>
              const max = Math.max(1, ...fa.map(f => f.count))
              return fa.map(f => <BarRow key={f.name} label={f.name} value={f.count} max={max} color="#10B981" note={f.rate != null ? `${f.rate}%` : ''} />)
            })()}
            <h4 style={{ fontSize: 13, fontWeight: 600, color: '#374151', margin: '20px 0 10px' }}>{t.featCombo}</h4>
            {(() => {
              const dist = analytics.depth.featureCountDist
              if (!dist.length) return <div style={{ color: '#9CA3AF', fontSize: 13 }}>{t.noData}</div>
              const max = Math.max(1, ...dist.map(d => d.count))
              return dist.map(d => <BarRow key={d.n} label={t.featComboItem(d.n)} value={d.count} max={max} color="#6B7280" />)
            })()}
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 8 }}>{t.featNote}</div>
          </div>
        </>
      )}

      {/* ── 커뮤니티 ── */}
      {sub === 'community' && (
        <>
          <div style={sectionStyle}>
            <h3 style={sectionTitle}>{t.tsCommunity}</h3>
            <MetricChart daily={aggregateBy(ts, series.community, "day")} metrics={series.community} lang={lang} lineType="linear" dots={false} />
            <ChartLegend metrics={series.community} />
          </div>

          <div style={sectionStyle}>
            <h3 style={sectionTitle}>{t.funnelTitle}</h3>
            {(() => {
              const f = community.funnel
              const raw = [
                { label: t.fView, value: f.view }, { label: t.fClick, value: f.click },
                { label: t.fViewPost, value: f.viewPost }, { label: t.fEngage, value: f.engage }, { label: t.fCreate, value: f.create },
              ]
              const steps = raw.map((s, i) => ({ ...s, rate: i === 0 ? null : (raw[i - 1].value > 0 ? ((s.value / raw[i - 1].value) * 100).toFixed(1) : null) }))
              return <FunnelChart steps={steps} color="#4F46E5" />
            })()}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginTop: 16 }}>
              <Card label={t.ctr} value={community.ctr != null ? `${community.ctr}%` : '-'} color="#4F46E5" />
              <Card label={t.engageRate} value={community.engageRate != null ? `${community.engageRate}%` : '-'} color="#8B5CF6" />
              <Card label={t.writeConv} value={community.writeConv != null ? `${community.writeConv}%` : '-'} color="#10B981" />
            </div>
          </div>

          <div style={sectionStyle}>
            <h3 style={sectionTitle}>{t.supplyTitle}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
              <Card label={t.posts} value={community.posts} color="#2563EB" />
              <Card label={t.comments} value={community.comments} color="#2563EB" />
              <Card label={t.cpp} value={community.commentsPerPost} color={cppNum < 1 ? '#EF4444' : '#10B981'} />
              <Card label={t.anonPost} value={community.anonPostRate != null ? `${community.anonPostRate}%` : '-'} color="#6B7280" />
              <Card label={t.anonComment} value={community.anonCommentRate != null ? `${community.anonCommentRate}%` : '-'} color="#6B7280" />
            </div>
            <h4 style={{ fontSize: 13, fontWeight: 600, color: '#374151', margin: '20px 0 10px' }}>{t.roles}</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <Card label={t.creators} value={community.creators} color="#EF4444" />
              <Card label={t.reactors} value={community.reactors} color="#F59E0B" />
              <Card label={t.viewers} value={community.viewers} color="#6B7280" />
            </div>
          </div>

          <div style={sectionStyle}>
            <h3 style={sectionTitle}>{t.catTitle}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div>
                <h4 style={{ fontSize: 13, fontWeight: 600, color: '#374151', margin: '0 0 10px' }}>{t.catViewed}</h4>
                <DistTable rows={community.categoriesViewed} t={t} />
              </div>
              <div>
                <h4 style={{ fontSize: 13, fontWeight: 600, color: '#374151', margin: '0 0 10px' }}>{t.searches}</h4>
                <DistTable rows={community.topSearches} t={t} />
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── 전환 ── */}
      {sub === 'conversion' && (
        <>
          <div style={sectionStyle}>
            <h3 style={sectionTitle}>{t.tsConvert}</h3>
            <MetricChart daily={aggregateBy(ts, series.convert, "day")} metrics={series.convert} lang={lang} lineType="linear" dots={false} />
            <ChartLegend metrics={series.convert} />
          </div>

          <div style={sectionStyle}>
            <h3 style={sectionTitle}>{t.jobsTitle}</h3>
            {(() => {
              const j = conversion.jobs
              const raw = [
                { label: t.jView, value: j.view }, { label: t.jCard, value: j.card },
                { label: t.jApply, value: j.apply }, { label: t.jSubmit, value: j.submit },
              ]
              const steps = raw.map((s, i) => ({ ...s, rate: i === 0 ? null : (raw[i - 1].value > 0 ? ((s.value / raw[i - 1].value) * 100).toFixed(1) : null) }))
              return <FunnelChart steps={steps} color="#2563EB" />
            })()}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginTop: 16 }}>
              <Card label={t.viewRate} value={conversion.jobs.viewRate != null ? `${conversion.jobs.viewRate}%` : '-'} color="#2563EB" />
              <Card label={t.applyRate} value={conversion.jobs.applyRate != null ? `${conversion.jobs.applyRate}%` : '-'} color="#8B5CF6" />
              <Card label={t.submitRate} value={conversion.jobs.submitRate != null ? `${conversion.jobs.submitRate}%` : '-'} sub={t.submitLeak} color={rateColor(conversion.jobs.submitRate)} />
              <Card label={t.saveRate} value={conversion.jobs.saveRate != null ? `${conversion.jobs.saveRate}%` : '-'} color="#6B7280" />
            </div>
            <div style={{ marginTop: 20 }}>
              <h4 style={{ fontSize: 13, fontWeight: 600, color: '#374151', margin: '0 0 10px' }}>{t.tsJobs}</h4>
              <MetricChart daily={aggregateBy(ts, series.jobs, "day")} metrics={series.jobs} lang={lang} lineType="linear" dots={false} />
              <ChartLegend metrics={series.jobs} />
            </div>
          </div>

          <div style={sectionStyle}>
            <h3 style={sectionTitle}>{t.salaryTitle}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 16 }}>
              <Card label={t.salaryCount} value={conversion.salary.count} color="#10B981" />
              <Card label={t.salaryUsers} value={conversion.salary.uniqueUsers} color="#059669" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div>
                <h4 style={{ fontSize: 13, fontWeight: 600, color: '#374151', margin: '0 0 10px' }}>{t.byRole}</h4>
                <DistTable rows={conversion.salary.byRole} t={t} />
              </div>
              <div>
                <h4 style={{ fontSize: 13, fontWeight: 600, color: '#374151', margin: '0 0 10px' }}>{t.byExp}</h4>
                <DistTable rows={conversion.salary.byExperience} t={t} />
              </div>
            </div>
          </div>

          <div style={sectionStyle}>
            <h3 style={sectionTitle}>{t.resumeTitle}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
              <Card label={t.resumeUploads} value={conversion.resume.uploads} color="#2563EB" />
              <Card label={t.resumeUsers} value={conversion.resume.uploadUsers} color="#2563EB" />
              <Card label={t.resumePublic} value={conversion.resume.appPublic} sub={t.resumePublicSub} color="#EA580C" />
              <Card label={t.uploadToApply} value={conversion.resume.uploadToApply != null ? `${conversion.resume.uploadToApply}%` : '-'} color="#10B981" />
            </div>
          </div>
        </>
      )}

      {/* ── 푸시 ── */}
      {sub === 'push' && (
        <div style={sectionStyle}>
          <h3 style={sectionTitle}>{t.pushTitle}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 16 }}>
            <Card label={t.pushSent} value={push.sent} color="#0EA5E9" />
            <Card label={t.pushClicks} value={push.clicks} color="#8B5CF6" />
            <Card label={t.pushCtr} value={push.ctr == null ? '–' : push.ctr + '%'} color="#10B981" />
            <Card label={t.pushClickUsers} value={push.clickUsers} color="#7C3AED" />
            <Card label={t.pushReceived} value={push.received} color="#6B7280" />
          </div>
          <h4 style={{ fontSize: 13, fontWeight: 600, color: '#374151', margin: '0 0 10px' }}>{t.tsPush}</h4>
          <MetricChart daily={aggregateBy(ts, series.push, "day")} metrics={series.push} lang={lang} dualAxis={false} lineType="linear" dots={false} />
          <ChartLegend metrics={series.push} />
          <h4 style={{ fontSize: 13, fontWeight: 600, color: '#374151', margin: '20px 0 10px' }}>{t.pushByCat}</h4>
          <BarDist rows={push.byCategory.map(c => ({ name: c.name, count: c.click }))} color="#8B5CF6" />
          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 14, lineHeight: 1.6 }}>{t.pushNote}</div>
        </div>
      )}

      {/* ── 세그먼트 ── */}
      {sub === 'segments' && (
        <div style={sectionStyle}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div>
              <h3 style={sectionTitle}>{t.osTitle}</h3>
              <DistTable rows={segments.os} t={t} />
            </div>
            <div>
              <h3 style={sectionTitle}>{t.verTitle}</h3>
              <DistTable rows={segments.appVersion} t={t} />
            </div>
          </div>
        </div>
      )}

      {sub === 'reports' && <ModerationView token={token} />}
    </>
  )
}

// 일별 활성 유저 — 신규/재방문 스택 막대(recharts).
function DauChart({ series, t }) {
  const data = (series || []).map(s => ({ date: s.date, newU: s.new, returning: s.returning }))
  return (
    <div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis dataKey="date" tickFormatter={d => d.slice(5)} fontSize={12} />
          <YAxis fontSize={12} allowDecimals={false} />
          <Tooltip cursor={{ fill: '#f9fafb' }} labelFormatter={d => d} />
          <Bar dataKey="returning" name={t.retU} stackId="a" fill="#2563EB" radius={[0, 0, 0, 0]} />
          <Bar dataKey="newU" name={t.newU} stackId="a" fill="#93C5FD" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 12, color: '#6B7280' }}>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#93C5FD', borderRadius: 2, marginRight: 4 }} />{t.newU}</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#2563EB', borderRadius: 2, marginRight: 4 }} />{t.retU}</span>
      </div>
    </div>
  )
}

// 언바운드 리텐션 커브 — D0~D14 활성 비율 라인 차트(recharts).
function RetentionCurveChart({ curve }) {
  const data = (curve || []).filter(p => p.rate != null)
    .map(p => ({ day: `D${p.day}`, rate: parseFloat(p.rate), retained: p.retained, eligible: p.eligible }))
  if (!data.length) return <div style={{ color: '#9CA3AF', fontSize: 13 }}>—</div>
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 12, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="day" fontSize={12} />
        <YAxis fontSize={12} unit="%" domain={[0, 100]} />
        <Tooltip formatter={(v, n, p) => [`${v}% (${p.payload.retained}/${p.payload.eligible})`, '잔존']} />
        <Line type="linear" dataKey="rate" stroke="#ff4400" strokeWidth={2.5}
          dot={false} activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

// 그로스 어카운팅 — 주간 WAU 분해 스택 막대(이탈은 음수, recharts).
function GrowthChart({ weeks, t }) {
  if (!weeks || !weeks.length) return <div style={{ color: '#9CA3AF', fontSize: 13 }}>{t.noData}</div>
  const data = weeks.map(w => ({
    week: w.week.slice(5), retained: w.retained, new: w.new, resurrected: w.resurrected, churned: -w.churned, qr: w.quickRatio,
  }))
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 0 }} stackOffset="sign">
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis dataKey="week" fontSize={12} />
        <YAxis fontSize={12} allowDecimals={false} />
        <Tooltip cursor={{ fill: '#f9fafb' }} formatter={(v, n) => [Math.abs(v), n]} />
        <ReferenceLine y={0} stroke="#9CA3AF" />
        <Bar dataKey="retained" name={t.gwRet} stackId="a" fill="#2563EB" />
        <Bar dataKey="new" name={t.gwNew} stackId="a" fill="#10B981" />
        <Bar dataKey="resurrected" name={t.gwRes} stackId="a" fill="#0EA5E9" />
        <Bar dataKey="churned" name={t.gwChurn} stackId="a" fill="#EF4444" radius={[0, 0, 3, 3]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// 그로스 어카운팅 — 주간 WAU 분해 표(신규/유지/부활/이탈 + Quick Ratio).
function GrowthTable({ weeks, t }) {
  if (!weeks || !weeks.length) return <div style={{ color: '#9CA3AF', fontSize: 13 }}>{t.noData}</div>
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead><tr>
          <th style={thStyle}>{t.gwWeek}</th>
          <th style={{ ...thStyle, textAlign: 'right' }}>{t.gwNew}</th>
          <th style={{ ...thStyle, textAlign: 'right' }}>{t.gwRet}</th>
          <th style={{ ...thStyle, textAlign: 'right' }}>{t.gwRes}</th>
          <th style={{ ...thStyle, textAlign: 'right' }}>{t.gwChurn}</th>
          <th style={{ ...thStyle, textAlign: 'right' }}>{t.gwWau}</th>
          <th style={{ ...thStyle, textAlign: 'right' }}>{t.gwQr}</th>
        </tr></thead>
        <tbody>
          {weeks.map((w, i) => (
            <tr key={w.week} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 ? '#fafafa' : '#fff' }}>
              <td style={{ ...tdStyle, fontWeight: 500 }}>{w.week}</td>
              <td style={{ ...tdStyle, textAlign: 'right', color: '#10B981', fontWeight: 600 }}>+{w.new}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{w.retained}</td>
              <td style={{ ...tdStyle, textAlign: 'right', color: '#0EA5E9' }}>+{w.resurrected}</td>
              <td style={{ ...tdStyle, textAlign: 'right', color: '#EF4444' }}>-{w.churned}</td>
              <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>{w.wau}</td>
              <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: w.quickRatio == null ? '#ccc' : parseFloat(w.quickRatio) >= 1 ? '#10B981' : '#EF4444' }}>{w.quickRatio ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
