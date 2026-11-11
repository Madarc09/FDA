import { useCallback, useEffect, useRef, useState } from "react";
const memory = new Map(),
  pending = new Map();
const ttl = {
  context: 300000,
  stats: 300000,
  roster: 600000,
  lineup: 900000,
  player: 3600000,
  scores: 20000,
  game: 20000,
};
export const keyFor = (params) =>
  params
    ? new URLSearchParams(
        Object.entries(params).filter(([, v]) => v !== undefined && v !== null),
      ).toString()
    : null;
export async function request(params, { force = false } = {}) {
  const key = typeof params === "string" ? params : keyFor(params),
    resource = new URLSearchParams(key).get("resource"),
    hit = memory.get(key);
  if (!force && hit && Date.now() - hit.at < (ttl[resource] || 60000))
    return hit.value;
  if (pending.has(key)) return pending.get(key);
  const task = (async () => {
    const res = await fetch(`/api/hockey?${key}`, {
      signal: AbortSignal.timeout(55000),
      cache: force ? "reload" : "default",
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || "The source is unavailable.");
    if (!body.meta || body.data === undefined)
      throw new Error("Unexpected data from the hockey service.");
    memory.set(key, { value: body, at: Date.now() });
    if (memory.size > 160) memory.delete(memory.keys().next().value);
    return body;
  })();
  pending.set(key, task);
  try {
    return await task;
  } finally {
    pending.delete(key);
  }
}
export function useResource(params, { poll = 0 } = {}) {
  const key = keyFor(params),
    [state, setState] = useState(() => ({
      result: key ? memory.get(key)?.value : null,
      loading: !!key,
      error: null,
    }));
  const alive = useRef(true),
    lastKey = useRef(key),
    pollRef = useRef(poll);
  pollRef.current = poll;
  const perform = useCallback(
    async (force = false) => {
      if (!key) return null;
      const thisKey = key;
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const result = await request(key, { force });
        if (alive.current && lastKey.current === thisKey)
          setState({ result, loading: false, error: null });
        return result;
      } catch (e) {
        if (alive.current && lastKey.current === thisKey)
          setState((s) => ({ ...s, loading: false, error: e.message }));
        return null;
      }
    },
    [key],
  );
  useEffect(() => {
    alive.current = true;
    lastKey.current = key;
    if (!key) {
      setState({ result: null, loading: false, error: null });
      return;
    }
    setState({
      result: memory.get(key)?.value || null,
      loading: true,
      error: null,
    });
    let cancelled = false,
      timer;
    async function cycle(force) {
      if (cancelled) return;
      const result = document.hidden
        ? memory.get(key)?.value
        : await perform(force);
      const interval =
        typeof pollRef.current === "function"
          ? pollRef.current(result?.data)
          : pollRef.current;
      if (!cancelled && interval)
        timer = setTimeout(
          () => cycle(true),
          document.hidden ? Math.max(60000, interval) : interval,
        );
    }
    cycle(false);
    const visible = () => {
      if (!document.hidden) {
        clearTimeout(timer);
        cycle(true);
      }
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [key, perform]);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );
  return {
    ...state,
    data: state.result?.data,
    meta: state.result?.meta,
    refresh: () => perform(true),
  };
}
