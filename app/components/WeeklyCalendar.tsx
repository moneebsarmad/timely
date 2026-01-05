"use client";

import { useMemo, useState } from "react";
import { addDays, addWeeks, format, isSameDay, isToday, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useDrop } from "react-dnd";
import { Task } from "../lib/types";
import { useTaskStore } from "./TaskList";
import { TaskItem } from "./TaskItem";

type DayCellProps = {
  date: Date;
  tasks: Task[];
  onDropTask: (id: string, date: Date) => void;
  onDeleteTask: (id: string) => void;
  onToggleStatus: (id: string) => void;
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
};

function DayCell({
  date,
  tasks,
  onDropTask,
  onDeleteTask,
  onToggleStatus,
  onUpdateTask,
}: DayCellProps) {
  const [{ isOver }, dropRef] = useDrop(
    () => ({
      accept: "TASK",
      drop: (item: { id: string }) => onDropTask(item.id, date),
      collect: (monitor) => ({
        isOver: monitor.isOver(),
      }),
    }),
    [date, onDropTask]
  );

  return (
    <div
      ref={dropRef}
      className={`flex flex-col rounded-2xl border border-stone-200 bg-white/80 p-3 transition ${
        isOver ? "border-stone-900 shadow-lg" : "shadow-sm"
      } ${isToday(date) ? "ring-2 ring-stone-900" : ""}`}
    >
      <div className="flex items-center justify-between text-xs text-stone-500">
        <span className="font-semibold text-stone-700">
          {format(date, "EEE")}
        </span>
        <span>{format(date, "d")}</span>
      </div>
      <div className="mt-2 space-y-2">
        {tasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50 p-2 text-xs text-stone-400">
            Drop here
          </div>
        ) : (
          tasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              variant="calendar"
              onDelete={onDeleteTask}
              onToggleStatus={onToggleStatus}
              onUpdate={onUpdateTask}
            />
          ))
        )}
      </div>
    </div>
  );
}

export function WeeklyCalendar() {
  const { tasks, setTaskDueDate, deleteTask, toggleStatus, updateTask } = useTaskStore();
  const [weekStart, setWeekStart] = useState(
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart]
  );

  const tasksByDay = useMemo(() => {
    return weekDays.map((day) =>
      tasks.filter((task) =>
        task.dueDate ? isSameDay(new Date(task.dueDate), day) : false
      )
    );
  }, [tasks, weekDays]);

  const handleDrop = (id: string, date: Date) => {
    setTaskDueDate(id, date.toISOString());
  };

  return (
    <section className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Weekly plan</h2>
          <p className="text-sm text-stone-500">
            {format(weekStart, "MMM d")} -{" "}
            {format(addDays(weekStart, 6), "MMM d")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekStart((current) => addWeeks(current, -1))}
            className="rounded-full border border-stone-200 p-2 text-stone-600 transition hover:border-stone-300"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() =>
              setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))
            }
            className="rounded-full border border-stone-200 px-3 py-2 text-xs font-semibold text-stone-600 transition hover:border-stone-300"
          >
            This week
          </button>
          <button
            type="button"
            onClick={() => setWeekStart((current) => addWeeks(current, 1))}
            className="rounded-full border border-stone-200 p-2 text-stone-600 transition hover:border-stone-300"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-3 lg:grid-cols-7">
        {weekDays.map((day, index) => (
          <div key={day.toISOString()} className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs text-stone-500">
              <span>{tasksByDay[index]?.length ?? 0} tasks</span>
              {isToday(day) ? (
                <span className="rounded-full bg-stone-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                  Today
                </span>
              ) : null}
            </div>
            <DayCell
              date={day}
              tasks={tasksByDay[index] ?? []}
              onDropTask={handleDrop}
              onDeleteTask={deleteTask}
              onToggleStatus={toggleStatus}
              onUpdateTask={updateTask}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
