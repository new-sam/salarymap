import { Button as UButton } from './button';
import {
  Dialog as UDialog,
  DialogContent as UDialogContent,
  DialogHeader as UDialogHeader,
  DialogTitle as UDialogTitle,
  DialogFooter as UDialogFooter,
} from './dialog';

/**
 * Platform-native confirmation modal — replaces window.confirm anywhere
 * inside the product so we never show the browser's chrome dialog.
 *
 * Props:
 *   open, onOpenChange  — controlled visibility
 *   title, description  — copy
 *   confirmLabel        — primary action label (default "확인")
 *   cancelLabel         — secondary action label (default "취소")
 *   destructive         — render the primary as destructive (red) variant
 *   onConfirm           — async/sync callback fired when confirmed
 *   busy                — when true, disables both buttons and shows "..."
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = '확인',
  cancelLabel = '취소',
  destructive = false,
  onConfirm,
  busy = false,
}) {
  return (
    <UDialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <UDialogContent className="max-w-sm">
        <UDialogHeader>
          <UDialogTitle>{title}</UDialogTitle>
        </UDialogHeader>
        {description && (
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{description}</p>
        )}
        <UDialogFooter className="gap-2 sm:gap-2">
          <UButton variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {cancelLabel}
          </UButton>
          <UButton
            variant={destructive ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? '...' : confirmLabel}
          </UButton>
        </UDialogFooter>
      </UDialogContent>
    </UDialog>
  );
}
