import { createClient } from '@supabase/supabase-js'
import formidable from 'formidable'
import fs from 'fs'

export const config = { api: { bodyParser: false } }

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'unauthorized' })

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'unauthorized' })

  const form = formidable({ maxFileSize: 10 * 1024 * 1024 })
  const [fields, files] = await form.parse(req)

  const type = fields.type?.[0] // 'photo' or 'resume'
  const file = files.file?.[0]
  if (!file || !type) return res.status(400).json({ error: 'file and type required' })

  const bucket = type === 'photo' ? 'profiles' : 'resumes'
  const ext = type === 'photo' ? 'jpg' : 'pdf'
  const path = `${user.id}.${ext}`

  const fileBuffer = fs.readFileSync(file.filepath)
  const { error: uploadErr } = await supabase.storage.from(bucket).upload(path, fileBuffer, {
    contentType: file.mimetype,
    upsert: true,
  })
  if (uploadErr) return res.status(500).json({ error: uploadErr.message })

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path)
  const publicUrl = urlData.publicUrl

  // Update profile
  const updateField = type === 'photo' ? 'photo_url' : 'resume_url'
  await supabase.from('user_profiles').update({
    [updateField]: publicUrl,
    updated_at: new Date().toISOString(),
  }).eq('id', user.id)

  res.json({ url: publicUrl })
}
