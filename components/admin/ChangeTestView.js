import { useAdmin } from '../../lib/adminSwr'
import { sectionStyle } from '../../constants/dashboard'

/* 변경 테스트 — "바꾼 게 먹혔나"를 재는 탭. 상시 퍼널(이력서 이탈 / KTC 유입)과 달리
   특정 변경에 딸린 한시적 측정이라 여기 모아둔다. 판정이 끝난 항목은 지운다.

   지금 두 건 모두 히어로 CTA 존치 판정이다. 핵심은 도달 수가 아니라 도달 이후
   전환율이다 — 버튼이 아직 준비 안 된 사람을 끌고 내려온 것이라면 도달은 늘고
   전환은 떨어진다. 그래서 경로별 전환율을 나란히 놓고 본다. */

const TESTS = [
  {
    target: 'cv',
    title: ['/cv 히어로 "바로 등록하기"', '/cv hero CTA'],
    question: ['버튼 없이도 등록 폼까지 내려오는가? 버튼으로 온 사람이 더 잘 등록하는가?',
               'Do people reach the form without the button — and do button-clickers convert better?',
               'Người dùng có tự đến form không, và nhóm nhấn nút có chuyển đổi tốt hơn?'],
    viewLabel: ['CV 페이지 뷰', 'CV views', 'Lượt xem CV'],
    reachLabel: ['등록 폼 도달', 'reached form', 'đến form'],
    cols: [
      { event: 'cv_attach_file', label: ['→ 첨부', '→ Attach', '→ Đính kèm'] },
      { event: 'cv_oauth_start', label: ['→ 로그인', '→ Login', '→ Login'] },
      { event: 'cv_register_success', label: ['→ 등록완료', '→ Done', '→ Xong'] },
    ],
  },
  {
    target: 'ktc',
    title: ['/ktc 히어로 "지금 지원하기"', '/ktc hero CTA'],
    question: ['준비중 모달을 공고 이동으로 바꾼 뒤(6e24eb3), 랜딩 유입이 실제로 공고까지 가는가?',
               'After the button switched from a coming-soon modal to scrolling to jobs, does landing traffic reach the jobs?',
               'Sau khi nút chuyển từ modal sang cuộn tới danh sách việc làm, traffic có đến được không?'],
    viewLabel: ['KTC 페이지 뷰', 'KTC views', 'Lượt xem KTC'],
    reachLabel: ['공고 섹션 도달', 'reached jobs', 'đến danh sách'],
    cols: [
      { event: 'ktc_job_click', label: ['→ 공고 클릭', '→ Job click', '→ Nhấn tin'] },
      { event: 'submit_application', label: ['→ 지원', '→ Applied', '→ Ứng tuyển'] },
    ],
  },
]

const VIA_ROWS = [
  { key: 'hero', label: ['히어로 CTA', 'Hero CTA', 'CTA hero'],
    desc: ['첫 화면 버튼을 눌러서 내려옴', 'Clicked the hero button', 'Nhấn nút ở hero'] },
  { key: 'nav', label: ['섹션 탭', 'Section tab', 'Tab mục'],
    desc: ['상단 섹션 탭바로 이동 (/ktc 만)', 'Via the section tab bar (/ktc only)', 'Qua thanh tab (/ktc)'] },
  { key: 'scrolldown', label: ['스크롤다운 버튼', 'Scroll-down button', 'Nút cuộn xuống'],
    desc: ['하단 화살표 버튼 (/cv 만)', 'Via the bottom arrow (/cv only)', 'Qua nút mũi tên (/cv)'] },
  { key: 'scroll', label: ['직접 스크롤', 'Own scrolling', 'Tự cuộn'],
    desc: ['아무것도 안 누르고 내려옴', 'Scrolled without any button', 'Không nhấn gì'] },
]

const fmt = (n) => (n === null || n === undefined ? '—' : n.toLocaleString())
const pct = (a, b, digits = 1) => (b > 0 ? ((a / b) * 100).toFixed(digits) : null)

function TestCard({ test, token, range, L }) {
  const { data, error, isLoading } = useAdmin(`/api/admin/hero-test?target=${test.target}&${range}`, token)
  const total = data?.byVia?.total
  // 값이 0인 경로는 줄만 차지한다 — 페이지마다 존재하는 경로가 다르기도 하고(/cv 는 nav 없음).
  const rows = VIA_ROWS.filter(r => (data?.byVia?.[r.key]?.reached || 0) > 0)

  return (
    <div style={{ ...sectionStyle, marginBottom: 12 }}>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: '#333', marginBottom: 3 }}>{L(...test.title)}</div>
      <div style={{ fontSize: 11.5, color: '#8B95A1', marginBottom: 12, lineHeight: 1.7 }}>{L(...test.question)}</div>

      {error ? (
        <div style={{ color: '#c00', fontSize: 12.5 }}>{error.message}</div>
      ) : isLoading && !data ? (
        <div style={{ color: '#999', fontSize: 12.5 }}>{L('불러오는 중…', 'Loading…', 'Đang tải…')}</div>
      ) : !total?.reached ? (
        <div style={{ color: '#8B95A1', fontSize: 12.5, lineHeight: 1.7 }}>
          {L('아직 데이터가 없다 — 이 계측은 이번 배포부터 쌓이므로 배포 이전 기간은 0으로 보이는 게 정상이다.',
             'No data yet — this instrumentation starts with the current deploy, so earlier ranges read 0.',
             'Chưa có dữ liệu — đo lường này bắt đầu từ lần triển khai hiện tại.')}
        </div>
      ) : (
        <>
          <div style={{ fontSize: 11.5, color: '#8B95A1', marginBottom: 10 }}>
            {L(...test.viewLabel)} <b style={{ color: '#191F28' }}>{fmt(data.viewers)}</b>
            {' → '}{L(...test.reachLabel)} <b style={{ color: '#191F28' }}>{fmt(data.reached)}</b>
            {data.viewers > 0 && ` (${pct(data.reached, data.viewers)}%)`}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 480 }}>
              <thead>
                <tr style={{ color: '#8B95A1', fontSize: 11, textAlign: 'right' }}>
                  <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600 }}>{L('도달 경로', 'Path', 'Đường')}</th>
                  <th style={{ padding: '6px 8px', fontWeight: 600 }}>{L('도달', 'Reached', 'Đến')}</th>
                  <th style={{ padding: '6px 8px', fontWeight: 600 }}>{L('비중', 'Share', 'Tỷ trọng')}</th>
                  {test.cols.map(cl => (
                    <th key={cl.event} style={{ padding: '6px 8px', fontWeight: 600 }}>{L(...cl.label)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const v = data.byVia[r.key]
                  return (
                    <tr key={r.key} style={{ borderTop: '1px solid #f1f3f5' }}>
                      <td style={{ padding: '9px 8px' }}>
                        <div style={{ fontWeight: 700, color: '#333' }}>{L(...r.label)}</div>
                        <div style={{ fontSize: 10.5, color: '#8B95A1', marginTop: 2 }}>{L(...r.desc)}</div>
                      </td>
                      <td style={{ padding: '9px 8px', textAlign: 'right', fontWeight: 700 }}>{fmt(v.reached)}</td>
                      <td style={{ padding: '9px 8px', textAlign: 'right', color: '#8B95A1' }}>{pct(v.reached, total.reached)}%</td>
                      {test.cols.map(cl => (
                        <td key={cl.event} style={{ padding: '9px 8px', textAlign: 'right' }}>{pct(v[cl.event], v.reached)}%</td>
                      ))}
                    </tr>
                  )
                })}
                <tr style={{ borderTop: '2px solid #e5e8eb', background: '#fafbfc' }}>
                  <td style={{ padding: '9px 8px', fontWeight: 700, color: '#333' }}>{L('전체', 'Total', 'Tổng')}</td>
                  <td style={{ padding: '9px 8px', textAlign: 'right', fontWeight: 700 }}>{fmt(total.reached)}</td>
                  <td style={{ padding: '9px 8px', textAlign: 'right', color: '#8B95A1' }}>100%</td>
                  {test.cols.map(cl => (
                    <td key={cl.event} style={{ padding: '9px 8px', textAlign: 'right' }}>{pct(total[cl.event], total.reached)}%</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

export default function ChangeTestView({ token, lang, dateRange }) {
  const L = (ko, en, vi) => (lang === 'vi' ? (vi ?? en) : lang === 'ko' ? ko : en)
  const range = `from=${dateRange.from}&to=${dateRange.to}`

  return (
    <>
      <div style={{ fontSize: 12, color: '#8B95A1', marginBottom: 12 }}>
        {dateRange.from} ~ {dateRange.to} · {L('client_id 단위 · 사람당 첫 도달만 집계',
          'Per client_id · first arrival per person only', 'Theo client_id · chỉ tính lần đến đầu tiên')}
      </div>

      {TESTS.map(t => <TestCard key={t.target} test={t} token={token} range={range} L={L} />)}

      <div style={{ fontSize: 11, color: '#8B95A1', lineHeight: 1.8, marginBottom: 24 }}>
        <b style={{ color: '#C2452B' }}>{L('읽는 법', 'How to read', 'Cách đọc')}</b>
        {L(' — 히어로 CTA 의 도달 비중이 낮다면 버튼 없이도 사람들이 내려온다는 뜻이라 제거 후보다. 비중이 높더라도 히어로 경로의 전환율이 직접 스크롤보다 낮으면, 버튼이 아직 마음을 정하지 않은 사람을 끌고 내려오고 있다는 신호다. 반대로 전환율까지 높으면 의도 있는 사람을 빨리 보내준 것이니 유지한다. 전환율은 각 경로의 도달자 대비이며, 도달 이후에 발생한 이벤트만 센다.',
           ' — A low hero share means people get there without the button (removal candidate). Even with a high share, if the hero path converts worse than own-scrolling, the button is dragging down undecided visitors. If it converts better, it is fast-tracking intent — keep it. Rates are against each path’s own arrivals, counting only events after arrival.',
           ' — Tỷ trọng hero thấp nghĩa là người dùng tự đến được. Nếu tỷ lệ chuyển đổi của hero thấp hơn tự cuộn, nút đang kéo xuống những người chưa sẵn sàng.')}
      </div>
    </>
  )
}