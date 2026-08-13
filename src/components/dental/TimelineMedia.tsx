import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export type TimelineMediaSource =
  | {
      type: "image";
      src: string;
      mediaClassName?: string;
    }
  | {
      type: "video";
      src: string;
      poster: string;
      fallbackSrc?: string;
      mediaClassName?: string;
    };

type TimelineMediaProps = {
  source: TimelineMediaSource;
  alt: string;
  className?: string;
  eager?: boolean;
};

export function TimelineMedia({
  source,
  alt,
  className,
  eager = false,
}: TimelineMediaProps) {
  const prefersReducedMotion = useReducedMotion();
  const [videoFailed, setVideoFailed] = useState(false);

  useEffect(() => {
    setVideoFailed(false);
  }, [source.src]);

  const mediaClassName = cn(
    "h-full w-full",
    source.type === "video" && "object-cover",
    source.mediaClassName
  );
  const fallbackSrc = source.type === "video"
    ? source.fallbackSrc ?? source.poster
    : source.src;

  return (
    <div className={cn("relative overflow-hidden bg-white", className)}>
      {source.type === "image" || videoFailed ? (
        <img
          src={fallbackSrc}
          alt={alt}
          className={mediaClassName}
          loading={eager ? "eager" : "lazy"}
        />
      ) : (
        <video
          src={source.src}
          poster={source.poster}
          aria-label={alt}
          className={mediaClassName}
          muted
          autoPlay={!prefersReducedMotion}
          loop={!prefersReducedMotion}
          playsInline
          controls={false}
          preload="metadata"
          disablePictureInPicture
          onError={() => setVideoFailed(true)}
        />
      )}
    </div>
  );
}
