"use client";

import { useState } from "react";

// Dashed upload area: a <label> wrapping a visually hidden file input, so it is
// keyboard- and screen-reader-accessible without extra wiring.
export function DropZone({
  label,
  name = "file",
  accept = "image/*,application/pdf",
  capture,
  onFile,
}: {
  label: string;
  name?: string;
  accept?: string;
  capture?: "user" | "environment";
  onFile?: (file: File) => void;
}) {
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <label className="flex h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-foreground/25 px-4 text-center text-muted transition-colors hover:border-foreground/50 hover:text-foreground focus-within:border-foreground focus-within:text-foreground">
      <span aria-hidden="true" className="text-2xl">
        📷
      </span>
      <span className="font-medium">{fileName ?? label}</span>
      <input
        type="file"
        name={name}
        accept={accept}
        capture={capture}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setFileName(file.name);
          onFile?.(file);
        }}
      />
    </label>
  );
}
