"use client";

/** Submit button that requires a window.confirm() before the form submits. */
export function ConfirmSubmitButton({
  confirmMessage,
  className,
  children,
}: {
  confirmMessage: string;
  className?: string;
  children: React.ReactNode;
}) {
  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    if (!window.confirm(confirmMessage)) e.preventDefault();
  }

  return (
    <button type="submit" className={className} onClick={handleClick}>
      {children}
    </button>
  );
}
