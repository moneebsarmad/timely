"use client";

import React, { createContext, useContext, useMemo, useRef, useState } from "react";
import { Task, Category, DEFAULT_CATEGORIES } from "../lib/types";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { TaskItem } from "./TaskItem";
import { CategoryFilter } from "./CategoryFilter";
import { Download, Upload, RotateCcw } from "lucide-react";

const STORAGE_KEY = "timely_tasks";

type TaskContextValue = {
  tasks: Task[];
  categories: Category[];
  selectedCategory: string;
  setSelectedCategory: (value: string) => void;
  addTask: (input: string) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  toggleStatus: (id: string) => void;
  setTaskDueDate: (id: string, dueDate: string | null) => void;
  replaceTasks: (tasks: Task[]) => void;
  recentlyDeleted: Task | null;
  undoDelete: () => void;
  isReady: boolean;
};

const TaskContext = createContext<TaskContextValue | null>(null);

const normalizeTag = (tag: string) => tag.trim().toLowerCase();

const getCategoryFromInput = (input: string, categories: Category[]) => {
  const matches = Array.from(input.matchAll(/#([a-z0-9-]+)/gi)).map((match) =>
    normalizeTag(match[1] ?? "")
  );

  for (const match of matches) {
    const found = categories.find(
      (category) =>
        category.id === match || normalizeTag(category.name) === match
    );
    if (found) {
      return found.id;
    }
  }

  return categories[0]?.id ?? "personal";
};

const cleanTaskTitle = (input: string) =>
  input
    .replace(/#([a-z0-9-]+)/gi, "")
    .replace(/\s+/g, " ")
    .trim();

const createTask = (title: string, category: string): Task => ({
  id: typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `task-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  title,
  category,
  dueDate: null,
  priority: "none",
  status: "todo",
  notes: "",
  createdAt: new Date().toISOString(),
});

export function TaskProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks, isReady] = useLocalStorage<Task[]>(STORAGE_KEY, []);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [recentlyDeleted, setRecentlyDeleted] = useState<Task | null>(null);
  const deleteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const categories = useMemo(() => DEFAULT_CATEGORIES, []);

  const addTask = (input: string) => {
    const title = cleanTaskTitle(input);
    if (!title) {
      return;
    }

    const category = getCategoryFromInput(input, categories);
    const newTask = createTask(title, category);

    setTasks((current) => [newTask, ...current]);
  };

  const updateTask = (id: string, updates: Partial<Task>) => {
    setTasks((current) =>
      current.map((task) => (task.id === id ? { ...task, ...updates } : task))
    );
  };

  const deleteTask = (id: string) => {
    setTasks((current) => {
      const toDelete = current.find((task) => task.id === id) ?? null;
      if (!toDelete) {
        return current;
      }

      setRecentlyDeleted(toDelete);
      if (deleteTimeoutRef.current) {
        clearTimeout(deleteTimeoutRef.current);
      }
      deleteTimeoutRef.current = setTimeout(() => {
        setRecentlyDeleted(null);
      }, 5000);

      return current.filter((task) => task.id !== id);
    });
  };

  const undoDelete = () => {
    if (!recentlyDeleted) {
      return;
    }
    if (deleteTimeoutRef.current) {
      clearTimeout(deleteTimeoutRef.current);
    }
    setTasks((current) => [recentlyDeleted, ...current]);
    setRecentlyDeleted(null);
  };

  const toggleStatus = (id: string) => {
    setTasks((current) =>
      current.map((task) =>
        task.id === id
          ? {
              ...task,
              status: task.status === "done" ? "todo" : "done",
            }
          : task
      )
    );
  };

  const setTaskDueDate = (id: string, dueDate: string | null) => {
    updateTask(id, { dueDate });
  };

  const replaceTasks = (nextTasks: Task[]) => {
    setTasks(nextTasks);
  };

  const value: TaskContextValue = {
    tasks,
    categories,
    selectedCategory,
    setSelectedCategory,
    addTask,
    updateTask,
    deleteTask,
    toggleStatus,
    setTaskDueDate,
    replaceTasks,
    recentlyDeleted,
    undoDelete,
    isReady,
  };

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}

export function useTaskStore() {
  const context = useContext(TaskContext);
  if (!context) {
    throw new Error("useTaskStore must be used within TaskProvider");
  }
  return context;
}

export function TaskList() {
  const {
    tasks,
    categories,
    selectedCategory,
    setSelectedCategory,
    deleteTask,
    toggleStatus,
    updateTask,
    recentlyDeleted,
    undoDelete,
    replaceTasks,
  } = useTaskStore();

  const inputRef = useRef<HTMLInputElement | null>(null);

  const filteredTasks = tasks.filter((task) => {
    if (task.dueDate !== null) {
      return false;
    }
    if (selectedCategory === "all") {
      return true;
    }
    return task.category === selectedCategory;
  });

  const handleExport = () => {
    const data = JSON.stringify(tasks, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `timely-backup-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string) as Task[];
        if (Array.isArray(parsed)) {
          replaceTasks(parsed);
        }
      } catch {
        // Ignore invalid imports.
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  return (
    <section className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Unscheduled</h2>
          <p className="text-sm text-stone-500">Brain dump tasks live here.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-semibold text-stone-700 transition hover:border-stone-300"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-semibold text-stone-700 transition hover:border-stone-300">
            <Upload className="h-4 w-4" />
            Import
            <input
              ref={inputRef}
              type="file"
              accept="application/json"
              onChange={handleImport}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {recentlyDeleted ? (
        <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <span>Task deleted.</span>
          <button
            type="button"
            onClick={undoDelete}
            className="inline-flex items-center gap-2 font-semibold"
          >
            <RotateCcw className="h-4 w-4" />
            Undo
          </button>
        </div>
      ) : null}

      <CategoryFilter
        categories={categories}
        selectedCategory={selectedCategory}
        onSelect={setSelectedCategory}
      />

      <div className="flex-1 space-y-3 overflow-y-auto pr-1">
        {filteredTasks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-200 bg-white/70 p-6 text-sm text-stone-500">
            No unscheduled tasks yet. Capture thoughts in the brain dump.
          </div>
        ) : (
          filteredTasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onDelete={deleteTask}
              onToggleStatus={toggleStatus}
              onUpdate={updateTask}
              variant="list"
            />
          ))
        )}
      </div>
    </section>
  );
}
