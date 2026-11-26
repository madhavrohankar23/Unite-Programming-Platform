import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTheme } from '@/features/theme/ThemeContext';
import { cn } from '@/lib/utilities/cn';

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  maxWidthClass?: string;
}

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  maxWidthClass = 'max-w-md',
}: ModalProps) {
  const { isLight } = useTheme();

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-50 backdrop-blur-sm',
            isLight ? 'bg-black/35' : 'bg-black/70',
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border p-6 focus:outline-none',
            isLight
              ? 'border-black/12 bg-gradient-to-b from-white via-white to-zinc-50 text-black shadow-[0_24px_60px_rgba(0,0,0,0.18)]'
              : 'border-slate-400/15 bg-[#0E1523] text-[#F8FAFC] shadow-unite-panel',
            maxWidthClass,
          )}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <DialogPrimitive.Title
                className={cn(
                  'text-lg font-semibold',
                  isLight ? 'text-black' : 'text-[#F8FAFC]',
                )}
              >
                {title}
              </DialogPrimitive.Title>
              {description && (
                <DialogPrimitive.Description
                  className={cn(
                    'mt-1 text-sm',
                    isLight ? 'text-zinc-600' : 'text-[#94A3B8]',
                  )}
                >
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close
              className={cn(
                'rounded-lg p-1.5 transition-colors',
                isLight
                  ? 'text-zinc-500 hover:bg-black/5 hover:text-black'
                  : 'text-[#64748B] hover:bg-slate-800 hover:text-[#F8FAFC]',
              )}
              aria-label="Close dialog"
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
