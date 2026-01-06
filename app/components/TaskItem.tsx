"use client";

import { useMemo, useState } from "react";
import { addDays, format, startOfDay } from "date-fns";
import { useDrag } from "react-dnd";
import {
  Check,
  Trash2,
  PencilLine,
  Save,
  X,
  Plus,
  Minus,
  CalendarDays,
  Archive,
  Clock,
} from "lucide-react";
import { Task, Category, ChecklistItem } from "../lib/types";
import { useTaskStore } from "./TaskList";

const priorityStyles: Record<Task["priority"], string> = {
  high: "bg-red-500",
  medium: "bg-orange-500",
  low: "bg-blue-500",
  none: "bg-stone-300",
};

type TaskItemProps = {
  task: Task;
  variant: "list" | "calendar";
  onDelete?: (id: string) => void;
  onToggleStatus?: (id: string) => void;
  onUpdate?: (id: string, updates: Partial<Task>) => void;
};

const getCategoryColor = (categories: Category[], categoryId: string) =>
  categories.find((category) => category.id === categoryId)?.color ?? "bg-stone-400";

export function TaskItem({
  task,
  variant,
  onDelete,
  onToggleStatus,
  onUpdate,
}: TaskItemProps) {
  const { categories } = useTaskStore();
  const safeTags = task.tags ?? [];
  const safeChecklist = task.checklist ?? [];
  const safeRepeat = task.repeat ?? "none";
  const safeMyDay = task.myDay ?? [];
  const safeSection = task.section ?? "";
  const todayKey = format(new Date(), "yyyy-MM-dd");
  const isPlannedToday = safeMyDay.includes(todayKey);
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(task.title);
  const [draftNotes, setDraftNotes] = useState(task.notes);
  const [draftCategory, setDraftCategory] = useState(task.category);
  const [draftPriority, setDraftPriority] = useState(task.priority);
  const [draftSection, setDraftSection] = useState(safeSection);
  const [draftTags, setDraftTags] = useState(safeTags.join(", "));
  const [draftRepeat, setDraftRepeat] = useState<Task["repeat"]>(
    task.repeat ?? "none"
  );
  const [draftBucket, setDraftBucket] = useState<Task["bucket"]>(
    task.bucket ?? "inbox"
  );
  const [draftDueDate, setDraftDueDate] = useState(
    task.dueDate ? format(new Date(task.dueDate), "yyyy-MM-dd") : ""
  );
  const [draftSnoozedUntil, setDraftSnoozedUntil] = useState(
    task.snoozedUntil ? format(new Date(task.snoozedUntil), "yyyy-MM-dd") : ""
  );
  const [draftReminderAt, setDraftReminderAt] = useState(
    task.reminderAt ? format(new Date(task.reminderAt), "yyyy-MM-dd'T'HH:mm") : ""
  );
  const [draftChecklist, setDraftChecklist] = useState<ChecklistItem[]>(
    safeChecklist
  );

  const isDraggable = variant === "list" && task.dueDate === null;
  const hasActions = Boolean(onDelete || onToggleStatus || onUpdate);

  const [{ isDragging }, dragRef] = useDrag(
    () => ({
      type: "TASK",
      item: { id: task.id },
      canDrag: isDraggable,
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
    }),
    [task.id, isDraggable]
  );

  const categoryColor = useMemo(
    () => getCategoryColor(categories, task.category),
    [categories, task.category]
  );

  const handleSave = () => {
    if (!onUpdate) {
      return;
    }
    const dueDate = draftDueDate
      ? new Date(`${draftDueDate}T00:00:00`).toISOString()
      : null;
    const reminderAt = draftReminderAt
      ? new Date(draftReminderAt).toISOString()
      : null;
    const snoozedUntil = draftSnoozedUntil
      ? new Date(`${draftSnoozedUntil}T00:00:00`).toISOString()
      : null;
    const tags = draftTags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    onUpdate(task.id, {
      title: draftTitle.trim() || task.title,
      notes: draftNotes,
      category: draftCategory,
      section: draftSection.trim(),
      priority: draftPriority,
      tags,
      repeat: draftRepeat,
      dueDate,
      snoozedUntil,
      bucket: draftBucket,
      reminderAt,
      checklist: draftChecklist,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setDraftTitle(task.title);
    setDraftNotes(task.notes);
    setDraftCategory(task.category);
    setDraftPriority(task.priority);
    setDraftSection(task.section ?? "");
    setDraftTags((task.tags ?? []).join(", "));
    setDraftRepeat(task.repeat ?? "none");
    setDraftBucket(task.bucket ?? "inbox");
    setDraftDueDate(task.dueDate ? format(new Date(task.dueDate), "yyyy-MM-dd") : "");
    setDraftSnoozedUntil(
      task.snoozedUntil ? format(new Date(task.snoozedUntil), "yyyy-MM-dd") : ""
    );
    setDraftReminderAt(
      task.reminderAt ? format(new Date(task.reminderAt), "yyyy-MM-dd'T'HH:mm") : ""
    );
    setDraftChecklist(task.checklist ?? []);
    setIsEditing(false);
  };

  const updateChecklistItem = (id: string, updates: Partial<ChecklistItem>) => {
    setDraftChecklist((current) =>
      current.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  const removeChecklistItem = (id: string) => {
    setDraftChecklist((current) => current.filter((item) => item.id !== id));
  };

  const addChecklistItem = () => {
    setDraftChecklist((current) => [
      ...current,
      {
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `check-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        text: "",
        done: false,
      },
    ]);
  };

  return (
    <div
      ref={dragRef}
      className={`rounded-2xl border border-stone-200 bg-white shadow-sm transition ${
        isDragging ? "opacity-60" : "opacity-100"
      } ${task.status === "done" ? "opacity-60" : ""} ${
        variant === "calendar"
          ? "border-stone-100 bg-white/80 px-2 py-2"
          : "px-4 py-3"
      }`}
    >
      <div
        className={`gap-3 ${variant === "calendar" ? "flex flex-col" : "flex items-start justify-between"}`}
      >
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${priorityStyles[task.priority]}`}
            />
            <span
              className={`min-w-0 flex-1 text-sm font-semibold break-words leading-snug ${
                task.status === "done" ? "line-through text-stone-400" : "text-stone-900"
              }`}
            >
              {task.title}
            </span>
          </div>
          {task.notes && variant === "list" ? (
            <p className="mt-1 text-xs text-stone-500">{task.notes}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-stone-500">
            <span className={`h-2 w-2 rounded-full ${categoryColor}`} />
            <span
              className={
                variant === "calendar" ? "text-[11px] uppercase tracking-wide" : ""
              }
            >
              {categories.find((category) => category.id === task.category)?.name}
            </span>
            {task.bucket === "someday" ? (
              <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                Someday
              </span>
            ) : null}
            {safeSection ? (
              <span className="rounded-full border border-stone-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-600">
                {safeSection}
              </span>
            ) : null}
            {task.dueDate ? (
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-600">
                Due {format(new Date(task.dueDate), "MMM d")}
              </span>
            ) : null}
            {task.snoozedUntil && new Date(task.snoozedUntil) > new Date() ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                Snoozed {format(new Date(task.snoozedUntil), "MMM d")}
              </span>
            ) : null}
            {task.reminderAt ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                Remind {format(new Date(task.reminderAt), "MMM d h:mm a")}
              </span>
            ) : null}
            {safeRepeat !== "none" ? (
              <span className="rounded-full border border-stone-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-600">
                Repeats {safeRepeat}
              </span>
            ) : null}
            {safeRepeat !== "none" && task.streak > 0 ? (
              <span className="rounded-full border border-stone-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-600">
                Streak {task.streak}
              </span>
            ) : null}
            {isPlannedToday ? (
              <span className="rounded-full bg-stone-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                My Day
              </span>
            ) : null}
          </div>
          {variant === "list" && safeTags.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {safeTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-stone-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-stone-600"
                >
                  @{tag}
                </span>
              ))}
            </div>
          ) : null}
          {safeChecklist.length > 0 ? (
            <div className="mt-2 text-[11px] uppercase tracking-wide text-stone-500">
              {safeChecklist.filter((item) => item.done).length}/
              {safeChecklist.length} steps
            </div>
          ) : null}
        </div>
        {hasActions ? (
          <div
            className={`flex items-center gap-2 ${
              variant === "calendar" ? "justify-start" : "justify-end"
            }`}
          >
            {variant === "list" ? (
              <button
                type="button"
                onClick={() => {
                  const nextMyDay = isPlannedToday
                    ? safeMyDay.filter((date) => date !== todayKey)
                    : [...safeMyDay, todayKey];
                  onUpdate?.(task.id, { myDay: nextMyDay });
                }}
                className={`rounded-full border border-stone-200 text-stone-600 transition hover:border-stone-300 ${
                  variant === "calendar" ? "h-7 w-7 p-1.5" : "p-2"
                }`}
              >
                <CalendarDays className="h-4 w-4" />
              </button>
            ) : null}
            {variant === "list" ? (
              <button
                type="button"
                title="Snooze until tomorrow"
                onClick={() => {
                  const snoozedUntil = addDays(startOfDay(new Date()), 1).toISOString();
                  onUpdate?.(task.id, { snoozedUntil });
                }}
                className="rounded-full border border-stone-200 p-2 text-stone-600 transition hover:border-stone-300"
              >
                <Clock className="h-4 w-4" />
              </button>
            ) : null}
            {variant === "list" ? (
              <button
                type="button"
                title="Move to Someday"
                onClick={() => {
                  const nextBucket = task.bucket === "someday" ? "inbox" : "someday";
                  onUpdate?.(task.id, { bucket: nextBucket, dueDate: null });
                }}
                className="rounded-full border border-stone-200 p-2 text-stone-600 transition hover:border-stone-300"
              >
                <Archive className="h-4 w-4" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => onToggleStatus?.(task.id)}
              className={`rounded-full border border-stone-200 text-stone-600 transition hover:border-stone-300 ${
                variant === "calendar" ? "h-7 w-7 p-1.5" : "p-2"
              }`}
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setIsEditing((value) => !value)}
              className={`rounded-full border border-stone-200 text-stone-600 transition hover:border-stone-300 ${
                variant === "calendar" ? "h-7 w-7 p-1.5" : "p-2"
              }`}
            >
              <PencilLine className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onDelete?.(task.id)}
              className={`rounded-full border border-stone-200 text-stone-600 transition hover:border-stone-300 ${
                variant === "calendar" ? "h-7 w-7 p-1.5" : "p-2"
              }`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>

      {isEditing && onUpdate ? (
        <div className="mt-3 space-y-2 border-t border-stone-100 pt-3">
          <input
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
          />
          <textarea
            value={draftNotes}
            onChange={(event) => setDraftNotes(event.target.value)}
            rows={2}
            className="w-full resize-none rounded-lg border border-stone-200 px-3 py-2 text-sm"
            placeholder="Notes"
          />
          <div className="grid gap-2 md:grid-cols-2">
            <select
              value={draftCategory}
              onChange={(event) => setDraftCategory(event.target.value)}
              className="rounded-lg border border-stone-200 px-3 py-2 text-sm"
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <input
              value={draftSection}
              onChange={(event) => setDraftSection(event.target.value)}
              className="rounded-lg border border-stone-200 px-3 py-2 text-sm"
              placeholder="Section / heading"
            />
            <select
              value={draftPriority}
              onChange={(event) =>
                setDraftPriority(event.target.value as Task["priority"])
              }
              className="rounded-lg border border-stone-200 px-3 py-2 text-sm"
            >
              <option value="none">No priority</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            <input
              type="date"
              value={draftDueDate}
              onChange={(event) => setDraftDueDate(event.target.value)}
              className="rounded-lg border border-stone-200 px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={draftSnoozedUntil}
              onChange={(event) => setDraftSnoozedUntil(event.target.value)}
              className="rounded-lg border border-stone-200 px-3 py-2 text-sm"
              placeholder="Snooze until"
            />
            <input
              type="datetime-local"
              value={draftReminderAt}
              onChange={(event) => setDraftReminderAt(event.target.value)}
              className="rounded-lg border border-stone-200 px-3 py-2 text-sm"
            />
            <select
              value={draftBucket}
              onChange={(event) =>
                setDraftBucket(event.target.value as Task["bucket"])
              }
              className="rounded-lg border border-stone-200 px-3 py-2 text-sm"
            >
              <option value="inbox">Inbox</option>
              <option value="someday">Someday</option>
            </select>
            <select
              value={draftRepeat}
              onChange={(event) =>
                setDraftRepeat(event.target.value as Task["repeat"])
              }
              className="rounded-lg border border-stone-200 px-3 py-2 text-sm"
            >
              <option value="none">No repeat</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
          <input
            value={draftTags}
            onChange={(event) => setDraftTags(event.target.value)}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
            placeholder="Tags (comma separated)"
          />
          <div className="rounded-xl border border-stone-100 bg-stone-50 p-3">
            <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-stone-500">
              Checklist
              <button
                type="button"
                onClick={addChecklistItem}
                className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-stone-600"
              >
                <Plus className="h-3 w-3" />
                Add step
              </button>
            </div>
            {draftChecklist.length === 0 ? (
              <div className="text-xs text-stone-400">No steps yet.</div>
            ) : (
              <div className="space-y-2">
                {draftChecklist.map((item) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={(event) =>
                        updateChecklistItem(item.id, {
                          done: event.target.checked,
                        })
                      }
                      className="h-4 w-4 rounded border-stone-300"
                    />
                    <input
                      value={item.text}
                      onChange={(event) =>
                        updateChecklistItem(item.id, {
                          text: event.target.value,
                        })
                      }
                      className="flex-1 rounded-lg border border-stone-200 px-2 py-1 text-xs"
                      placeholder="Step details"
                    />
                    <button
                      type="button"
                      onClick={() => removeChecklistItem(item.id)}
                      className="rounded-full border border-stone-200 p-1 text-stone-500"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-2 rounded-full bg-stone-900 px-3 py-1 text-xs font-semibold text-white"
            >
              <Save className="h-3.5 w-3.5" />
              Save
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="inline-flex items-center gap-2 rounded-full border border-stone-200 px-3 py-1 text-xs font-semibold text-stone-700"
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
