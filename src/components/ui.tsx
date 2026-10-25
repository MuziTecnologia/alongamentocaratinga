'use client';
import { useEffect, useRef, type FormEvent, type ReactNode } from 'react';
import { ArrowUpRight, Check, Flower2, Plus, X } from 'lucide-react';
import { initials } from '@/lib/utils';
import { useStudio } from './studio-provider';
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand">
      <div className="brand-mark">
        <Flower2 size={27} strokeWidth={1.25} />
      </div>
      {!compact && (
        <div>
          <strong>
            Alongamentos<span>Caratinga</span>
          </strong>
          <small>SEU ESPAÇO DE CUIDADO</small>
        </div>
      )}
    </div>
  );
}
export function PageHeading({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action}
    </div>
  );
}
export function Avatar({
  name,
  color,
  size = '',
}: {
  name: string;
  color?: string;
  size?: string;
}) {
  return (
    <span className={`avatar ${size}`} style={color ? { background: color } : undefined}>
      {initials(name)}
    </span>
  );
}
export function Badge({ children, tone = '' }: { children: ReactNode; tone?: string }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Empty({
  title = 'Um novo começo por aqui',
  text,
  action,
}: {
  title?: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Flower2 size={34} strokeWidth={1} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
  className = '',
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={`field ${className}`}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const firstField = ref.current?.querySelector<HTMLElement>('input,select,textarea');
    (firstField || ref.current?.querySelector<HTMLElement>('button'))?.focus();
    const handle = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        const els = ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
        );
        if (!els?.length) return;
        if (event.shiftKey && document.activeElement === els[0]) {
          event.preventDefault();
          els[els.length - 1].focus();
        } else if (!event.shiftKey && document.activeElement === els[els.length - 1]) {
          event.preventDefault();
          els[0].focus();
        }
      }
    };
    document.addEventListener('keydown', handle);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', handle);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`modal ${wide ? 'wide' : ''}`}
      >
        <div className="modal-head">
          <div>
            <div className="eyebrow">AlongamentosCARATINGA</div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon-button" aria-label="Fechar janela" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function FormActions({
  onClose,
  label = 'Salvar',
  extra,
  pending = false,
}: {
  onClose: () => void;
  label?: string;
  extra?: ReactNode;
  pending?: boolean;
}) {
  const { busy } = useStudio();
  return (
    <div className="form-actions">
      {extra}
      <button
        type="button"
        className="button secondary"
        disabled={busy || pending}
        onClick={onClose}
      >
        Cancelar
      </button>
      <button className="button primary" disabled={busy || pending} type="submit">
        <Check size={16} />
        {busy || pending ? 'Salvando…' : label}
      </button>
    </div>
  );
}
export function AddButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button className="button primary" onClick={onClick}>
      <Plus size={17} />
      {children}
    </button>
  );
}
export function SectionHead({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-head">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
export function Stat({
  label,
  value,
  detail,
  icon,
  positive,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: ReactNode;
  positive?: boolean;
}) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <div className="stat-icon">{icon}</div>
      </div>
      <strong>{value}</strong>
      <small className={positive ? 'positive' : ''}>
        {positive && <ArrowUpRight size={13} />}
        {detail}
      </small>
    </div>
  );
}
export const formValues = (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault();
  return new FormData(event.currentTarget);
};
export const value = (form: FormData, key: string) => String(form.get(key) || '').trim();
export const numberValue = (form: FormData, key: string) =>
  Number(value(form, key).replace(',', '.'));
