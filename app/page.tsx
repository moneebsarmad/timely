"use client";

import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { BrainDump } from "./components/BrainDump";
import { FocusTimer } from "./components/FocusTimer";
import { TaskList, TaskProvider, useTaskStore } from "./components/TaskList";
import { WeeklyCalendar } from "./components/WeeklyCalendar";

function AppShell() {
  const { isReady } = useTaskStore();

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-stone-500">
        Loading Timely...
      </div>
    );
  }

  return (
    <div className="app-shell text-stone-900">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-10 lg:flex-row lg:items-start">
        <section className="flex w-full flex-col gap-6 lg:w-[38%]">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Timely</h1>
            <p className="text-sm text-stone-600">
              Capture, categorize, and drop tasks into your week.
            </p>
          </div>
          <BrainDump />
          <FocusTimer />
          <TaskList />
        </section>
        <section className="w-full lg:sticky lg:top-8 lg:w-[62%]">
          <WeeklyCalendar />
        </section>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <TaskProvider>
      <DndProvider backend={HTML5Backend}>
        <AppShell />
      </DndProvider>
    </TaskProvider>
  );
}
