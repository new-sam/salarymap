import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { cn } from '../../lib/cn';

export function BackLink({ href, children, className }) {
  return (
    <Link
      href={href}
      className={cn(
        // matches Button outline default size — same height, padding, font, border, shadow
        'inline-flex items-center gap-1.5 h-9 px-4 rounded-md',
        'border border-input bg-card shadow-soft-xs',
        'text-[13px] font-bold text-foreground',
        'hover:bg-secondary',
        'transition-all duration-200 ease-spring active:scale-[0.98]',
        className
      )}
    >
      <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2.25} />
      {children}
    </Link>
  );
}
