import { useEffect, useRef, useState } from 'react'

/* /jobs 필터바의 인라인 드롭다운. 자주 쓰는 조건(직무 대분류·경력·근무형태)을 모달을 열지
   않고 바로 고르게 한다. 나머지 상세 조건은 우측 드로어(JobFilterModal)로 뺐다.

   네이티브 <select> 를 쓰지 않는 이유: 다중선택이 안 되고, macOS/iOS 는 OS 가 목록을 그려서
   스타일이 안 먹는다(/ktc 잡보드에서 같은 이유로 커스텀으로 갈아탄 적 있음).

   선택 반영은 즉시 — 모달과 달리 "적용" 버튼이 없다. 목록 건수가 바로 따라 움직여야
   드롭다운을 앞으로 빼는 의미가 있다. */
export default function FilterDropdown({ label, summary, active, children, align = 'left' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <div className="fd" ref={ref}>
      <button
        className={`fd-btn${active ? ' on' : ''}${open ? ' open' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className="fd-btn-t">{summary || label}</span>
        <svg className="fd-caret" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && <div className={`fd-menu${align === 'right' ? ' fd-menu-r' : ''}`}>{children}</div>}

      <style jsx>{`
        .fd { position: relative; display: inline-flex; }
        .fd-btn {
          display: inline-flex; align-items: center; gap: 6px;
          font-family: inherit; font-size: 14px; font-weight: 600; color: #444;
          background: #fff; border: 1px solid #dcdcda; border-radius: 999px;
          height: 38px; padding: 0 16px; cursor: pointer; white-space: nowrap;  /* jobs.js 칩 줄과 같은 높이 */
        }
        .fd-btn:hover { border-color: #999; }
        .fd-btn.open { border-color: #111; }
        /* 선택된 조건은 채우지 않고 테두리·글자만 강조 — 목록 위라 색 면적이 커지면 시끄럽다. */
        .fd-btn.on { border-color: #ff4400; color: #ff4400; background: #fff7f4; }
        .fd-caret { flex-shrink: 0; opacity: .55; }
        .fd-btn.open .fd-caret { transform: rotate(180deg); }

        .fd-menu {
          position: absolute; top: calc(100% + 6px); left: 0; z-index: 60;
          min-width: 208px; max-height: 320px; overflow-y: auto;
          background: #fff; border: 1px solid #e4e4e2; border-radius: 12px;
          box-shadow: 0 12px 28px rgba(0,0,0,0.13); padding: 6px;
        }
        .fd-menu-r { left: auto; right: 0; }
      `}</style>
    </div>
  )
}

/* 드롭다운 안의 한 줄. 다중선택은 체크박스 모양, 단일선택은 체크표시만. */
export function FilterOption({ checked, onClick, children, multi = true }) {
  return (
    <button className={`fo${checked ? ' on' : ''}`} onClick={onClick}>
      {multi ? <span className={`fo-box${checked ? ' on' : ''}`}>{checked && '✓'}</span> : <span className="fo-dot">{checked && '✓'}</span>}
      <span className="fo-t">{children}</span>

      <style jsx>{`
        .fo {
          display: flex; align-items: center; gap: 9px; width: 100%;
          font-family: inherit; font-size: 14px; font-weight: 500; color: #333;
          background: none; border: none; border-radius: 8px;
          padding: 8px 9px; cursor: pointer; text-align: left;
        }
        .fo:hover { background: #f6f6f4; }
        .fo.on { color: #111; font-weight: 700; }
        .fo-box {
          flex-shrink: 0; width: 16px; height: 16px; border-radius: 4px;
          border: 1.5px solid #ccc; display: inline-flex; align-items: center; justify-content: center;
          font-size: 10px; color: #fff; line-height: 1;
        }
        .fo-box.on { background: #ff4400; border-color: #ff4400; }
        .fo-dot { flex-shrink: 0; width: 16px; text-align: center; color: #ff4400; font-size: 12px; font-weight: 800; }
        .fo-t { min-width: 0; }
      `}</style>
    </button>
  )
}
