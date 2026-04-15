import { useState, useEffect } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabaseClient'

export default function ProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [otw, setOtw] = useState(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
      setUser(session.user)
      const { data } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()
      if (data) {
        setProfile(data)
        setLinkedinUrl(data.linkedin_url || '')
        setOtw(data.otw || null)
      }
      setLoading(false)
    })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    await supabase
      .from('user_profiles')
      .update({
        linkedin_url: linkedinUrl.trim() || null,
        otw: otw,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
    setSaving(false)
    setMsg('Saved')
    setTimeout(() => setMsg(null), 2000)
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f7f7f5', fontFamily: "-apple-system, 'Helvetica Neue', Arial, sans-serif" }}>
      <div style={{ fontSize: 14, color: '#aaa' }}>Loading...</div>
    </div>
  )

  return (
    <>
      <Head><title>Profile — FYI</title></Head>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f7f7f5; font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; }
        .pn { position: sticky; top: 0; z-index: 100; height: 56px; background: #fff; border-bottom: 1px solid #f0f0f0; display: flex; align-items: center; padding: 0 40px; gap: 28px; }
        .pn-logo { font-size: 18px; font-weight: 800; color: #ff4400; text-decoration: none; }
        .pn-back { font-size: 13px; color: #888; text-decoration: none; }
        .pn-back:hover { color: #333; }
        .pw { max-width: 520px; margin: 0 auto; padding: 40px 20px 80px; }
        .pw-h { font-size: 22px; font-weight: 800; color: #111; margin-bottom: 4px; }
        .pw-sub { font-size: 13px; color: #aaa; margin-bottom: 32px; }
        .pcard { background: #fff; border: 1px solid #eee; border-radius: 12px; padding: 24px; margin-bottom: 16px; }
        .pcard-h { font-size: 11px; font-weight: 700; color: #aaa; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 16px; }
        .pfield { margin-bottom: 16px; }
        .pfield:last-child { margin-bottom: 0; }
        .pfield-label { font-size: 11px; font-weight: 700; color: #aaa; text-transform: uppercase; letter-spacing: .04em; margin-bottom: 6px; }
        .pfield-value { font-size: 14px; color: #111; }
        .pfield-input { width: 100%; font-size: 14px; padding: 10px 12px; border: 1px solid #e0e0e0; border-radius: 8px; outline: none; font-family: inherit; transition: border-color .15s; }
        .pfield-input:focus { border-color: #ff4400; }
        .potw { display: flex; gap: 8px; }
        .potw-btn { flex: 1; padding: 10px; border-radius: 8px; border: 1px solid #e0e0e0; background: #fff; font-size: 13px; font-weight: 600; color: #888; cursor: pointer; transition: all .15s; text-align: center; }
        .potw-btn.on { background: #111; color: #fff; border-color: #111; }
        .potw-btn:hover:not(.on) { border-color: #bbb; }
        .psave { width: 100%; padding: 12px; background: #ff4400; color: #fff; border: none; border-radius: 8px; font-size: 14px; font-weight: 700; cursor: pointer; transition: opacity .15s; }
        .psave:disabled { opacity: 0.6; }
        .pmsg { background: #dcfce7; color: #166534; font-size: 13px; font-weight: 600; padding: 8px 16px; border-radius: 8px; margin-bottom: 16px; text-align: center; }
        @media (max-width: 768px) {
          .pn { padding: 0 16px; }
          .pw { padding: 28px 16px 60px; }
        }
      `}</style>

      <nav className="pn">
        <Link href="/" className="pn-logo">FYI</Link>
        <Link href="/" className="pn-back">← Back to home</Link>
      </nav>

      <div className="pw">
        <div className="pw-h">My Profile</div>
        <div className="pw-sub">Manage your contact info and headhunter preferences</div>

        {msg && <div className="pmsg">{msg}</div>}

        {/* Account info (read-only) */}
        <div className="pcard">
          <div className="pcard-h">Account</div>
          <div className="pfield">
            <div className="pfield-label">Email</div>
            <div className="pfield-value">{user?.email}</div>
          </div>
          <div className="pfield">
            <div className="pfield-label">Name</div>
            <div className="pfield-value">{profile?.full_name || user?.user_metadata?.full_name || '—'}</div>
          </div>
          <div className="pfield">
            <div className="pfield-label">Provider</div>
            <div className="pfield-value" style={{ textTransform: 'capitalize' }}>{profile?.provider || '—'}</div>
          </div>
        </div>

        {/* Editable fields */}
        <div className="pcard">
          <div className="pcard-h">Contact for headhunter</div>
          <div className="pfield">
            <div className="pfield-label">LinkedIn Profile</div>
            <input
              className="pfield-input"
              type="url"
              value={linkedinUrl}
              onChange={e => setLinkedinUrl(e.target.value)}
              placeholder="https://linkedin.com/in/yourname"
            />
          </div>
          <div className="pfield">
            <div className="pfield-label">Open to work</div>
            <div className="potw">
              <button className={`potw-btn${otw === 'yes' ? ' on' : ''}`} onClick={() => setOtw('yes')}>
                Yes, I'm open
              </button>
              <button className={`potw-btn${otw === 'selective' ? ' on' : ''}`} onClick={() => setOtw('selective')}>
                Selectively open
              </button>
              <button className={`potw-btn${otw === 'no' ? ' on' : ''}`} onClick={() => setOtw('no')}>
                Not looking
              </button>
            </div>
          </div>
        </div>

        <button className="psave" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </div>
    </>
  )
}
