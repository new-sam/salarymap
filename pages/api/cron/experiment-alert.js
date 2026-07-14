import { computeExperimentMetrics } from '../../../lib/experimentMetrics';
import { sendAlert, ADMIN_URL } from '../../../lib/experimentAlerts';

// 실험 가드지표 데일리 판정 — 완결일 기준 롤백/주의에 걸리면 이메일+텔레그램.
// vercel.json: 00:00 UTC = 09:00 KST = 07:00 ICT — 받는 사람(한국) 아침 기준. 어제(ICT) 데이터는 이미 마감됨.
// 인트라데이 조기경보는 experiment-pulse가 담당.
const STATUS_LABEL = { rollback: '🔴 롤백 기준 도달', warn: '🟠 주의', ok: '🟢 정상', pending: '⚪ 수집중' };

function ruleLine(r) {
  const n1 = (v) => Math.round(v * 10) / 10;
  const cur = r.current == null ? '—' : n1(r.current);
  const ratio = r.ratio == null ? '' : ` (베이스라인의 ${Math.round(r.ratio * 100)}%)`;
  return `${STATUS_LABEL[r.status]} ${r.labelKo}: ${cur}${ratio} · 기준: ${Math.round(r.rollbackBelow * 100)}% 미만 롤백 / ${Math.round(r.warnBelow * 100)}% 미만 주의 · 베이스라인 ${n1(r.baseline)}`;
}

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const data = await computeExperimentMetrics();
    const rules = data.rollback.rules;
    const bad = rules.filter((r) => r.status === 'rollback' || r.status === 'warn');
    const force = req.query.force === '1'; // 발송 경로 테스트용 — 판정과 무관하게 1회 발송

    if (!bad.length && !force) {
      return res.status(200).json({ ok: true, alerted: false, statuses: rules.map((r) => `${r.key}:${r.status}`) });
    }

    const severity = bad.some((r) => r.status === 'rollback') ? '🔴 롤백 기준 도달'
      : bad.length ? '🟠 주의'
      : '✅ 테스트 발송 (지표 정상)';
    const lines = rules.map(ruleLine);
    const bodyText = [
      `[FYI 실험 가드지표] ${severity}`,
      '',
      ...lines,
      '',
      `최근 ${data.rollback.sampleDays}완결일 평균 vs 실험 전 ${data.rollback.baselineDays}일 평균`,
      `어제 실측: 제출 ${data.daily[data.daily.length - 2]?.submissions ?? '—'} · 가입 ${data.daily[data.daily.length - 2]?.signups ?? '—'}`,
      '',
      `롤백 스위치: ${ADMIN_URL}`,
    ].join('\n');

    const html = `
      <div style="font-family:sans-serif;max-width:560px">
        <h2 style="margin:0 0 4px">${severity}</h2>
        <p style="color:#666;margin:0 0 16px">가입 게이트 실험 가드지표 데일리 체크</p>
        ${rules.map((r) => `<p style="margin:6px 0;font-size:14px">${ruleLine(r)}</p>`).join('')}
        <p style="margin:20px 0">
          <a href="${ADMIN_URL}" style="background:#DC2626;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:700">
            실험탭 열기 → 원클릭 롤백
          </a>
        </p>
        <p style="color:#999;font-size:12px">실험 스위치(히어로 그리드/하드 게이트/One Tap)는 실험탭 상단에서 개별로 끌 수 있어요. 재배포 없이 60초 내 반영.</p>
      </div>`;

    const results = await sendAlert({
      subject: `[FYI 실험] ${severity} — ${bad.map((r2) => r2.labelKo).join(', ') || '테스트'}`,
      text: bodyText,
      html,
    });

    return res.status(200).json({ ok: true, alerted: true, severity, results, statuses: rules.map((r) => `${r.key}:${r.status}`) });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
