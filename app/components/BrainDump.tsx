"use client";

import { useEffect, useRef, useState } from "react";
import { useTaskStore } from "./TaskList";
import { Plus } from "lucide-react";

export function BrainDump() {
  const { addTask } = useTaskStore();
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!value.trim()) {
      return;
    }
    addTask(value);
    setValue("");
  };

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && event.ctrlKey) {
        event.preventDefault();
        inputRef.current?.focus();
      }
      if (event.key === "Escape") {
        setValue("");
        inputRef.current?.blur();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-stone-200 bg-white/80 p-4 shadow-sm"
    >
      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-stone-500">
        Brain dump
      </label>
      <div className="flex items-center gap-3">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Capture anything... (#work, #personal)"
          className="h-12 flex-1 rounded-xl border border-stone-200 bg-white px-4 text-base text-stone-900 shadow-inner outline-none transition focus:border-stone-900"
        />
        <button
          type="submit"
          className="inline-flex h-12 items-center gap-2 rounded-xl bg-stone-900 px-4 text-sm font-semibold text-white transition hover:bg-stone-800"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </div>
      <p className="mt-2 text-xs text-stone-500">
        Enter adds a task. Ctrl+K focuses, Esc clears.
      </p>
    </form>
  );
}
