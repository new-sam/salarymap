import supabase from '../../lib/supabaseAdmin';
import { sendPush } from '../../lib/push';
import { canonicalCompanyName } from '../../lib/canonicalCompany';

// 토큰 locale(vi|ko|en)별로 push.js가 고른다. 제목은 회사명(언어 중립)을 그대로 쓴다.
const NEW_SALARY_BODY = {
  vi: 'Có dữ liệu lương mới cho công ty bạn theo dõi',
  ko: '팔로우한 회사에 새 연봉 정보가 올라왔어요',
  en: 'New salary data for a company you follow',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { role, experience, salary, company, source, email, user_id, utm_source, utm_medium, utm_campaign, utm_content } = req.body;

  if (!role || !experience || !salary) {
    return res.status(400).json({ error: 'role, experience, salary are required.' });
  }

  // ── Input validation ──
  const VALID_ROLES = ['Backend','Frontend','Mobile','Data · AI','DevOps','PM · PO','Design','QA'];
  const VALID_EXPS  = ['Under 1yr','1–2 yrs','3–4 yrs','5–7 yrs','8+ yrs'];
  const MIN_SALARY = 3;
  const MAX_SALARY = 300;

  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` });
  }
  if (!VALID_EXPS.includes(experience)) {
    return res.status(400).json({ error: `Invalid experience. Must be one of: ${VALID_EXPS.join(', ')}` });
  }
  const salNum = Number(salary);
  if (!Number.isFinite(salNum) || salNum < MIN_SALARY || salNum > MAX_SALARY) {
    return res.status(400).json({ error: `Salary must be between ${MIN_SALARY} and ${MAX_SALARY} (triệu VND).` });
  }
  if (company && (company.trim().length < 2 || company.trim().length > 100)) {
    return res.status(400).json({ error: 'Company name must be 2–100 characters.' });
  }
  const junkPattern = /^(test|qwer|asdf|abc|xxx|123|zzz|aaa|bbb)/i;
  if (company && junkPattern.test(company.trim())) {
    return res.status(400).json({ error: 'Please enter a real company name.' });
  }

  // Skip DB writes in development (localhost) to keep production data clean
  if (process.env.NODE_ENV === 'development') {
    return res.status(201).json({ success: true, data: { id: 'dev-mock' } });
  }

  // 회사명 분산 방지: 같은 회사의 대소문자 변형을 기존 대표 표기로 통일해 저장한다.
  const canonicalCompany = company && company.trim()
    ? await canonicalCompanyName(company)
    : null;

  // Insert into submissions table — link to user if logged in
  const record = { role, experience, salary: salNum, company: canonicalCompany, source };
  if (user_id) record.user_id = user_id;
  if (email && email.trim()) record.email = email.trim();
  if (utm_source) record.utm_source = utm_source;
  if (utm_medium) record.utm_medium = utm_medium;
  if (utm_campaign) record.utm_campaign = utm_campaign;
  if (utm_content) record.utm_content = utm_content;

  const { data, error } = await supabase
    .from('submissions')
    .insert([record])
    .select('id')
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  // Auto-add company to companies table if not exists
  if (canonicalCompany) {
    await supabase
      .from('companies')
      .upsert(
        { name: canonicalCompany, tier: 4 },
        { onConflict: 'name', ignoreDuplicates: true }
      );

    // 팔로워 알림 — 이 회사를 팔로우한 사용자에게 "새 연봉 정보" 푸시(카테고리 company_follow).
    // company_follows.company_name은 lower(trim())로 정규화 저장되므로 동일하게 맞춰 조회한다.
    // 제보자 본인은 제외. 발송 실패가 제보 응답을 막지 않도록 await하지 않고 흘려보낸다(sendPush는 throw 안 함).
    const norm = canonicalCompany.toLowerCase();
    const { data: followers } = await supabase
      .from('company_follows')
      .select('user_id')
      .eq('company_name', norm);
    const userIds = (followers || [])
      .map((f) => f.user_id)
      .filter((id) => id && id !== user_id);
    if (userIds.length) {
      sendPush(userIds, {
        title: canonicalCompany,
        body: NEW_SALARY_BODY,
        category: 'company_follow',
        data: { type: 'company_follow', company: canonicalCompany },
      });
    }
  }

  return res.status(201).json({ success: true, data });
}
