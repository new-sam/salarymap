import { cn } from '../../lib/cn';

export function PageHeader({ title, subtitle, back, right, size = 'md', sticky = true, className }) {
  const titleClass = {
    sm: 'text-lg',   // 18px — overlay/inner page
    md: 'text-xl',   // 20px — standard page (default)
    lg: 'text-2xl',  // 24px — landing
  }[size];

  return (
    <header className={cn(
      'flex items-center justify-between gap-4 pb-3 border-b border-border',
      sticky && 'sticky top-0 z-20 bg-[#FAFAFA]/95 backdrop-blur-sm pt-3 -mx-4 md:-mx-6 px-4 md:px-6',
      className
    )}>
      <div className="min-w-0 flex-1">
        {back}
        <h1 className={cn('font-extrabold text-foreground tracking-tight leading-tight', titleClass)}>
          {title}
        </h1>
        {subtitle && (
          <div className="mt-1 text-[12.5px] text-gray-900 font-semibold leading-relaxed">{subtitle}</div>
        )}
      </div>
      {right && <div className="flex items-center gap-2 shrink-0">{right}</div>}
    </header>
  );
}
