export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' })

  const { businessNumber } = req.body
  const raw = (businessNumber || '').replace(/[^0-9]/g, '')

  if (raw.length !== 10) {
    return res.status(400).json({ error: 'invalid', message: '사업자등록번호 10자리를 입력해 주세요.' })
  }

  const serviceKey = process.env.NTS_API_KEY
  if (!serviceKey) {
    // API 키 없으면 포맷 검증만 통과
    return res.json({ valid: true, status: 'unchecked', message: '형식 확인 완료 (API 키 미설정)' })
  }

  try {
    const response = await fetch(
      `https://api.odcloud.kr/api/nts-businessman/v1/status?serviceKey=${encodeURIComponent(serviceKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ b_no: [raw] }),
      }
    )

    const data = await response.json()

    if (!data.data || data.data.length === 0) {
      return res.json({ valid: false, status: 'error', message: '조회 결과가 없습니다.' })
    }

    const result = data.data[0]
    const taxType = result.tax_type || ''
    const isRegistered = !taxType.includes('등록되지 않은')

    return res.json({
      valid: isRegistered,
      status: isRegistered ? 'active' : 'not_found',
      taxType: taxType,
      message: isRegistered
        ? '사업자등록이 확인되었습니다.'
        : '국세청에 등록되지 않은 사업자등록번호입니다.',
    })
  } catch (e) {
    return res.status(500).json({ valid: false, status: 'error', message: '조회 중 오류가 발생했습니다.' })
  }
}
