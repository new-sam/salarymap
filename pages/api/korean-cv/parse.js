import formidable from 'formidable'
import fs from 'fs'
import { parseResumeBuffer } from '../../../lib/parseResume'

// /korean-cv 무료 변환 툴의 익명 파싱 — CV 파일을 한국식 이력서 템플릿에 부을
// 구조화 데이터로 바꾼다. 가입 전이라 DB에는 아무것도 쓰지 않는다 — 실제 등록은
// 가입 후 클라이언트가 /api/profile/upload 로 처리한다.
// 증명사진: PDF에 박힌 JPEG을 추출해 data URL로 돌려준다(스토리지 저장 없음,
// profile/parse-resume 의 휴리스틱과 동일).
export const config = { api: { bodyParser: false } }

function isValidJpeg(buf) {
  if (buf.length < 4) return false
  if (buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) return false
  const validMarkers = [0xe0, 0xe1, 0xe2, 0xe3, 0xdb, 0xc0, 0xc2, 0xc4, 0xfe]
  return validMarkers.includes(buf[3])
}

function extractJpegsFromPdf(buffer) {
  const images = []
  const SOI = Buffer.from([0xff, 0xd8])
  const EOI = Buffer.from([0xff, 0xd9])
  let offset = 0
  while (offset < buffer.length - 1) {
    const startIdx = buffer.indexOf(SOI, offset)
    if (startIdx === -1) break
    const endIdx = buffer.indexOf(EOI, startIdx + 2)
    if (endIdx === -1) break
    const jpegData = buffer.slice(startIdx, endIdx + 2)
    // 증명사진 후보: 유효한 JPEG, 10KB~2MB (아이콘·풀스캔 제외)
    if (jpegData.length > 10000 && jpegData.length < 2 * 1024 * 1024 && isValidJpeg(jpegData)) {
      images.push(jpegData)
    }
    offset = endIdx + 2
  }
  return images
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' })
  try {
    const form = formidable({ maxFileSize: 10 * 1024 * 1024 })
    const [, files] = await form.parse(req)
    const file = files.file?.[0]
    if (!file) return res.status(400).json({ error: 'file required' })
    const buffer = fs.readFileSync(file.filepath)

    let profile
    try {
      profile = await parseResumeBuffer(buffer)
    } catch (e) {
      // 스캔 이미지 PDF 등 텍스트 추출 실패 — 클라이언트가 안내 문구로 처리
      if (/could not extract text/i.test(e.message || '')) {
        return res.status(422).json({ error: 'unreadable' })
      }
      throw e
    }

    let photo = null
    if (buffer.subarray(0, 5).toString('latin1') === '%PDF-') {
      const jpegs = extractJpegsFromPdf(buffer)
      if (jpegs.length > 0) photo = `data:image/jpeg;base64,${jpegs[0].toString('base64')}`
    }

    return res.status(200).json({ profile, photo })
  } catch (e) {
    return res.status(500).json({ error: e.message || 'parse failed' })
  }
}
