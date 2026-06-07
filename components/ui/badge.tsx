import type { HTMLAttributes, PropsWithChildren } from "react";

import { cn } from "@/lib/utils";

type BadgeTone = "green" | "blue" | "orange" | "rose" | "neutral";

const tones: Record<BadgeTone, string> = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  blue: "bg-blue-50 text-blue-700 ring-blue-100",
  orange: "bg-orange-50 text-orange-700 ring-orange-100",
  rose: "bg-rose-50 text-rose-700 ring-rose-100",
  neutral: "bg-zinc-100 text-zinc-700 ring-zinc-200"
};

export function Badge({
  className,
  tone = "neutral",
  children,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }>) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center rounded-full px-3 text-xs font-bold ring-1",
        tones[tone],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
