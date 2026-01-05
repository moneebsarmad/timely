export interface Task {
  id: string;
  title: string;
  category: string;
  tags: string[];
  dueDate: string | null;
  reminderAt: string | null;
  priority: "high" | "medium" | "low" | "none";
  repeat: "none" | "daily" | "weekly" | "monthly" | "yearly";
  status: "todo" | "in-progress" | "done";
  notes: string;
  checklist: ChecklistItem[];
  myDay: string[];
  lastCompletedAt: string | null;
  streak: number;
  createdAt: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface Category {
  id: string;
  name: string;
  color: string;
}

export const DEFAULT_CATEGORIES: Category[] = [
  { id: "work", name: "Work", color: "bg-blue-500" },
  { id: "personal", name: "Personal", color: "bg-green-500" },
  { id: "school", name: "School", color: "bg-purple-500" },
  { id: "health", name: "Health", color: "bg-red-500" },
  { id: "finance", name: "Finance", color: "bg-orange-500" },
];
