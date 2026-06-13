import type { ReactNode } from "react";

type DataSourceNoteProps = {
  children: ReactNode;
  className?: string;
};

export default function DataSourceNote({
  children,
  className = "",
}: DataSourceNoteProps) {
  return (
    <p className={["mt-2 text-xs font-medium leading-5 text-slate-500", className].join(" ")}>
      {children}
    </p>
  );
}
