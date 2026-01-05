"use client";

import { useEffect, useRef, useState } from "react";
import { readStorage, writeStorage } from "../lib/localStorage";

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const [isReady, setIsReady] = useState(false);
  const initialRef = useRef(initialValue);

  useEffect(() => {
    const value = readStorage<T>(key, initialRef.current);
    setStoredValue(value);
    setIsReady(true);
  }, [key]);

  const setValue = (value: T | ((current: T) => T)) => {
    setStoredValue((current) => {
      const nextValue = value instanceof Function ? value(current) : value;
      writeStorage(key, nextValue);
      return nextValue;
    });
  };

  return [storedValue, setValue, isReady] as const;
}
