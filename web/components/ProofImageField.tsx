"use client";

import { useRef, useState } from "react";
import { Spinner } from "@/components/ui";

/**
 * Advocate-facing image proof: snap or pick a photo (receipt, items bought, your visit),
 * it uploads and becomes a link the business can open from the approval queue.
 */
export function ProofImageField({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/upload/proof", { method: "POST", body });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? "Upload failed");
      onChange(json.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
        }}
      />

      {value ? (
        <div className="relative overflow-hidden rounded-xl border border-ink-700">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="Your proof" className="max-h-72 w-full object-contain bg-ink-900" />
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute right-2 top-2 rounded-full bg-ink-950/80 px-2 py-1 text-xs text-mist-300 hover:text-white"
          >
            Replace
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-ink-600 bg-ink-850 px-4 py-6 text-sm text-mist-400 transition hover:border-crimson-500 hover:text-mist-200 disabled:opacity-60"
        >
          {uploading ? (
            <>
              <Spinner className="size-4" /> Uploading…
            </>
          ) : (
            <>📷 Take or upload a photo</>
          )}
        </button>
      )}

      {error ? <p className="text-xs text-crimson-300">{error}</p> : null}
    </div>
  );
}
