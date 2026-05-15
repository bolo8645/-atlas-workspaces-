"use client";

import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

export const NOTES_DND_END_EVENT = "ascu:notes-dnd-end";

export type NotesDndEndDetail = {
  activeId: string;
  overId: string | null;
};

export function NotesDndProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8
      }
    })
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  function handleDragEnd(event: DragEndEvent) {
    window.dispatchEvent(
      new CustomEvent<NotesDndEndDetail>(NOTES_DND_END_EVENT, {
        detail: {
          activeId: String(event.active.id),
          overId: event.over ? String(event.over.id) : null
        }
      })
    );
  }

  if (!mounted) return children;

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      {children}
    </DndContext>
  );
}
