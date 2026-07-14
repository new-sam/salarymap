// On-demand translation for community posts/comments. Reuses the same OpenAI
// client pattern as the community seeder (lib/communityContent.js). Text is
// user-generated and public (posts render via SSR), so no auth is required —
// a length cap + in-memory cache keep cost/abuse in check.
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const LANGS = { ko: 'Korean', vi: 'Vietnamese', en: 'English' }
const MAX_LEN = 5000

// Cache within a serverless instance so the same post translated by many
// viewers only hits the API once. Bounded so it can't grow unbounded.
const cache = new Map()
const CACHE_MAX = 2000
function cacheGet(key) { return cache.get(key) }
function cacheSet(key, val) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value)
  cache.set(key, val)
}

// Segments are joined with this sentinel so a title + body can be translated in
// one call, then split back apart. Chosen to never appear in real text.
const SEP = '\n<<<§SEG§>>>\n'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { texts, targetLang } = req.body || {}
  if (!Array.isArray(texts) || texts.length === 0 || texts.length > 10) {
    return res.status(400).json({ error: 'Missing texts' })
  }
  if (!texts.every(t => typeof t === 'string')) {
    return res.status(400).json({ error: 'Invalid texts' })
  }
  if (!LANGS[targetLang]) {
    return res.status(400).json({ error: 'Invalid targetLang' })
  }
  const joined = texts.join(SEP)
  if (joined.length > MAX_LEN) {
    return res.status(400).json({ error: 'Text too long' })
  }

  const key = `${targetLang}:${joined}`
  const cached = cacheGet(key)
  if (cached) return res.status(200).json({ translated: cached })

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: `You translate short community forum posts and comments into ${LANGS[targetLang]}. Preserve the original tone, casual style, line breaks and emoji. Do not add explanations, notes, or quotation marks. If a passage is already in ${LANGS[targetLang]}, return it unchanged. The input may contain multiple segments separated by the exact marker "${SEP.trim()}" — translate each segment and return them separated by that same marker, in the same order and count. Output only the translation.`,
        },
        { role: 'user', content: joined },
      ],
    })
    const raw = completion.choices?.[0]?.message?.content?.trim()
    if (!raw) return res.status(502).json({ error: 'Translation failed' })
    const translated = raw.split(SEP.trim()).map(s => s.replace(/^\n+|\n+$/g, ''))
    // Only cache a clean result; on a segment-count mismatch the client treats
    // it as a failure and can retry (which won't be poisoned by the cache).
    if (translated.length === texts.length) cacheSet(key, translated)
    return res.status(200).json({ translated })
  } catch (err) {
    console.error('translate error', err)
    return res.status(500).json({ error: 'Translation failed' })
  }
}
