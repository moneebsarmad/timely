"use client";

import { useEffect, useMemo, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";

const MINUTE = 60;

export function FocusTimer() {
  const [focusMinutes, setFocusMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [mode, setMode] = useState<"focus" | "break">("focus");
  const [remaining, setRemaining] = useState(25 * MINUTE);
  const [isRunning, setIsRunning] = useState(false);
  const [label, setLabel] = useState("");

  useEffect(() => {
    setRemaining(mode === "focus" ? focusMinutes * MINUTE : breakMinutes * MINUTE);
  }, [focusMinutes, breakMinutes, mode]);

  useEffect(() => {
    if (!isRunning) {
      return;
    }
    const interval = setInterval(() => {
      setRemaining((current) => {
        if (current <= 1) {
          clearInterval(interval);
          setIsRunning(false);
          setMode((prev) => (prev === "focus" ? "break" : "focus"));
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  const formatted = useMemo(() => {
    const minutes = Math.floor(remaining / MINUTE);
    const seconds = remaining % MINUTE;
    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  }, [remaining]);

  const handleReset = () => {
    setIsRunning(false);
    setRemaining(mode === "focus" ? focusMinutes * MINUTE : breakMinutes * MINUTE);
  };

  return (
    <section className="panel fade-up p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Focus timer</h2>
          <p className="text-xs text-stone-500">
            {mode === "focus" ? "Deep work session" : "Recovery break"}
          </p>
        </div>
        <div className="rounded-full border border-stone-200 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-stone-600">
          {mode}
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between">
        <div className="text-4xl font-semibold tabular-nums text-stone-900">
          {formatted}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsRunning((value) => !value)}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-stone-900 px-4 text-xs font-semibold text-white shadow-sm"
          >
            {isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {isRunning ? "Pause" : "Start"}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-stone-200 bg-white/80 px-3 text-xs font-semibold text-stone-600"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 text-xs text-stone-500 md:grid-cols-2">
        <label className="space-y-1">
          <span className="font-semibold uppercase tracking-wide">Focus minutes</span>
          <input
            type="number"
            min={5}
            max={90}
            value={focusMinutes}
            onChange={(event) => setFocusMinutes(Number(event.target.value))}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-700"
          />
        </label>
        <label className="space-y-1">
          <span className="font-semibold uppercase tracking-wide">Break minutes</span>
          <input
            type="number"
            min={3}
            max={30}
            value={breakMinutes}
            onChange={(event) => setBreakMinutes(Number(event.target.value))}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-700"
          />
        </label>
      </div>

      <label className="mt-3 block text-xs text-stone-500">
        <span className="font-semibold uppercase tracking-wide">Session label</span>
        <input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="What are you focusing on?"
          className="mt-2 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-700"
        />
      </label>
    </section>
  );
}
