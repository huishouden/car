import type { ReactNode } from 'react';
import { FileText, Pencil, Wrench } from 'lucide-react';
import { CompleteButton, StatusPill, iconButton, type Attention } from '@huishouden/pwa-kit/react/ui';
import { AddToCalendar } from '@huishouden/pwa-kit/react/calendar';
import type { CalendarEntry } from '@huishouden/pwa-kit/calendar-export';
/**
 * One thing to do: the glanceable line, its state, what it is about, and the one action, the kit's
 * outlined `CompleteButton` with the domain verb ("Log service", "Mark renewed"; DESIGN.md
 * "Completion"). Doing it moves the item to its next due date (with the toast's Undo), so a row is
 * never shown done.
 */
export function DueRow({ kind, state, text, meta, onDone, doneVerb, doneLabel, onEdit, editLabel, calendar }: {
  kind: 'service' | 'renewal';
  state: Attention;
  text: string;
  meta: ReactNode;
  onDone?: () => void;
  /** The button's word: "Log service", "Mark renewed". */
  doneVerb: string;
  /** The button's name: "Log Oil change for Family van as done". */
  doneLabel: string;
  /** Left out where the person may not edit it (a helper on someone else's item). */
  onEdit?: () => void;
  editLabel: string;
  /** The item as Car puts it on the household agenda, for "Add to calendar"; left out when it has no day. */
  calendar?: CalendarEntry;
}) {
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
      {onDone && <CompleteButton done={false} name={text} verb={doneVerb} label={doneLabel} onDone={onDone} />}
      {calendar && <AddToCalendar entry={calendar} compact />}
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
