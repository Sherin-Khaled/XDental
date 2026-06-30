import { useEffect, type RefObject } from "react";

type UseClickOutsideOptions = {
  enabled?: boolean;
  onEscapeKey?: (event: KeyboardEvent) => void;
};

export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  onOutsideClick: (event: PointerEvent | KeyboardEvent) => void,
  { enabled = true, onEscapeKey }: UseClickOutsideOptions = {}
) {
  useEffect(() => {
    if (!enabled) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (!(target instanceof Node) || ref.current?.contains(target)) {
        return;
      }

      onOutsideClick(event);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        (onEscapeKey ?? onOutsideClick)(event);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled, onEscapeKey, onOutsideClick, ref]);
}
