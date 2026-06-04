import { supabase } from './supabaseClient'

const BUCKET = 'community-images'
const MAX_DIM = 1600        // longest edge after resize
const QUALITY = 0.82        // JPEG quality
const MAX_BYTES = 12 * 1024 * 1024  // reject inputs larger than 12MB

export const MAX_POST_IMAGES = 4

// Resize + re-encode an image File in the browser to cut upload size and
// storage cost. Animated GIFs are left untouched (canvas would flatten them).
async function compressImage(file) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height))
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h)
    bitmap.close?.()
    const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', QUALITY))
    // Only keep the compressed version if it actually came out smaller.
    return blob && blob.size < file.size ? blob : file
  } catch {
    return file
  }
}

// Compress and upload a single image; resolves to its public URL.
export async function uploadCommunityImage(file, userId) {
  if (!file.type.startsWith('image/')) throw new Error('Not an image')
  if (file.size > MAX_BYTES) throw new Error('Image too large')
  const out = await compressImage(file)
  const ext = out.type === 'image/gif' ? 'gif' : 'jpg'
  const path = `${userId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, out, {
    contentType: out.type || 'image/jpeg',
    upsert: false,
  })
  if (error) throw error
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}
