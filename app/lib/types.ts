export interface Task {
  id: string;
  title: string;
  category: string;
  dueDate: string | null;
  priority: "high" | "medium" | "low" | "none";
  status: "todo" | "in-progress" | "done";
  notes: string;
  createdAt: string;
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
