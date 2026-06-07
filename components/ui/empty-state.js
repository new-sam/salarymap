import { cn } from '../../lib/cn';

export function EmptyState({ icon: Icon, title, description, action, className, tone = 'default' }) {
  const toneClass = {
    default: 'bg-gray-100 text-gray-400',
    brand: 'bg-primary-50 text-primary-600',
    success: 'bg-emerald-50 text-emerald-600',
    info: 'bg-gray-100 text-gray-500',
  }[tone];

  return (
    <div className={cn(
      'flex flex-col items-center justify-center text-center px-6 py-10',
      className
    )}>
      {Icon && (
        <div className={cn('w-12 h-12 rounded-xl grid place-items-center mb-3', toneClass)}>
          <Icon className="w-5 h-5" />
        </div>
      )}
      {title && (
        <h3 className="text-sm font-bold text-foreground mb-1">{title}</h3>
      )}
      {description && (
        <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">{description}</p>
      )}
      {action && (
        <div className="mt-4">{action}</div>
      )}
    </div>
  );
}
