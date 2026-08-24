import type { Division } from "../lib/divisions";
import { getDivisionLabel } from "../lib/divisions";

type DivisionBadgeProps = {
  division: Division;
  className?: string;
};

export function DivisionBadge({ division, className = "" }: DivisionBadgeProps) {
  const isDivOne = division === "division_one";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        isDivOne
          ? "bg-blue-500/15 text-blue-700 dark:text-blue-300"
          : "bg-amber-500/15 text-amber-800 dark:text-amber-300"
      } ${className}`}
    >
      {getDivisionLabel(division)}
    </span>
  );
}
