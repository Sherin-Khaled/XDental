import { useEffect, useState } from "react";

/**
 * Resolves an <img> src with a guaranteed-safe fallback, covering both
 * failure modes: the source being null/empty, and the source being a
 * non-empty URL that 404s or otherwise fails to load in the browser
 * (which a `src || fallback` expression alone can't catch).
 */
export function useImageFallback(src: string | null | undefined, fallback: string) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  return {
    src: src && !failed ? src : fallback,
    onError: () => setFailed(true),
  };
}
