import { useState } from 'react';
import { Star } from 'lucide-react';
import { cn } from '../../lib/cn';

// 5-star inline rating. Click a star to commit the score.
// score: 0..5 (or 0..100 if max=100)
// onChange(nextScore) called immediately on click.
export function StarRating({ value = 0, onChange, size = 16, max = 5, readOnly = false, className }) {
  const [hover, setHover] = useState(0);
  const display = hover || value;
  const stars = Array.from({ length: max });

  return (
    <div
      className={cn('inline-flex items-center gap-0.5', className)}
      onMouseLeave={() => setHover(0)}
    >
      {stars.map((_, i) => {
        const idx = i + 1;
        const filled = display >= idx;
        return (
          <button
            key={i}
            type="button"
            disabled={readOnly}
            onMouseEnter={() => !readOnly && setHover(idx)}
            onClick={() => !readOnly && onChange?.(idx === value ? 0 : idx)}
            className={cn(
              'p-0.5 transition-transform',
              !readOnly && 'hover:scale-110 cursor-pointer',
              readOnly && 'cursor-default'
            )}
            aria-label={`${idx} star`}
          >
            <Star
              style={{ width: size, height: size }}
              className={cn(
                'transition-colors',
                filled ? 'text-amber-400 fill-amber-400' : 'text-gray-300'
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
