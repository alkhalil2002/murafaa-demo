/**
 * Icon set reproduced from the approved prototype (nav + chrome). Paths are the
 * prototype's literal `d` values so the sidebar reads identically.
 */

type IconProps = { className?: string };

/** Shared stroke geometry used by every outline nav icon in the prototype. */
function Outline({ children, width = 1.7 }: { children: React.ReactNode; width?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function IconToday() {
  return <Outline><path d="M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18" /></Outline>;
}

export function IconCases() {
  return <Outline><path d="M3 7h18M3 12h18M3 17h18" /></Outline>;
}

export function IconClients() {
  return (
    <Outline>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87" />
    </Outline>
  );
}

export function IconLeads() {
  return <Outline><path d="M3 12h4l3-7 4 14 3-7h4" /></Outline>;
}

export function IconPulse() {
  return (
    <Outline>
      <path d="M3 12h4l3-7 4 14 3-7h4" />
    </Outline>
  );
}

export function IconTasks() {
  return (
    <Outline>
      <path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </Outline>
  );
}

export function IconDocuments() {
  return <Outline><path d="M14 3v5h5M7 3h8l5 5v13H7z" /></Outline>;
}

export function IconDeadlines() {
  return (
    <Outline>
      <path d="M8 2v4M16 2v4M3 9h18M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
    </Outline>
  );
}

export function IconAi() {
  return (
    <Outline>
      <path d="M12 3l1.8 4.4L18 9.2l-4.2 1.8L12 15l-1.8-4L6 9.2l4.2-1.8zM18 14l.9 2.1L21 17l-2.1.9L18 20l-.9-2.1L15 17l2.1-.9z" />
    </Outline>
  );
}

export function IconFinance() {
  return (
    <Outline>
      <path d="M20 7H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM2 11h20M16 15h.01" />
    </Outline>
  );
}

export function IconHr() {
  return (
    <Outline>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M23 21v-2a4 4 0 0 0-3-3.87M16 3.1a4 4 0 0 1 0 7.75" />
    </Outline>
  );
}

export function IconBell() {
  return (
    <Outline>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
    </Outline>
  );
}

export function IconChevron() {
  return <Outline width={2.5}><path d="M6 9l6 6 6-6" /></Outline>;
}

export function IconUser() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}

/** The scales-of-justice brand mark that sits in the gold ring. */
export function BrandMark({ className, withBase = false }: IconProps & { withBase?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="#C2974B"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 3v18M5 7h14M7 7l-3 6h6zM17 7l-3 6h6z" />
      <path d="M2 13a4 4 0 0 0 8 0M14 13a4 4 0 0 0 8 0" />
      {withBase ? <path d="M8 21h8" /> : null}
    </svg>
  );
}

export function IconWhatsapp() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.04 2a9.9 9.9 0 0 0-8.5 14.9L2 22l5.3-1.4A9.9 9.9 0 1 0 12.04 2zm0 1.8a8.1 8.1 0 0 1 6.9 12.3l-.2.3.6 2.2-2.3-.6-.3.2A8.1 8.1 0 1 1 12 3.8zm4.6 10.1c-.2-.1-1.4-.7-1.6-.8s-.4-.1-.5.1-.6.8-.8.9-.3.2-.5.1a6.6 6.6 0 0 1-3.2-2.8c-.2-.4.2-.4.6-1.2.1-.2 0-.3 0-.5l-.7-1.6c-.2-.5-.4-.4-.5-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2c0 1.3 1 2.6 1.1 2.7s1.9 2.9 4.6 4c1.7.7 2.3.8 3.1.7.5-.1 1.4-.6 1.6-1.1s.2-1 .1-1.1z" />
    </svg>
  );
}
