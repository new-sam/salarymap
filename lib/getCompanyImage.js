const cache = {};

const CATEGORY_QUERY = {
  'Super App':   'southeast asia city technology app',
  'E-commerce':  'ecommerce warehouse package delivery',
  'Fintech':     'fintech mobile payment digital banking',
  'Banking':     'modern bank building financial district',
  'Product':     'product team startup office',
  'IT Services': 'software developer team office',
  'Social Tech': 'social media mobile phone people',
  'Web3 Gaming': 'gaming setup esports neon dark',
  'Telecom':     'network technology city infrastructure',
  'Logistics':   'logistics warehouse delivery operations',
  'Tech':        'tech startup modern office team',
};

export async function getCompanyImage(companyName, category) {
  const key = companyName;
  if (cache[key]) return cache[key];

  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) return null;

  const query = CATEGORY_QUERY[category] || 'tech office modern workplace';

  try {
    // Use page offset based on company name hash for variety within same category
    const page = (companyName.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 5) + 1;
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&page=${page}&orientation=landscape`,
      {
        headers: { Authorization: `Client-ID ${accessKey}` },
        signal: AbortSignal.timeout(4000),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const url = data?.results?.[0]?.urls?.regular || null;
    if (url) cache[key] = url;
    return url;
  } catch {
    return null;
  }
}
