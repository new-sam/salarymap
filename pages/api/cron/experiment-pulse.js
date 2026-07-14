import supabase from '../../../lib/supabaseAdmin';
import { computeIntradayPulse } from '../../../lib/experimentMetrics';
import { sendAlert, ADMIN_URL } from '../../../lib/experimentAlerts';

// 인트라데이 펄스 (15분 크론) — 지표 급락/급등을 즉시 감지해서 텔레그램+메일.
// 데일리 판정(experiment-alert, 00:30 ICT)과 별개의 조기경보. vercel.json: */15.
// 판정: 지난 7일 같은 시간대 평균 대비 — 비율 가드(50% 이하/2배 이상) + 포아송 유의성(p<0.005) 둘 다 통과해야 알림.
// 비율만 쓰면 저볼륨 구간에서 매일 울림(백테스트 3.6건/일) → 포아송 결합으로 0.6건/일까지 감소.
// 새벽 노이즈 방지: 기대값(평균)이 MIN_EXPECTED 미만인 지표는 판정 안 함.
// 동일 알림은 (지표·윈도우·방향)당 하루 1회만 — events(experiment_alert_sent)로 dedup.
const CRASH_RATIO = 0.5;
const SURGE_RATIO = 2.0;
const P_THRESH = 0.005; // 이 정도 편차가 우연일 확률
const MIN_EXPECTED = 4;
const GATE_MIN_VIEWS = 10; // 3시간 게이트 노출이 이만큼인데 로그인 0이면 로그인 깨짐 의심

// P(X <= k) for X ~ Poisson(lambda)
function poissonCdf(k, lambda) {
  if (k < 0) return 0;
  let term = Math.exp(-lambda);
  let sum = term;
  for (let i = 1; i <= k; i++) { term *= lambda / i; sum += term; }
  return Math.min(1, sum);
}

const ICT_OFFSET_MS = 7 * 3600e3;
const vnDay = () => new Date(Date.now() + ICT_OFFSET_MS).toISOString().slice(0, 10);

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const pulse = await computeIntradayPulse();
    const force = req.query.force === '1';
    const alerts = [];

    for (const m of pulse.metrics) {
      if (m.expected < MIN_EXPECTED) continue;
      const pLow = poissonCdf(m.today, m.expected);           // 이만큼 적을 확률
      const pHigh = 1 - poissonCdf(m.today - 1, m.expected);  // 이만큼 많을 확률
      if (m.ratio <= CRASH_RATIO && pLow < P_THRESH) {
        alerts.push({ sig: `crash:${m.metric}:${m.window}`, line: `📉 ${m.label} 급락 — ${m.windowLabel} ${m.today}건 (평소 ${m.expected.toFixed(1)}건의 ${Math.round(m.ratio * 100)}%, 우연일 확률 ${(pLow * 100).toFixed(2)}%)` });
      } else if (m.ratio >= SURGE_RATIO && pHigh < P_THRESH) {
        alerts.push({ sig: `surge:${m.metric}:${m.window}`, line: `🚀 ${m.label} 급등 — ${m.windowLabel} ${m.today}건 (평소 ${m.expected.toFixed(1)}건의 ${Math.round(m.ratio * 100)}%, 우연일 확률 ${(pHigh * 100).toFixed(2)}%)` });
      }
    }
    if (pulse.gateViews3h >= GATE_MIN_VIEWS && pulse.gateLogins3h === 0) {
      alerts.push({ sig: 'gate_zero_login', line: `🚨 하드게이트 로그인 0 — 최근 3시간 노출 ${pulse.gateViews3h}회인데 로그인 성공 0. 로그인 플로우 고장 의심, 즉시 확인 필요` });
    }

    if (!alerts.length && !force) {
      return res.status(200).json({ ok: true, alerted: false, pulse });
    }

    // dedup — 오늘 이미 보낸 시그니처는 제외
    const todayStartIso = new Date(new Date(`${vnDay()}T00:00:00+07:00`)).toISOString();
    const { data: sent } = await supabase
      .from('events')
      .select('meta')
      .eq('event', 'experiment_alert_sent')
      .gte('created_at', todayStartIso);
    const sentSigs = new Set((sent || []).map((r) => r.meta?.sig).filter(Boolean));
    const fresh = force ? alerts : alerts.filter((a) => !sentSigs.has(a.sig));

    if (!fresh.length && !force) {
      return res.status(200).json({ ok: true, alerted: false, deduped: alerts.map((a) => a.sig), pulse });
    }

    const lines = fresh.length ? fresh.map((a) => a.line) : ['✅ 테스트 발송 — 이상 없음'];
    const text = [`[FYI 펄스] 실험 지표 이상 감지`, '', ...lines, '', `롤백 스위치: ${ADMIN_URL}`].join('\n');
    const html = `
      <div style="font-family:sans-serif;max-width:560px">
        <h2 style="margin:0 0 12px">[FYI 펄스] 실험 지표 이상 감지</h2>
        ${lines.map((l) => `<p style="margin:6px 0;font-size:14px">${l}</p>`).join('')}
        <p style="margin:20px 0">
          <a href="${ADMIN_URL}" style="background:#DC2626;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:700">실험탭 열기 → 원클릭 롤백</a>
        </p>
      </div>`;

    const results = await sendAlert({ subject: `[FYI 펄스] ${lines[0]}`, text, html });

    // 발송 기록 (dedup용)
    if (fresh.length) {
      await supabase.from('events').insert(fresh.map((a) => ({
        event: 'experiment_alert_sent', page: 'cron', meta: { sig: a.sig, line: a.line },
      })));
    }

    return res.status(200).json({ ok: true, alerted: true, sent: fresh.map((a) => a.sig), results, pulse });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
