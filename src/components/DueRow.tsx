import type { ReactNode } from 'react';
import { CheckCircle2, FileText, Pencil, Wrench } from 'lucide-react';
import { StatusPill, iconButton, secondaryButton, type Attention } from '@huishouden/pwa-kit/react/ui';
import { useT } from '../i18n';

/** One thing to do: the glanceable line, its state, what it is about, and the one action. */
export function DueRow({ kind, state, text, meta, onDone, doneLabel, onEdit, editLabel }: {
  kind: 'service' | 'renewal';
  state: Attention;
  text: string;
  meta: ReactNode;
  onDone?: () => void;
  doneLabel: string;
  /** Left out where the person may not edit it (a helper on someone else's item). */
  onEdit?: () => void;
  editLabel: string;
}) {
  const t = useT();
  const Icon = kind === 'service' ? Wrench : FileText;
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-4 py-3 last:border-b-0 sm:flex-nowrap sm:px-5">
      <Icon size={22} strokeWidth={2.2} className={`shrink-0 ${state === 'overdue' ? 'text-attention-fill' : 'text-muted'}`} aria-hidden="true" />
      <div className="min-w-0 flex-1 basis-[calc(100%-2.5rem)] sm:basis-0">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <p className="text-lg font-semibold text-ink">{text}</p>
          <StatusPill state={state} />
        </div>
        <p className="mt-0.5 text-base text-muted">{meta}</p>
      </div>
      <div className="ml-9.5 flex items-center gap-1 sm:ml-0">
      {onDone && (
        <button type="button" className={secondaryButton} onClick={onDone} aria-label={t('row.doneLabel', { action: doneLabel, text })}>
          <CheckCircle2 size={18} aria-hidden="true" /> {doneLabel}
        </button>
      )}
      {onEdit && (
        <button type="button" className={iconButton} onClick={onEdit} aria-label={editLabel}>
          <Pencil size={18} />
        </button>
      )}
      </div>
    </li>
  );
}

/** Pieces of a meta line joined with a middle dot. */
export function Meta({ parts }: { parts: (ReactNode | null | undefined | false)[] }) {
  const shown = parts.filter(Boolean);
  return (
    <>
      {shown.map((p, i) => (
        <span key={i}>
          {i > 0 && ' · '}
          {p}
        </span>
      ))}
    </>
  );
}
