"use client";

import { Suspense } from "react";
import { Tabs } from "@/components/ui/Tabs";
import {
  ActivityTimeline,
  type TimelineEvent,
} from "@/components/customer/ActivityTimeline";
import { NotesPanel, type NoteItem } from "@/components/customer/NotesPanel";
import { TasksPanel, type TaskItem } from "@/components/customer/TasksPanel";

export function CustomerTabs({
  customerId,
  events,
  notes,
  tasks,
  selfId,
  canEdit,
  isAdmin,
}: {
  customerId: string;
  events: TimelineEvent[];
  notes: NoteItem[];
  tasks: TaskItem[];
  selfId: string;
  canEdit: boolean;
  isAdmin: boolean;
}) {
  return (
    // Tabs read useSearchParams, which needs a Suspense boundary during SSR.
    <Suspense fallback={null}>
      <Tabs
        tabs={[
          { key: "activity", label: "Activity", count: events.length },
          { key: "notes", label: "Notes", count: notes.length },
          { key: "tasks", label: "Interventions", count: tasks.length },
        ]}
      >
        {(active) =>
          active === "notes" ? (
            <NotesPanel
              customerId={customerId}
              notes={notes}
              selfId={selfId}
              canEdit={canEdit}
              isAdmin={isAdmin}
            />
          ) : active === "tasks" ? (
            <TasksPanel customerId={customerId} tasks={tasks} canEdit={canEdit} />
          ) : (
            <ActivityTimeline events={events} />
          )
        }
      </Tabs>
    </Suspense>
  );
}
