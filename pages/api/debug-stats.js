export default async function handler(req, res) {
  try {
    const { getCompanyStats } = await import('../../lib/getCompanyStats');
    const stats = await getCompanyStats();
    return res.json({ count: stats.length, sample: stats.slice(0, 2) });
  } catch(e) {
    return res.json({ caught: e.message, stack: e.stack?.slice(0, 800) });
  }
}
