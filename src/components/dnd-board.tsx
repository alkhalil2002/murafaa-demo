"use client";

import { useState, useTransition } from "react";

/**
 * Drag-and-drop for the kanban boards (tasks) and the lead pipeline.
 *
 * Native HTML5 drag and drop — no library, so no stack change. The card and
 * column bodies are still rendered on the server; these components only wrap
 * them to add the drag behaviour, and the server action is passed down as a
 * prop.
 *
 * ACCESSIBILITY: HTML5 drag and drop is pointer-only — it cannot be operated
 * by keyboard or screen reader. The existing move-back / move-forward buttons
 * on each card are therefore NOT redundant and must stay: they are the
 * keyboard path to the same operation. Never treat dragging as the only way
 * to move a card.
 */

/** Payload key — `text/plain` so the browser's default drag image still works. */
const MIME = "text/plain";

export function DndCard({
  id,
  className,
  children,
}: {
  id: string;
  className: string;
  children: React.ReactNode;
}) {
  const [dragging, setDragging] = useState(false);
  return (
    <div
      draggable
      className={`${className} dnd-card${dragging ? " is-dragging" : ""}`}
      onDragStart={(e) => {
        e.dataTransfer.setData(MIME, id);
        e.dataTransfer.effectAllowed = "move";
        setDragging(true);
      }}
      onDragEnd={() => setDragging(false)}
    >
      {children}
    </div>
  );
}

export function DndColumn({
  target,
  field,
  onMove,
  className,
  children,
}: {
  /** Destination value, e.g. a TaskColumn or LeadStage. */
  target: string;
  /** Form field the action reads the destination from ("status" / "stage"). */
  field: string;
  /** Server action, passed down from the server component. */
  onMove: (formData: FormData) => Promise<void>;
  className: string;
  children: React.ReactNode;
}) {
  const [over, setOver] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div
      className={`${className} dnd-col${over ? " is-over" : ""}${pending ? " is-pending" : ""}`}
      onDragOver={(e) => {
        // Both preventDefault calls are required — without them the browser
        // refuses the drop and fires no drop event at all.
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (!over) setOver(true);
      }}
      onDragLeave={(e) => {
        // Ignore leave events fired while moving between this column's own
        // children, or the highlight flickers on every card boundary.
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        setOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const id = e.dataTransfer.getData(MIME);
        if (!id) return;
        const fd = new FormData();
        fd.set("id", id);
        fd.set(field, target);
        startTransition(() => {
          void onMove(fd);
        });
      }}
    >
      {children}
    </div>
  );
}
