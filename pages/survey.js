import { useEffect, useState } from 'react'
import Head from 'next/head'

// 유저 서베이 콜드메일 랜딩 — 로그인 없이 토큰(?t=)으로 진입, 대상이 베트남 회원이라 VI 단일 언어.
// 질문 설계 원칙: 미래 가정("있으면 쓸래요?") 금지, 과거 행동·실지출만 묻는다.
// 제출은 /api/survey → events(survey_submit) 저장, 결과는 어드민 ?tab=survey.
const Q1 = [
  { value: 'seeking', label: 'Đang tìm việc' },
  { value: 'employed_open', label: 'Đang đi làm, nhưng quan tâm cơ hội mới' },
  { value: 'employed_stay', label: 'Đang đi làm, chưa có ý định chuyển việc' },
  { value: 'student', label: 'Sinh viên / sắp tốt nghiệp' },
]
const Q4 = [
  { value: 'high', label: 'Rất quan tâm' },
  { value: 'some', label: 'Có quan tâm' },
  { value: 'no', label: 'Không quan tâm' },
]

export default function Survey() {
  const [token, setToken] = useState(null) // null=파싱 전, ''=없음
  const [name, setName] = useState('')
  const [state, setState] = useState('loading') // loading | invalid | form | submitting | done
  const [error, setError] = useState('')
  const [a, setA] = useState({ status: '', pain: '', spent: '', kr_interest: '', kr_obstacle: '', call_ok: false, contact: '' })
  const set = (k, v) => setA((prev) => ({ ...prev, [k]: v }))

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('t') || ''
    setToken(t)
    if (!t) { setState('invalid'); return }
    fetch('/api/survey', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ t, view: true }),
    })
      .then((r) => r.ok ? r.json() : Promise.reject(r))
      .then((d) => { setName(d.name || ''); setState(d.submitted ? 'done' : 'form') })
      .catch(() => setState('invalid'))
  }, [])

  const canSubmit = a.status && a.pain.trim().length >= 5

  async function submit() {
    if (!canSubmit || state === 'submitting') return
    setState('submitting')
    setError('')
    try {
      const res = await fetch('/api/survey', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ t: token, answers: a }),
      })
      if (!res.ok) throw new Error()
      setState('done')
    } catch {
      setState('form')
      setError('Gửi thất bại. Vui lòng thử lại.')
    }
  }

  const firstName = (name || '').trim().split(/\s+/).slice(-1)[0] || 'bạn'
  const wrap = { minHeight: '100vh', background: '#faf9f7', display: 'flex', justifyContent: 'center', padding: '28px 16px 60px', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", color: '#1a1612' }
  const card = { maxWidth: 560, width: '100%' }
  const qBox = { background: '#fff', border: '1px solid #eee5da', borderRadius: 16, padding: '18px 18px 16px', marginBottom: 14 }
  const qTitle = { fontSize: 15, fontWeight: 700, lineHeight: 1.45, marginBottom: 12 }
  const radio = (active) => ({ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', borderRadius: 11, border: active ? '2px solid #ff6000' : '1px solid #e5ddd2', background: active ? '#fff4ec' : '#fff', fontSize: 14, cursor: 'pointer', marginBottom: 8, fontWeight: active ? 700 : 400 })
  const ta = { width: '100%', minHeight: 96, border: '1px solid #e5ddd2', borderRadius: 11, padding: '11px 13px', fontSize: 14, lineHeight: 1.55, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', outline: 'none' }
  const input = { ...ta, minHeight: 0, resize: 'none' }
  const btn = (enabled) => ({ display: 'block', width: '100%', padding: '15px 0', border: 'none', borderRadius: 12, background: enabled ? '#ff6000' : '#f5c9a8', color: '#fff', fontSize: 15.5, fontWeight: 800, cursor: enabled ? 'pointer' : 'default' })

  return (
    <div style={wrap}>
      <Head><title>Khảo sát FYI</title><meta name="robots" content="noindex" /></Head>
      <div style={card}>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#ff6000', marginBottom: 18 }}>FYI</div>

        {state === 'loading' && <div style={{ textAlign: 'center', padding: 60, color: '#8a8073' }}>Đang tải…</div>}

        {state === 'invalid' && (
          <div style={{ ...qBox, textAlign: 'center', padding: 36 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Liên kết không hợp lệ</div>
            <div style={{ fontSize: 13.5, color: '#8a8073' }}>Vui lòng mở lại từ email bạn nhận được.</div>
          </div>
        )}

        {state === 'done' && (
          <div style={{ ...qBox, textAlign: 'center', padding: 36 }}>
            <div style={{ fontSize: 34, marginBottom: 10 }}>🙏</div>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 8 }}>Cảm ơn {firstName} rất nhiều!</div>
            <div style={{ fontSize: 14, color: '#4a443c', lineHeight: 1.6 }}>
              Câu trả lời của bạn sẽ trực tiếp giúp FYI xây dựng những tính năng hữu ích hơn cho cộng đồng.
            </div>
          </div>
        )}

        {(state === 'form' || state === 'submitting') && (
          <>
            <div style={{ fontSize: 21, fontWeight: 800, lineHeight: 1.35, marginBottom: 8 }}>
              Chào {firstName} 👋
            </div>
            <div style={{ fontSize: 14, color: '#4a443c', lineHeight: 1.6, marginBottom: 22 }}>
              Mình là <b>Seungju, người sáng lập FYI</b>. 5 câu hỏi dưới đây (~3 phút) sẽ giúp mình hiểu điều gì
              thực sự khó khăn với bạn — và FYI nên xây dựng gì tiếp theo.
            </div>

            <div style={qBox}>
              <div style={qTitle}>1. Tình trạng hiện tại của bạn?</div>
              {Q1.map((o) => (
                <div key={o.value} style={radio(a.status === o.value)} onClick={() => set('status', o.value)}>
                  <span style={{ width: 16, height: 16, borderRadius: '50%', border: a.status === o.value ? '5px solid #ff6000' : '2px solid #d9cfc2', boxSizing: 'border-box', flexShrink: 0 }} />
                  {o.label}
                </div>
              ))}
            </div>

            <div style={qBox}>
              <div style={qTitle}>2. Gần đây, điều gì làm bạn thấy <span style={{ color: '#ff6000' }}>khó khăn nhất</span> khi tìm việc hoặc phát triển sự nghiệp? Bạn đã xử lý như thế nào?</div>
              <textarea style={ta} value={a.pain} onChange={(e) => set('pain', e.target.value)}
                placeholder="Ví dụ: khó biết mức lương thị trường, CV gửi đi không được phản hồi, không biết học gì tiếp theo…" />
            </div>

            <div style={qBox}>
              <div style={qTitle}>3. Trong 6 tháng qua, bạn có <span style={{ color: '#ff6000' }}>chi tiền</span> cho việc gì liên quan đến nghề nghiệp không? Khoảng bao nhiêu?</div>
              <textarea style={{ ...ta, minHeight: 76 }} value={a.spent} onChange={(e) => set('spent', e.target.value)}
                placeholder="Ví dụ: khóa học online 500k, thi TOPIK/IELTS, dịch vụ sửa CV, app học tiếng… (nếu không có, ghi 'không')" />
            </div>

            <div style={qBox}>
              <div style={qTitle}>4. Bạn có quan tâm đến việc làm tại công ty Hàn Quốc không?</div>
              {Q4.map((o) => (
                <div key={o.value} style={radio(a.kr_interest === o.value)} onClick={() => set('kr_interest', o.value)}>
                  <span style={{ width: 16, height: 16, borderRadius: '50%', border: a.kr_interest === o.value ? '5px solid #ff6000' : '2px solid #d9cfc2', boxSizing: 'border-box', flexShrink: 0 }} />
                  {o.label}
                </div>
              ))}
              {(a.kr_interest === 'high' || a.kr_interest === 'some') && (
                <input style={{ ...input, marginTop: 6 }} value={a.kr_obstacle} onChange={(e) => set('kr_obstacle', e.target.value)}
                  placeholder="Trở ngại lớn nhất với bạn là gì? (tiếng Hàn, thông tin, visa…)" />
              )}
            </div>

            <div style={qBox}>
              <div style={qTitle}>5. Bạn có sẵn lòng trò chuyện online 15 phút với mình để chia sẻ thêm không?</div>
              <div style={radio(a.call_ok)} onClick={() => set('call_ok', !a.call_ok)}>
                <span style={{ width: 16, height: 16, borderRadius: 4, border: a.call_ok ? 'none' : '2px solid #d9cfc2', background: a.call_ok ? '#ff6000' : '#fff', boxSizing: 'border-box', flexShrink: 0, color: '#fff', fontSize: 12, fontWeight: 800, textAlign: 'center', lineHeight: '16px' }}>{a.call_ok ? '✓' : ''}</span>
                Có, mình sẵn lòng!
              </div>
              {a.call_ok && (
                <input style={{ ...input, marginTop: 6 }} value={a.contact} onChange={(e) => set('contact', e.target.value)}
                  placeholder="Zalo / số điện thoại của bạn" />
              )}
            </div>

            {error && <div style={{ color: '#c00', fontSize: 13.5, marginBottom: 10, textAlign: 'center' }}>{error}</div>}
            <button style={btn(canSubmit && state !== 'submitting')} onClick={submit} disabled={!canSubmit || state === 'submitting'}>
              {state === 'submitting' ? 'Đang gửi…' : 'Gửi câu trả lời'}
            </button>
            <div style={{ fontSize: 12, color: '#a89f92', textAlign: 'center', marginTop: 14, lineHeight: 1.5 }}>
              Câu trả lời chỉ dùng để cải thiện FYI, không chia sẻ cho bên thứ ba.
            </div>
          </>
        )}
      </div>
    </div>
  )
}
