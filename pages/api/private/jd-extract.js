import formidable from 'formidable'
import fs from 'fs'
import pdf from 'pdf-parse'
import mammoth from 'mammoth'

/* /private/showcasing 의 JD 파일 첨부 → 글자만 뽑아 되돌려준다.

   저장하지 않는다. 스토리지에도, DB 에도 안 남기고 임시 파일도 바로 지운다 —
   고객사의 미공개 채용 JD 라서 남길 이유가 없고, 이 화면은 주소만 감춘 비공개라
   저장하는 순간 '누가 무슨 자리를 뽑는지'가 우리 쪽에 쌓인다.

   뽑은 글은 화면의 입력칸을 채운다. 파일은 입력 수단일 뿐이고 진짜 JD 는 화면에
   보이는 글이다 — 무엇을 읽었는지 눈으로 확인하고 고칠 수 있어야 한다.

   로그인이 없는 경로라(주소를 아는 사람은 그냥 열린다) 파일 크기·확장자를 막는다. */

export const config = { api: { bodyParser: false } }

const MAX_BYTES = 5 * 1024 * 1024
const MAX_CHARS = 20000

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' })

  let filepath = null
  try {
    const form = formidable({ maxFileSize: MAX_BYTES })
    const [, files] = await form.parse(req)
    const file = files.file?.[0]
    if (!file) return res.status(400).json({ error: '파일이 없습니다' })
    filepath = file.filepath

    const ext = (file.originalFilename || '').split('.').pop()?.toLowerCase()
    const buf = fs.readFileSync(filepath)

    let text = ''
    if (ext === 'pdf') text = (await pdf(buf)).text
    else if (ext === 'docx') text = (await mammoth.extractRawText({ buffer: buf })).value
    else if (ext === 'txt' || ext === 'md') text = buf.toString('utf8')
    // .doc(옛 바이너리)·.hwp 는 읽을 방법이 없다 — 붙여넣기로 안내한다.
    else return res.status(400).json({ error: 'PDF · DOCX · TXT 만 읽을 수 있습니다' })

    // 줄 정리 — PDF 는 줄 끝을 공백으로 채우고 줄 사이도 과하게 벌어져서, 그대로 두면
    // 입력칸이 눈으로 훑을 수 없게 길어진다.
    text = text.replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, MAX_CHARS)

    // 스캔본 PDF 는 글자가 아니라 그림이라 여기서 빈 값이 나온다.
    if (text.length < 30) {
      return res.status(400).json({ error: '글자를 찾지 못했습니다 — 스캔한 파일이면 내용을 붙여넣어 주세요' })
    }

    return res.status(200).json({ text, name: file.originalFilename || '' })
  } catch (e) {
    if (e?.code === 'ETOOBIG' || /maxFileSize/i.test(e?.message || '')) {
      return res.status(400).json({ error: '파일이 너무 큽니다 (5MB까지)' })
    }
    return res.status(500).json({ error: e.message || '파일을 읽지 못했습니다' })
  } finally {
    if (filepath) { try { fs.unlinkSync(filepath) } catch {} }
  }
}
