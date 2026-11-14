import { useEffect } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { CloseIcon } from './icons';

/* ---------------- 버튼 ---------------- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-ink text-white hover:bg-ink/90 disabled:bg-ink/40',
  secondary: 'border border-line bg-paper text-ink hover:bg-soft/60 disabled:opacity-50',
  ghost: 'text-accent hover:bg-soft/60 disabled:opacity-50',
  danger: 'border border-danger/30 bg-paper text-danger hover:bg-danger/5 disabled:opacity-50',
};

export function Button({
  variant = 'primary',
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-[13px] font-medium transition-colors ${VARIANT[variant]} ${className}`}
      {...rest}
    />
  );
}

/* ---------------- 페이지 제목 ---------------- */

export function PageTitle({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div className="mb-6">
      <div className="eyebrow">{eyebrow}</div>
      <h1 className="mt-2.5 mb-2 font-serif text-[clamp(30px,5vw,44px)] leading-tight font-normal">{title}</h1>
      {sub && <p className="text-sm text-muted">{sub}</p>}
    </div>
  );
}

export function SectionHead({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mt-9 mb-4 flex items-center justify-between">
      <h2 className="font-serif text-[21px] font-normal">{title}</h2>
      {action}
    </div>
  );
}

export function EmptyState({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-paper px-6 py-9 text-center text-sm leading-relaxed text-muted">
      {children}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ---------------- 모달(모바일에서는 바텀시트) ---------------- */

export function Modal({
  title,
  onClose,
  children,
  footer,
  wide = false,
}: {
  title?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="animate-fade fixed inset-0 z-40 flex items-end justify-center bg-[#211d19]/60 sm:items-center sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`animate-sheet relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-paper sm:rounded-3xl ${wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'}`}
      >
        {title && (
          <div className="flex items-center justify-between px-6 pt-6 pb-2">
            <h2 className="font-serif text-[23px] font-normal">{title}</h2>
            <button type="button" onClick={onClose} aria-label="닫기" className="-mr-2 rounded-full p-2 text-muted hover:bg-soft">
              <CloseIcon />
            </button>
          </div>
        )}
        {!title && (
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="absolute top-3 right-3 z-10 rounded-full bg-black/35 p-2 text-white backdrop-blur-sm"
          >
            <CloseIcon size={18} />
          </button>
        )}
        <div className="flex-1 overflow-y-auto px-6 pb-6">{children}</div>
        {footer && <div className="pb-safe flex justify-end gap-2 border-t border-line px-6 pt-4">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------------- 폼 필드 ---------------- */

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="my-3.5 block">
      <span className="mb-1.5 flex items-baseline justify-between text-xs text-muted">
        <span>{label}</span>
        {hint && <span className="text-[11px]">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

export function Chip({
  active,
  onClick,
  children,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] transition-colors disabled:opacity-40 ${
        active ? 'border-ink bg-ink text-white' : 'border-line bg-paper text-ink hover:bg-soft/60'
      }`}
    >
      {children}
    </button>
  );
}

export function Badge({ children, tone = 'soft' }: { children: ReactNode; tone?: 'soft' | 'accent' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${
        tone === 'accent' ? 'bg-accent/12 text-accent' : 'bg-soft text-muted'
      }`}
    >
      {children}
    </span>
  );
}
