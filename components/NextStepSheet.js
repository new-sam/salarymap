import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'

export default function NextStepSheet({ role, experience, percentile, topCompanies }) {
  const [visible, setVisible] = useState(false)
  const [selected, setSelected] = useState(null)
  const [jobs, setJobs] = useState([])
  const router = useRouter()
  const userSalary = typeof window !== 'undefined' ? parseInt(localStorage.getItem('fyi_salary')) || 0 : 0

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 3000)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    fetch('/api/jobs').then(r => r.json()).then(data => {
      setJobs(data.filter(j => j.salary_min > userSalary).slice(0, 3))
    }).catch(() => {})
  }, [userSalary])

  if (!visible) return null

  const jobCount = jobs.length
  const bgColors = ['#e8ecf5', '#f0ece8', '#e8f0ec']

  const handleSelect = (intent) => {
    setSelected(intent)
    if (typeof window !== 'undefined') {
      localStorage.setItem('fyi_intent', intent)
      // Save intent to DB
      const sid = localStorage.getItem('fyi_submission_id')
      if (sid) {
        fetch('/api/intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ submissionId: sid, intent }),
        }).catch(() => {})
      }
    }
    if (typeof gtag === 'function') gtag('event', 'nextstep_intent', { intent })
    setTimeout(() => {
      document.getElementById('ns-post')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 100)
  }

  return (
    <>
      <style>{`
.ns-backdrop{position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:400;backdrop-filter:blur(4px)}
@keyframes nsUp{from{transform:translateX(-50%) translateY(100%)}to{transform:translateX(-50%) translateY(0)}}
.ns-sheet{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:680px;background:#fff;border-radius:28px 28px 0 0;z-index:500;box-shadow:0 -20px 80px rgba(0,0,0,0.4);animation:nsUp .4s cubic-bezier(.16,1,.3,1);max-height:85vh;overflow-y:auto;font-family:'Be Vietnam Pro',sans-serif}
@media(max-width:768px){.ns-sheet{max-width:100%;left:0;transform:none}@keyframes nsUp{from{transform:translateY(100%)}to{transform:translateY(0)}}}
.ns-handle{width:40px;height:4px;background:#e0e0e0;border-radius:2px;margin:14px auto 0}
.ns-body{padding:14px 18px 28px}
.ns-title{font-size:19px;font-weight:800;color:#111;line-height:1.35;text-align:center;margin-bottom:8px}
.ns-title .blue{color:#0080FF}
.ns-sub{font-size:13px;color:#888;text-align:center;line-height:1.6;margin-bottom:20px}
.ns-sub b{color:#0080FF}
.ns-intents{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px}
.ns-card{display:flex;flex-direction:column;cursor:pointer;border-radius:16px;overflow:hidden;border:1.5px solid #ebebeb;background:#fff;transition:all .18s cubic-bezier(.16,1,.3,1);box-shadow:0 2px 8px rgba(0,0,0,0.06)}
.ns-card:hover{transform:translateY(-3px);box-shadow:0 6px 20px rgba(0,0,0,0.1)}
.ns-card.sel-blue{border-color:#0080FF;box-shadow:0 0 0 3px rgba(0,128,255,0.15),0 6px 20px rgba(0,128,255,0.15)}
.ns-card.sel-gray{border-color:#aaa;box-shadow:0 0 0 3px rgba(0,0,0,0.06)}
.ns-card-img{width:100%;display:block}
.ns-card-img img{width:100%;height:auto;display:block}
.ns-card-body{padding:10px 8px 12px;display:flex;flex-direction:column;align-items:center;gap:4px;flex:1}
.ns-btn{font-family:'Be Vietnam Pro',sans-serif;font-size:11px;font-weight:800;color:#0080FF;background:transparent;border:none;text-align:center;line-height:1.3;cursor:pointer;padding:0}
.ns-btn.gray{color:#888}
.ns-btn.active{color:#005ecc}
.ns-desc{font-size:10px;color:#bbb;text-align:center;line-height:1.4}
.ns-exit{display:block;width:100%;padding:8px;background:transparent;border:none;font-family:'Be Vietnam Pro',sans-serif;font-size:11px;font-weight:400;color:#ccc;text-align:center;cursor:pointer;margin-top:6px;letter-spacing:.01em}
.ns-exit:hover{color:#aaa}
.ns-match{display:flex;align-items:center;gap:7px;background:#f0fff4;border:1px solid #86efac;border-radius:10px;padding:9px 12px;margin-bottom:12px}
.ns-match-dot{width:7px;height:7px;border-radius:50%;background:#22c55e;flex-shrink:0}
.ns-match-text{font-size:12px;color:#444;line-height:1.4}
.ns-match-text b{color:#111}
.ns-jobs-preview{position:relative;margin-bottom:14px;border-radius:12px;overflow:hidden;border:1px solid #eee}
.ns-jobs-blur{display:flex;gap:0;filter:blur(3px);pointer-events:none;user-select:none}
.ns-jp{flex:0 0 52%;background:#fff;border-right:1px solid #f0f0f0}
.ns-jp-half{flex:0 0 30%;opacity:.6}
.ns-jp-img{height:72px;position:relative;display:flex;align-items:flex-end;padding:8px}
.ns-jp-logo{width:26px;height:26px;border-radius:5px;background:#fff;border:1px solid rgba(0,0,0,0.08);display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:800;color:#333}
.ns-jp-body{padding:8px 10px 10px}
.ns-jp-title{font-size:11px;font-weight:700;color:#111;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ns-jp-co{font-size:10px;color:#aaa;margin-bottom:5px}
.ns-jp-sal{font-size:10px;color:#bbb;display:flex;align-items:center;gap:3px}
.ns-jp-old{text-decoration:line-through}
.ns-jp-new{color:#111;font-weight:700}
.ns-jp-pct{background:#fff4f0;color:#ff4400;font-weight:700;padding:1px 5px;border-radius:4px;font-size:9px}
.ns-overlay{position:absolute;inset:0;background:rgba(255,255,255,0.55);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px}
.ns-overlay-icon{font-size:20px}
.ns-overlay-text{font-size:12px;font-weight:600;color:#555}
.ns-right-fade{position:absolute;top:0;right:0;bottom:0;width:60px;background:linear-gradient(to right,transparent,#fff);pointer-events:none}
.ns-unlock{width:100%;padding:13px;background:#0080FF;border:none;border-radius:12px;font-size:14px;font-weight:700;color:#fff;cursor:pointer;margin-bottom:8px;font-family:'Be Vietnam Pro',sans-serif;box-shadow:0 4px 16px rgba(0,128,255,0.25)}
.ns-unlock:hover{background:#006ee0}
.ns-privacy{font-size:10px;color:#ccc;text-align:center;line-height:1.6}
.ns-browse{width:100%;padding:13px;border-radius:12px;background:#111;border:none;font-size:13px;font-weight:700;color:#fff;cursor:pointer;margin-bottom:8px;font-family:'Be Vietnam Pro',sans-serif}
.ns-browse-sub{font-size:11px;color:#bbb;text-align:center}
      `}</style>

      <div className="ns-backdrop" onClick={() => setVisible(false)} />

      <div className="ns-sheet">
        <div className="ns-handle" />
        <div className="ns-body">

          <div className="ns-title">Muốn được kết nối với công ty <span className="blue">trả lương cao hơn</span>?</div>
          <div className="ns-sub">Chúng tôi đã giúp <b>3.000+</b> kỹ sư kiếm được hơn <b>10%</b> lương hiện tại.</div>

          <div className="ns-intents">
            {[
              { id:'open', img:'/char1.png', label:<>Có, sẵn sàng nhận<br/>cơ hội tốt hơn</>, desc:'Tôi muốn tìm việc phù hợp ngay', blue:true },
              { id:'selective', img:'/char2.png', label:<>Cân nhắc nếu<br/>phù hợp</>, desc:'Tôi sẽ xem xét nếu đúng vị trí và mức lương', blue:true },
              { id:'none', img:'/char3.png', label:'Chưa cần ngay', desc:'Tôi hài lòng với công việc hiện tại', blue:false },
            ].map(c => (
              <div key={c.id} className={`ns-card${selected===c.id?(c.blue?' sel-blue':' sel-gray'):''}`} onClick={() => handleSelect(c.id)}>
                <div className="ns-card-img"><img src={c.img} alt="" /></div>
                <div className="ns-card-body">
                  <button className={`ns-btn${!c.blue?' gray':''}${selected===c.id?' active':''}`}>{c.label}</button>
                  <div className="ns-desc">{c.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{textAlign:'center',marginBottom:4}}>
            <button className="ns-exit" onClick={() => { handleSelect('maybe_later'); setVisible(false); }}>Để sau</button>
          </div>

          <div id="ns-post">
            {(selected==='open'||selected==='selective') && (
              <div>
                {jobCount>0 && (
                  <div className="ns-match">
                    <div className="ns-match-dot" />
                    <div className="ns-match-text">Chúng tôi tìm thấy <b>{jobCount} việc làm</b> trả lương cao hơn bạn hiện tại</div>
                  </div>
                )}
                {jobCount>0 && (
                  <div className="ns-jobs-preview">
                    <div className="ns-jobs-blur">
                      {jobs.map((job,i) => {
                        const ini = job.company_initials || (job.company||'').slice(0,2).toUpperCase()
                        const bump = Math.round(((job.salary_min-userSalary)/userSalary)*100)
                        return (
                          <div key={i} className={`ns-jp${i===2?' ns-jp-half':''}`}>
                            <div className="ns-jp-img" style={{background:bgColors[i%3]}}><div className="ns-jp-logo">{ini}</div></div>
                            <div className="ns-jp-body">
                              <div className="ns-jp-title">{job.title}</div>
                              <div className="ns-jp-co">{job.company} · {job.location}</div>
                              <div className="ns-jp-sal">
                                <span className="ns-jp-old">{userSalary}M</span> → <span className="ns-jp-new">{Math.round(job.salary_min/1e6)}–{Math.round(job.salary_max/1e6)}M</span>
                                {bump>0 && <span className="ns-jp-pct">+{bump}%</span>}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <div className="ns-overlay"><div className="ns-overlay-icon">🔒</div><div className="ns-overlay-text">Đăng nhập để xem & ứng tuyển</div></div>
                    <div className="ns-right-fade" />
                  </div>
                )}
                <button className="ns-unlock" onClick={() => router.push('/jobs')}>Xem tất cả việc làm →</button>
                <div className="ns-privacy">🔒 Không spam. Chúng tôi chỉ liên hệ khi thực sự đáng giá.</div>
              </div>
            )}
            {selected==='none' && (
              <div>
                <button className="ns-browse" onClick={() => setVisible(false)}>Xem dữ liệu lương →</button>
                <div className="ns-browse-sub">Không cần đăng ký. Khám phá dữ liệu lương tất cả công ty.</div>
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  )
}
