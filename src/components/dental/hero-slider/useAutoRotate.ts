import { useCallback, useEffect, useState } from "react";

type UseAutoRotateOptions = {
  /** Number of slides in the rotation. */
  length: number;
  /** Time each slide stays visible. */
  intervalMs: number;
  /** Master switch — false disables autoplay entirely (e.g. reduced motion). */
  enabled: boolean;
  /** Temporary pause (hover / focus inside the hero). */
  paused: boolean;
};

/**
 * Auto-rotation state for the hero slider.
 *
 * - One fresh `setTimeout` per slide keeps timing drift-free: the timer is
 *   re-armed from zero whenever the slide changes or playback resumes,
 *   instead of letting an interval accumulate error.
 * - Rotation also pauses while the tab is hidden (visibilitychange).
 * - `cycle` increments every time the timer restarts; the dots use it as a
 *   key to restart the progress-fill animation in sync with the timer.
 */
export function useAutoRotate({ length, intervalMs, enabled, paused }: UseAutoRotateOptions) {
  const [index, setIndex] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [docVisible, setDocVisible] = useState(
    () => typeof document === "undefined" || document.visibilityState === "visible"
  );

  useEffect(() => {
    const onVisibilityChange = () => setDocVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  // Keep the index valid if the slide list shrinks (e.g. admin removes one).
  useEffect(() => {
    if (length > 0 && index >= length) setIndex(0);
  }, [index, length]);

  const goTo = useCallback(
    (next: number) => {
      if (length === 0) return;
      setIndex(((next % length) + length) % length);
      setCycle((current) => current + 1);
    },
    [length]
  );

  const running = enabled && !paused && docVisible && length > 1;

  // Restart the cycle (timer + dot progress) whenever playback resumes.
  useEffect(() => {
    if (running) setCycle((current) => current + 1);
  }, [running]);

  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => goTo(index + 1), intervalMs);
    return () => window.clearTimeout(timer);
  }, [running, index, cycle, intervalMs, goTo]);

  return { index, goTo, running, cycle };
}
