import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";

const INTERACTIVE_SELECTOR =
  "a, button, input, textarea, select, [role='button'], [contenteditable='true']";

export function RecordingCursor() {
  const [location] = useLocation();
  const cursorRef = useRef<HTMLDivElement | null>(null);
  const [supportsPointer, setSupportsPointer] = useState(false);
  const [pulseKey, setPulseKey] = useState(0);
  const recordingRequested = useMemo(
    () => new URLSearchParams(window.location.search).get("recording") === "1",
    [location]
  );
  const enabled = recordingRequested && supportsPointer;

  useEffect(() => {
    const pointerQuery = window.matchMedia("(pointer: fine) and (hover: hover)");
    const updatePointerSupport = () => setSupportsPointer(pointerQuery.matches);
    updatePointerSupport();
    pointerQuery.addEventListener("change", updatePointerSupport);
    return () => pointerQuery.removeEventListener("change", updatePointerSupport);
  }, []);

  useEffect(() => {
    if (!enabled || !cursorRef.current) return;

    const cursor = cursorRef.current;
    let frameId = 0;
    let pointerX = 0;
    let pointerY = 0;

    const paintPosition = () => {
      frameId = 0;
      cursor.style.transform =
        `translate3d(${pointerX}px, ${pointerY}px, 0) translate(-50%, -50%)`;
      cursor.dataset.visible = "true";
    };

    const positionCursor = (event: PointerEvent) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      const target = event.target;
      cursor.dataset.interactive = String(
        target instanceof Element && Boolean(target.closest(INTERACTIVE_SELECTOR))
      );
      if (!frameId) frameId = window.requestAnimationFrame(paintPosition);
    };

    const pressCursor = () => {
      cursor.dataset.pressed = "true";
      setPulseKey((current) => current + 1);
    };
    const releaseCursor = () => {
      cursor.dataset.pressed = "false";
    };
    const hideCursor = () => {
      cursor.dataset.visible = "false";
      releaseCursor();
    };

    document.body.classList.add("xd-recording-cursor-active");
    window.addEventListener("pointermove", positionCursor, { passive: true });
    window.addEventListener("pointerdown", pressCursor, { passive: true });
    window.addEventListener("pointerup", releaseCursor, { passive: true });
    window.addEventListener("pointercancel", hideCursor, { passive: true });
    document.documentElement.addEventListener("mouseleave", hideCursor);
    window.addEventListener("blur", hideCursor);

    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      document.body.classList.remove("xd-recording-cursor-active");
      window.removeEventListener("pointermove", positionCursor);
      window.removeEventListener("pointerdown", pressCursor);
      window.removeEventListener("pointerup", releaseCursor);
      window.removeEventListener("pointercancel", hideCursor);
      document.documentElement.removeEventListener("mouseleave", hideCursor);
      window.removeEventListener("blur", hideCursor);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div
      ref={cursorRef}
      className="xd-recording-cursor"
      data-visible="false"
      data-interactive="false"
      data-pressed="false"
      aria-hidden="true"
    >
      <span className="xd-recording-cursor__dot" />
      {pulseKey > 0 && (
        <span key={pulseKey} className="xd-recording-cursor__pulse" />
      )}
    </div>
  );
}
