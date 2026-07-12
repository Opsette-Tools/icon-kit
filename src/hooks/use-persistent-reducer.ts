import { useEffect, useReducer, type Reducer } from "react";

// A useReducer that hydrates from localStorage on mount and writes back on every
// change. The whole point of a local tool: switching tabs or reloading must not
// wipe a client's in-progress work. Hydration is tolerant — a bad/absent/old
// blob just falls back to `initial` (merged so new fields are always present).
export function usePersistentReducer<S extends object, A>(
  key: string,
  reducer: Reducer<S, A>,
  initial: S,
): [S, React.Dispatch<A>] {
  const [state, dispatch] = useReducer(reducer, initial, (base) => {
    if (typeof window === "undefined") return base;
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return base;
      const saved = JSON.parse(raw) as Partial<S>;
      return { ...base, ...saved };
    } catch {
      return base;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch {
      /* quota / private mode — non-fatal */
    }
  }, [key, state]);

  return [state, dispatch];
}
