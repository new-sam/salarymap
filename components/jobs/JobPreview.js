// Visual mirror of the CURRENT /pages/jobs.js right-side detail panel (.jd),
// used inside the admin & company job-form preview panes. Kept standalone so the
// public page isn't touched. If the jobs.js detail panel layout/styles change,
// update this file too to keep the preview faithful. (2026-07 리디자인 반영:
// 제목 → 회사명 단독 줄 → 지역·형태·경력·마감 서브라인 → 연봉 → 스택 칩 구조)
const typeLabel = (t) => t === 'remote' ? 'Remote' : t === 'hybrid' ? 'Hybrid' : t === 'onsite' ? 'On-site' : t || '';

// Normalize the recruiter/admin form shape into the saved-job shape the public
// panel expects (tech_stack/benefits arrays, images array, etc.)
function normalize(form, companyName) {
  const techArr = typeof form.tech_stack === 'string'
    ? form.tech_stack.split(',').map(s => s.trim()).filter(Boolean)
    : (Array.isArray(form.tech_stack) ? form.tech_stack : []);
  const benefitsArr = typeof form.benefits === 'string'
    ? form.benefits.split(',').map(s => s.trim()).filter(Boolean)
    : (Array.isArray(form.benefits) ? form.benefits : []);
  return {
    title: form.title || '',
    description: form.description || '',
    company: companyName || form.company || '',
    company_url: form.company_url || '',
    company_size: form.company_size || null,
    image_url: form.image_url || '',
    logo_url: form.logo_url || '',
    // 어드민 폼은 사진 배열(images)을 직접 관리 — 있으면 그대로, 없으면 단일 썸네일 폴백
    images: Array.isArray(form.images) && form.images.length ? form.images : (form.image_url ? [form.image_url] : []),
    role: form.role || '',
    type: form.type || '',
    location: form.location || '',
    country: form.country || 'vietnam',
    salary_min: Number(form.salary_min) || 0,
    salary_max: Number(form.salary_max) || 0,
    experience_min: Number(form.experience_min) || 0,
    experience_max: Number(form.experience_max) || 0,
    tech_stack: techArr,
    benefits: benefitsArr,
    headcount: form.headcount || null,
    deadline: form.deadline || null,
    hiring_process: form.hiring_process || null,
  };
}

// panel: 실사이트 우측 상세 패널(.jd)처럼 풀블리드로 렌더 (radius/그림자 없음, 전체 높이)
export default function JobPreview({ form, companyName, fullscreen = false, panel = false }) {
  const job = normalize(form, companyName);
  // No fallback to DEFAULT_IMAGES — empty form should look empty, not auto-filled.
  const heroSrc = job.images[0] || '';

  const expText = !job.experience_min && !job.experience_max
    ? 'Any level'
    : job.experience_max >= 30
      ? `${job.experience_min || 0}+ yrs`
      : `${job.experience_min}–${job.experience_max} yrs`;
  const deadlineText = job.deadline
    ? (() => {
        const days = Math.ceil((new Date(job.deadline) - new Date()) / 86400000);
        return days >= 0 ? `D-${days}` : 'Closed';
      })()
    : 'Ongoing';

  return (
    <div className={`jdp-wrap ${panel ? 'jdp-panel' : fullscreen ? 'jdp-full' : 'jdp-narrow'}`}>
      <div className="jd-page-inner">
        {/* Hero image (+ 상단 그라데이션 셰이드, 사진 여러 장이면 도트) */}
        <div style={{ position: 'relative' }}>
          <div className="jd-img" style={heroSrc ? { backgroundImage: `url(${heroSrc})` } : undefined} />
          <div className="jd-img-shade" />
          {job.images.length > 1 && (
            <div className="jd-dots">
              {job.images.map((_, i) => <span key={i} className={i === 0 ? 'on' : ''} />)}
            </div>
          )}
        </div>

        <div className="jd-body">
          {/* Title → 회사명 단독 줄 → 서브라인 (현행 상세 패널 순서) */}
          <div className="jd-title">{job.title}</div>
          <span className="jd-co-line">{job.company}</span>

          <div className="jd-subline">
            {job.location && <><span>{job.location}</span><span className="jd-subline-sep">·</span></>}
            <span>{typeLabel(job.type)}</span>
            <span className="jd-subline-sep">·</span>
            <span>{expText}</span>
            <span className="jd-subline-sep">·</span>
            <span>{deadlineText}</span>
            {job.company_url && <><span className="jd-subline-sep">·</span><span className="jd-subline-web">Website</span></>}
          </div>

          {job.salary_min > 0 && (
            <div className="jd-salary">{Math.round(job.salary_min / 1e6)}M – {Math.round(job.salary_max / 1e6)}M VND</div>
          )}

          {job.tech_stack.length > 0 && (
            <div className="jd-tech">
              {job.tech_stack.map(t => <span key={t}>{t}</span>)}
            </div>
          )}

          {(job.company_size || job.headcount) && (
            <div className="jd-meta-grid">
              {job.company_size && (
                <div className="jd-meta-item">
                  <div className="jd-meta-label">Company size</div>
                  <div className="jd-meta-value">{job.company_size}</div>
                </div>
              )}
              {job.headcount && (
                <div className="jd-meta-item">
                  <div className="jd-meta-label">Headcount</div>
                  <div className="jd-meta-value">{job.headcount}</div>
                </div>
              )}
            </div>
          )}

          <div className="jd-divider" />

          <div className="jd-section-title">About the Role</div>
          <div className="jd-desc">
            {job.description || (job.company && job.title
              ? `${job.company} is looking for a ${job.title} to join their team${job.location ? ` in ${job.location}` : ''}.`
              : '')}
          </div>

          {job.benefits.length > 0 && (
            <>
              <div className="jd-divider" />
              <div className="jd-section-title">Benefits</div>
              <div className="jd-benefits">
                {job.benefits.map(b => <span key={b}>{b}</span>)}
              </div>
            </>
          )}

          {job.hiring_process && (
            <>
              <div className="jd-divider" />
              <div className="jd-section-title">Hiring Process</div>
              <div className="jd-hp">{job.hiring_process}</div>
            </>
          )}
        </div>

        {/* 하단 지원 버튼 바 (실페이지의 sticky 지원 버튼 미러 — 프리뷰라 비활성) */}
        <div className="jd-apply-float">
          <div className="jd-apply-btn">Apply Now</div>
        </div>
      </div>

      <style jsx>{`
        .jdp-wrap { width: 100%; }
        .jdp-narrow :global(.jd-page-inner) { background: #fafaf8; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 8px rgba(0,0,0,0.06); }
        .jdp-full   :global(.jd-page-inner) { background: #fafaf8; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 8px rgba(0,0,0,0.06); max-width: 760px; margin: 0 auto; }
        .jdp-panel  { height: 100%; }
        .jdp-panel  :global(.jd-page-inner) { background: #fafaf8; min-height: 100%; display: flex; flex-direction: column; }
        .jdp-panel  :global(.jd-body) { flex: 1; }
        .jdp-panel  :global(.jd-apply-float) { position: sticky; bottom: 0; }

        /* ↓ pages/jobs.js 상세 패널(.jd)의 현행 스타일 미러 */
        .jdp-wrap :global(.jd-img) { width: 100%; max-height: 400px; background-color: #f0f0f0; background-size: contain; background-position: center; background-repeat: no-repeat; aspect-ratio: 16/9; }
        .jdp-wrap :global(.jd-img-shade) { position: absolute; top: 0; left: 0; right: 0; height: 88px; background: linear-gradient(180deg, rgba(0,0,0,0.32), rgba(0,0,0,0)); pointer-events: none; }
        .jdp-wrap :global(.jd-dots) { position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%); display: flex; gap: 6px; }
        .jdp-wrap :global(.jd-dots span) { width: 7px; height: 7px; border-radius: 50%; background: rgba(255,255,255,0.4); }
        .jdp-wrap :global(.jd-dots span.on) { background: #fff; }
        .jdp-wrap :global(.jd-body) { padding: 28px 32px 40px; }
        .jdp-wrap :global(.jd-title) { font-size: 22px; font-weight: 800; color: #111; margin-bottom: 10px; letter-spacing: -0.3px; line-height: 1.3; min-height: 0.5em; }
        .jdp-wrap :global(.jd-co-line) { display: inline-block; font-size: 15px; font-weight: 700; color: #111; text-decoration: underline; text-underline-offset: 2px; margin-bottom: 6px; min-height: 0.5em; }
        .jdp-wrap :global(.jd-subline) { display: flex; align-items: center; flex-wrap: wrap; gap: 7px; font-size: 14px; color: #666; margin-bottom: 16px; }
        .jdp-wrap :global(.jd-subline-sep) { color: #ccc; }
        .jdp-wrap :global(.jd-subline-web) { color: #ff4400; }
        .jdp-wrap :global(.jd-salary) { font-size: 16px; font-weight: 700; color: #ff4400; margin-bottom: 24px; }
        .jdp-wrap :global(.jd-tech) { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 16px; }
        .jdp-wrap :global(.jd-tech span) { font-size: 12px; font-weight: 600; color: #333; background: #f0f0f0; padding: 4px 10px; border-radius: 5px; }
        .jdp-wrap :global(.jd-meta-grid) { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }
        .jdp-wrap :global(.jd-meta-item) { background: #f9f9f8; border-radius: 8px; padding: 12px 14px; }
        .jdp-wrap :global(.jd-meta-label) { font-size: 10px; font-weight: 700; color: #999; text-transform: uppercase; letter-spacing: .04em; margin-bottom: 4px; }
        .jdp-wrap :global(.jd-meta-value) { font-size: 14px; font-weight: 600; color: #111; }
        .jdp-wrap :global(.jd-divider) { height: 1px; background: #f0f0f0; margin: 24px 0; }
        .jdp-wrap :global(.jd-section-title) { font-size: 18px; font-weight: 800; color: #111; letter-spacing: -0.02em; margin-bottom: 14px; }
        .jdp-wrap :global(.jd-desc) { font-size: 14px; color: #444; line-height: 1.8; margin-bottom: 24px; white-space: pre-line; min-height: 1em; }
        .jdp-wrap :global(.jd-benefits) { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 24px; }
        .jdp-wrap :global(.jd-benefits span) { font-size: 13px; color: #166534; background: #f0fff4; border: 1px solid #86efac; padding: 5px 12px; border-radius: 6px; }
        .jdp-wrap :global(.jd-hp) { font-size: 14px; color: #444; margin-bottom: 24px; white-space: pre-line; }
        .jdp-wrap :global(.jd-apply-float) { background: #fafaf8; padding: 16px 32px; border-top: 1px solid #f0f0f0; }
        .jdp-wrap :global(.jd-apply-btn) { width: 100%; padding: 14px; background: #ff4400; color: #fff; border: none; border-radius: 8px; font-size: 15px; font-weight: 700; text-align: center; opacity: 0.9; }
      `}</style>
    </div>
  );
}
