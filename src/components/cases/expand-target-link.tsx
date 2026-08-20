"use client";

/**
 * Header quick-link (prototype hearingCard's ✎/📎 header buttons) that jumps
 * straight to and opens a nested <details> further down the same card,
 * instead of requiring the user to scroll to it and click its own summary.
 * A plain `<a href="#id">` can't reliably force-open a closed <details> across
 * browsers, so this does it directly via the DOM.
 */
export function ExpandTargetLink({
  targetId,
  className,
  title,
  children,
}: {
  targetId: string;
  className?: string;
  title?: string;
  children: React.ReactNode;
}) {
  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    // Both needed: preventDefault stops the ancestor <summary>'s native
    // toggle (this link usually sits inside a card's always-visible header
    // row, which IS a <summary>), stopPropagation belt-and-braces against
    // any other click handler on an ancestor.
    e.preventDefault();
    e.stopPropagation();
    const target = document.getElementById(targetId);
    if (!target) return;
    if (target instanceof HTMLDetailsElement) target.open = true;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <a href={`#${targetId}`} className={className} title={title} onClick={handleClick}>
      {children}
    </a>
  );
}
