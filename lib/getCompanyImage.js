const cache = {};

export async function getCompanyImage(companyName) {
  if (cache[companyName]) return cache[companyName];

  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return null;

  try {
    const query = encodeURIComponent(companyName + ' tech office');
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${query}&per_page=1&orientation=landscape`,
      { headers: { Authorization: `Client-ID ${key}` } }
    );
    const data = await res.json();
    const url = data?.results?.[0]?.urls?.regular || null;
    if (url) cache[companyName] = url;
    return url;
  } catch {
    return null;
  }
}
