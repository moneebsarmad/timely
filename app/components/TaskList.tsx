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
  eachDayOfInterval,
  endOfDay,
  differenceInCalendarDays,
  differenceInCalendarMonths,
  differenceInCalendarWeeks,
  differenceInCalendarYears,
  format,
  isBefore,
  isSameDay,
  isWithinInterval,
  nextDay,
  setHours,
  setMinutes,
  setSeconds,
  subDays,
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
  addTasks: (tasks: Task[]) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  toggleStatus: (id: string) => void;
  setTaskDueDate: (id: string, dueDate: string | null) => void;
  replaceTasks: (tasks: Task[]) => void;
  recentlyDeleted: Task | null;
  undoDelete: () => void;
  reminderStatus: NotificationPermission | "unsupported";
  requestReminderPermission: () => void;
  isReady: boolean;
};

type TemplateTaskEntry = {
  title: string;
  category: string;
  overrides: Partial<Task>;
  checklistItems?: string[];
};

const TaskContext = createContext<TaskContextValue | null>(null);

const normalizeTag = (tag: string) => tag.trim().toLowerCase();

const normalizeTask = (task: Task): Task => ({
  ...task,
  section: task.section ?? "",
  tags: Array.isArray(task.tags) ? task.tags : [],
  repeat: task.repeat ?? "none",
  checklist: Array.isArray(task.checklist) ? task.checklist : [],
  reminderAt: task.reminderAt ?? null,
  myDay: Array.isArray(task.myDay) ? task.myDay : [],
  lastCompletedAt: task.lastCompletedAt ?? null,
  streak: typeof task.streak === "number" ? task.streak : 0,
  completedDates: Array.isArray(task.completedDates) ? task.completedDates : [],
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
    .replace(/\bremind(?:\s+at)?\s+(today|tomorrow)?\s*[a-z0-9:./-]+\s*(am|pm)?\b/gi, "")
    .replace(/>\s*[^#@!]+/g, "")
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
  section: "",
  tags: [],
  dueDate: null,
  reminderAt: null,
  priority: "none",
  repeat: "none",
  status: "todo",
  notes: "",
  checklist: [],
  myDay: [],
  lastCompletedAt: null,
  streak: 0,
  completedDates: [],
  createdAt: new Date().toISOString(),
  ...overrides,
});

const createChecklistItems = (items: string[]): ChecklistItem[] =>
  items.map((text) => ({
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `check-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    text,
    done: false,
  }));

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

const extractSection = (input: string) => {
  const match = input.match(/>\s*([^#@!]+)/);
  return match ? match[1].trim() : "";
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

const extractReminderAt = (input: string) => {
  const lowered = input.toLowerCase();
  const reminderMatch = lowered.match(
    /remind(?:\s+at)?\s+(today|tomorrow)?\s*([0-9:./-]+(?:\s*(?:am|pm))?)/i
  );
  if (!reminderMatch) {
    return null;
  }

  const dateToken = reminderMatch[1];
  const timeToken = reminderMatch[2]?.trim() ?? "";
  const baseDate = startOfDay(new Date());

  let date = baseDate;
  if (dateToken === "tomorrow") {
    date = addDays(baseDate, 1);
  }

  const dateMatch = timeToken.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateMatch) {
    const [_, year, month, day] = dateMatch;
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      9,
      0,
      0
    ).toISOString();
  }

  const timeMatch = timeToken.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (timeMatch) {
    let hours = Number(timeMatch[1]);
    const minutes = Number(timeMatch[2] ?? 0);
    const meridiem = timeMatch[3];
    if (meridiem) {
      if (meridiem === "pm" && hours < 12) {
        hours += 12;
      }
      if (meridiem === "am" && hours === 12) {
        hours = 0;
      }
    }
    const withTime = setSeconds(setMinutes(setHours(date, hours), minutes), 0);
    return withTime.toISOString();
  }

  return null;
};

export function TaskProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks, isReady] = useLocalStorage<Task[]>(STORAGE_KEY, []);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [recentlyDeleted, setRecentlyDeleted] = useState<Task | null>(null);
  const [reminderStatus, setReminderStatus] = useState<
    NotificationPermission | "unsupported"
  >("default");
  const deleteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reminderTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );

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

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (!("Notification" in window)) {
      setReminderStatus("unsupported");
      return;
    }
    setReminderStatus(Notification.permission);
  }, []);

  useEffect(() => {
    if (!isReady || reminderStatus !== "granted") {
      reminderTimeouts.current.forEach((timeout) => clearTimeout(timeout));
      reminderTimeouts.current.clear();
      return;
    }

    reminderTimeouts.current.forEach((timeout) => clearTimeout(timeout));
    reminderTimeouts.current.clear();

    const now = Date.now();
    tasks.forEach((task) => {
      if (!task.reminderAt || task.status === "done") {
        return;
      }
      const remindAt = new Date(task.reminderAt).getTime();
      if (!Number.isFinite(remindAt) || remindAt <= now) {
        return;
      }
      const timeout = setTimeout(() => {
        if (Notification.permission === "granted") {
          new Notification("Timely reminder", {
            body: task.title,
          });
        }
      }, remindAt - now);
      reminderTimeouts.current.set(task.id, timeout);
    });

    return () => {
      reminderTimeouts.current.forEach((timeout) => clearTimeout(timeout));
      reminderTimeouts.current.clear();
    };
  }, [isReady, reminderStatus, tasks]);

  const requestReminderPermission = () => {
    if (typeof window === "undefined") {
      return;
    }
    if (!("Notification" in window)) {
      setReminderStatus("unsupported");
      return;
    }
    Notification.requestPermission().then((permission) => {
      setReminderStatus(permission);
    });
  };

  const addTask = (input: string) => {
    const title = cleanTaskTitle(input);
    if (!title) {
      return;
    }

    const category = getCategoryFromInput(input, categories);
    const section = extractSection(input);
    const tags = extractTags(input);
    const priority = extractPriority(input);
    const repeat = extractRepeat(input);
    const dueDate = extractDueDate(input);
    const reminderAt = extractReminderAt(input);
    const newTask = createTask(title, category, {
      section,
      tags,
      priority,
      repeat,
      dueDate,
      reminderAt,
    });

    setTasks((current) => [newTask, ...current]);
  };

  const addTasks = (newTasks: Task[]) => {
    if (newTasks.length === 0) {
      return;
    }
    setTasks((current) => [...newTasks, ...current]);
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
        const now = new Date();
        let nextStreak = task.streak;
        if (isCompleting && task.repeat !== "none") {
          if (!task.lastCompletedAt) {
            nextStreak = 1;
          } else {
            const lastCompleted = new Date(task.lastCompletedAt);
            let delta = 0;
            switch (task.repeat) {
              case "daily":
                delta = differenceInCalendarDays(now, lastCompleted);
                break;
              case "weekly":
                delta = differenceInCalendarWeeks(now, lastCompleted);
                break;
              case "monthly":
                delta = differenceInCalendarMonths(now, lastCompleted);
                break;
              case "yearly":
                delta = differenceInCalendarYears(now, lastCompleted);
                break;
            }
            if (delta <= 0) {
              nextStreak = task.streak;
            } else if (delta === 1) {
              nextStreak = task.streak + 1;
            } else {
              nextStreak = 1;
            }
          }
        }
        if (isCompleting && task.repeat !== "none") {
          const baseDate = task.dueDate ? new Date(task.dueDate) : now;
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

          const todayKey = format(startOfDay(now), "yyyy-MM-dd");
          const completedDates = new Set(task.completedDates ?? []);
          completedDates.add(todayKey);

          nextTasks.push({
            ...task,
            status: "todo",
            dueDate: startOfDay(nextDate).toISOString(),
            lastCompletedAt: now.toISOString(),
            streak: nextStreak,
            completedDates: Array.from(completedDates),
          });
        } else {
          nextTasks.push({
            ...task,
            status: isCompleting ? "done" : "todo",
            lastCompletedAt: isCompleting ? now.toISOString() : task.lastCompletedAt,
            streak: isCompleting ? nextStreak : task.streak,
          });
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
    addTasks,
    updateTask,
    deleteTask,
    toggleStatus,
    setTaskDueDate,
    replaceTasks,
    recentlyDeleted,
    undoDelete,
    reminderStatus,
    requestReminderPermission,
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
    addTasks,
    reminderStatus,
    requestReminderPermission,
  } = useTaskStore();

  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedList, setSelectedList] = useState<
    "inbox" | "today" | "myday" | "upcoming" | "overdue" | "habits" | "all"
  >("inbox");
  const [searchTerm, setSearchTerm] = useState("");

  const templates = useMemo(
    () => [
      {
        id: "morning",
        label: "Morning routine",
        tasks: [
          {
            title: "Morning routine",
            category: "health",
            overrides: {
              tags: ["habit", "morning"],
              repeat: "daily",
            },
            checklistItems: ["Hydrate", "Stretch", "Plan top 3"],
          },
        ],
      },
      {
        id: "deep-work",
        label: "Deep work block",
        tasks: [
          {
            title: "Deep work block",
            category: "work",
            overrides: {
              tags: ["focus"],
              priority: "high",
            },
          },
        ],
      },
      {
        id: "weekly-review",
        label: "Weekly review",
        tasks: [
          {
            title: "Weekly review",
            category: "work",
            overrides: {
              tags: ["review"],
              repeat: "weekly",
            },
          },
        ],
      },
      {
        id: "workout",
        label: "Workout",
        tasks: [
          {
            title: "Workout",
            category: "health",
            overrides: {
              tags: ["habit"],
              repeat: "weekly",
            },
          },
        ],
      },
      {
        id: "groceries",
        label: "Grocery list",
        tasks: [
          {
            title: "Grocery list",
            category: "personal",
            overrides: {},
            checklistItems: ["Produce", "Protein", "Pantry staples"],
          },
        ],
      },
    ],
    []
  );

  const today = startOfDay(new Date());
  const todayKey = format(today, "yyyy-MM-dd");
  const upcomingEnd = endOfDay(addDays(today, 7));

  const filteredTasks = tasks.filter((task) => {
    const dueDate = task.dueDate ? new Date(task.dueDate) : null;
    const matchesList = (() => {
      switch (selectedList) {
        case "inbox":
          return dueDate === null;
        case "today":
          return dueDate ? isSameDay(dueDate, today) : false;
        case "myday":
          return (task.myDay ?? []).includes(todayKey);
        case "upcoming":
          return dueDate
            ? isWithinInterval(dueDate, {
                start: addDays(today, 1),
                end: upcomingEnd,
              })
            : false;
        case "overdue":
          return dueDate ? isBefore(dueDate, today) && task.status !== "done" : false;
        case "habits":
          return task.repeat !== "none";
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
        task.section,
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

  const groupedTasks = useMemo(() => {
    const groups = new Map<string, Task[]>();
    filteredTasks.forEach((task) => {
      const section = task.section?.trim() || "Unsectioned";
      const existing = groups.get(section) ?? [];
      existing.push(task);
      groups.set(section, existing);
    });
    return Array.from(groups.entries());
  }, [filteredTasks]);

  const habitDays = useMemo(() => {
    const end = startOfDay(new Date());
    const start = subDays(end, 6);
    return eachDayOfInterval({ start, end }).map((day) => ({
      key: format(day, "yyyy-MM-dd"),
      label: format(day, "EEE"),
      dayNumber: format(day, "d"),
    }));
  }, []);

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
    <section className="flex flex-col gap-4">
      <div className="panel fade-up flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h2 className="text-lg font-semibold">
            {selectedList === "inbox"
              ? "Inbox"
              : selectedList === "today"
              ? "Today"
              : selectedList === "myday"
              ? "My Day"
              : selectedList === "upcoming"
              ? "Upcoming"
              : selectedList === "overdue"
              ? "Overdue"
              : selectedList === "habits"
              ? "Habits"
              : "All tasks"}
          </h2>
          <p className="text-sm text-stone-500">
            {selectedList === "inbox"
              ? "Brain dump tasks live here."
              : selectedList === "today"
              ? "Focus on what's due today."
              : selectedList === "myday"
              ? "Hand-picked tasks for today."
              : selectedList === "upcoming"
              ? "Next 7 days of scheduled tasks."
              : selectedList === "overdue"
              ? "Tasks that missed their due date."
              : selectedList === "habits"
              ? "Recurring tasks and streaks."
              : "Every task across your workspace."}
          </p>
        </div>
        <details className="group rounded-xl border border-stone-200 bg-white/70 px-3 py-2">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-stone-600">
            Tools
          </summary>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {reminderStatus === "unsupported" ? (
              <span className="rounded-full border border-stone-200 bg-white/80 px-3 py-1 text-xs font-semibold text-stone-500">
                Reminders unavailable
              </span>
            ) : reminderStatus === "granted" ? (
              <span className="rounded-full border border-stone-200 bg-white/80 px-3 py-1 text-xs font-semibold text-stone-500">
                Reminders on
              </span>
            ) : reminderStatus === "denied" ? (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                Reminders blocked
              </span>
            ) : (
              <button
                type="button"
                onClick={requestReminderPermission}
                className="rounded-full border border-stone-200 bg-white/80 px-3 py-1 text-xs font-semibold text-stone-600 transition hover:border-stone-300"
              >
                Enable reminders
              </button>
            )}
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white/80 px-3 py-1 text-xs font-semibold text-stone-700 transition hover:border-stone-300"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-stone-200 bg-white/80 px-3 py-1 text-xs font-semibold text-stone-700 transition hover:border-stone-300">
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
        </details>
      </div>

      {recentlyDeleted ? (
        <div className="panel-muted flex items-center justify-between rounded-xl border border-amber-200 px-3 py-2 text-xs text-amber-900">
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

      <details className="panel fade-up px-4 py-3">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-stone-500">
          Templates
        </summary>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {templates.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => {
                const newTasks = template.tasks.map((entry) =>
                  createTask(entry.title, entry.category, {
                    ...entry.overrides,
                    checklist: entry.checklistItems
                      ? createChecklistItems(entry.checklistItems)
                      : [],
                  })
                );
                addTasks(newTasks);
              }}
              className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-semibold text-stone-600 transition hover:border-stone-300"
            >
              {template.label}
            </button>
          ))}
        </div>
      </details>

      <details className="panel fade-up p-4">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-stone-500">
          Views & filters
        </summary>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {[
              { id: "inbox", label: "Inbox" },
              { id: "today", label: "Today" },
              { id: "myday", label: "My Day" },
              { id: "upcoming", label: "Upcoming" },
              { id: "overdue", label: "Overdue" },
              { id: "habits", label: "Habits" },
              { id: "all", label: "All" },
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() =>
                  setSelectedList(
                    option.id as
                      | "inbox"
                      | "today"
                      | "myday"
                      | "upcoming"
                      | "overdue"
                      | "habits"
                      | "all"
                  )
                }
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  selectedList === option.id
                    ? "border-amber-500 bg-amber-400 text-stone-900 shadow-sm"
                    : "border-stone-200 bg-white/80 text-stone-600 hover:border-stone-300"
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
              placeholder="Search"
              className="h-9 w-full rounded-xl border border-stone-200 bg-white/80 px-3 text-sm text-stone-700 outline-none transition focus:border-amber-400 md:w-40"
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
        </div>
        <div className="mt-3">
          <CategoryFilter
            categories={categories}
            selectedCategory={selectedCategory}
            onSelect={setSelectedCategory}
          />
        </div>
      </details>

      {selectedList === "habits" ? (
        <div className="panel fade-up p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-600">
                Habit history
              </h3>
              <p className="text-xs text-stone-500">
                Last 7 days of completions.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-stone-400">
              {habitDays.map((day) => (
                <div key={day.key} className="w-7 text-center">
                  {day.label}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {filteredTasks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50 p-3 text-xs text-stone-500">
                No recurring tasks yet.
              </div>
            ) : (
              filteredTasks.map((task) => {
                const completed = new Set(task.completedDates ?? []);
                return (
                  <div
                    key={task.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-stone-100 bg-white px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-stone-800">
                        {task.title}
                      </div>
                      <div className="text-xs text-stone-500">
                        Streak {task.streak}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-stone-400">
                      {habitDays.map((day) => (
                        <div
                          key={`${task.id}-${day.key}`}
                          className={`flex h-7 w-7 items-center justify-center rounded-full border text-[10px] ${
                            completed.has(day.key)
                              ? "border-stone-900 bg-stone-900 text-white"
                              : "border-stone-200 text-stone-400"
                          }`}
                        >
                          {day.dayNumber}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : null}

      <div className="flex-1 space-y-3 overflow-y-auto pr-1">
        {filteredTasks.length === 0 ? (
          <div className="panel-muted rounded-2xl border border-dashed border-stone-200 p-6 text-sm text-stone-500">
            {selectedList === "inbox"
              ? "No unscheduled tasks yet. Capture thoughts in the brain dump."
              : "No tasks match this view yet."}
          </div>
        ) : (
          groupedTasks.map(([section, tasksInSection]) => (
            <div key={section} className="space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-stone-500">
                <span>{section}</span>
                <span>{tasksInSection.length} tasks</span>
              </div>
              <div className="space-y-3">
                {tasksInSection.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onDelete={deleteTask}
                    onToggleStatus={toggleStatus}
                    onUpdate={updateTask}
                    variant="list"
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
