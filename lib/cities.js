// 베트남 행정구역(63개 성·시) + 주요 도시 표기 통일.
// 자유입력(Hanoi / Hà Nội / 하노이 / "Quảng Trị, Vietnam" 등)을 정규화해
// 토글 언어(한국어/베트남어)로 일관되게 표시한다. 모르는 값은 원문 그대로.

// 발음기호·띄어쓰기·구두점을 제거해 매칭 (Hanoi == Hà Nội == "Ha Noi").
const norm = (s) => String(s)
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[đĐ]/g, 'd')
  .toLowerCase()
  .replace(/[^a-z0-9가-힣]/g, '')

// {ko, vi, alt?} — vi/ko 는 자동 매칭키. alt 에 축약·변형 추가.
const CITIES = [
  // 직할시 + 주요 도시 (변형 많은 것 먼저)
  { ko: '호치민', vi: 'Hồ Chí Minh', alt: ['hcmc', 'hcm', 'saigon', 'ho chi minh city', 'thu duc', 'thu duc city', '호찌민', '사이공', '투득'] },
  { ko: '하노이', vi: 'Hà Nội' },
  { ko: '다낭', vi: 'Đà Nẵng' },
  { ko: '하이퐁', vi: 'Hải Phòng' },
  { ko: '껀터', vi: 'Cần Thơ', alt: ['칸토'] },
  { ko: '나트랑', vi: 'Nha Trang' },
  { ko: '달랏', vi: 'Đà Lạt' },
  { ko: '후에', vi: 'Huế', alt: ['thua thien hue'] },
  { ko: '붕따우', vi: 'Vũng Tàu' },
  { ko: '비엔호아', vi: 'Biên Hòa' },
  // 성(省) — 가나다
  { ko: '안장', vi: 'An Giang' },
  { ko: '바리아붕따우', vi: 'Bà Rịa - Vũng Tàu' },
  { ko: '박장', vi: 'Bắc Giang' },
  { ko: '박깐', vi: 'Bắc Kạn' },
  { ko: '박리에우', vi: 'Bạc Liêu' },
  { ko: '박닌', vi: 'Bắc Ninh' },
  { ko: '벤째', vi: 'Bến Tre' },
  { ko: '빈딘', vi: 'Bình Định' },
  { ko: '빈즈엉', vi: 'Bình Dương' },
  { ko: '빈프억', vi: 'Bình Phước' },
  { ko: '빈투언', vi: 'Bình Thuận' },
  { ko: '까마우', vi: 'Cà Mau' },
  { ko: '까오방', vi: 'Cao Bằng' },
  { ko: '닥락', vi: 'Đắk Lắk' },
  { ko: '닥농', vi: 'Đắk Nông' },
  { ko: '디엔비엔', vi: 'Điện Biên' },
  { ko: '동나이', vi: 'Đồng Nai' },
  { ko: '동탑', vi: 'Đồng Tháp' },
  { ko: '자라이', vi: 'Gia Lai' },
  { ko: '하장', vi: 'Hà Giang' },
  { ko: '하남', vi: 'Hà Nam' },
  { ko: '하띤', vi: 'Hà Tĩnh' },
  { ko: '하이즈엉', vi: 'Hải Dương' },
  { ko: '허우장', vi: 'Hậu Giang' },
  { ko: '호아빈', vi: 'Hòa Bình' },
  { ko: '흥옌', vi: 'Hưng Yên' },
  { ko: '칸호아', vi: 'Khánh Hòa' },
  { ko: '끼엔장', vi: 'Kiên Giang' },
  { ko: '꼰뚬', vi: 'Kon Tum' },
  { ko: '라이쩌우', vi: 'Lai Châu' },
  { ko: '럼동', vi: 'Lâm Đồng' },
  { ko: '랑선', vi: 'Lạng Sơn' },
  { ko: '라오까이', vi: 'Lào Cai' },
  { ko: '롱안', vi: 'Long An' },
  { ko: '남딘', vi: 'Nam Định' },
  { ko: '응에안', vi: 'Nghệ An' },
  { ko: '닌빈', vi: 'Ninh Bình' },
  { ko: '닌투언', vi: 'Ninh Thuận' },
  { ko: '푸토', vi: 'Phú Thọ' },
  { ko: '푸옌', vi: 'Phú Yên' },
  { ko: '꽝빈', vi: 'Quảng Bình' },
  { ko: '꽝남', vi: 'Quảng Nam' },
  { ko: '꽝응아이', vi: 'Quảng Ngãi' },
  { ko: '꽝닌', vi: 'Quảng Ninh' },
  { ko: '꽝찌', vi: 'Quảng Trị' },
  { ko: '속짱', vi: 'Sóc Trăng' },
  { ko: '선라', vi: 'Sơn La' },
  { ko: '떠이닌', vi: 'Tây Ninh' },
  { ko: '타이빈', vi: 'Thái Bình' },
  { ko: '타이응우옌', vi: 'Thái Nguyên' },
  { ko: '타인호아', vi: 'Thanh Hóa' },
  { ko: '트어티엔후에', vi: 'Thừa Thiên Huế' },
  { ko: '띠엔장', vi: 'Tiền Giang' },
  { ko: '짜빈', vi: 'Trà Vinh' },
  { ko: '뚜옌꽝', vi: 'Tuyên Quang' },
  { ko: '빈롱', vi: 'Vĩnh Long' },
  { ko: '빈푹', vi: 'Vĩnh Phúc' },
  { ko: '옌바이', vi: 'Yên Bái' },
  { ko: '재택', vi: 'Remote', alt: ['재택', '리모트', 'wfh', 'work from home'] },
]

// 매칭키 → 엔트리. 긴 키 우선(부분일치 충돌 방지).
const ENTRIES = []
for (const c of CITIES) {
  const keys = new Set([norm(c.vi), norm(c.ko), ...(c.alt || []).map(norm)])
  for (const k of keys) if (k) ENTRIES.push([k, c])
}
ENTRIES.sort((a, b) => b[0].length - a[0].length)

export function cityLabel(raw, lang = 'ko') {
  if (!raw) return null
  const s = norm(raw)
  if (!s) return String(raw).trim()
  for (const [k, c] of ENTRIES) {
    if (s === k || s.includes(k)) return lang === 'ko' ? c.ko : c.vi
  }
  return String(raw).trim()
}
