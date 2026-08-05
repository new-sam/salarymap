import { useEffect, useRef, useState } from 'react'
import Head from 'next/head'

// 사진 등록 콜드메일(photo1) 랜딩 — 로그인 없이 토큰(?t=)으로 진입해 프로필 사진 1장 업로드.
// 대상이 베트남 인재라 VI 단일 언어. 모바일 우선(수신자 대부분 폰에서 염).
// 큰 폰 사진은 canvas 로 900px 리사이즈 후 JPEG 전송(페이로드 축소 + HEIC 회피:
// accept 를 jpeg/png/webp 로 제한하면 iOS 가 자동으로 JPEG 변환해 준다).
export default function PhotoUpload() {
  const [token, setToken] = useState(null) // null=파싱 전, ''=없음
  const [preview, setPreview] = useState(null) // 리사이즈된 dataURL
  const [state, setState] = useState('idle') // idle | submitting | done
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('t') || ''
    setToken(t)
    if (t) {
      fetch('/api/profile/photo-claim', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ t, view: true }),
      }).catch(() => {})
    }
  }, [])

  function onPick(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    const img = new Image()
    const objUrl = URL.createObjectURL(file)
    img.onload = () => {
      const MAX = 900
      const scale = Math.min(1, MAX / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      setPreview(canvas.toDataURL('image/jpeg', 0.85))
      URL.revokeObjectURL(objUrl)
    }
    img.onerror = () => {
      setError('Không đọc được ảnh. Vui lòng chọn ảnh khác (JPG/PNG).')
      URL.revokeObjectURL(objUrl)
    }
    img.src = objUrl
  }

  async function submit() {
    if (!preview || state === 'submitting') return
    setState('submitting')
    setError('')
    try {
      const res = await fetch('/api/profile/photo-claim', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ t: token, image: preview }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) { setState('done'); return }
      setState('idle')
      if (data.error === 'not_portrait') setError('Ảnh chưa được nhận diện là ảnh chân dung. Vui lòng chọn ảnh rõ khuôn mặt của bạn.')
      else if (data.error === 'invalid_token') setError('Liên kết không hợp lệ hoặc đã hết hạn.')
      else setError('Có lỗi xảy ra. Vui lòng thử lại.')
    } catch {
      setState('idle')
      setError('Có lỗi xảy ra. Vui lòng thử lại.')
    }
  }

  const card = { maxWidth: 440, width: '100%', background: '#fff', border: '1px solid #eee5da', borderRadius: 20, padding: '36px 26px', boxShadow: '0 8px 30px rgba(0,0,0,.06)', textAlign: 'center' }
  const btn = (enabled) => ({ display: 'block', width: '100%', padding: '15px 0', border: 'none', borderRadius: 12, background: enabled ? '#ff6000' : '#f5c9a8', color: '#fff', fontSize: 15.5, fontWeight: 800, cursor: enabled ? 'pointer' : 'default' })

  return (
    <>
      <Head>
        <title>FYI — Thêm ảnh hồ sơ</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex" />
      </Head>
      <div style={{ minHeight: '100vh', background: '#faf9f7', color: '#1a1612', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        {token === null ? null : !token ? (
          <div style={card}>
            <div style={{ fontSize: 48, marginBottom: 14 }}>⚠️</div>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Liên kết không hợp lệ</div>
            <div style={{ fontSize: 14, color: '#6b6357', lineHeight: 1.6 }}>Vui lòng mở lại liên kết trong email từ FYI.</div>
          </div>
        ) : state === 'done' ? (
          <div style={card}>
            <div style={{ fontSize: 48, marginBottom: 14 }}>✅</div>
            <div style={{ fontSize: 19, fontWeight: 800, marginBottom: 10 }}>Đã cập nhật ảnh hồ sơ!</div>
            <div style={{ fontSize: 14, color: '#6b6357', lineHeight: 1.6 }}>
              Hồ sơ của bạn giờ đã nổi bật hơn với nhà tuyển dụng.<br />Cảm ơn bạn! 🎉
            </div>
          </div>
        ) : (
          <div style={card}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#ff6000', marginBottom: 18 }}>FYI</div>
            <div style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.35, marginBottom: 10 }}>Thêm ảnh hồ sơ trong 1 phút</div>
            <div style={{ fontSize: 14, color: '#6b6357', lineHeight: 1.6, marginBottom: 22 }}>
              Nhà tuyển dụng thường loại hồ sơ chưa có ảnh khỏi danh sách đề cử.<br />Hồ sơ có ảnh có khả năng nhận offer cao hơn <b style={{ color: '#1a1612' }}>62%</b>.
            </div>

            <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onPick} style={{ display: 'none' }} />
            <button onClick={() => inputRef.current?.click()} style={{ width: 148, height: 148, borderRadius: '50%', border: preview ? '3px solid #ff6000' : '2px dashed #d9cfc2', background: '#faf9f7', margin: '0 auto 18px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', padding: 0 }}>
              {preview ? (
                <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: 13, color: '#a89f92', lineHeight: 1.5 }}>📷<br />Chọn ảnh<br />chân dung</span>
              )}
            </button>

            {error && <div style={{ fontSize: 13, color: '#d92d20', lineHeight: 1.5, marginBottom: 14 }}>{error}</div>}

            {preview ? (
              <>
                <button onClick={submit} disabled={state === 'submitting'} style={btn(state !== 'submitting')}>
                  {state === 'submitting' ? 'Đang tải lên…' : 'Hoàn tất đăng ký ảnh →'}
                </button>
                <button onClick={() => inputRef.current?.click()} style={{ marginTop: 10, border: 'none', background: 'none', fontSize: 13, color: '#8a8073', cursor: 'pointer', textDecoration: 'underline' }}>
                  Chọn ảnh khác
                </button>
              </>
            ) : (
              <button onClick={() => inputRef.current?.click()} style={btn(true)}>Chọn ảnh từ điện thoại</button>
            )}

            <div style={{ fontSize: 11.5, color: '#a89f92', marginTop: 16, lineHeight: 1.5 }}>Không cần đăng nhập · Ảnh chỉ hiển thị cho nhà tuyển dụng</div>
          </div>
        )}
      </div>
    </>
  )
}
