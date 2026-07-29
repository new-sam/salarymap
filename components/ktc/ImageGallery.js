import { c } from './ktcStyles';

/* 원본의 InfiniteMovingCards 대체 — 의존성 없이 CSS 애니메이션으로 같은
   좌/우 무한 스크롤 스트립 두 줄을 만든다.
   원본과 같은 자리(FAQ 앞)에 둔다. */
const ROWS = [
  { dir: 'left', images: [1, 2, 3, 4, 5, 6].map((n) => `/ktc/gallery/ktc-${n}.jpg`) },
  { dir: 'right', images: [1, 2, 3, 4, 5, 6].map((n) => `/ktc/gallery/fair-${n}.jpg`) },
];

function Row({ images, dir }) {
  // 이음매 없이 흐르도록 같은 목록을 두 번 이어 붙인다.
  const doubled = [...images, ...images];
  return (
    <div style={{ overflow: 'hidden', maskImage: 'linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)' }}>
      <div
        className={`ktc-marquee ktc-marquee-${dir}`}
        style={{ display: 'flex', gap: 14, width: 'max-content' }}
      >
        {doubled.map((src, i) => (
          <img
            key={`${src}-${i}`}
            src={src}
            alt=""
            aria-hidden={i >= images.length}
            loading="lazy"
            style={{
              height: 'clamp(120px, 18vw, 190px)',
              width: 'auto',
              borderRadius: 10,
              border: `1px solid ${c.line}`,
              objectFit: 'cover',
              flexShrink: 0,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function ImageGallery() {
  return (
    <section style={{ padding: 'clamp(24px, 4vw, 44px) 0', display: 'grid', gap: 14 }}>
      {ROWS.map((r) => (
        <Row key={r.dir} images={r.images} dir={r.dir} />
      ))}
    </section>
  );
}
