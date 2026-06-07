import { useState, useRef, useEffect } from 'react';
import { cn } from '../../lib/cn';

// Single-line text that collapses with "…" by default. Tap/click to expand
// (multiline wrap), tap again to collapse. Desktop also gets a native title
// tooltip on hover for free. Use anywhere truncation would otherwise hide
// information the user might need at a glance.
//
// Props:
//   children            — the full string to display
//   as                  — tag name, defaults to 'span'
//   className           — extra Tailwind classes on the wrapper
//   stopPropagation     — true (default): toggle click doesn't bubble to parent
//                         button/card handlers. Set false if you want bubbling.
export default function Truncate({
  children,
  as: Tag = 'span',
  className,
  stopPropagation = true,
  ...rest
}) {
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const ref = useRef(null);
  const text = typeof children === 'string' ? children : '';

  // Detect overflow so we can show a pointer cursor only when truncation is
  // actually happening — short strings shouldn't look interactive.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      // When expanded the element naturally wraps, so overflow check only
      // makes sense in the collapsed state.
      if (expanded) return;
      setOverflowing(el.scrollWidth > el.clientWidth + 1);
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [children, expanded]);

  const toggle = (e) => {
    if (!overflowing && !expanded) return;
    if (stopPropagation) e.stopPropagation();
    setExpanded(prev => !prev);
  };

  return (
    <Tag
      ref={ref}
      onClick={toggle}
      title={overflowing && !expanded ? text : undefined}
      className={cn(
        expanded ? 'whitespace-normal break-words' : 'truncate',
        overflowing && 'cursor-pointer',
        className
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}
