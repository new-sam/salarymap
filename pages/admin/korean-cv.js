import { useState, useEffect } from 'react'
import Head from 'next/head'
import { supabase } from '../../lib/supabaseClient'

/* /admin/korean-cv — 한국식 이력서 첨삭 요청 큐 + 편집기.
   /korean-cv 랜딩에서 접수된 요청(kcv_request)을 보고, [작업하기]로 AI 파싱을 돌려
   편집 가능한 A4 한국식 이력서 템플릿에서 다듬은 뒤 브라우저 인쇄로 PDF 저장 →
   이메일은 수동 발송 → [발송 완료]로 kcv_sent 마킹. 어드민 전용(승주 작업 도구, 한국어만). */

const DOC_W = 794 // A4 @96dpi
const DEGREE_KO = { Associate: '전문학사', Bachelor: '학사', Master: '석사', PhD: '박사' }

function fmtYm(months) {
  const m = Number(months)
  if (!m || m <= 0) return ''
  const y = Math.floor(m / 12)
  const r = m % 12
  if (!y) return `${r}개월`
  return r ? `${y}년 ${r}개월` : `${y}년`
}

/* 편집 셀 — 파싱 결과가 state 로 한 번만 렌더되므로 React 가 이후 DOM 텍스트를
   건드리지 않아 수정이 보존된다. 빈 값 placeholder 는 인쇄 시 숨긴다. */
const Ed = ({ v, ph }) => (
  <span className="kcv-ed" contentEditable suppressContentEditableWarning data-ph={ph || ''}>{v || ''}</span>
)

export default function AdminKoreanCv() {
  const [token, setToken] = useState(null)
  const [ready, setReady] = useState(false)
  const [requests, setRequests] = useState([])
  const [listErr, setListErr] = useState('')
  const [editing, setEditing] = useState(null) // { row, profile, photo }
  const [parsingId, setParsingId] = useState(null)
  const [photo, setPhoto] = useState(null)
  const [marking, setMarking] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setToken(session?.access_token || null)
      setReady(true)
    })
  }, [])

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {}

  const loadList = async () => {
    setListErr('')
    try {
      const r = await fetch('/api/admin/korean-cv', { headers: authHeaders })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
      setRequests(j.requests || [])
    } catch (e) {
      setListErr(e.message)
    }
  }

  useEffect(() => { if (ready) loadList() }, [ready])

  const openEditor = async (row) => {
    setParsingId(row.user_id)
    try {
      const r = await fetch('/api/admin/korean-cv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ action: 'parse', userId: row.user_id }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
      setEditing({ row, profile: j.profile })
      setPhoto(j.photo || null)
    } catch (e) {
      alert(`파싱 실패: ${e.message}`)
    } finally {
      setParsingId(null)
    }
  }

  const markSent = async () => {
    if (!editing || marking) return
    setMarking(true)
    try {
      const r = await fetch('/api/admin/korean-cv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ action: 'sent', userId: editing.row.user_id }),
      })
      if (!r.ok) throw new Error((await r.json()).error || `HTTP ${r.status}`)
      setEditing(null)
      setPhoto(null)
      loadList()
    } catch (e) {
      alert(`실패: ${e.message}`)
    } finally {
      setMarking(false)
    }
  }

  const download = () => {
    const name = editing?.profile?.full_name || 'FYI'
    const prev = document.title
    document.title = `이력서_${name}`
    window.onafterprint = () => { document.title = prev; window.onafterprint = null }
    window.print()
    setTimeout(() => { if (document.title !== prev) document.title = prev }, 3000)
  }

  const onPickPhoto = (e) => {
    const f = e.target.files?.[0]
    if (!f || !f.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => setPhoto(reader.result)
    reader.readAsDataURL(f)
  }

  const p = editing?.profile || {}
  const rs = p.resume_summary || {}
  const nameLine = rs.name_ko ? `${rs.name_ko} (${p.full_name || ''})` : (p.full_name || '')
  const experiences = Array.isArray(p.experiences) && p.experiences.length
    ? p.experiences
    : [{ company: '', title: '', start: '', end: '', months: 0 }]
  const today = typeof window === 'undefined' ? null : new Date()
  const dateLine = today ? `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일` : ''

  return (
    <>
      <Head><title>한국식 이력서 요청 | Admin</title></Head>
      <style>{`
        .akcv { min-height: 100vh; background: #f4f2ee; color: #1a1612; font-family: 'Barlow', -apple-system, sans-serif; padding: 32px 16px 90px; }
        .akcv-wrap { max-width: 900px; margin: 0 auto; }
        .akcv-h { font-size: 22px; font-weight: 800; margin: 0 0 18px; }
        .akcv-err { background: rgba(239,68,68,0.07); border: 1px solid rgba(239,68,68,0.3); color: #b91c1c; font-size: 13.5px; border-radius: 10px; padding: 11px 16px; margin-bottom: 14px; }
        .akcv-table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #e8e2da; border-radius: 14px; overflow: hidden; font-size: 13px; }
        .akcv-table th { text-align: left; font-size: 11.5px; color: #8a8177; font-weight: 700; padding: 10px 14px; border-bottom: 1px solid #e8e2da; background: #faf8f5; white-space: nowrap; }
        .akcv-table td { padding: 12px 14px; border-bottom: 1px solid #f0ebe4; vertical-align: middle; }
        .akcv-table tr:last-child td { border-bottom: none; }
        .akcv-status { font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 100px; white-space: nowrap; }
        .akcv-status.wait { background: rgba(255,96,0,0.1); color: #e05400; }
        .akcv-status.sent { background: rgba(13,148,136,0.1); color: #0d9488; }
        .akcv-btn { border: none; border-radius: 100px; padding: 8px 18px; font-size: 13px; font-weight: 700; cursor: pointer; font-family: inherit; transition: all .15s; white-space: nowrap; }
        .akcv-btn-primary { background: #ff6000; color: #fff; }
        .akcv-btn-primary:hover { background: #ff7a1a; }
        .akcv-btn-primary:disabled { opacity: 0.55; cursor: default; }
        .akcv-btn-ghost { background: #fff; color: #57504a; border: 1px solid #d8d0c6; }
        .akcv-btn-ghost:hover { color: #1a1612; border-color: #b6ac9f; }
        .akcv-btn-teal { background: #0d9488; color: #fff; }
        .akcv-btn-teal:hover { background: #0f766e; }
        .akcv-empty { text-align: center; color: #9a9186; font-size: 14px; padding: 48px 0; }
        .akcv-link { color: #e05400; font-weight: 600; text-decoration: none; }

        .akcv-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
        .akcv-toolbar-info { font-size: 13px; color: #57504a; }
        .akcv-toolbar-info b { color: #1a1612; }
        .akcv-btns { display: flex; gap: 8px; }
        .akcv-hint { font-size: 12px; color: #9a9186; margin: 0 0 14px; }

        .kcv-doc { width: ${DOC_W}px; min-height: 1123px; background: #fff; color: #1c1712; padding: 52px 58px; box-shadow: 0 18px 60px rgba(26,22,18,0.16); border: 1px solid #e8e2da; border-radius: 3px; font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', 'Segoe UI', sans-serif; }
        .kcv-doc-title { font-size: 30px; font-weight: 800; letter-spacing: 20px; text-indent: 20px; text-align: center; margin: 0 0 30px; }
        .kcv-sec-h { display: flex; align-items: baseline; gap: 8px; font-size: 14.5px; font-weight: 800; margin: 26px 0 8px; }
        .kcv-sec-h small { font-size: 11px; font-weight: 600; color: #9a8f83; }
        .kcv-tb { width: 100%; border-collapse: collapse; font-size: 12.5px; table-layout: fixed; }
        .kcv-tb th, .kcv-tb td { border: 1px solid #8f877d; padding: 8px 10px; text-align: left; vertical-align: middle; word-break: break-word; }
        .kcv-tb th { background: #f4f0ea; font-weight: 700; width: 92px; }
        .kcv-tb thead th { width: auto; text-align: center; }
        .kcv-photo-cell { width: 116px !important; text-align: center !important; padding: 6px !important; }
        .kcv-photo { width: 96px; height: 128px; object-fit: cover; display: block; margin: 0 auto; cursor: pointer; }
        .kcv-photo-ph { width: 96px; height: 128px; margin: 0 auto; border: 1px dashed #b6ac9f; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; font-size: 11px; color: #a79b8d; cursor: pointer; }
        .kcv-photo-hint { font-size: 10px; color: #b0a496; margin-top: 4px; }
        .kcv-skills { border: 1px solid #8f877d; padding: 10px 12px; font-size: 12.5px; line-height: 1.7; }
        .kcv-bullets { margin: 0; padding: 0 0 0 4px; list-style: none; }
        .kcv-bullets li { font-size: 12.5px; line-height: 1.7; padding: 3px 0 3px 16px; position: relative; }
        .kcv-bullets li::before { content: '•'; position: absolute; left: 2px; color: #1c1712; }
        .kcv-foot { margin-top: 44px; text-align: center; font-size: 12.5px; line-height: 2; }
        .kcv-foot .kcv-sign { margin-top: 8px; }
        .kcv-ed { display: block; width: 100%; min-height: 1em; outline: none; border-radius: 2px; }
        .kcv-ed:hover { background: rgba(255,96,0,0.06); }
        .kcv-ed:focus { background: rgba(255,96,0,0.09); box-shadow: inset 0 0 0 1px rgba(255,96,0,0.4); }
        .kcv-ed:empty::before { content: attr(data-ph); color: #b9ae9f; }

        @media print {
          body * { visibility: hidden !important; }
          .kcv-doc, .kcv-doc * { visibility: visible !important; }
          .kcv-doc { position: absolute; left: 0; top: 0; width: 100%; min-height: 0; margin: 0; padding: 0; box-shadow: none; border: none; border-radius: 0; }
          .kcv-photo-hint { display: none !important; }
          .kcv-ed:empty::before { content: '' !important; }
          .kcv-ed:hover, .kcv-ed:focus { background: none !important; box-shadow: none !important; }
        }
        @page { size: A4; margin: 12mm; }
      `}</style>

      <div className="akcv">
        <div className="akcv-wrap">
          {!editing ? (
            <>
              <h1 className="akcv-h">한국식 이력서 요청</h1>
              {listErr && <div className="akcv-err">{listErr} — 어드민 계정으로 로그인돼 있는지 확인하세요.</div>}
              {requests.length === 0 && !listErr ? (
                <div className="akcv-empty">아직 접수된 요청이 없어요.</div>
              ) : (
                <table className="akcv-table">
                  <thead>
                    <tr>
                      <th>접수</th><th>이름</th><th>이메일</th><th>직군/연차</th><th>한국어</th><th>원본</th><th>상태</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map(r => (
                      <tr key={r.user_id}>
                        <td style={{ whiteSpace: 'nowrap' }}>{(r.requested_at || '').slice(0, 10)}</td>
                        <td>{r.full_name || '-'}</td>
                        <td>{r.email || '-'}</td>
                        <td>{[r.position, fmtYm(r.yoe_months)].filter(Boolean).join(' · ') || '-'}</td>
                        <td>{r.korean_cert || '-'}</td>
                        <td>{r.resume_url ? <a className="akcv-link" href={r.resume_url} target="_blank" rel="noreferrer">CV ↗</a> : '-'}</td>
                        <td><span className={`akcv-status ${r.sent ? 'sent' : 'wait'}`}>{r.sent ? '발송됨' : '대기'}</span></td>
                        <td>
                          <button className="akcv-btn akcv-btn-primary" disabled={!r.resume_url || parsingId === r.user_id} onClick={() => openEditor(r)}>
                            {parsingId === r.user_id ? '파싱 중...' : '작업하기'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          ) : (
            <>
              <div className="akcv-toolbar">
                <div className="akcv-toolbar-info">
                  <b>{editing.row.full_name || editing.row.email}</b> · 받는 곳: <b>{editing.row.email}</b>{' '}
                  <button className="akcv-btn akcv-btn-ghost" style={{ padding: '3px 10px', fontSize: 11 }}
                    onClick={() => navigator.clipboard?.writeText(editing.row.email || '')}>이메일 복사</button>
                </div>
                <div className="akcv-btns">
                  <button className="akcv-btn akcv-btn-ghost" onClick={() => { setEditing(null); setPhoto(null) }}>← 목록</button>
                  <button className="akcv-btn akcv-btn-primary" onClick={download}>PDF 저장</button>
                  <button className="akcv-btn akcv-btn-teal" onClick={markSent} disabled={marking}>{marking ? '처리 중...' : '발송 완료'}</button>
                </div>
              </div>
              <p className="akcv-hint">칸을 클릭하면 바로 수정돼요. PDF 저장(브라우저 인쇄 → PDF) 후 이메일은 직접 발송하고, 보냈으면 [발송 완료]를 눌러주세요.</p>

              <div className="kcv-doc">
                <h2 className="kcv-doc-title">이력서</h2>

                <table className="kcv-tb">
                  <tbody>
                    <tr>
                      <td className="kcv-photo-cell" rowSpan={4}>
                        {photo ? (
                          <img src={photo} className="kcv-photo" alt="" onClick={() => document.getElementById('akcv-photo-input')?.click()} />
                        ) : (
                          <div className="kcv-photo-ph" onClick={() => document.getElementById('akcv-photo-input')?.click()}>
                            <span style={{ fontSize: 20 }}>+</span>
                            <span>사진 추가</span>
                          </div>
                        )}
                        <div className="kcv-photo-hint">클릭해서 교체</div>
                      </td>
                      <th>성명</th>
                      <td><Ed v={nameLine} ph="이름" /></td>
                      <th>생년월일</th>
                      <td><Ed v="" ph="YYYY.MM.DD" /></td>
                    </tr>
                    <tr>
                      <th>연락처</th>
                      <td><Ed v="" ph="+84 " /></td>
                      <th>이메일</th>
                      <td><Ed v={editing.row.email || ''} ph="email" /></td>
                    </tr>
                    <tr>
                      <th>거주지</th>
                      <td><Ed v={p.location} ph="도시, 국가" /></td>
                      <th>총 경력</th>
                      <td><Ed v={fmtYm(p.yoe_months)} ph="신입" /></td>
                    </tr>
                    <tr>
                      <th>희망 직무</th>
                      <td colSpan={3}><Ed v={p.headline || p.position} ph="직무" /></td>
                    </tr>
                  </tbody>
                </table>

                <div className="kcv-sec-h">학력사항 <small>Học vấn</small></div>
                <table className="kcv-tb">
                  <thead>
                    <tr><th>졸업연도</th><th>학교명</th><th>전공</th><th>학위</th></tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ textAlign: 'center' }}><Ed v={p.graduation_year} ph="YYYY" /></td>
                      <td><Ed v={p.university} ph="학교명" /></td>
                      <td><Ed v={p.major} ph="전공" /></td>
                      <td style={{ textAlign: 'center' }}><Ed v={DEGREE_KO[rs.degree] || rs.degree} ph="학사" /></td>
                    </tr>
                  </tbody>
                </table>

                <div className="kcv-sec-h">경력사항 <small>Kinh nghiệm làm việc</small></div>
                <table className="kcv-tb">
                  <thead>
                    <tr><th style={{ width: 150 }}>기간</th><th>회사명</th><th>직위</th><th style={{ width: 100 }}>근무기간</th></tr>
                  </thead>
                  <tbody>
                    {experiences.map((e, i) => (
                      <tr key={i}>
                        <td><Ed v={[e.start, e.end === 'Present' ? '재직중' : e.end].filter(Boolean).join(' ~ ')} ph="YYYY.MM ~" /></td>
                        <td><Ed v={e.company} ph="회사명" /></td>
                        <td><Ed v={e.title} ph="직위" /></td>
                        <td style={{ textAlign: 'center' }}><Ed v={fmtYm(e.months)} ph="-" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="kcv-sec-h">어학 및 자격 <small>Ngoại ngữ & Chứng chỉ</small></div>
                <table className="kcv-tb">
                  <tbody>
                    <tr>
                      <th>한국어</th>
                      <td><Ed v={p.korean_cert} ph="예: TOPIK 5급" /></td>
                      <th>영어</th>
                      <td><Ed v={p.english_cert} ph="예: TOEIC 900" /></td>
                    </tr>
                  </tbody>
                </table>

                <div className="kcv-sec-h">보유 기술 <small>Kỹ năng</small></div>
                <div className="kcv-skills">
                  <Ed v={(p.skills || []).join(', ')} ph="기술" />
                </div>

                {Array.isArray(rs.bullets) && rs.bullets.length > 0 && (
                  <>
                    <div className="kcv-sec-h">핵심 역량 <small>Điểm mạnh nổi bật</small></div>
                    <ul className="kcv-bullets">
                      {rs.bullets.map((b, i) => <li key={i}><Ed v={b} /></li>)}
                    </ul>
                  </>
                )}

                <div className="kcv-foot">
                  <div>위 기재 내용은 사실과 다름이 없습니다.</div>
                  <div>{dateLine}</div>
                  <div className="kcv-sign">작성자: {p.full_name || ''} (인)</div>
                </div>
              </div>

              <input id="akcv-photo-input" type="file" accept="image/*" style={{ display: 'none' }}
                onClick={e => { e.currentTarget.value = '' }} onChange={onPickPhoto} />
            </>
          )}
        </div>
      </div>
    </>
  )
}
