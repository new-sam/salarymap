import { readFileSync } from 'fs';
import { join } from 'path';

// og:image cache (run scripts/generate-og-images.js to populate)
let ogCache = null;
function getOgCache() {
  if (ogCache) return ogCache;
  try {
    const p = join(process.cwd(), 'lib', 'ogImages.json');
    ogCache = JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    ogCache = {};
  }
  return ogCache;
}

// Unsplash pre-generated cache (run scripts/generate-images.js to populate)
let fileCache = null;
function getFileCache() {
  if (fileCache) return fileCache;
  try {
    const p = join(process.cwd(), 'lib', 'companyImages.json');
    fileCache = JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    fileCache = {};
  }
  return fileCache;
}

const runtimeCache = {};

export async function getCompanyImage(companyName) {
  // 1. Check og:image cache first (company's own thumbnail — most accurate)
  const fromOg = getOgCache()[companyName];
  if (fromOg) return fromOg;

  // 2. Check pre-generated Unsplash file cache (no API call needed)
  const fromFile = getFileCache()[companyName];
  if (fromFile) return fromFile;

  // 2. Check runtime memory cache
  if (runtimeCache[companyName] !== undefined) return runtimeCache[companyName];

  // 3. Live API call as last resort
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) return null;

  try {
    const query = encodeURIComponent(companyName + ' Vietnam tech');
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${query}&per_page=1&orientation=landscape`,
      {
        headers: { Authorization: `Client-ID ${accessKey}` },
        signal: AbortSignal.timeout(4000),
      }
    );
    if (!res.ok) { runtimeCache[companyName] = null; return null; }
    const data = await res.json();
    const url = data?.results?.[0]?.urls?.regular || null;
    runtimeCache[companyName] = url;
    return url;
  } catch {
    runtimeCache[companyName] = null;
    return null;
  }
}
