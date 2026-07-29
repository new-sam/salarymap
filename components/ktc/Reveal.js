import { useEffect, useRef, useState } from 'react';

/* 원본 ktc-landing 의 AnimationLayout(framer-motion) 대체.
   FYI 는 framer-motion 을 랜딩에서 쓰지 않으므로 IntersectionObserver 로
   동일한 "뷰포트 진입 시 페이드업" 효과만 가볍게 재현한다. */
export default function Reveal({ children, delay = 0, style }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.12 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? 'none' : 'translateY(28px)',
        transition: `opacity .7s cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform .7s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
