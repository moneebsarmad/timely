"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  endOfDay,
  isBefore,
  isSameDay,
  isWithinInterval,
  nextDay,
  startOfDay,
} from "date-fns";
import { Task, Category, ChecklistItem, DEFAULT_CATEGORIES } from "../lib/types";
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

const normalizeTask = (task: Task): Task => ({
  ...task,
  tags: Array.isArray(task.tags) ? task.tags : [],
  repeat: task.repeat ?? "none",
  checklist: Array.isArray(task.checklist) ? task.checklist : [],
});

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
    .replace(/@([a-z0-9-]+)/gi, "")
    .replace(/\b(!high|!med|!medium|!low|p1|p2|p3)\b/gi, "")
    .replace(/\bevery\s+(day|week|month|year)\b/gi, "")
    .replace(/\b(daily|weekly|monthly|yearly)\b/gi, "")
    .replace(/\b(next\s+)?(mon|monday|tue|tues|tuesday|wed|weds|wednesday|thu|thurs|thursday|fri|friday|sat|saturday|sun|sunday)\b/gi, "")
    .replace(/\b(today|tomorrow)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

const createTask = (
  title: string,
  category: string,
  overrides: Partial<Task> = {}
): Task => ({
  id:
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `task-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  title,
  category,
  tags: [],
  dueDate: null,
  priority: "none",
  repeat: "none",
  status: "todo",
  notes: "",
  checklist: [],
  createdAt: new Date().toISOString(),
  ...overrides,
});

const extractTags = (input: string) =>
  Array.from(input.matchAll(/@([a-z0-9-]+)/gi)).map((match) =>
    normalizeTag(match[1] ?? "")
  );

const extractPriority = (input: string): Task["priority"] => {
  const lowered = input.toLowerCase();
  if (/\b(!high|p1)\b/.test(lowered)) return "high";
  if (/\b(!med|!medium|p2)\b/.test(lowered)) return "medium";
  if (/\b(!low|p3)\b/.test(lowered)) return "low";
  return "none";
};

const extractRepeat = (input: string): Task["repeat"] => {
  const lowered = input.toLowerCase();
  if (/\b(every\s+day|daily)\b/.test(lowered)) return "daily";
  if (/\b(every\s+week|weekly)\b/.test(lowered)) return "weekly";
  if (/\b(every\s+month|monthly)\b/.test(lowered)) return "monthly";
  if (/\b(every\s+year|yearly)\b/.test(lowered)) return "yearly";
  return "none";
};

const weekdayIndexes: Record<string, number> = {
  sun: 0,
  sunday: 0,
  mon: 1,
  monday: 1,
  tue: 2,
  tues: 2,
  tuesday: 2,
  wed: 3,
  weds: 3,
  wednesday: 3,
  thu: 4,
  thurs: 4,
  thursday: 4,
  fri: 5,
  friday: 5,
  sat: 6,
  saturday: 6,
};

const extractDueDate = (input: string) => {
  const lowered = input.toLowerCase();
  const today = startOfDay(new Date());

  if (/\btoday\b/.test(lowered)) {
    return today.toISOString();
  }
  if (/\btomorrow\b/.test(lowered)) {
    return startOfDay(addDays(today, 1)).toISOString();
  }

  const nextMatch = lowered.match(
    /\bnext\s+(mon|monday|tue|tues|tuesday|wed|weds|wednesday|thu|thurs|thursday|fri|friday|sat|saturday|sun|sunday)\b/
  );
  if (nextMatch) {
    const index = weekdayIndexes[nextMatch[1]] ?? 0;
    return startOfDay(addDays(nextDay(today, index), 0)).toISOString();
  }

  const match = lowered.match(
    /\b(mon|monday|tue|tues|tuesday|wed|weds|wednesday|thu|thurs|thursday|fri|friday|sat|saturday|sun|sunday)\b/
  );
  if (match) {
    const index = weekdayIndexes[match[1]] ?? 0;
    const candidate = nextDay(addDays(today, -1), index);
    return startOfDay(candidate).toISOString();
  }

  return null;
};

export function TaskProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks, isReady] = useLocalStorage<Task[]>(STORAGE_KEY, []);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [recentlyDeleted, setRecentlyDeleted] = useState<Task | null>(null);
  const deleteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const categories = useMemo(() => DEFAULT_CATEGORIES, []);

  useEffect(() => {
    if (!isReady) {
      return;
    }
    setTasks((current) => {
      const needsUpdate = current.some(
        (task) =>
          !("tags" in task) ||
          !("repeat" in task) ||
          !("checklist" in task)
      );
      if (!needsUpdate) {
        return current;
      }
      return current.map((task) => normalizeTask(task));
    });
  }, [isReady, setTasks]);

  const addTask = (input: string) => {
    const title = cleanTaskTitle(input);
    if (!title) {
      return;
    }

    const category = getCategoryFromInput(input, categories);
    const tags = extractTags(input);
    const priority = extractPriority(input);
    const repeat = extractRepeat(input);
    const dueDate = extractDueDate(input);
    const newTask = createTask(title, category, {
      tags,
      priority,
      repeat,
      dueDate,
    });

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
    setTasks((current) => {
      const nextTasks: Task[] = [];

      for (const task of current) {
        if (task.id !== id) {
          nextTasks.push(task);
          continue;
        }

        const isCompleting = task.status !== "done";
        nextTasks.push({
          ...task,
          status: isCompleting ? "done" : "todo",
        });

        if (isCompleting && task.repeat !== "none") {
          const baseDate = task.dueDate ? new Date(task.dueDate) : new Date();
          let nextDate = baseDate;

          switch (task.repeat) {
            case "daily":
              nextDate = addDays(baseDate, 1);
              break;
            case "weekly":
              nextDate = addWeeks(baseDate, 1);
              break;
            case "monthly":
              nextDate = addMonths(baseDate, 1);
              break;
            case "yearly":
              nextDate = addYears(baseDate, 1);
              break;
          }

          const resetChecklist: ChecklistItem[] = task.checklist.map((item) => ({
            ...item,
            id:
              typeof crypto !== "undefined" && "randomUUID" in crypto
                ? crypto.randomUUID()
                : `check-${Date.now()}-${Math.random()
                    .toString(16)
                    .slice(2)}`,
            done: false,
          }));

          nextTasks.unshift(
            createTask(task.title, task.category, {
              tags: task.tags,
              priority: task.priority,
              repeat: task.repeat,
              dueDate: startOfDay(nextDate).toISOString(),
              notes: task.notes,
              checklist: resetChecklist,
            })
          );
        }
      }

      return nextTasks;
    });
  };

  const setTaskDueDate = (id: string, dueDate: string | null) => {
    updateTask(id, { dueDate });
  };

  const replaceTasks = (nextTasks: Task[]) => {
    setTasks(nextTasks.map((task) => normalizeTask(task)));
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
  const [selectedList, setSelectedList] = useState<
    "inbox" | "today" | "upcoming" | "overdue" | "all"
  >("inbox");
  const [searchTerm, setSearchTerm] = useState("");

  const today = startOfDay(new Date());
  const upcomingEnd = endOfDay(addDays(today, 7));

  const filteredTasks = tasks.filter((task) => {
    const dueDate = task.dueDate ? new Date(task.dueDate) : null;
    const matchesList = (() => {
      switch (selectedList) {
        case "inbox":
          return dueDate === null;
        case "today":
          return dueDate ? isSameDay(dueDate, today) : false;
        case "upcoming":
          return dueDate
            ? isWithinInterval(dueDate, {
                start: addDays(today, 1),
                end: upcomingEnd,
              })
            : false;
        case "overdue":
          return dueDate ? isBefore(dueDate, today) : false;
        case "all":
        default:
          return true;
      }
    })();

    if (!matchesList) {
      return false;
    }

    if (selectedCategory !== "all" && task.category !== selectedCategory) {
      return false;
    }

    if (searchTerm.trim().length > 0) {
      const needle = searchTerm.toLowerCase();
      const taskTags = Array.isArray(task.tags) ? task.tags : [];
      const haystack = [
        task.title,
        task.notes,
        taskTags.join(" "),
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(needle)) {
        return false;
      }
    }

    return true;
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
          <h2 className="text-lg font-semibold">
            {selectedList === "inbox"
              ? "Inbox"
              : selectedList === "today"
              ? "Today"
              : selectedList === "upcoming"
              ? "Upcoming"
              : selectedList === "overdue"
              ? "Overdue"
              : "All tasks"}
          </h2>
          <p className="text-sm text-stone-500">
            {selectedList === "inbox"
              ? "Brain dump tasks live here."
              : selectedList === "today"
              ? "Focus on what's due today."
              : selectedList === "upcoming"
              ? "Next 7 days of scheduled tasks."
              : selectedList === "overdue"
              ? "Tasks that missed their due date."
              : "Every task across your workspace."}
          </p>
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

      <div className="flex flex-wrap gap-2">
        {[
          { id: "inbox", label: "Inbox" },
          { id: "today", label: "Today" },
          { id: "upcoming", label: "Upcoming" },
          { id: "overdue", label: "Overdue" },
          { id: "all", label: "All" },
        ].map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() =>
              setSelectedList(
                option.id as "inbox" | "today" | "upcoming" | "overdue" | "all"
              )
            }
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
              selectedList === option.id
                ? "border-stone-900 bg-stone-900 text-white"
                : "border-stone-200 bg-white text-stone-600 hover:border-stone-300"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search tasks, notes, or tags"
          className="h-10 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none transition focus:border-stone-900 md:w-64"
        />
        {searchTerm ? (
          <button
            type="button"
            onClick={() => setSearchTerm("")}
            className="text-xs font-semibold text-stone-500"
          >
            Clear
          </button>
        ) : null}
      </div>

      <CategoryFilter
        categories={categories}
        selectedCategory={selectedCategory}
        onSelect={setSelectedCategory}
      />

      <div className="flex-1 space-y-3 overflow-y-auto pr-1">
        {filteredTasks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-200 bg-white/70 p-6 text-sm text-stone-500">
            {selectedList === "inbox"
              ? "No unscheduled tasks yet. Capture thoughts in the brain dump."
              : "No tasks match this view yet."}
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
