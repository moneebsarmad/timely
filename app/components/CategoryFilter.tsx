"use client";

import { Category } from "../lib/types";

type CategoryFilterProps = {
  categories: Category[];
  selectedCategory: string;
  onSelect: (value: string) => void;
};

export function CategoryFilter({
  categories,
  selectedCategory,
  onSelect,
}: CategoryFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onSelect("all")}
        className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
          selectedCategory === "all"
            ? "border-amber-300 bg-amber-200/70 text-stone-900"
            : "border-stone-200 bg-white/80 text-stone-600 hover:border-stone-300"
        }`}
      >
        All
      </button>
      {categories.map((category) => (
        <button
          key={category.id}
          type="button"
          onClick={() => onSelect(category.id)}
          className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
            selectedCategory === category.id
              ? "border-amber-300 bg-amber-200/70 text-stone-900"
              : "border-stone-200 bg-white/80 text-stone-600 hover:border-stone-300"
          }`}
        >
          <span
            className={`mr-2 inline-flex h-2 w-2 rounded-full ${category.color}`}
          />
          {category.name}
        </button>
      ))}
    </div>
  );
}
