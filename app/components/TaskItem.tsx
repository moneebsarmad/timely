"use client";

import { useMemo, useState } from "react";
import { useDrag } from "react-dnd";
import { Check, Trash2, PencilLine, Save, X } from "lucide-react";
import { Task, Category } from "../lib/types";
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
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(task.title);
  const [draftNotes, setDraftNotes] = useState(task.notes);
  const [draftCategory, setDraftCategory] = useState(task.category);
  const [draftPriority, setDraftPriority] = useState(task.priority);

  const isDraggable = variant === "list" && task.dueDate === null;

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
    onUpdate(task.id, {
      title: draftTitle.trim() || task.title,
      notes: draftNotes,
      category: draftCategory,
      priority: draftPriority,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setDraftTitle(task.title);
    setDraftNotes(task.notes);
    setDraftCategory(task.category);
    setDraftPriority(task.priority);
    setIsEditing(false);
  };

  return (
    <div
      ref={dragRef}
      className={`rounded-2xl border border-stone-200 bg-white px-4 py-3 shadow-sm transition ${
        isDragging ? "opacity-60" : "opacity-100"
      } ${task.status === "done" ? "opacity-60" : ""} ${
        variant === "calendar" ? "border-stone-100 bg-white/80" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${priorityStyles[task.priority]}`}
            />
            <span
              className={`text-sm font-semibold ${
                task.status === "done" ? "line-through text-stone-400" : "text-stone-900"
              }`}
            >
              {task.title}
            </span>
          </div>
          {task.notes && variant === "list" ? (
            <p className="mt-1 text-xs text-stone-500">{task.notes}</p>
          ) : null}
          <div className="mt-2 flex items-center gap-2 text-xs text-stone-500">
            <span className={`h-2 w-2 rounded-full ${categoryColor}`} />
            <span>{categories.find((category) => category.id === task.category)?.name}</span>
          </div>
        </div>
        {variant === "list" ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onToggleStatus?.(task.id)}
              className="rounded-full border border-stone-200 p-2 text-stone-600 transition hover:border-stone-300"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setIsEditing((value) => !value)}
              className="rounded-full border border-stone-200 p-2 text-stone-600 transition hover:border-stone-300"
            >
              <PencilLine className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onDelete?.(task.id)}
              className="rounded-full border border-stone-200 p-2 text-stone-600 transition hover:border-stone-300"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>

      {variant === "list" && isEditing ? (
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
