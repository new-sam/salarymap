// Visual mirror of the public /pages/jobs/[id].js body, used inside the
// company-side job form preview pane. Kept as a standalone component so the
// public page isn't touched. If /pages/jobs/[id].js layout/styles change,
// update this file too to keep the preview faithful.
import Icon from '../Icon';
import { DEFAULT_IMAGES, DEFAULT_WORK_DAYS, DEFAULT_WORK_HOURS, DEFAULT_PAID_LEAVE, DEFAULT_CONTRACT } from '../../constants/jobs';
import { COMPANY_PROFILES } from '../../data/companyProfiles.js';
import { generateCompanyDescription } from '../../utils/companyDescription';

const typeLabel = (t) => t === 'remote' ? 'Remote' : t === 'hybrid' ? 'Hybrid' : t === 'onsite' ? 'On-site' : t || '';

// Normalize the recruiter form shape into the saved-job shape the public page
// expects (tech_stack/benefits arrays, single image as a 1-element array, etc.)
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
    company_initials: (companyName || form.company || '??').slice(0, 2).toUpperCase(),
    company_size: form.company_size || null,
    image_url: form.image_url || '',
    logo_url: form.logo_url || '',
    images: form.image_url ? [form.image_url] : [],
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
    work_days: form.work_days || '',
    work_hours: form.work_hours || '',
    paid_leave: form.paid_leave || '',
    contract_type: form.contract_type || '',
  };
}

export default function JobPreview({ form, companyName, fullscreen = false }) {
  const job = normalize(form, companyName);
  // No fallback to DEFAULT_IMAGES — empty form should look empty, not auto-filled.
  const heroSrc = job.images[0] || job.image_url || '';

  const profile = COMPANY_PROFILES[job.company];
  const deadlineLabel = job.deadline ? (() => {
    const days = Math.ceil((new Date(job.deadline) - new Date()) / 86400000);
    const ddayText = days >= 0 ? `D-${days}` : 'Closed';
    return `${job.deadline} (${ddayText})`;
  })() : '';

  const hasExperience = job.experience_min || job.experience_max;
  const subtitleParts = [job.location, typeLabel(job.type)].filter(Boolean);
  const subtitleText = subtitleParts.join(' · ');
  const hasCompanyMeta = !!(profile || job.company_size || job.company);

  return (
    <div className={`jdp-wrap ${fullscreen ? 'jdp-full' : 'jdp-narrow'}`}>
      <div className="jd-page-inner">
        <div className="jd-img" style={heroSrc ? { backgroundImage: `url(${heroSrc})` } : undefined} />

        <div className="jd-body">
          <div className="jd-company">
            {job.logo_url ? (
              <img src={job.logo_url} alt="" className="jd-co-logo" />
            ) : (
              <div className="jd-co-ini">{job.company ? job.company_initials : ''}</div>
            )}
            <div>
              <div className="jd-co-name">{job.company}</div>
              <div className="jd-co-loc">{subtitleText}</div>
            </div>
          </div>

          <div className="jd-title">{job.title}</div>
          {job.salary_min > 0 && (
            <div className="jd-salary">
              {Math.round(job.salary_min / 1e6)}M – {Math.round(job.salary_max / 1e6)}M VND
            </div>
          )}

          {job.tech_stack.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
              {job.tech_stack.map(t => (
                <span key={t} style={{ fontSize: 12, fontWeight: 600, color: '#333', background: '#f0f0f0', padding: '4px 10px', borderRadius: 5 }}>{t}</span>
              ))}
            </div>
          )}

          <div className="jd-meta-grid">
            <div className="jd-meta-item">
              <div className="jd-meta-label">Experience</div>
              <div className="jd-meta-value">
                {hasExperience
                  ? (job.experience_max >= 30 ? `${job.experience_min}+ years` : `${job.experience_min}–${job.experience_max} years`)
                  : ''}
              </div>
            </div>
            <div className="jd-meta-item">
              <div className="jd-meta-label">Position</div>
              <div className="jd-meta-value">{job.role}</div>
            </div>
            <div className="jd-meta-item">
              <div className="jd-meta-label">Type</div>
              <div className="jd-meta-value">{typeLabel(job.type)}</div>
            </div>
            <div className="jd-meta-item">
              <div className="jd-meta-label">Region</div>
              <div className="jd-meta-value" style={{ textTransform: 'capitalize' }}>{job.location ? job.country : ''}</div>
            </div>
            {job.headcount && (
              <div className="jd-meta-item">
                <div className="jd-meta-label">Headcount</div>
                <div className="jd-meta-value">{job.headcount}</div>
              </div>
            )}
            <div className="jd-meta-item">
              <div className="jd-meta-label">Deadline</div>
              <div className="jd-meta-value">{deadlineLabel}</div>
            </div>
          </div>

          <div className="jd-divider" />

          <div className="jd-section-title">Company Overview</div>
          <div className="jd-company-overview">
            <div className="jd-co-overview-header">
              <div className="jd-co-overview-badge">AI Summary</div>
            </div>
            <div className="jd-co-overview-text">
              {job.company ? generateCompanyDescription(job) : ''}
            </div>
            <div className="jd-co-overview-stats">
              <div className="jd-co-stat">
                <div className="jd-co-stat-num">{profile?.employees?.toLocaleString() || job.company_size || ''}</div>
                <div className="jd-co-stat-label">Employees</div>
              </div>
              <div className="jd-co-stat">
                <div className="jd-co-stat-num">{profile?.founded || ''}</div>
                <div className="jd-co-stat-label">Founded</div>
              </div>
              <div className="jd-co-stat">
                <div className="jd-co-stat-num">{profile?.revenue || ''}</div>
                <div className="jd-co-stat-label">Revenue</div>
              </div>
              <div className="jd-co-stat">
                <div className="jd-co-stat-num">{profile?.funding || ''}</div>
                <div className="jd-co-stat-label">Funding</div>
              </div>
            </div>
          </div>

          <div className="jd-divider" />

          <div className="jd-section-title">Work Information</div>
          <div className="jd-work-info">
            <div className="jd-work-item">
              <div className="jd-work-icon"><Icon name="calendar" size={18} color="#555" /></div>
              <div>
                <div className="jd-work-label">Work Days</div>
                <div className="jd-work-value">{job.work_days || DEFAULT_WORK_DAYS}</div>
              </div>
            </div>
            <div className="jd-work-item">
              <div className="jd-work-icon"><Icon name="clock" size={18} color="#555" /></div>
              <div>
                <div className="jd-work-label">Work Hours</div>
                <div className="jd-work-value">{job.work_hours || DEFAULT_WORK_HOURS}</div>
              </div>
            </div>
            <div className="jd-work-item">
              <div className="jd-work-icon"><Icon name="mapPin" size={18} color="#555" /></div>
              <div>
                <div className="jd-work-label">Work Type</div>
                <div className="jd-work-value">{job.type === 'remote' ? 'Fully Remote' : job.type === 'hybrid' ? 'Hybrid (Office + Remote)' : 'On-site'}</div>
              </div>
            </div>
            <div className="jd-work-item">
              <div className="jd-work-icon"><Icon name="palmTree" size={18} color="#555" /></div>
              <div>
                <div className="jd-work-label">Paid Leave</div>
                <div className="jd-work-value">{job.paid_leave || DEFAULT_PAID_LEAVE}</div>
              </div>
            </div>
            <div className="jd-work-item">
              <div className="jd-work-icon"><Icon name="clipboard" size={18} color="#555" /></div>
              <div>
                <div className="jd-work-label">Contract</div>
                <div className="jd-work-value">{job.contract_type || DEFAULT_CONTRACT}</div>
              </div>
            </div>
            <div className="jd-work-item">
              <div className="jd-work-icon"><Icon name="hospital" size={18} color="#555" /></div>
              <div>
                <div className="jd-work-label">Insurance</div>
                <div className="jd-work-value">Social & Health Insurance</div>
              </div>
            </div>
          </div>

          <div className="jd-divider" />

          <div className="jd-section-title">About this position</div>
          <div className="jd-desc">{job.description}</div>

          {job.benefits.length > 0 && (
            <>
              <div className="jd-divider" />
              <div className="jd-section-title">Benefits</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
                {job.benefits.map(b => (
                  <span key={b} style={{ fontSize: 13, color: '#166534', background: '#f0fff4', border: '1px solid #86efac', padding: '5px 12px', borderRadius: 6 }}>{b}</span>
                ))}
              </div>
            </>
          )}

          {job.hiring_process && (
            <>
              <div className="jd-divider" />
              <div className="jd-section-title">Hiring Process</div>
              <div style={{ fontSize: 14, color: '#444', marginBottom: 24, whiteSpace: 'pre-line' }}>{job.hiring_process}</div>
            </>
          )}
        </div>
      </div>

      <style jsx>{`
        .jdp-wrap { width: 100%; }
        .jdp-narrow :global(.jd-page-inner) { background: #fafaf8; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 8px rgba(0,0,0,0.06); }
        .jdp-full   :global(.jd-page-inner) { background: #fafaf8; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 8px rgba(0,0,0,0.06); max-width: 720px; margin: 0 auto; }

        .jdp-wrap :global(.jd-img) { width: 100%; max-height: 400px; background: #f0f0f0; background-size: contain; background-position: center; background-repeat: no-repeat; aspect-ratio: 16/9; }
        .jdp-wrap :global(.jd-body) { padding: 24px 24px 32px; }
        .jdp-full  :global(.jd-body) { padding: 28px 32px 40px; }

        .jdp-wrap :global(.jd-company) { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
        .jdp-wrap :global(.jd-co-ini) { width: 44px; height: 44px; border-radius: 10px; background: #f0f0f0; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 800; color: #555; flex-shrink: 0; }
        .jdp-wrap :global(.jd-co-logo) { width: 44px; height: 44px; border-radius: 10px; object-fit: contain; background: #fafafa; border: 1px solid #f0f0f0; flex-shrink: 0; }
        .jdp-wrap :global(.jd-co-name) { font-size: 15px; font-weight: 600; color: #111; }
        .jdp-wrap :global(.jd-co-loc) { font-size: 13px; color: #777; }
        .jdp-wrap :global(.jd-title) { font-size: 20px; font-weight: 800; color: #111; margin-bottom: 8px; letter-spacing: -0.3px; line-height: 1.25; }
        .jdp-full  :global(.jd-title) { font-size: 22px; }
        .jdp-wrap :global(.jd-salary) { font-size: 16px; font-weight: 700; color: #ff4400; margin-bottom: 20px; }
        .jdp-wrap :global(.jd-divider) { height: 1px; background: #f0f0f0; margin: 20px 0; }
        .jdp-full  :global(.jd-divider) { margin: 24px 0; }
        .jdp-wrap :global(.jd-section-title) { font-size: 11px; font-weight: 700; color: #999; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 12px; }
        .jdp-wrap :global(.jd-desc) { font-size: 14px; color: #444; line-height: 1.8; margin-bottom: 24px; white-space: pre-line; }
        .jdp-wrap :global(.jd-meta-grid) { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }
        .jdp-wrap :global(.jd-meta-item) { background: #f9f9f8; border-radius: 8px; padding: 10px 12px; }
        .jdp-wrap :global(.jd-meta-label) { font-size: 10px; font-weight: 700; color: #999; text-transform: uppercase; letter-spacing: .04em; margin-bottom: 4px; }
        .jdp-wrap :global(.jd-meta-value) { font-size: 13px; font-weight: 600; color: #111; min-height: 1.2em; }
        .jdp-wrap :global(.jd-img) { background-color: #f0f0f0; }
        .jdp-wrap :global(.jd-co-name:empty), .jdp-wrap :global(.jd-co-loc:empty), .jdp-wrap :global(.jd-title:empty), .jdp-wrap :global(.jd-desc:empty) { min-height: 0.5em; }

        .jdp-wrap :global(.jd-work-info) { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 24px; }
        .jdp-wrap :global(.jd-work-item) { display: flex; align-items: center; gap: 10px; background: #fafafa; border: 1px solid #f0f0f0; border-radius: 10px; padding: 10px 12px; }
        .jdp-wrap :global(.jd-work-icon) { font-size: 18px; flex-shrink: 0; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: #fafaf8; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
        .jdp-wrap :global(.jd-work-label) { font-size: 10.5px; color: #999; font-weight: 600; text-transform: uppercase; letter-spacing: .03em; }
        .jdp-wrap :global(.jd-work-value) { font-size: 12.5px; color: #222; font-weight: 600; margin-top: 2px; }

        .jdp-wrap :global(.jd-company-overview) { background: linear-gradient(135deg, #f8f9ff 0%, #f0f4ff 100%); border: 1px solid #e0e7ff; border-radius: 12px; padding: 18px; margin-bottom: 24px; }
        .jdp-wrap :global(.jd-co-overview-header) { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
        .jdp-wrap :global(.jd-co-overview-badge) { font-size: 11px; font-weight: 700; color: #6366f1; background: #e0e7ff; padding: 3px 10px; border-radius: 20px; display: inline-flex; align-items: center; gap: 4px; }
        .jdp-wrap :global(.jd-co-overview-badge)::before { content: '✦'; font-size: 10px; }
        .jdp-wrap :global(.jd-co-overview-text) { font-size: 13px; color: #374151; line-height: 1.7; margin-bottom: 14px; white-space: pre-line; }
        .jdp-wrap :global(.jd-co-overview-stats) { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border-top: 1px solid #e0e7ff; padding-top: 12px; }
        .jdp-wrap :global(.jd-co-stat) { text-align: center; padding: 6px 0; }
        .jdp-wrap :global(.jd-co-stat):nth-child(odd) { border-right: 1px solid #e0e7ff; }
        .jdp-wrap :global(.jd-co-stat-num) { font-size: 14px; font-weight: 800; color: #111; }
        .jdp-wrap :global(.jd-co-stat-label) { font-size: 11px; color: #777; margin-top: 2px; }
      `}</style>
    </div>
  );
}
