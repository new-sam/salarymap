// 공개 디지털 명함 페이지(앱 없이 링크로 보기). /c/<token>.
// 앱이 발행한 card_data(정보+디자인)를 그대로 웹에 렌더하고, "연락처 저장(vCard)" 버튼을 제공한다.
// 카톡/Zalo/메신저에 링크를 붙이면 OG 메타로 이름·회사·사진 미리보기가 뜬다.
import Head from 'next/head'
import { createClient } from '@supabase/supabase-js'

export async function getServerSideProps({ params, req, res }) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )
  const { data: row } = await supabase
    .from('business_cards')
    .select('id, card_data, card_image_url, is_published')
    .eq('share_token', params.token)
    .eq('is_published', true)
    .maybeSingle()

  if (!row) return { notFound: true }

  // 고유 열람 기록(브라우저 쿠키 단위). 명함 주인의 디자인 잠금해제 카운트에 쓰인다.
  try {
    let vid = req.cookies?.fyi_vid
    if (!vid) {
      vid = Math.random().toString(36).slice(2) + Date.now().toString(36)
      res.setHeader('Set-Cookie', `fyi_vid=${vid}; Path=/; Max-Age=31536000; SameSite=Lax`)
    }
    await supabase
      .from('card_views')
      .upsert({ card_id: row.id, visitor: vid }, { onConflict: 'card_id,visitor', ignoreDuplicates: true })
  } catch {
    // 열람 기록 실패는 페이지 표시에 영향 없음.
  }

  const card = row.card_data || {}
  return { props: { data: card.data || {}, design: card.design || {}, image: row.card_image_url || null } }
}

// ---- 디자인 토큰 헬퍼(앱의 business-card-face와 동일 규칙) ----
function withAlpha(hex, a) {
  let h = String(hex || '').replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (h.length !== 6) return hex
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${a})`
}
function isLight(hex) {
  let h = String(hex || '').replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (h.length !== 6) return false
  const r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255
  return 0.299 * r + 0.587 * g + 0.114 * b > 0.62
}
function fontFamily(font) {
  if (font === 'serif') return 'Georgia, "Times New Roman", serif'
  if (font === 'mono') return 'Menlo, Consolas, monospace'
  return '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
}
function monogram(name, email) {
  const base = (name || '').trim() || (email || '').trim() || '?'
  return base.charAt(0).toUpperCase()
}
// vCard 3.0 문자열.
function buildVCard(d) {
  const esc = (s) => String(s || '').replace(/([,;\\])/g, '\\$1')
  const lines = ['BEGIN:VCARD', 'VERSION:3.0']
  if (d.name) { lines.push(`N:${esc(d.name)};;;`); lines.push(`FN:${esc(d.name)}`) }
  if (d.company) lines.push(`ORG:${esc(d.company)}`)
  if (d.position) lines.push(`TITLE:${esc(d.position)}`)
  if (d.phone) lines.push(`TEL;TYPE=CELL:${esc(d.phone)}`)
  if (d.email) lines.push(`EMAIL;TYPE=WORK:${esc(d.email)}`)
  if (d.address) lines.push(`ADR;TYPE=WORK:;;${esc(d.address)};;;;`)
  lines.push('END:VCARD')
  return lines.join('\r\n')
}

export default function PublicCardPage({ data, design, image }) {
  const d = data || {}
  const ds = design || {}
  const accent = ds.accent || '#D4AF6A'
  const text = ds.text || '#FFFFFF'
  const bg1 = ds.bg1 || '#1A1A1D'
  const bg2 = ds.bg2 || bg1
  const sub = withAlpha(text, 0.72)
  const border = isLight(bg1) ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.14)'
  const font = fontFamily(ds.font)
  const center = ds.template === 'gradient' || ds.template === 'mono'
  const cardBg = ds.bgKind === 'gradient' ? `linear-gradient(135deg, ${bg1}, ${bg2})` : bg1
  const upper = ds.template !== 'gradient'
  const showPhoto = ds.photo !== 'none'

  const title = d.name ? `${d.name} 명함` : '디지털 명함'
  const desc = [d.position, d.company].filter(Boolean).join(' · ')

  function saveContact() {
    const blob = new Blob([buildVCard(d)], { type: 'text/vcard;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(d.name || 'contact').replace(/\s+/g, '_')}.vcf`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const contacts = [d.phone, d.email, d.address].filter(Boolean)

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        {/* 링크 미리보기: 명함을 캡처한 이미지(card_image_url)가 있으면 그걸 큰 카드로,
            없으면 프로필 사진 대신 이름·직책 텍스트만(작은 카드)으로. */}
        <meta property="og:title" content={d.name || '디지털 명함'} />
        <meta property="og:description" content={desc || '디지털 명함'} />
        <meta property="og:type" content="profile" />
        {image ? <meta property="og:image" content={image} /> : null}
        <meta name="twitter:card" content={image ? 'summary_large_image' : 'summary'} />
        {image ? <meta name="twitter:image" content={image} /> : null}
      </Head>

      <main style={S.page}>
        <div style={{ ...S.card, background: cardBg, color: text, borderColor: border, fontFamily: font, textAlign: center ? 'center' : 'left', alignItems: center ? 'center' : 'stretch' }}>
          {/* 상단: 회사 마크 */}
          {d.company ? (
            <div style={{ ...S.brand, color: accent, letterSpacing: upper ? 1.5 : 0.3, textAlign: center ? 'center' : 'right' }}>
              {upper ? String(d.company).toUpperCase() : d.company}
            </div>
          ) : null}

          {/* 사진 + 이름/직책 */}
          <div style={{ ...S.idRow, justifyContent: center ? 'center' : 'flex-start', flexDirection: center ? 'column' : 'row' }}>
            {showPhoto ? (
              d.photoUrl ? (
                <img src={d.photoUrl} alt="" style={{ ...S.photo, borderColor: withAlpha(accent, 0.6) }} />
              ) : (
                <div style={{ ...S.photo, ...S.mono, borderColor: withAlpha(accent, 0.6), background: withAlpha(text, 0.06), color: accent }}>
                  {monogram(d.name, d.email)}
                </div>
              )
            ) : null}
            <div>
              {d.name ? <div style={{ ...S.name, color: text }}>{d.name}</div> : null}
              {d.position ? <div style={{ ...S.pos, color: accent }}>{d.position}</div> : null}
            </div>
          </div>

          {contacts.length ? <div style={{ ...S.divider, background: withAlpha(accent, 0.7), marginLeft: center ? 'auto' : 0, marginRight: center ? 'auto' : 0 }} /> : null}
          <div>
            {d.phone ? <div style={{ ...S.contact, color: sub }}>{d.phone}</div> : null}
            {d.email ? <div style={{ ...S.contact, color: sub }}>{d.email}</div> : null}
            {d.address ? <div style={{ ...S.contact, color: sub }}>{d.address}</div> : null}
          </div>
        </div>

        <button style={S.saveBtn} onClick={saveContact}>연락처 저장</button>
        <a href="https://salary-fyi.com" style={S.footer}>FYI로 만든 디지털 명함</a>
      </main>
    </>
  )
}

const S = {
  page: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, padding: 24, background: '#0E0F12', boxSizing: 'border-box' },
  card: { width: '100%', maxWidth: 380, aspectRatio: '1.586 / 1', borderRadius: 20, padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box', borderWidth: 1, borderStyle: 'solid', boxShadow: '0 18px 50px rgba(0,0,0,0.5)', overflow: 'hidden' },
  brand: { fontSize: 13, fontWeight: 800 },
  idRow: { display: 'flex', alignItems: 'center', gap: 13 },
  photo: { width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', borderWidth: 1, borderStyle: 'solid', flexShrink: 0 },
  mono: { display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800 },
  name: { fontSize: 23, fontWeight: 800, letterSpacing: 0.3, lineHeight: 1.15 },
  pos: { fontSize: 13.5, fontWeight: 600, marginTop: 3 },
  divider: { width: 38, height: 2, borderRadius: 1 },
  contact: { fontSize: 12.5, fontWeight: 500, letterSpacing: 0.2, lineHeight: 1.7, wordBreak: 'break-word' },
  saveBtn: { background: '#FFFFFF', color: '#111', border: 'none', borderRadius: 26, padding: '13px 28px', fontSize: 15, fontWeight: 700, cursor: 'pointer' },
  footer: { color: 'rgba(255,255,255,0.45)', fontSize: 12.5, textDecoration: 'none', fontWeight: 500 },
}
