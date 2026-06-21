import { createClient } from '@supabase/supabase-js'
import formidable from 'formidable'
import fs from 'fs'
import { normalizeTrieu } from '../../../lib/salaryTiers'

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

  const file = files.file?.[0]
  const documentType = fields.document_type?.[0] || 'other'
  // Stored in 백만 VND (triệu). normalizeTrieu coerces a raw-VND amount sent by
  // mistake (e.g. 50000000) back into triệu so the stored value, admin prefill and
  // the user's own profile display all stay in the right unit.
  const salaryAmount = fields.salary_amount?.[0] ? normalizeTrieu(parseInt(fields.salary_amount[0])) : null

  if (!file) return res.status(400).json({ error: 'file required' })

  const ext = file.originalFilename?.split('.').pop() || 'pdf'
  const path = `${user.id}/${Date.now()}.${ext}`

  const fileBuffer = fs.readFileSync(file.filepath)
  const { error: uploadErr } = await supabase.storage.from('salary-docs').upload(path, fileBuffer, {
    contentType: file.mimetype,
  })
  if (uploadErr) return res.status(500).json({ error: uploadErr.message })

  const { data: urlData } = supabase.storage.from('salary-docs').getPublicUrl(path)

  const { data: verification, error: insertErr } = await supabase
    .from('salary_verifications')
    .insert({
      user_id: user.id,
      document_url: urlData.publicUrl,
      document_type: documentType,
      salary_amount: salaryAmount,
    })
    .select()
    .single()

  if (insertErr) return res.status(500).json({ error: insertErr.message })

  res.json({ verification })
}
