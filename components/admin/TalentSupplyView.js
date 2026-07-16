import { useState } from 'react'
import { useAdmin } from '../../lib/adminSwr'

// 인재 공급(Talent supply) — FYI 인재풀을 포지션(직군)으로 분해한 스냅샷.
// 기업 고객의 수요 포지션 대비 우리 공급이 어디에 몰려 있고 어디가 비었는지 매일 확인.
// 데이터: /api/admin/talent-supply (전체 프로필 → 이력서 → 활성, 직군별).

const GROUP_LABEL = {
  tech: { ko: '개발 직군', en: 'Tech' },
  product: { ko: '개발 직군', en: 'Tech' },
  nontech: { ko: '비개발 직군', en: 'Non-tech' },
  other: { ko: '미분류', en: 'Other' },
}
// 개발/비개발/미분류 색 — 공급 편중을 한눈에.
const GROUP_COLOR = { tech: '#2563EB', product: '#2563EB', nontech: '#0D9488', other: '#94A3B8' }

export default function TalentSupplyView({ token, lang }) {
  const ko = lang !== 'en'
  const { data, isLoading } = useAdmin('/api/admin/talent-supply', token)
  const [showUncat, setShowUncat] = useState(false)

  if (isLoading || !data) return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>{ko ? '불러오는 중…' : 'Loading…'}</div>
  if (data.error) return <div style={{ textAlign: 'center', padding: 40, color: '#c00' }}>{data.error}</div>

  const { totals, categories, unknown, split, uncategorized } = data
  const rows = [...categories]
  if (unknown.all > 0) rows.push({ key: '_unknown', ko: '포지션 미입력', en: 'No position', group: 'other', ...unknown })
  const maxAll = Math.max(1, ...rows.map(r => r.all))
  const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : 0)

  const stat = (label, value, sub) => (
    <div style={{ background: '#fff', border: '1px solid #E5E8EB', borderRadius: 12, padding: '14px 16px', minWidth: 130 }}>
      <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 4 }}>{sub}</div>}
    </div>
  )

  function downloadCsv() {
    const headers = ['Category', 'Group', 'All', 'Resume', 'Resume public', 'Active(resume)']
    const body = rows.map(r => [ko ? r.ko : r.en, GROUP_LABEL[r.group][ko ? 'ko' : 'en'], r.all, r.resume, r.resumePublic ?? '', r.active])
    const csv = [headers, ...body].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `talent-supply-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  // 개발/비개발 공급 비중 (미분류 제외한 분모)
  const classified = split.tech.all + split.nontech.all
  const techPct = pct(split.tech.all, classified)
  const nontechPct = pct(split.nontech.all, classified)

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* 헤더 + CSV */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
        <div>
          <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 4px' }}>{ko ? '인재 공급 구성' : 'Talent supply mix'}</h3>
          <div style={{ fontSize: 12.5, color: '#6B7280' }}>
            {ko
              ? '등록 인재풀을 직군으로 분해한 스냅샷 — 기업 수요 포지션 대비 공급 확인용. 매일 갱신.'
              : 'Snapshot of the talent pool by role — supply vs. company demand. Refreshes daily.'}
          </div>
        </div>
        <button onClick={downloadCsv} style={{ padding: '8px 16px', border: 'none', borderRadius: 8, fontSize: 13, background: '#ff6000', color: '#fff', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>
          {ko ? 'CSV 다운로드' : 'Download CSV'}
        </button>
      </div>

      {/* 퍼널 요약 카드 */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '14px 0 18px' }}>
        {stat(ko ? '전체 프로필' : 'Profiles', totals.profiles, ko ? `포지션 입력 ${totals.withPosition} (${pct(totals.withPosition, totals.profiles)}%)` : `${pct(totals.withPosition, totals.profiles)}% w/ position`)}
        {stat(ko ? '이력서 등록' : 'Resume', totals.resumeHolders, `${pct(totals.resumeHolders, totals.profiles)}% · ${ko ? '공개' : 'public'} ${totals.resumePublic}`)}
        {stat(ko ? '활성 (전체)' : 'Active (all)', totals.activeAll, ko ? '7일 방문·지원·반복' : '7d visit / applied / repeat')}
        {stat(ko ? '활성 이력서' : 'Active w/ resume', totals.activeResume, `${pct(totals.activeResume, totals.resumeHolders)}% ${ko ? '이력서 중' : 'of resumes'}`)}
      </div>

      {/* 개발 vs 비개발 공급 비중 — 수요·공급 갭 핵심 신호 */}
      <div style={{ background: '#FAFBFC', border: '1px solid #EEF0F2', borderRadius: 12, padding: '14px 16px', marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
          <span>{ko ? '공급 편중 (포지션 입력자 기준)' : 'Supply skew (positions declared)'}</span>
          <span style={{ color: '#9CA3AF', fontWeight: 500 }}>
            {ko ? '개발' : 'Tech'} {split.tech.all} · {ko ? '비개발' : 'Non-tech'} {split.nontech.all} · {ko ? '미분류' : 'Other'} {split.other.all}
          </span>
        </div>
        <div style={{ display: 'flex', height: 22, borderRadius: 6, overflow: 'hidden', border: '1px solid #E5E8EB' }}>
          <div style={{ width: `${techPct}%`, background: '#2563EB', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{techPct >= 8 ? `${ko ? '개발' : 'Tech'} ${techPct}%` : ''}</div>
          <div style={{ width: `${nontechPct}%`, background: '#0D9488', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{nontechPct >= 8 ? `${ko ? '비개발' : 'Non-tech'} ${nontechPct}%` : ''}</div>
        </div>
        <div style={{ fontSize: 12, color: '#6B7280', marginTop: 8, lineHeight: 1.5 }}>
          {ko
            ? `비개발 직군 공급은 전체의 ${nontechPct}%뿐입니다. 기업 수요가 비개발(예: HR·영업·마케팅) 포지션이면 해당 직군 인재 확보(메타 타겟팅)가 필요합니다.`
            : `Non-tech roles are only ${nontechPct}% of declared supply. If client demand is non-tech (e.g. HR/Sales/Marketing), acquire that segment (Meta targeting).`}
        </div>
      </div>

      {/* 직군별 퍼널 테이블 */}
      <div className="adm-m-scroll" style={{ border: '1px solid #E5E8EB', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#F8FAFC', color: '#475569' }}>
              <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600 }}>{ko ? '직군' : 'Role'}</th>
              <th style={{ textAlign: 'right', padding: '10px 10px', fontWeight: 600 }}>{ko ? '전체' : 'All'}</th>
              <th style={{ textAlign: 'left', padding: '10px 10px', fontWeight: 600, width: '32%' }}>{ko ? '비중' : 'Share'}</th>
              <th style={{ textAlign: 'right', padding: '10px 10px', fontWeight: 600 }}>{ko ? '이력서' : 'Resume'}</th>
              <th style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 600 }}>{ko ? '활성' : 'Active'}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.key} style={{ borderTop: '1px solid #F1F5F9' }}>
                <td style={{ padding: '9px 14px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: GROUP_COLOR[r.group], flexShrink: 0 }} />
                    <span style={{ fontWeight: 600, color: '#0F172A' }}>{ko ? r.ko : r.en}</span>
                    <span style={{ fontSize: 10.5, color: '#9CA3AF' }}>{GROUP_LABEL[r.group][ko ? 'ko' : 'en']}</span>
                  </span>
                </td>
                <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 700, color: '#0F172A' }}>{r.all}</td>
                <td style={{ padding: '9px 10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 8, background: '#F1F5F9', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${(r.all / maxAll) * 100}%`, height: '100%', background: GROUP_COLOR[r.group], borderRadius: 4 }} />
                    </div>
                    <span style={{ fontSize: 11.5, color: '#6B7280', width: 34, textAlign: 'right' }}>{pct(r.all, totals.profiles)}%</span>
                  </div>
                </td>
                <td style={{ padding: '9px 10px', textAlign: 'right', color: '#374151' }}>{r.resume}</td>
                <td style={{ padding: '9px 14px', textAlign: 'right', color: r.active > 0 ? '#ff6000' : '#CBD5E1', fontWeight: 600 }}>{r.active}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 미분류 원본 값 검수 */}
      {uncategorized.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <button onClick={() => setShowUncat(v => !v)} style={{ background: 'none', border: 'none', color: '#6B7280', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
            {showUncat ? '▾' : '▸'} {ko ? `미분류 원본 값 ${uncategorized.length}종` : `${uncategorized.length} uncategorized raw values`}
          </button>
          {showUncat && (
            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {uncategorized.map(u => (
                <span key={u.value} style={{ fontSize: 11.5, padding: '3px 9px', background: '#F1F5F9', borderRadius: 999, color: '#475569' }}>
                  {u.value} <b style={{ color: '#0F172A' }}>{u.count}</b>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 14, lineHeight: 1.5 }}>
        {ko
          ? '활성 = 최근 7일 방문 · 채용 지원 · 반복 방문(2일+) 중 하나(로그인 식별 이벤트 기준). 포지션 값은 자유입력이 섞여 휴리스틱으로 표준 직군에 매핑됩니다.'
          : 'Active = 7-day visit, job application, or repeat visit (2+ days), based on login-identified events. Position values are heuristically mapped to standard roles.'}
      </div>
    </div>
  )
}
