import Head from 'next/head'

/* /private/showcasing — 고객사에 보여줄 인재 전시장(비공개).

   "비공개"의 뜻은 인증이 아니라 '안 알려진 주소'다 — 링크를 아는 사람은 그냥 열린다.
   그래서 두 가지가 이 페이지의 전제다.

   1) 검색엔진에 절대 안 잡혀야 한다. robots.txt 는 Allow: / 이므로 여기서 noindex 를
      직접 건다(robots.txt 에 Disallow 를 적으면 오히려 주소를 광고하는 꼴이다).
   2) 링크가 한 번 새면 회수가 안 된다. 그래서 후보의 실명·이메일·이력서 원본 링크는
      이 화면에 올리지 않는다 — 어드민(/admin/lang-scores)의 전시장과 다른 점이 그거다.
      이력서 파일 URL 은 Storage 직링이라 한 번 새면 계속 열린다.

   내용(누구를 어떻게 올릴지)은 아직 안 정했다. 지금은 주소만 잡아 둔 껍데기다. */

export default function PrivateShowcasing() {
  return (
    <>
      <Head>
        <title>Showcasing · FYI</title>
        <meta name="robots" content="noindex, nofollow, noarchive, nosnippet" />
        <meta name="googlebot" content="noindex, nofollow" />
      </Head>
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'inherit', color: '#8B95A1', fontSize: 13,
      }}>
        준비 중입니다
      </div>
    </>
  )
}
