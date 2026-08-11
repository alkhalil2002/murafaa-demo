/**
 * v2 vector marks.
 *
 * These exist to remove the two emoji the v1 Today screen used as structural
 * icons (🏆 for employee-of-the-week, ⚖ for the case chip). Emoji render
 * differently on every platform, can't inherit colour, and can't be sized
 * from design tokens — so they read as unfinished regardless of the layout
 * around them.
 */

/** Award medallion + ribbon — replaces the 🏆 emoji. */
export function SealMark({ size = 46 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {/* ribbon tails, sitting behind the medallion */}
      <path
        d="M19 32.6 L14.5 44.5 L20.6 41.6 L24 45 L27.4 41.6 L33.5 44.5 L29 32.6 Z"
        fill="currentColor"
        opacity="0.28"
      />
      {/* medallion — outer notched ring reads as a struck seal */}
      <circle
        cx="24"
        cy="21"
        r="14"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeDasharray="2.6 2.2"
        opacity="0.65"
      />
      <circle cx="24" cy="21" r="11" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M24 13.5 L25.88 18.41 L31.13 18.68 L27.04 21.99 L28.41 27.07 L24 24.2 L19.59 27.07 L20.96 21.99 L16.87 18.68 L22.12 18.41 Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Balance scale — replaces the ⚖ emoji in the task→case chip. */
export function ScaleMark({ size = 13 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 6v14M8 20h8M3.5 8h17" />
      <path d="M3.5 8 1.4 12.6a3.2 3.2 0 0 0 4.2 0L3.5 8Z" />
      <path d="M20.5 8l-2.1 4.6a3.2 3.2 0 0 0 4.2 0L20.5 8Z" />
      <circle cx="12" cy="4.4" r="1.5" />
    </svg>
  );
}
