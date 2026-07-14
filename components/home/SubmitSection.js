import { useState, useEffect, useRef } from 'react';
import { useT } from '../../lib/i18n';
import Icon from '../Icon';
import ResultSection from '../ResultSection';
import supabaseClient from '../../lib/supabaseClient';
import { track } from '../../lib/track';

function SubmitSection({
  wizardStep, setWizardStep,
  wRole, setWRole, wExp, setWExp,
  wSalary, setWSalary, wCompany, setWCompany,
  percentileData,
  showSocialPrompt, setShowSocialPrompt,
  isLoggedIn,
  onSubmit,
  submissionId,
  freshSubmit,
}) {
  const { t } = useT();
  const [submitting, setSubmitting] = useState(false);
  const [ratingWorklife, setRatingWorklife] = useState(0);
  const [ratingSalary, setRatingSalary] = useState(0);
  // 연봉 슬라이더를 실제로 건드렸는지 — 미건드림 통과(기본값 박힘) 방지
  const [salaryTouched, setSalaryTouched] = useState(false);
  const [ratingGrowth, setRatingGrowth] = useState(0);
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [acResults, setAcResults] = useState([]);
  const [acLoading, setAcLoading] = useState(false);
  const [acOpen, setAcOpen] = useState(false);
  const [acHighlight, setAcHighlight] = useState(-1);
  const [selectedItem, setSelectedItem] = useState(null);
  const acTimerRef = useRef(null);
  const acWrapRef = useRef(null);
  const ROLES = ['Backend','Frontend','Mobile','Data · AI','DevOps','PM · PO','Design','QA'];
  const EXPS  = ['Under 1yr','1–2 yrs','3–4 yrs','5–7 yrs','8+ yrs'];
  const sal = Number(wSalary);
  const salPct = Math.round(((sal - 5) / (200 - 5)) * 100);

  const handleSubmit = async () => {
    if (!wCompany.trim() || submitting) return;
    setSubmitting(true);
    await onSubmit();
    setSubmitting(false);
    setWizardStep(5);
    // GA4 event
    if (typeof gtag === 'function') gtag('event', 'submit_salary', { event_category: 'engagement', event_label: wRole });
    // Meta Pixel event
    if (typeof fbq === 'function') fbq('track', 'Lead', { content_name: 'salary_submit', content_category: wRole });
    // 자체 퍼널 이벤트 — step 4 완료 = 제출 (client_id 실려서 유니크 퍼널 가능)
    track('wizard_step_4', { meta: { role: wRole }, page: '/' });
  };

  const handleRatingSubmit = async () => {
    if (!submissionId || (!ratingWorklife && !ratingSalary && !ratingGrowth)) return;
    setRatingSubmitting(true);
    try {
      await fetch('/api/submit-rating', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId,
          rating_worklife: ratingWorklife || null,
          rating_salary: ratingSalary || null,
          rating_growth: ratingGrowth || null,
        }),
      });
    } catch (e) {}
    setRatingSubmitting(false);
  };

  // 결과 화면 전환 시 그래프가 화면 상단에 오도록 앵커 — 위쪽 회사 그리드가
  // role 필터 재렌더로 높이가 바뀌며 스크롤이 밀리는 것 방지.
  // freshSubmit: 방금 제출한 경우에만 — 새로고침 복원 시 자동 스크롤 금지
  useEffect(() => {
    if (wizardStep > 5 && freshSubmit) {
      const tid = setTimeout(() => {
        document.getElementById('submit')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 250);
      return () => clearTimeout(tid);
    }
  }, [wizardStep > 5, freshSubmit]);

  // Auto-advance when all 3 ratings are filled
  useEffect(() => {
    if (wizardStep === 5 && ratingWorklife && ratingSalary && ratingGrowth) {
      const timer = setTimeout(async () => {
        await handleRatingSubmit();
        setWizardStep(6);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [ratingWorklife, ratingSalary, ratingGrowth, wizardStep]);

  const StarRow = ({ label, value, onChange }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>{label}</span>
      <div style={{ display: 'flex', gap: 4 }}>
        {[1, 2, 3, 4, 5].map(n => (
          <span key={n} onClick={() => onChange(n)}
            style={{ cursor: 'pointer', transition: 'color .12s' }}>
            <Icon name="star" size={22} color={n <= value ? '#f59e0b' : 'rgba(255,255,255,0.15)'} style={{ fill: n <= value ? '#f59e0b' : 'none' }} />
          </span>
        ))}
      </div>
    </div>
  );

  const isValidCompanyName = (name) => {
    if (!name || name.trim().length < 2) return false;
    const valid = /^[\w\s.,&\-()àáảãạăắặẳẵằâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ]+$/i;
    if (!valid.test(name.trim())) return false;
    const junk = /^(test|qwer|asdf|abc|xxx|123|qwd|dwd|zzz)/i;
    if (junk.test(name.trim())) return false;
    return true;
  };

  const searchCompanies = (q) => {
    clearTimeout(acTimerRef.current);
    if (!q || q.trim().length < 1) { setAcResults([]); setAcOpen(false); return; }
    setAcLoading(true);
    acTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/companies/search?q=${encodeURIComponent(q.trim())}`);
        const data = await res.json();
        setAcResults(data);
        setAcOpen(true);
        setAcHighlight(-1);
      } catch { setAcResults([]); }
      setAcLoading(false);
    }, 150);
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handler = (e) => { if (acWrapRef.current && !acWrapRef.current.contains(e.target)) setAcOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectCompany = (item) => {
    setWCompany(item.name);
    setSelectedItem(item);
    setAcOpen(false);
    setAcResults([]);
    if (item.source === 'clearbit' && item.name && item.domain) {
      fetch('/api/companies/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: item.name, domain: item.domain }),
      }).catch(() => {});
    }
    // Auto-submit after company selection
    setTimeout(() => handleSubmit(), 400);
  };

  const clearSelectedItem = () => {
    setSelectedItem(null);
    setWCompany('');
  };

  // percentile = % of peers earning less (e.g. 80 = earns more than 80%)
  const percentile = percentileData ? 100 - (percentileData.topPct ?? 50) : null;
  const isTopHalf = percentile != null && percentile >= 50;
  const pctLabel = percentile == null ? null
    : percentile >= 50 ? `Top ${100 - percentile}%`
    : `Bottom ${percentile}%`;
  const pctColor = percentile == null ? '#fff'
    : percentile >= 50 ? '#4ade80' : '#ff6000';
  const diff = percentileData ? sal - (percentileData.median ?? sal) : 0;
  const diffLabel = diff >= 0 ? `+${diff}M` : `-${Math.abs(diff)}M`;
  const message = isTopHalf
    ? t('wizard.aboveMedian')
    : t('wizard.belowMedian');

  const card = { background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'20px', padding:'36px 32px' };
  const btn = { fontFamily:"'Barlow',sans-serif", cursor:'pointer', border:'none' };

  const handleOAuth = async (provider) => {
    try {
      // Google goes through our own /api/auth/google to keep the OAuth screen
      // showing salary-fyi.com instead of the Supabase URL.
      if (provider === 'google') {
        window.location.href = '/api/auth/google?return=' + encodeURIComponent('/');
        return;
      }
      const { error } = await supabaseClient.auth.signInWithOAuth({
        provider,
        options: { redirectTo: window.location.origin + '/auth/callback' },
      });
      if (error) throw error;
    } catch (e) {
      console.error('OAuth error:', e);
    }
  };

  const POPULAR_COMPANIES = ['Grab','FPT Software','MoMo','VNG','Sky Mavis','Shopee'];
  const stepHeadings = [
    null,
    { pre: t('wizard.step1.pre'), em: t('wizard.step1.em'), sub: t('wizard.step1.sub') },
    { pre: t('wizard.step2.pre'), em: t('wizard.step2.em'), sub: t('wizard.step2.sub') },
    { pre: t('wizard.step3.pre'), em: t('wizard.step3.em'), sub: t('wizard.step3.sub') },
    { pre: t('wizard.step4.pre'), em: t('wizard.step4.em'), sub: t('wizard.step4.sub') },
    { pre: t('wizard.step5.pre'), em: t('wizard.step5.em'), sub: t('wizard.step5.sub', { company: wCompany }) },
  ];
  const EXP_LABELS = {
    'Under 1yr': t('exp.under1'), '1–2 yrs': t('exp.1_2'), '3–4 yrs': t('exp.3_4'),
    '5–7 yrs': t('exp.5_7'), '8+ yrs': t('exp.8plus'),
  };

  const quizCard = {
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '20px', padding: 'clamp(24px, 5vw, 40px)',
    maxWidth: '520px', margin: '0 auto', position: 'relative',
  };
  const quizBtn = { fontFamily: "'Be Vietnam Pro', sans-serif", cursor: 'pointer', border: 'none' };
  const ctaStyle = {
    ...quizBtn, width: '100%', background: '#ff4400', color: '#fff', fontSize: '16px',
    fontWeight: 700, padding: '16px', borderRadius: '14px',
    boxShadow: '0 8px 32px rgba(255,68,0,0.3)', transition: 'all .15s',
  };
  const optBase = {
    ...quizBtn, padding: '15px 12px', borderRadius: '14px', color: 'rgba(255,255,255,0.55)',
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
    fontSize: '14px', fontWeight: 700, textAlign: 'left', transition: 'all .15s',
    width: '100%',
  };
  const optSelected = {
    border: '1px solid #ff4400', background: 'rgba(255,68,0,0.12)', color: '#fff',
    boxShadow: '0 0 20px rgba(255,68,0,0.2)',
  };

  const BlurredTeaser = () => (
    <div style={{ border: '1px solid rgba(255,68,0,0.2)', background: 'rgba(255,68,0,0.05)',
      borderRadius: '18px', padding: '20px', marginBottom: '24px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ filter: 'blur(10px)', pointerEvents: 'none', userSelect: 'none' }}>
        <div style={{ fontSize: '28px', fontWeight: 900, color: '#4ade80' }}>Top 18%</div>
        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>{t('wizard.earningMore')}</div>
        <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '20px', marginTop: '12px' }}>
          <div style={{ height: '100%', width: '82%', background: '#4ade80', borderRadius: '20px' }} />
        </div>
      </div>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
        <Icon name="lock" size={20} color="rgba(255,255,255,0.5)" />
        <span style={{ fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>
          {t('wizard.selectRoleToSee')}
        </span>
      </div>
    </div>
  );

  const heading = stepHeadings[Math.min(wizardStep, 5)];

  return (
    <section id="submit" style={{
      background: '#080808', padding: 'clamp(60px, 8vw, 100px) clamp(16px, 4vw, 52px)',
      fontFamily: "'Be Vietnam Pro', sans-serif", scrollMarginTop: '64px', position: 'relative', overflow: 'hidden',
    }}>
      {/* Ambient glow */}
      <div style={{ position: 'absolute', top: '-200px', left: '-200px', width: '600px', height: '600px',
        background: 'radial-gradient(circle, rgba(255,68,0,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-200px', right: '-200px', width: '600px', height: '600px',
        background: 'radial-gradient(circle, rgba(255,68,0,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

      {wizardStep <= 5 ? (
        <div style={quizCard}>
          {/* Progress bar */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '28px' }}>
            {[1,2,3,4].map(s => (
              <div key={s} style={{ height: '2px', flex: 1, borderRadius: '2px', transition: 'background .3s',
                background: s < wizardStep ? '#ff4400' : s === wizardStep ? 'rgba(255,68,0,0.4)' : 'rgba(255,255,255,0.08)' }} />
            ))}
          </div>

          {/* Step label */}
          {heading && (
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '.14em', color: 'rgba(255,255,255,0.25)',
                textTransform: 'uppercase', marginBottom: '12px' }}>
                {t('wizard.step', { step: Math.min(wizardStep, 4) })}
              </div>
              <h2 style={{ fontSize: 'clamp(28px, 5vw, 36px)', fontWeight: 900, color: '#fff', lineHeight: 1.15, marginBottom: '8px' }}>
                {heading.pre}<em style={{ fontStyle: 'italic', color: '#ff4400' }}>{heading.em}</em>
              </h2>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.3)' }}>{heading.sub}</p>
            </div>
          )}

          {/* Step 1 — Role */}
          {wizardStep === 1 && (
            <div>
              <BlurredTeaser />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {ROLES.map(r => (
                  <button key={r} onClick={() => { setWRole(r); if(typeof gtag==='function') gtag('event','wizard_step_1',{role:r}); track('wizard_step_1', { meta: { role: r }, page: '/' }); setTimeout(() => setWizardStep(2), 300); }}
                    style={{ ...optBase, ...(wRole === r ? optSelected : {}) }}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2 — Experience */}
          {wizardStep === 2 && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                {EXPS.map(e => (
                  <button key={e} onClick={() => { setWExp(e); if(typeof gtag==='function') gtag('event','wizard_step_2',{experience:e}); track('wizard_step_2', { meta: { experience: e }, page: '/' }); setTimeout(() => setWizardStep(3), 300); }}
                    style={{ ...optBase, textAlign: 'center', ...(wExp === e ? optSelected : {}) }}>
                    {EXP_LABELS[e] || e}
                  </button>
                ))}
              </div>
              <button onClick={() => setWizardStep(1)} style={{ ...quizBtn, marginTop: '16px', background: 'none', color: 'rgba(255,255,255,0.25)', fontSize: '12px' }}>{t('wizard.back')}</button>
            </div>
          )}

          {/* Step 3 — Salary */}
          {wizardStep === 3 && (
            <div>
              <BlurredTeaser />
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <span style={{ fontSize: '56px', fontWeight: 900, fontStyle: 'italic', color: salaryTouched ? '#fff' : 'rgba(255,255,255,0.3)', lineHeight: 1 }}>{salaryTouched ? sal : '—'}</span>
                <span style={{ fontSize: '16px', color: 'rgba(255,255,255,0.25)', marginLeft: '8px' }}>{t('wizard.salaryUnit')}</span>
              </div>
              <input type="range" min="5" max="200" value={sal}
                onChange={e => { setWSalary(Number(e.target.value)); setSalaryTouched(true); }}
                style={{ width: '100%', accentColor: '#ff4400', height: '4px', marginBottom: '24px' }}
              />
              <div style={{ textAlign: 'center', fontSize: '11px', color: 'rgba(255,255,255,0.18)', marginBottom: '20px' }}>
                {salaryTouched ? t('wizard.salaryPrivacy') : t('wizard.salaryHint')}
              </div>
              <button onClick={() => { if (!salaryTouched) return; if(typeof gtag==='function') gtag('event','wizard_step_3',{salary:wSalary}); track('wizard_step_3', { meta: { salary: wSalary }, page: '/' }); setWizardStep(4); }}
                disabled={!salaryTouched}
                style={{ ...ctaStyle, ...(salaryTouched ? {} : { opacity: 0.4, cursor: 'not-allowed' }) }}>
                {t('wizard.almostDone')}
              </button>
              <button onClick={() => setWizardStep(2)} style={{ ...quizBtn, marginTop: '12px', background: 'none', color: 'rgba(255,255,255,0.25)', fontSize: '12px', display: 'block', width: '100%', textAlign: 'center' }}>{t('wizard.back')}</button>
            </div>
          )}

          {/* Step 4 — Company (with autocomplete) */}
          {wizardStep === 4 && (
            <div>
              <div ref={acWrapRef} style={{ position: 'relative', marginBottom: '16px' }}>
                {selectedItem ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,68,0,0.08)',
                    border: '1px solid rgba(255,68,0,0.3)', borderRadius: '14px', padding: '14px 16px' }}>
                    {selectedItem.domain ? (
                      <img src={`https://www.google.com/s2/favicons?domain=${selectedItem.domain}&sz=128`} alt=""
                        style={{ width: 28, height: 28, borderRadius: '6px', objectFit: 'contain', background: '#fafaf8' }}
                        onError={e => { e.target.style.display = 'none'; }} />
                    ) : (
                      <div style={{ width: 28, height: 28, borderRadius: '6px', background: 'rgba(255,255,255,0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 800, color: 'rgba(255,255,255,0.4)' }}>
                        {selectedItem.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>{selectedItem.name}</div>
                      {selectedItem.domain && <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>{selectedItem.domain}</div>}
                    </div>
                    <button onClick={clearSelectedItem} style={{ ...quizBtn, background: 'none', color: 'rgba(255,255,255,0.3)', fontSize: '18px', padding: '4px' }}>×</button>
                  </div>
                ) : (
                  <>
                    <input type="text" placeholder="VD: Grab Vietnam, FPT Software…" value={wCompany}
                      onChange={e => { setWCompany(e.target.value); searchCompanies(e.target.value); }}
                      onFocus={() => { if (acResults.length > 0) setAcOpen(true); }}
                      onKeyDown={e => {
                        if (e.key === 'ArrowDown') { e.preventDefault(); setAcHighlight(h => Math.min(h + 1, acResults.length - 1)); }
                        else if (e.key === 'ArrowUp') { e.preventDefault(); setAcHighlight(h => Math.max(h - 1, -1)); }
                        else if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); if (acHighlight >= 0 && acResults[acHighlight]) selectCompany(acResults[acHighlight]); else if (wCompany.trim()) { setAcOpen(false); handleSubmit(); } }
                        else if (e.key === 'Escape') setAcOpen(false);
                      }}
                      autoFocus autoComplete="off"
                      style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1.5px solid rgba(255,255,255,0.1)',
                        borderRadius: '14px', padding: '16px 18px', color: '#fff', fontSize: '15px',
                        fontFamily: "'Be Vietnam Pro', sans-serif", outline: 'none', boxSizing: 'border-box' }}
                    />
                    {acLoading && <div style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>…</div>}
                    {acOpen && (acResults.length > 0 || (wCompany.trim().length >= 2 && isValidCompanyName(wCompany))) && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: '4px',
                        background: '#1a1a18', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px',
                        overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', maxHeight: '280px', overflowY: 'auto' }}>
                        {acResults.map((item, i) => (
                          <div key={item.name + i} onMouseDown={e => { e.preventDefault(); selectCompany(item); }} onMouseEnter={() => setAcHighlight(i)}
                            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', cursor: 'pointer', transition: 'background .1s',
                              background: i === acHighlight ? 'rgba(255,255,255,0.06)' : 'transparent' }}>
                            {item.logo ? (
                              <img src={item.logo} alt="" style={{ width: 22, height: 22, borderRadius: '4px', objectFit: 'contain', background: '#fafaf8', flexShrink: 0 }}
                                onError={e => { e.target.style.display = 'none'; }} />
                            ) : (
                              <div style={{ width: 22, height: 22, borderRadius: '4px', background: 'rgba(255,255,255,0.08)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 800, color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>
                                {item.name.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                              {item.domain && <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '1px' }}>{item.domain}</div>}
                            </div>
                            {item.source === 'db' && <span style={{ fontSize: '9px', fontWeight: 700, color: '#ff4400', background: 'rgba(255,68,0,0.1)', padding: '2px 6px', borderRadius: '4px', flexShrink: 0 }}>FYI</span>}
                          </div>
                        ))}
                        {wCompany.trim().length >= 2 && isValidCompanyName(wCompany) && !acResults.some(r => r.name.toLowerCase() === wCompany.trim().toLowerCase()) && (
                          <div onMouseDown={e => { e.preventDefault(); setAcOpen(false); }}
                            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', cursor: 'pointer', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{ width: 22, height: 22, borderRadius: '4px', background: 'rgba(255,68,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', color: '#ff4400', flexShrink: 0 }}>+</div>
                            <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>{t('wizard.addCompany', { company: '' })}<span style={{ color: '#fff', fontWeight: 600 }}>{wCompany.trim()}</span>"</span>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
              {submitting && <div style={{ textAlign: 'center', fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginTop: '16px' }}>{t('wizard.submitting')}</div>}
              <div style={{ textAlign: 'center', fontSize: '11px', color: 'rgba(255,255,255,0.18)', marginTop: '12px' }}>
                {t('wizard.anonymous')}
              </div>
              <button onClick={() => setWizardStep(3)} style={{ ...quizBtn, marginTop: '12px', background: 'none', color: 'rgba(255,255,255,0.25)', fontSize: '12px', display: 'block', width: '100%', textAlign: 'center' }}>{t('wizard.back')}</button>
            </div>
          )}

          {/* Step 5 — Rating */}
          {wizardStep === 5 && (
            <div>
              <StarRow label="Work-life balance" value={ratingWorklife} onChange={setRatingWorklife} />
              <StarRow label="Salary fairness" value={ratingSalary} onChange={setRatingSalary} />
              <StarRow label="Growth opportunity" value={ratingGrowth} onChange={setRatingGrowth} />
              <button onClick={() => setWizardStep(6)}
                style={{ ...quizBtn, marginTop: '28px', background: 'none', color: 'rgba(255,255,255,0.25)', fontSize: '12px', display: 'block', width: '100%', textAlign: 'center' }}>
                {t('wizard.skip')}
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Result + rate nudge */
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <ResultSection salary={sal} role={wRole} experience={wExp} company={wCompany} isLoggedIn={isLoggedIn} anchor={freshSubmit} />
        </div>
      )}
    </section>
  );
}

export default SubmitSection;
