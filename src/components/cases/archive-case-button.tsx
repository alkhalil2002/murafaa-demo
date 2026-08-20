"use client";

/**
 * Archive submit button that warns before archiving with an incomplete
 * closing checklist (prototype archiveCaseFull's confirm() guard) — a
 * plain server-action button has no way to intercept submission, so this
 * needs its own client boundary.
 */
export function ArchiveCaseButton({
  incomplete,
  confirmMessage,
  children,
}: {
  incomplete: boolean;
  confirmMessage: string;
  children: React.ReactNode;
}) {
  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    if (incomplete && !window.confirm(confirmMessage)) e.preventDefault();
  }

  return (
    <button type="submit" className="act b-judge" onClick={handleClick}>
      {children}
    </button>
  );
}
