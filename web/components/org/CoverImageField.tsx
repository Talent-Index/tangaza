"use client";

import { useCallback, useRef, useState } from "react";
import { Spinner } from "@/components/ui";

export function CoverImageField({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUrl, setShowUrl] = useState(false);

  const upload = useCallback(
    async (file: File) => {
      setError(null);
      setUploading(true);
      try {
        const body = new FormData();
        body.append("file", file);
        const res = await fetch("/api/upload/campaign-cover", { method: "POST", body });
        const json = (await res.json()) as { url?: string; error?: string };
        if (!res.ok || !json.url) throw new Error(json.error ?? "Upload failed");
        onChange(json.url);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [onChange]
  );

  function onFiles(files: FileList | null) {
    const file = files?.[0];
    if (file) upload(file);
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-mist-500">
        Cover image
      </p>

      {value ? (
        <div className="relative overflow-hidden rounded-xl border border-ink-700">
          <img src={value} alt="" className="aspect-[2/1] w-full object-cover" />
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute right-2 top-2 rounded-full bg-ink-950/80 px-2 py-1 text-xs text-mist-300 hover:text-white"
          >
            Remove
          </button>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            onFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={`relative grid aspect-[2/1] cursor-pointer place-items-center rounded-xl border-2 border-dashed transition ${
            dragging
              ? "border-crimson-500 bg-crimson-500/10"
              : "border-ink-600 bg-ink-850/50 hover:border-ink-500 hover:bg-ink-850"
          }`}
        >
          {uploading ? (
            <Spinner className="size-6" />
          ) : (
            <div className="px-4 text-center">
              <p className="text-sm font-medium text-mist-300">
                Drag and drop an image here
              </p>
              <p className="mt-1 text-xs text-mist-500">or click to choose a file</p>
              <p className="mt-2 text-[11px] text-mist-600">JPEG, PNG, WebP or GIF · max 4 MB</p>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            onChange={(e) => onFiles(e.target.files)}
          />
        </div>
      )}

      {error ? <p className="text-xs text-crimson-400">{error}</p> : null}

      <button
        type="button"
        onClick={() => setShowUrl((v) => !v)}
        className="text-xs text-mist-500 underline underline-offset-4 hover:text-mist-300"
      >
        {showUrl ? "Hide URL field" : "Or paste an image URL"}
      </button>

      {showUrl ? (
        <input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://…"
          className="w-full rounded-xl border border-ink-700 bg-ink-850 px-3 py-2 text-sm outline-none placeholder:text-mist-500 focus:border-crimson-500"
        />
      ) : null}
    </div>
  );
}
