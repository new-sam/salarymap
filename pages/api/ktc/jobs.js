import { fetchKtcJobs } from '../../../lib/ktcJobs';

/* /ktc 랜딩의 공개 공고 목록. 조회·정규화는 lib/ktcJobs.js 가 담당하고,
   상세 페이지(pages/ktc/jobs/[id].js)도 같은 모듈을 쓴다. */
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const jobs = await fetchKtcJobs();
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return res.json({ jobs });
  } catch (e) {
    console.error('ktc/jobs:', e);
    return res.status(500).json({ error: 'Failed to load jobs' });
  }
}
