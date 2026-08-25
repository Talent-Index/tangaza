import "server-only";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export type UploadResult = { ok: true; url: string } | { ok: false; error: string; status: number };

/**
 * Store an uploaded image and return a URL. Cloudinary when configured, else the local
 * public/ dir (dev). `folder` scopes both the Cloudinary path and the on-disk directory.
 */
export async function uploadImage(file: unknown, folder: string): Promise<UploadResult> {
  if (!file || !(file instanceof File)) {
    return { ok: false, error: "file is required", status: 400 };
  }
  if (!ALLOWED.has(file.type)) {
    return { ok: false, error: "Use a JPEG, PNG, WebP, or GIF image", status: 400 };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "Image must be under 4 MB", status: 400 };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const preset = process.env.CLOUDINARY_UPLOAD_PRESET;
  if (cloudName && preset) {
    const body = new FormData();
    body.append("file", new Blob([buffer], { type: file.type }), file.name || folder);
    body.append("upload_preset", preset);
    body.append("folder", folder);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: "POST",
      body,
    });
    const json = (await res.json()) as { secure_url?: string; error?: { message?: string } };
    if (!res.ok || !json.secure_url) {
      return { ok: false, error: json.error?.message ?? "Cloudinary upload failed", status: 500 };
    }
    return { ok: true, url: json.secure_url };
  }

  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : file.type === "image/gif"
          ? "gif"
          : "jpg";
  const name = `${randomUUID()}.${ext}`;
  const dir = path.join(process.cwd(), "public", folder);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), buffer);
  return { ok: true, url: `/${folder}/${name}` };
}
