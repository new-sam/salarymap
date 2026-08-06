import { useState } from 'react'
import { useAdmin } from '../../lib/adminSwr'

// 리텐션 전용 탭 — 전체 서비스(웹+앱) 가입 유저 기준.
// 데이터: /api/admin/retention (활성 = user_id 이벤트 1건+, unbounded 정의 — 앱 대시보드와 동일).
// 플랫폼 토글은 '활성' 축만 필터한다(가입 분모엔 플랫폼 없음).

// 앱 대시보드 코호트 표와 동일한 히트 셀 색 규칙.
function rateColor(r) {
  const v = parseFloat(r); if (isNaN(v)) return '#ccc'
  if (v >= 50) return '#065F46'; if (v >= 30) return '#10B981'; if (v >= 15) return '#F59E0B'; return '#EF4444'
}
function rateBg(r) {
  const v = parseFloat(r); if (isNaN(v)) return '#f9fafb'
  if (v >= 50) return '#D1FAE5'; if (v >= 30) return '#ECFDF5'; if (v >= 15) return '#FFFBEB'; return '#FEF2F2'
}

const thStyle = { padding: '8px 12px', textAlign: 'left', fontSize: 12, color: '#6B7280', fontWeight: 600, borderBottom: '1px solid #E5E8EB', whiteSpace: 'nowrap' }
const tdStyle = { padding: '8px 12px', fontSize: 13, color: '#111827' }
const sectionStyle = { background: '#fff', border: '1px solid #E5E8EB', borderRadius: 12, padding: '18px 20px', marginBottom: 18 }
const sectionTitle = { fontSize: 15, fontWeight: 700, margin: '0 0 12px', color: '#0F172A' }

export default function RetentionView({ token, lang }) {
  const ko = lang === 'ko'
  const L = (k, e, v) => (lang === 'vi' ? (v ?? e) : ko ? k : e)
  const [platform, setPlatform] = useState('all')
  const { data, isLoading } = useAdmin(`/api/admin/retention?platform=${platform}`, token)

  if (isLoading || !data) return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>{L('불러오는 중…', 'Loading…', 'Đang tải…')}</div>
  if (data.error) return <div style={{ textAlign: 'center', padding: 40, color: '#c00' }}>{data.error}</div>

  const { meta, summary, curve, cohorts, features = [] } = data

  // API FEATURE_RULES 의 key 와 1:1 — 새 그룹을 API에 추가하면 여기 라벨도 추가.
  const FEATURE_LABELS = {
    jobs: ['공고 탐색·지원', 'Jobs browse & apply', 'Xem & ứng tuyển việc làm'],
    salary: ['연봉 위저드·조회', 'Salary wizard & lookup', 'Tra cứu lương'],
    cv: ['CV·이력서', 'CV & resume', 'CV & hồ sơ'],
    community: ['커뮤니티', 'Community', 'Cộng đồng'],
    ktc: ['KTC', 'KTC', 'KTC'],
    profile: ['프로필', 'Profile', 'Hồ sơ cá nhân'],
    quiz: ['한국어 퀴즈', 'Korean quiz', 'Quiz tiếng Hàn'],
    photo: ['사진 등록', 'Photo upload', 'Tải ảnh'],
    card: ['디지털 명함', 'Digital card', 'Danh thiếp số'],
    coldmail: ['콜드메일 랜딩 반응', 'Coldmail landing actions', 'Tương tác landing coldmail'],
    push: ['알림·푸시', 'Notifications & push', 'Thông báo & push'],
    other: ['기타(미분류)', 'Other (unmapped)', 'Khác (chưa phân loại)'],
  }
  const featName = (key) => {
    const l = FEATURE_LABELS[key] || [key, key, key]
    return lang === 'vi' ? l[2] : ko ? l[0] : l[1]
  }

  const card = (label, value, sub) => (
    <div style={{ background: '#fff', border: '1px solid #E5E8EB', borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 4 }}>{sub}</div>}
    </div>
  )
  const dCard = (label, c) => card(label, c && c.rate != null ? `${c.rate}%` : '-', c ? `${c.retained}/${c.eligible}` : null)

  const PLATFORMS = [
    { key: 'all', label: L('전체', 'All', 'Tất cả') },
    { key: 'web', label: L('웹', 'Web', 'Web') },
    { key: 'app', label: L('앱', 'App', 'App') },
  ]

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* 헤더 + 플랫폼 토글 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 4px' }}>{L('리텐션', 'Retention', 'Giữ chân')}</h3>
          <div style={{ fontSize: 12.5, color: '#6B7280' }}>
            {L(
              `가입 유저(웹+앱) 기준 · 활성 = 이벤트 1건+ · 데이터 시작 ${meta.dataStart} (이전 가입자는 코호트 제외)`,
              `Signed-up users (web+app) · active = 1+ event · data since ${meta.dataStart} (earlier signups excluded from cohorts)`,
              `Người dùng đã đăng ký (web+app) · hoạt động = 1+ sự kiện · dữ liệu từ ${meta.dataStart} (đăng ký trước đó không tính vào cohort)`
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {PLATFORMS.map(p => (
            <button key={p.key} onClick={() => setPlatform(p.key)} style={{
              padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              border: `1px solid ${platform === p.key ? '#ff6000' : '#E5E8EB'}`,
              background: platform === p.key ? '#FFF3EB' : '#fff',
              color: platform === p.key ? '#ff6000' : '#6B7280',
            }}>{p.label}</button>
          ))}
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="adm-m-2col" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 18 }}>
        {card('DAU', summary.dau, L('오늘(VN)', 'today (VN)', 'hôm nay (VN)'))}
        {card('WAU', summary.wau, L('최근 7일', 'last 7d', '7 ngày qua'))}
        {card('MAU', summary.mau, L('최근 30일', 'last 30d', '30 ngày qua'))}
        {card(L('스티키니스', 'Stickiness', 'Độ gắn bó'), summary.dauMau != null ? `${summary.dauMau}%` : '-', `DAU/MAU · WAU/MAU ${summary.wauMau ?? '-'}%`)}
        {dCard('D1', summary.d1)}
        {dCard('D7', summary.d7)}
        {dCard('D30', summary.d30)}
      </div>

      {/* 언바운드 리텐션 커브 — 표+미니바 */}
      <div style={sectionStyle}>
        <h3 style={sectionTitle}>{L('언바운드 리텐션 커브', 'Unbounded retention curve', 'Đường cong giữ chân (unbounded)')}</h3>
        <div className="adm-m-scroll">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={thStyle}>{L('가입 후', 'Day', 'Sau đăng ký')}</th>
              <th style={{ ...thStyle, width: '55%' }}>{L('유지율', 'Retained %', 'Tỷ lệ giữ')}</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>{L('유지/대상', 'Retained/eligible', 'Giữ/đủ điều kiện')}</th>
            </tr></thead>
            <tbody>
              {curve.map(c => (
                <tr key={c.day} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ ...tdStyle, fontWeight: 600, whiteSpace: 'nowrap' }}>D{c.day}</td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 8, background: '#F3F4F6', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, c.rate ?? 0)}%`, height: '100%', background: '#ff6000', borderRadius: 4 }} />
                      </div>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: rateColor(c.rate), minWidth: 44, textAlign: 'right' }}>{c.rate != null ? `${c.rate}%` : '-'}</span>
                    </div>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: '#6B7280', fontSize: 12, whiteSpace: 'nowrap' }}>{c.retained}/{c.eligible}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 10 }}>
          {L(
            '가입 N일째 이후에도 활동한 비율(unbounded). D0 = 가입 당일 활동 — 낮으면 계측 커버리지 문제. 평평해지는 지점 = 충성 코어.',
            '% still active on/after day N (unbounded). D0 = activity on signup day — low D0 means instrumentation gaps. Flattening point = loyal core.',
            '% còn hoạt động từ ngày N trở đi (unbounded). D0 = hoạt động ngày đăng ký. Điểm đi ngang = nhóm trung thành.'
          )}
        </div>
      </div>

      {/* 기능별 사용 — 어떤 기능이 잘 쓰이는지(최근 30일, 사용 유저 기준 랭킹) */}
      <div style={sectionStyle}>
        <h3 style={sectionTitle}>{L(`기능별 사용 (최근 ${meta.featureWindow}일)`, `Feature usage (last ${meta.featureWindow}d)`, `Sử dụng tính năng (${meta.featureWindow} ngày qua)`)}</h3>
        <div className="adm-m-scroll">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={thStyle}>{L('기능', 'Feature', 'Tính năng')}</th>
              <th style={{ ...thStyle, width: '32%' }}>{L('사용 유저 (MAU 대비)', 'Users (vs MAU)', 'Người dùng (so với MAU)')}</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>{L('재사용률', 'Repeat use', 'Dùng lại')}</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>{L('D7 사용/미사용', 'D7 used/not', 'D7 dùng/không')}</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>{L('이벤트', 'Events', 'Sự kiện')}</th>
              <th style={thStyle}>{L('주요 이벤트', 'Top events', 'Sự kiện chính')}</th>
            </tr></thead>
            <tbody>
              {features.map(f => {
                const share = summary.mau > 0 ? Math.round((f.users / summary.mau) * 100) : 0
                return (
                  <tr key={f.key} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ ...tdStyle, fontWeight: 600, whiteSpace: 'nowrap' }}>{featName(f.key)}</td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 8, background: '#F3F4F6', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, share)}%`, height: '100%', background: '#ff6000', borderRadius: 4 }} />
                        </div>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0F172A', minWidth: 90, textAlign: 'right', whiteSpace: 'nowrap' }}>{f.users.toLocaleString()} · {share}%</span>
                      </div>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 600, color: rateColor(f.repeatRate), whiteSpace: 'nowrap' }}>{f.repeatRate != null ? `${f.repeatRate}%` : '-'}</td>
                    <td style={{ ...tdStyle, textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <span style={{ fontWeight: 700, color: f.d7Used != null && f.d7NonUsed != null && f.d7Used > f.d7NonUsed ? '#065F46' : '#0F172A' }}>{f.d7Used != null ? `${f.d7Used}%` : '-'}</span>
                      <span style={{ color: '#9CA3AF' }}> / {f.d7NonUsed != null ? `${f.d7NonUsed}%` : '-'}</span>
                      <div style={{ fontSize: 10, fontWeight: 400, color: '#9CA3AF' }}>n={f.d7UsedN}</div>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: '#6B7280', fontSize: 12, whiteSpace: 'nowrap' }}>{f.events.toLocaleString()}</td>
                    <td style={{ ...tdStyle, fontSize: 11.5, color: '#9CA3AF' }}>
                      {f.top.map(t => `${t.event} ${t.users}`).join(' · ')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 10 }}>
          {L(
            '가입 유저(user_id) 이벤트만 집계 — 비로그인 사용은 미포함. 발송 마커·크론 제외. 재사용률 = 30일 내 2일 이상 사용한 유저 비율. D7 사용/미사용 = 가입 첫 7일 내 그 기능을 쓴 유저 vs 안 쓴 유저의 D7 유지율(가입 7일 경과 코호트, n=사용측 표본) — 상관이지 인과 아님. 주요 이벤트 숫자 = 사용 유저 수.',
            'Signed-in (user_id) events only — anonymous usage not counted. Send markers & crons excluded. Repeat use = % using on 2+ days within 30d. D7 used/not = D7 retention of users who used the feature in their first 7 days vs those who did not (cohort aged 7+ days, n = used-side sample) — correlation, not causation. Top-event numbers = unique users.',
            'Chỉ tính sự kiện user_id (không gồm khách ẩn danh). Dùng lại = % dùng từ 2 ngày trở lên trong 30 ngày. D7 dùng/không = tỷ lệ giữ chân D7 của người dùng tính năng trong 7 ngày đầu so với người không dùng — tương quan, không phải nhân quả.'
          )}
        </div>
      </div>

      {/* 주간 코호트 삼각표 */}
      <div style={sectionStyle}>
        <h3 style={sectionTitle}>{L('주간 코호트 리텐션', 'Weekly cohort retention', 'Giữ chân theo cohort tuần')}</h3>
        <div className="adm-m-scroll">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr>
              <th style={thStyle}>{L('가입 주차', 'Signup week', 'Tuần đăng ký')}</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>{L('가입', 'Users', 'Đăng ký')}</th>
              {Array.from({ length: meta.weekOffsets + 1 }, (_, i) => (
                <th key={i} style={{ ...thStyle, textAlign: 'center' }}>W{i}</th>
              ))}
            </tr></thead>
            <tbody>
              {cohorts.map((c, i) => (
                <tr key={c.week} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 ? '#fafafa' : '#fff' }}>
                  <td style={{ ...tdStyle, fontWeight: 500, whiteSpace: 'nowrap' }}>{c.week}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{c.size}</td>
                  {c.cells.map((cell, ci) => (
                    <td key={ci} style={{ ...tdStyle, textAlign: 'center', fontWeight: 600, background: cell ? rateBg(cell.rate) : '#f9fafb', color: cell ? rateColor(cell.rate) : '#ccc', whiteSpace: 'nowrap' }}>
                      {cell ? `${cell.rate ?? 0}%${cell.partial ? '*' : ''}` : '-'}
                      {cell && <div style={{ fontSize: 10, fontWeight: 400, color: '#9CA3AF' }}>{cell.active}/{c.size}</div>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 10 }}>
          {L(
            'W0 = 가입한 그 주 활동. 캘린더 주(월요일 시작, VN) 기준 — 그 주에 이벤트 1건이라도 있으면 유지. * = 진행 중인 주(부분 집계).',
            'W0 = activity in signup week. Calendar weeks (Mon-start, VN) — retained if 1+ event that week. * = current week (partial).',
            'W0 = hoạt động trong tuần đăng ký. Tuần lịch (bắt đầu thứ Hai, VN). * = tuần hiện tại (chưa trọn).'
          )}
        </div>
      </div>

      <div style={{ fontSize: 11.5, color: '#9CA3AF' }}>
        {L(
          `내부/정지 계정 제외 · 모집단 ${meta.cohortUsers.toLocaleString()}명 (전체 ${meta.totalUsers.toLocaleString()}명 중 ${meta.dataStart} 이후 가입) · 플랫폼 토글은 활성 축만 필터(가입엔 플랫폼 정보 없음)`,
          `Internal/banned accounts excluded · cohort population ${meta.cohortUsers.toLocaleString()} (of ${meta.totalUsers.toLocaleString()}, signed up since ${meta.dataStart}) · platform toggle filters the activity axis only`,
          `Loại tài khoản nội bộ/bị khóa · quần thể cohort ${meta.cohortUsers.toLocaleString()} (trong ${meta.totalUsers.toLocaleString()}, đăng ký từ ${meta.dataStart}) · bộ lọc nền tảng chỉ áp dụng cho trục hoạt động`
        )}
      </div>
    </div>
  )
}
