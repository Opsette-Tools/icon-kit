import { useEffect, useReducer, useRef, type Reducer } from "react";

// A useReducer that hydrates from localStorage on mount and writes back on every
// change. The whole point of a local tool: switching tabs or reloading must not
// wipe a client's in-progress work. Hydration is tolerant — a bad/absent/old
// blob just falls back to `initial` (merged so new fields are always present).
//
// CRITICAL: the panels mount/unmount when the user switches tabs. A plain
// post-render effect can be SKIPPED if the component unmounts before it flushes
// (e.g. reopen a design, then immediately switch tabs) — the new state never
// reaches localStorage and is lost on the way back. To be race-free we:
//   1. write on every state change (normal case), AND
//   2. keep a ref to the latest state and flush it in an unmount cleanup, so a
//      switch that happens before the effect fires still persists.
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

  // Always hold the latest state + key so the unmount cleanup can flush them.
  const latest = useRef({ key, state });
  latest.current = { key, state };

  const persist = (k: string, s: S) => {
    try {
      window.localStorage.setItem(k, JSON.stringify(s));
    } catch {
      /* quota / private mode — non-fatal */
    }
  };

  // Write on every change (normal path).
  useEffect(() => {
    persist(key, state);
  }, [key, state]);

  // Flush the latest state on unmount — catches the "changed then switched tabs
  // before the effect ran" race that was wiping reopened designs.
  useEffect(() => {
    return () => {
      persist(latest.current.key, latest.current.state);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [state, dispatch];
}
