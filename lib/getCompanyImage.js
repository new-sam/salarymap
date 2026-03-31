const cache = {};

export async function getCompanyImage(companyName) {
  if (cache[companyName]) return cache[companyName];

  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) return null;

  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(companyName)}&per_page=1&orientation=landscape`,
      {
        headers: { Authorization: `Client-ID ${accessKey}` },
        signal: AbortSignal.timeout(4000),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const url = data?.results?.[0]?.urls?.regular || null;
    if (url) cache[companyName] = url;
    return url;
  } catch {
    return null;
  }
}
