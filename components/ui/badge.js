import * as React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../../lib/cn';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold transition-colors',
  {
    variants: {
      variant: {
        default:  'border border-transparent bg-primary text-primary-foreground',
        secondary: 'border border-transparent bg-gray-100 text-gray-700',
        destructive: 'border border-destructive/20 bg-red-50 text-red-700',
        success:  'border border-emerald-200 bg-emerald-50 text-emerald-700',
        warning:  'border border-amber-200 bg-amber-50 text-amber-700',
        info:     'border border-blue-200 bg-blue-50 text-blue-700',
        outline:  'text-foreground border border-border',
        brand:    'border border-primary-200 bg-primary-50 text-primary-700',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

function Badge({ className, variant, ...props }) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
