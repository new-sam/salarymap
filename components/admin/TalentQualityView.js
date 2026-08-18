import { useState, useMemo } from 'react'
import { useAdmin } from '../../lib/adminSwr'
import { asExperiences } from '../../lib/talentCategory'
import { schoolBucketOf, enBucketOf, koBucketOf, levelBucketOf, brandTypesOf, BRAND_TYPES } from '../../lib/talentQuality'

// 인재 퀄리티(Talent quality) — 인재풀의 "급"을 이루는 신호(사진/학벌/어학/경력/네임밸류/포폴)가
// 얼마나 채워져 있고 어떤 등급 분포인지 보는 화면. 좋은 인재의 기준이 시장마다 달라서
// (한국행 = 한국어·학벌, VN 현지 = 연차·현지 네임밸류·영어) 두 렌즈의 코어를 나란히 보여준다.
// 데이터는 인재풀 탭과 동일한 /api/admin/resumes 를 재사용, 집계는 전부 클라이언트.

// ── 기업이 실제로 뽑는 신호 (8/18 실측 스냅샷) ──────────────────────────
// KTC 입사자 CV 21건 vs 지원자 표본 116건(탈락+통과, 자체 AI 스크리닝 판정 무시,
// 모집단 40:60 가중)을 동일 파서로 직파싱해 비교한 결과. CV가 ktc-support DB에만
// 있어 라이브 재계산 불가 — 재분석 시 이 상수를 갱신한다(memory/hired-vs-applicants 참조).
// 결론: 채용을 가른 건 언어뿐. 경력·학벌·네임밸류·포폴은 안 갈렸다.
const HIRE_SNAPSHOT = {
  date: '2026-08-18',
  hiredN: 21,
  applicantN: 116,
  rows: [
    // hired/appl = %, tone: up(가르는 신호)·flat(무차별)·down(역방향)
    { key: 'enMidUp', hired: 52.4, appl: 31.6, lift: '1.66x', p: '.08', tone: 'up' },
    { key: 'enHigh', hired: 23.8, appl: 11.2, lift: '2.13x', p: '.15', tone: 'up' },
    { key: 'koAny', hired: 14.3, appl: 4.3, lift: '3.29x', p: '.11', tone: 'up' },
    { key: 'schoolTop', hired: 52.4, appl: 40.2, lift: '1.30x', p: '.34', tone: 'flat' },
    { key: 'exp2y', hired: 33.3, appl: 32.2, lift: '1.03x', p: '1.0', tone: 'flat' },
    { key: 'brand', hired: 4.8, appl: 17.4, lift: '0.27x', p: '.20', tone: 'down' },
    { key: 'links', hired: 47.6, appl: 53.2, lift: '0.90x', p: '.64', tone: 'flat' },
  ],
}

export default function TalentQualityView({ token, lang }) {
  const ko = lang === 'ko'
  const L = (k, e, v) => (lang === 'vi' ? (v ?? e) : ko ? k : e)
  const { data: all, isLoading } = useAdmin('/api/admin/resumes', token)
  const [showCompanies, setShowCompanies] = useState(false)

  const S = useMemo(() => {
    if (!Array.isArray(all) || all.length === 0) return null
    const N = all.length
    const rows = all.map(r => {
      const exps = asExperiences(r.experiences)
      const links = Array.isArray(r.resume_summary?.links) ? r.resume_summary.links : []
      const brands = brandTypesOf(exps)
      const school = schoolBucketOf(r)
      const en = enBucketOf(r.english_cert)
      const kor = koBucketOf(r.korean_cert)
      const level = levelBucketOf(r.yoe_months)
      // 복합 신호 6종 — 사진 / 명문·해외대 / 어학(영어 상급 ∪ 한국어 중급+) / 경력 2y+ / 포폴 링크 / 유명기업
      const signals = [
        !!r.photo_url,
        school === 'top' || school === 'overseas',
        en === 'high' || kor === 'high' || kor === 'mid',
        (r.yoe_months || 0) >= 24,
        links.length > 0,
        brands.size > 0,
      ].filter(Boolean).length
      return { r, exps, links, brands, school, en, kor, level, signals }
    })
    const count = fn => rows.filter(fn).length
    const dist = (key, order) => order.map(k => [k, count(x => x[key] === k)])

    const exp2y = x => (x.r.yoe_months || 0) >= 24
    const coCount = {}
    for (const x of rows) for (const e of x.exps) {
      const c = (e?.company || '').trim().toLowerCase().replace(/\s+/g, ' ')
      if (c) coCount[c] = (coCount[c] || 0) + 1
    }

    return {
      N,
      publicN: count(x => !!x.r.is_resume_public),
      coverage: {
        photo: count(x => !!x.r.photo_url),
        school: count(x => x.school !== 'none'),
        english: count(x => x.en !== 'none'),
        korean: count(x => x.kor !== 'none'),
        career: count(x => x.exps.length > 0),
        brand: count(x => x.brands.size > 0),
        links: count(x => x.links.length > 0),
        salary: count(x => x.r.current_salary != null || x.r.verified_salary != null),
      },
      school: dist('school', ['top', 'overseas', 'strong', 'other', 'none']),
      en: dist('en', ['high', 'mid', 'low', 'unknown', 'none']),
      kor: dist('kor', ['high', 'mid', 'low', 'unknown', 'none']),
      level: dist('level', ['new', 'junior', 'mid', 'senior', 'unknown']),
      brands: BRAND_TYPES.map(t => [t.key, count(x => x.brands.has(t.key))]),
      vnCore: count(exp2y),
      vnCoreBrand: count(x => exp2y(x) && x.brands.size > 0),
      vnCoreEnMid: count(x => exp2y(x) && (x.en === 'high' || x.en === 'mid')),
      krCore: count(x => x.kor === 'high' || x.kor === 'mid'),
      krCoreHigh: count(x => x.kor === 'high'),
      krGroupExp: count(x => x.brands.has('krGroup')),
      signalStack: [6, 5, 4, 3, 2, 1, 0].map(n => [n, count(x => x.signals === n)]),
      signals4up: count(x => x.signals >= 4),
      topCompanies: Object.entries(coCount).sort((a, b) => b[1] - a[1]).slice(0, 40),
    }
  }, [all])

  if (isLoading || !all) return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>{L('불러오는 중…', 'Loading…', 'Đang tải…')}</div>
  if (!S) return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>{all?.error || L('이력서를 등록한 인재가 아직 없습니다.', 'No resumes yet.', 'Chưa có CV nào.')}</div>

  const pct = n => `${(n / S.N * 100).toFixed(1)}%`

  const stat = (label, value, sub) => (
    <div style={{ background: '#fff', border: '1px solid #E5E8EB', borderRadius: 12, padding: '14px 16px', minWidth: 150 }}>
      <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 4 }}>{sub}</div>}
    </div>
  )

  // 미니바 한 줄 — 어드민 공통 표+미니바 패턴
  const Row = ({ label, sub, n, color = '#2563EB' }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderTop: '1px solid #F1F5F9' }}>
      <div style={{ width: 190, fontSize: 12.5, color: '#374151', fontWeight: 600, flexShrink: 0, lineHeight: 1.3 }}>
        {label}
        {sub && <div style={{ fontSize: 10.5, color: '#9CA3AF', fontWeight: 400 }}>{sub}</div>}
      </div>
      <div style={{ flex: 1, height: 8, background: '#F1F5F9', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${(n / S.N) * 100}%`, height: '100%', background: color, borderRadius: 4 }} />
      </div>
      <div style={{ width: 104, textAlign: 'right', fontSize: 12.5, flexShrink: 0 }}>
        <b style={{ color: '#0F172A' }}>{n}</b><span style={{ color: '#9CA3AF' }}> ({pct(n)})</span>
      </div>
    </div>
  )

  const Card = ({ title, note, children }) => (
    <div style={{ background: '#fff', border: '1px solid #E5E8EB', borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0F172A' }}>{title}</div>
      {note && <div style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 2 }}>{note}</div>}
      <div style={{ marginTop: 8 }}>{children}</div>
    </div>
  )

  const SCHOOL_L = {
    top: [L('명문대', 'Top-tier', 'Trường top'), L('인증 top ∪ 상위권 분류', 'verified top ∪ classified top', '')],
    overseas: [L('해외대', 'Overseas', 'Du học'), null],
    strong: [L('상위권', 'Strong', 'Khá'), null],
    other: [L('기타 대학', 'Other', 'Khác'), null],
    none: [L('미기재', 'Not stated', 'Chưa ghi'), null],
  }
  const EN_L = {
    high: [L('상급', 'Advanced', 'Cao'), 'IELTS 7+ · TOEIC 850+ · fluent'],
    mid: [L('중급', 'Intermediate', 'Trung'), 'IELTS 6+ · TOEIC 700+ · B2'],
    low: [L('기초', 'Basic', 'Cơ bản'), 'IELTS <6 · TOEIC <700 · B1'],
    unknown: [L('판별불가', 'Unclear', 'Không rõ'), L('표기 있으나 급간 불명', 'stated but level unclear', 'có ghi nhưng không rõ trình độ')],
    none: [L('미기재', 'Not stated', 'Chưa ghi'), null],
  }
  const KO_L = {
    high: [L('상급', 'Advanced', 'Cao'), 'TOPIK 5+ · fluent'],
    mid: [L('중급', 'Intermediate', 'Trung'), 'TOPIK 3-4 · intermediate'],
    low: [L('기초', 'Basic', 'Cơ bản'), 'TOPIK 1-2 · beginner'],
    unknown: [L('판별불가', 'Unclear', 'Không rõ'), L('표기 있으나 급간 불명', 'stated but level unclear', 'có ghi nhưng không rõ trình độ')],
    none: [L('미기재', 'Not stated', 'Chưa ghi'), null],
  }
  const LEVEL_L = {
    new: [L('신입', 'New grad', 'Fresher'), null],
    junior: [L('주니어', 'Junior', 'Junior'), '< 2y'],
    mid: [L('미들', 'Mid', 'Middle'), '2-5y'],
    senior: [L('시니어', 'Senior', 'Senior'), '5y+'],
    unknown: [L('미상', 'Unknown', 'Chưa rõ'), null],
  }
  const HIRE_L = {
    enMidUp: L('영어 중급+', 'English mid+', 'T.Anh TB+'),
    enHigh: L('영어 상급', 'English adv', 'T.Anh cao'),
    koAny: L('한국어 기재', 'Korean stated', 'Có T.Hàn'),
    schoolTop: L('명문/해외대', 'Top/overseas school', 'Trường top/du học'),
    exp2y: L('경력 2y+', '2y+ career', '2y+ kinh nghiệm'),
    brand: L('유명기업 경력', 'Brand employer', 'Cty tên tuổi'),
    links: L('포폴 링크', 'Portfolio', 'Portfolio'),
  }
  const COVERAGE_ROWS = [
    ['photo', L('사진', 'Photo', 'Ảnh')],
    ['school', L('학교 기재', 'School stated', 'Có trường')],
    ['english', L('영어 어학 기재', 'English stated', 'Có T.Anh')],
    ['korean', L('한국어 기재', 'Korean stated', 'Có T.Hàn')],
    ['career', L('경력 1건+', 'Career 1+', 'Có kinh nghiệm')],
    ['brand', L('유명기업 경력(현지 포함)', 'Brand-name employer', 'Công ty tên tuổi')],
    ['links', L('포폴·링크', 'Portfolio links', 'Link portfolio')],
    ['salary', L('연봉 파악(기입∪뱃지)', 'Salary known', 'Biết lương')],
  ]
  const grid2 = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }

  return (
    <div style={{ paddingBottom: 40 }}>
      <div style={{ marginBottom: 6 }}>
        <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 4px' }}>{L('인재 퀄리티', 'Talent quality', 'Chất lượng ứng viên')}</h3>
        <div style={{ fontSize: 12.5, color: '#6B7280' }}>
          {L(
            '이력서 보유 인재의 퀄리티 신호 분포 — 좋은 인재의 기준이 시장마다 달라 한국행(한국어·학벌)과 베트남 현지(연차·네임밸류·영어) 두 렌즈로 본다.',
            'Quality-signal distribution of the resume pool — viewed through two lenses: Korea-bound (Korean, school) and Vietnam-local (seniority, brand employers, English).',
            'Phân bố tín hiệu chất lượng của nguồn CV — theo hai lăng kính: sang Hàn (tiếng Hàn, trường) và nội địa VN (thâm niên, công ty tên tuổi, tiếng Anh).'
          )}
        </div>
      </div>

      {/* 기업이 실제로 뽑는 신호 — 8/18 실측 스냅샷 (CV가 ktc-support DB에만 있어 라이브 아님) */}
      <div style={{ background: '#fff', border: '1px solid #E5E8EB', borderRadius: 12, padding: '14px 16px', marginTop: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0F172A' }}>
            {L('한국계 기업이 실제로 뽑는 신호 — 입사자 vs 지원자', 'What Korean companies actually hire for — hired vs applicants', 'Tín hiệu doanh nghiệp Hàn thực sự tuyển — trúng tuyển vs ứng viên')}
          </div>
          <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600 }}>
            {L('8/18 실측 스냅샷', 'Snapshot Aug 18', 'Snapshot 18/8')} · n={HIRE_SNAPSHOT.hiredN} vs {HIRE_SNAPSHOT.applicantN}
          </span>
        </div>
        <div style={{ fontSize: 12.5, color: '#374151', margin: '6px 0 2px', fontWeight: 600 }}>
          {L(
            '채용을 가른 건 언어뿐 — 경력·학벌·네임밸류·포폴은 안 갈렸다. 전달 우선순위는 연차보다 어학.',
            'Only language moved hiring — seniority, school, brand employers and portfolios did not. Forward by language, not years.',
            'Chỉ ngôn ngữ tạo khác biệt — thâm niên, trường, công ty tên tuổi thì không. Ưu tiên ngoại ngữ khi giới thiệu.'
          )}
        </div>
        <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 8 }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#ff6000', marginRight: 4 }} />{L('입사자', 'Hired', 'Trúng tuyển')}
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#94A3B8', margin: '0 4px 0 10px' }} />{L('지원자', 'Applicants', 'Ứng viên')}
        </div>
        {HIRE_SNAPSHOT.rows.map(r => (
          <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderTop: '1px solid #F1F5F9' }}>
            <div style={{ width: 150, fontSize: 12.5, fontWeight: 600, color: '#374151', flexShrink: 0 }}>{HIRE_L[r.key]}</div>
            <div style={{ flex: 1, display: 'grid', gap: 3 }}>
              <div style={{ height: 6, background: '#F1F5F9', borderRadius: 3 }}><div style={{ width: `${r.hired}%`, height: '100%', background: '#ff6000', borderRadius: 3 }} /></div>
              <div style={{ height: 6, background: '#F1F5F9', borderRadius: 3 }}><div style={{ width: `${r.appl}%`, height: '100%', background: '#94A3B8', borderRadius: 3 }} /></div>
            </div>
            <div style={{ width: 170, textAlign: 'right', fontSize: 12, flexShrink: 0, color: '#6B7280' }}>
              <b style={{ color: '#0F172A' }}>{r.hired}%</b> vs {r.appl}%
              <b style={{ marginLeft: 7, color: r.tone === 'up' ? '#ff6000' : r.tone === 'down' ? '#DC2626' : '#9CA3AF' }}>{r.lift}</b>
            </div>
          </div>
        ))}
        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 8, lineHeight: 1.5 }}>
          {L(
            'KTC 입사자 CV 21건 vs 지원자 표본 116건(탈락+통과, 자체 AI 스크리닝 판정 무시·모집단 40:60 가중)을 동일 파서로 직파싱해 비교. 표본이 작아 p<.05 미달(영어 중급+ p=.08) — 방향성 참고. 재분석 시 코드 상수(HIRE_SNAPSHOT) 갱신.',
            'Parsed 21 hired CVs vs 116 applicant CVs (rejected+passed, ignoring our own AI screening; population-weighted 40:60) with the same parser. Small n, p<.05 not reached (EN mid+ p=.08) — directional. Update HIRE_SNAPSHOT on re-analysis.',
            'So sánh 21 CV trúng tuyển vs 116 CV ứng viên (bỏ qua sàng lọc AI nội bộ). Mẫu nhỏ — chỉ mang tính định hướng.'
          )}
        </div>
      </div>

      {/* 요약 카드 — 시장별 코어 규모 */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '14px 0 18px' }}>
        {stat(L('전체 인재풀', 'Pool', 'Tổng'), S.N, `${L('공개', 'public', 'công khai')} ${S.publicN} (${pct(S.publicN)})`)}
        {stat(L('VN 현지 코어 (경력 2y+)', 'VN core (2y+)', 'Core VN (2y+)'), S.vnCore, `${L('유명기업', 'brand', 'cty tên tuổi')} ${S.vnCoreBrand} · ${L('영어 중급+', 'EN mid+', 'T.Anh TB+')} ${S.vnCoreEnMid}`)}
        {stat(L('한국행 코어 (한국어 중급+)', 'KR core (Korean mid+)', 'Core Hàn (T.Hàn TB+)'), S.krCore, `${L('상급', 'adv', 'cao')} ${S.krCoreHigh} · ${L('한국계 경력', 'KR employer', 'cty Hàn')} ${S.krGroupExp}`)}
        {stat(L('유명기업 경력', 'Brand employer', 'Cty tên tuổi'), S.coverage.brand, L('현지 네임밸류 포함', 'incl. VN-local brands', 'gồm thương hiệu VN'))}
        {stat(L('복합신호 4개+', '4+ signals', '4+ tín hiệu'), S.signals4up, `${pct(S.signals4up)} · ${L('6종 중', 'of 6', 'trên 6')}`)}
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {/* 신호별 채움율 — 데이터 병목 추적 */}
        <Card
          title={L('신호별 보유율', 'Signal coverage', 'Tỷ lệ có tín hiệu')}
          note={L('이력서·프로필에서 해당 신호가 확인되는 인원 — 낮은 줄이 데이터 수집 병목.', 'Members with the signal present — low rows are data-collection bottlenecks.', 'Số người có tín hiệu — hàng thấp là điểm nghẽn thu thập dữ liệu.')}
        >
          {COVERAGE_ROWS.map(([k, label]) => <Row key={k} label={label} n={S.coverage[k]} />)}
        </Card>

        {/* 등급 분포 4종 */}
        <div style={grid2}>
          <Card title={L('학벌', 'School tier', 'Trường')}>
            {S.school.map(([k, n]) => <Row key={k} label={SCHOOL_L[k][0]} sub={SCHOOL_L[k][1]} n={n} color={k === 'none' ? '#CBD5E1' : '#2563EB'} />)}
          </Card>
          <Card title={L('영어', 'English', 'Tiếng Anh')}>
            {S.en.map(([k, n]) => <Row key={k} label={EN_L[k][0]} sub={EN_L[k][1]} n={n} color={k === 'none' || k === 'unknown' ? '#CBD5E1' : '#2563EB'} />)}
          </Card>
          <Card title={L('한국어', 'Korean', 'Tiếng Hàn')}>
            {S.kor.map(([k, n]) => <Row key={k} label={KO_L[k][0]} sub={KO_L[k][1]} n={n} color={k === 'none' || k === 'unknown' ? '#CBD5E1' : '#2563EB'} />)}
          </Card>
          <Card title={L('경력 레벨', 'Career level', 'Cấp bậc')}>
            {S.level.map(([k, n]) => <Row key={k} label={LEVEL_L[k][0]} sub={LEVEL_L[k][1]} n={n} color={k === 'unknown' ? '#CBD5E1' : '#2563EB'} />)}
          </Card>
        </div>

        {/* 회사 네임밸류 — 현지 유명 기업도 유명한 것으로 집계 */}
        <Card
          title={L('경력 회사 네임밸류', 'Employer name value', 'Tên tuổi công ty đã làm')}
          note={L('경력 중 1곳이라도 해당되면 집계(중복 허용) — 키워드 러프 매칭이라 표기 편차로 소폭 누락 가능.', 'Counted if any past employer matches (overlaps allowed) — rough keyword match, minor misses possible.', 'Tính nếu từng làm ở công ty khớp (cho phép trùng) — khớp từ khóa nên có thể sót nhẹ.')}
        >
          {S.brands.map(([k, n]) => {
            const t = BRAND_TYPES.find(b => b.key === k)
            return <Row key={k} label={t.label[ko ? 'ko' : lang === 'vi' ? 'vi' : 'en']} sub={t.examples} n={n} color="#0D9488" />
          })}
        </Card>

        {/* 복합 신호 스택 — "몇 개나 갖췄나" */}
        <Card
          title={L('복합 신호 보유 개수', 'Signals held per member', 'Số tín hiệu mỗi người')}
          note={L('6종: 사진 · 명문/해외대 · 어학(영어 상급 ∪ 한국어 중급+) · 경력 2y+ · 포폴 링크 · 유명기업 경력', '6 signals: photo · top/overseas school · language (EN adv ∪ KO mid+) · 2y+ career · portfolio · brand employer', '6 tín hiệu: ảnh · trường top/du học · ngoại ngữ · 2y+ kinh nghiệm · portfolio · công ty tên tuổi')}
        >
          {S.signalStack.map(([k, n]) => <Row key={k} label={`${k}${L('개', '', '')}`} n={n} color={k >= 4 ? '#ff6000' : k >= 2 ? '#FDBA74' : '#CBD5E1'} />)}
        </Card>
      </div>

      {/* 유명기업 리스트 검수용 — 여기서 빠진 유명 회사를 발견하면 lib/talentQuality.js BRAND_TYPES에 추가 */}
      <div style={{ marginTop: 14 }}>
        <button onClick={() => setShowCompanies(v => !v)} style={{ background: 'none', border: 'none', color: '#6B7280', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
          {showCompanies ? '▾' : '▸'} {L('경력 회사명 상위 40 (네임밸류 기준 검수용)', 'Top 40 employer names (for refining the brand list)', 'Top 40 tên công ty (để rà soát danh sách tên tuổi)')}
        </button>
        {showCompanies && (
          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {S.topCompanies.map(([c, n]) => (
              <span key={c} style={{ fontSize: 11.5, padding: '3px 9px', background: '#F1F5F9', borderRadius: 999, color: '#475569' }}>
                {c} <b style={{ color: '#0F172A' }}>{n}</b>
              </span>
            ))}
          </div>
        )}
      </div>

      <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 14, lineHeight: 1.5 }}>
        {L(
          '모수 = 이력서 보유 인재 전체(내부 계정 제외). 어학은 이력서/프로필 기재 기준이라 안 쓴 능력은 못 잡는다. 학벌·어학 컷은 인재풀 탭 최우수 인재 점수와 같은 규칙.',
          'Base = all members with a resume (internal accounts excluded). Language reflects what resumes state — unstated skills are not captured. School/language cuts follow the talent-pool elite scoring rules.',
          'Mẫu = toàn bộ ứng viên có CV (trừ tài khoản nội bộ). Ngoại ngữ tính theo nội dung CV — kỹ năng không ghi sẽ không được tính.'
        )}
      </div>
    </div>
  )
}
