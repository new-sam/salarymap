import { useEffect, useState } from 'react'
import { ROLE_GROUPS, roleGroupKey, TYPE_OPTIONS, TECH_OPTIONS } from '../../constants/jobs'

// 공고 필터 모달 — 드롭다운 4개(직무/경력/근무형태/기술)를 하나의 모달로 통합.
// 앱(salary-fyi) /jobs/filter 페이지와 같은 구조: 좌측 탭 → 우측 옵션, 하단에
// "공고 N건 보기"가 조건을 만질 때마다 실시간 갱신되고, 눌러야 목록에 적용된다
// (배경 클릭/ESC로 닫으면 변경 폐기 — 실수로 만진 조건이 목록을 안 흔들게).
// 직무/근무형태/기술은 다중선택(섹션 안 OR). roles 항목은 소분류 value 또는
// 'cat:<대분류>'(그룹 전체) — 페이지 matchesJobFilters와 같은 의미.
const EMPTY = { roles: [], types: [], techs: [], expMin: '', expMax: '' }
const TABS = ['role', 'exp', 'type', 'tech']

// 배열 토글(있으면 빼고 없으면 넣기).
const toggled = (list, v) => (list.includes(v) ? list.filter(x => x !== v) : [...list, v])

export default function JobFilterModal({ open, initial, countWith, onApply, onClose, typeLabel, t, lang }) {
  const [draft, setDraft] = useState(EMPTY)
  const [tab, setTab] = useState('role')
  const [cat, setCat] = useState(ROLE_GROUPS[0].key)

  // 열릴 때마다 현재 적용값으로 초기화 + 첫 선택 소분류의 대분류를 미리 펼친다.
  useEffect(() => {
    if (!open) return
    setDraft({ ...EMPTY, ...initial })
    setTab('role')
    const first = (initial?.roles || []).find(r => !r.startsWith('grp:'))
    const k = first ? (first.startsWith('cat:') ? first.slice(4) : roleGroupKey(first)) : null
    if (k) setCat(k)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial은 매 렌더 새 객체라 open 전환 시점만 본다
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const count = countWith(draft)
  const activeCat = ROLE_GROUPS.find(g => g.key === cat) || ROLE_GROUPS[0]
  const tabLabels = {
    role: t('jobs.filterRole'),
    exp: t('jobs.expSelect'),
    type: t('jobs.filterType'),
    tech: t('jobs.filterTech'),
  }
  const tabCounts = {
    role: draft.roles.length,
    exp: draft.expMin !== '' || draft.expMax !== '' ? 1 : 0,
    type: draft.types.length,
    tech: draft.techs.length,
  }
  // 대분류별 선택 수(좌측 레일 배지) — cat: 전체 선택도 1로 센다.
  const catCount = g =>
    (draft.roles.includes(`cat:${g.key}`) ? 1 : 0) + g.roles.filter(r => draft.roles.includes(r.value)).length

  const catToken = `cat:${activeCat.key}`
  // 그룹 전체(cat:)를 켜면 그 그룹의 개별 소분류 선택은 중복이라 걷어낸다.
  const toggleCatAll = () =>
    setDraft(d => ({
      ...d,
      roles: d.roles.includes(catToken)
        ? d.roles.filter(x => x !== catToken)
        : [...d.roles.filter(x => !activeCat.roles.some(r => r.value === x)), catToken],
    }))
  // 소분류를 켜면 그 그룹의 전체(cat:) 선택은 해제(더 좁은 선택이 우선).
  const toggleRole = value =>
    setDraft(d => ({ ...d, roles: toggled(d.roles.filter(x => x !== catToken), value) }))

  return (
    <div className="fm-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="fm" role="dialog" aria-modal="true">
        <div className="fm-head">
          <div className="fm-title">{t('jobs.filterModalTitle')}</div>
          <button className="fm-close" onClick={onClose} aria-label="close">×</button>
        </div>

        <div className="fm-tabs">
          {TABS.map(k => (
            <button key={k} className={`fm-tab${tab === k ? ' on' : ''}`} onClick={() => setTab(k)}>
              {tabLabels[k]}
              {tabCounts[k] > 0 && <span className="fm-tab-n">{tabCounts[k]}</span>}
            </button>
          ))}
        </div>

        <div className="fm-body">
          {tab === 'role' && (
            <div className="fm-split">
              <div className="fm-rail">
                {ROLE_GROUPS.map(g => (
                  <button key={g.key} className={`fm-rail-item${cat === g.key ? ' on' : ''}`} onClick={() => setCat(g.key)}>
                    <span className="fm-rail-label">{g.label[lang] || g.label.en}</span>
                    {catCount(g) > 0 && <span className="fm-rail-n">{catCount(g)}</span>}
                  </button>
                ))}
              </div>
              <div className="fm-detail">
                <button className={`fm-row${draft.roles.includes(catToken) ? ' on' : ''}`} onClick={toggleCatAll}>
                  <span>{(activeCat.label[lang] || activeCat.label.en)} {t('jobs.filterAll')}</span>
                  {draft.roles.includes(catToken) && <span className="fm-check">✓</span>}
                </button>
                {activeCat.roles.map(r => (
                  <button
                    key={r.value}
                    className={`fm-row${draft.roles.includes(r.value) ? ' on' : ''}`}
                    onClick={() => toggleRole(r.value)}>
                    <span>{r.label[lang] || r.label.en}</span>
                    {draft.roles.includes(r.value) && <span className="fm-check">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === 'exp' && (
            <div className="fm-exp">
              <div className="fm-exp-display">
                {draft.expMin === '' && draft.expMax === ''
                  ? t('jobs.yearsAny')
                  : `${draft.expMin || 0}${t('jobs.expYears')} ~ ${draft.expMax || 15}${t('jobs.expYears')}`}
              </div>
              <div className="fm-exp-slider">
                <div className="fm-exp-track">
                  <div
                    className="fm-exp-fill"
                    style={{
                      left: `${(Number(draft.expMin || 0) / 15) * 100}%`,
                      right: `${100 - (Number(draft.expMax || 15) / 15) * 100}%`,
                    }}
                  />
                </div>
                <input
                  type="range" className="fm-exp-range" min="0" max="15" value={draft.expMin || 0}
                  onChange={e => {
                    const v = e.target.value
                    if (Number(v) <= Number(draft.expMax || 15)) setDraft(d => ({ ...d, expMin: v === '0' ? '' : v }))
                  }}
                />
                <input
                  type="range" className="fm-exp-range" min="0" max="15" value={draft.expMax || 15}
                  onChange={e => {
                    const v = e.target.value
                    if (Number(v) >= Number(draft.expMin || 0)) setDraft(d => ({ ...d, expMax: v === '15' ? '' : v }))
                  }}
                />
              </div>
              <div className="fm-exp-scale"><span>0{t('jobs.expYears')}</span><span>15{t('jobs.expYears')}+</span></div>
            </div>
          )}

          {tab === 'type' && (
            <div className="fm-list">
              {TYPE_OPTIONS.map(tp => (
                <button
                  key={tp}
                  className={`fm-row${draft.types.includes(tp) ? ' on' : ''}`}
                  onClick={() => setDraft(d => ({ ...d, types: toggled(d.types, tp) }))}>
                  <span>{typeLabel(tp)}</span>
                  {draft.types.includes(tp) && <span className="fm-check">✓</span>}
                </button>
              ))}
            </div>
          )}

          {tab === 'tech' && (
            <div className="fm-list">
              {TECH_OPTIONS.map(tc => (
                <button
                  key={tc}
                  className={`fm-row${draft.techs.includes(tc) ? ' on' : ''}`}
                  onClick={() => setDraft(d => ({ ...d, techs: toggled(d.techs, tc) }))}>
                  <span>{tc}</span>
                  {draft.techs.includes(tc) && <span className="fm-check">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="fm-foot">
          <button className="fm-reset" onClick={() => setDraft(EMPTY)}>{t('jobs.filterReset')}</button>
          <button className="fm-apply" onClick={() => onApply(draft)}>{t('jobs.filterShow', { n: count })}</button>
        </div>
      </div>

      <style jsx>{`
        /* z-index는 하단 탭바(99999) 위 — 안 그러면 바텀시트 하단 적용/초기화 버튼이 탭바에 가려 안 눌린다(.jd 상세패널과 동일 패턴). 백드롭이 탭바까지 덮어 필터 중엔 탭바가 안 보인다. */
        .fm-overlay { position: fixed; inset: 0; z-index: 100000; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; padding: 20px; }
        .fm { display: flex; flex-direction: column; width: 560px; max-width: 100%; height: 600px; max-height: calc(100vh - 40px); background: #fff; border-radius: 16px; overflow: hidden; font-family: inherit; }
        .fm-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px 10px; }
        .fm-title { font-size: 17px; font-weight: 800; color: #111; }
        .fm-close { font-size: 24px; line-height: 1; color: #999; background: none; border: none; cursor: pointer; padding: 2px 6px; }
        .fm-tabs { display: flex; gap: 18px; padding: 0 20px; border-bottom: 1px solid #ececea; }
        .fm-tab { display: inline-flex; align-items: center; gap: 5px; font-size: 14px; font-weight: 700; color: #999; background: none; border: none; padding: 10px 2px 11px; cursor: pointer; border-bottom: 2px solid transparent; font-family: inherit; }
        .fm-tab.on { color: #111; border-bottom-color: #ff4400; }
        .fm-tab-n { display: inline-flex; align-items: center; justify-content: center; min-width: 16px; height: 16px; border-radius: 50%; background: #ff4400; color: #fff; font-size: 10px; font-weight: 800; padding: 0 4px; }
        .fm-body { flex: 1; min-height: 0; display: flex; }
        .fm-split { flex: 1; display: flex; min-height: 0; }
        .fm-rail { width: 168px; overflow-y: auto; background: #f7f7f5; border-right: 1px solid #ececea; }
        .fm-rail-item { display: flex; align-items: center; gap: 6px; width: 100%; text-align: left; font-size: 13px; font-weight: 600; color: #777; background: none; border: none; padding: 13px 14px; cursor: pointer; font-family: inherit; }
        .fm-rail-item.on { background: #fff; color: #111; font-weight: 800; }
        .fm-rail-label { flex: 1; }
        .fm-rail-n { display: inline-flex; align-items: center; justify-content: center; min-width: 16px; height: 16px; border-radius: 50%; background: #ff4400; color: #fff; font-size: 10px; font-weight: 800; padding: 0 4px; flex: none; }
        .fm-detail { flex: 1; overflow-y: auto; padding: 4px 8px; }
        .fm-list { flex: 1; overflow-y: auto; padding: 4px 12px; }
        .fm-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; width: 100%; text-align: left; font-size: 14px; color: #555; background: none; border: none; border-bottom: 1px solid #f1f1ef; padding: 13px 8px; cursor: pointer; font-family: inherit; }
        .fm-row.on { color: #ff4400; font-weight: 800; }
        .fm-check { color: #ff4400; font-weight: 800; }
        .fm-exp { flex: 1; padding: 34px 28px; }
        .fm-exp-display { font-size: 18px; font-weight: 800; color: #111; text-align: center; margin-bottom: 26px; }
        .fm-exp-slider { position: relative; height: 20px; }
        .fm-exp-track { position: absolute; top: 8px; left: 0; right: 0; height: 4px; border-radius: 2px; background: #e5e5e3; }
        .fm-exp-fill { position: absolute; top: 0; height: 4px; border-radius: 2px; background: #ff4400; }
        .fm-exp-range { position: absolute; top: 0; left: 0; width: 100%; height: 20px; -webkit-appearance: none; appearance: none; background: none; pointer-events: none; margin: 0; }
        .fm-exp-range::-webkit-slider-thumb { -webkit-appearance: none; width: 20px; height: 20px; border-radius: 50%; background: #ff4400; border: 3px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.2); cursor: pointer; pointer-events: auto; }
        .fm-exp-range::-moz-range-thumb { width: 20px; height: 20px; border-radius: 50%; background: #ff4400; border: 3px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.2); cursor: pointer; pointer-events: auto; }
        .fm-exp-scale { display: flex; justify-content: space-between; font-size: 12px; color: #999; margin-top: 10px; }
        .fm-foot { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-top: 1px solid #ececea; }
        .fm-reset { font-size: 13px; font-weight: 600; color: #777; background: none; border: 1px solid #e0e0e0; border-radius: 10px; padding: 12px 18px; cursor: pointer; font-family: inherit; }
        .fm-reset:hover { border-color: #999; }
        .fm-apply { flex: 1; font-size: 15px; font-weight: 800; color: #fff; background: #ff4400; border: none; border-radius: 10px; padding: 13px 0; cursor: pointer; font-family: inherit; }
        .fm-apply:hover { background: #e63d00; }
        @media (max-width: 640px) {
          .fm-overlay { padding: 0; align-items: flex-end; }
          .fm { width: 100%; height: 86vh; max-height: none; border-radius: 16px 16px 0 0; }
          .fm-rail { width: 132px; }
          .fm-foot { padding-bottom: calc(12px + env(safe-area-inset-bottom)); }
        }
      `}</style>
    </div>
  )
}
