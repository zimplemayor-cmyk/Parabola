export async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/upload-image", { method: "POST", body: form });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || "Image upload failed.");
  return body.uri as string;
}

export async function uploadMetadata(metadata: {
  name: string;
  symbol: string;
  description?: string;
  image?: string;
}): Promise<string> {
  const res = await fetch("/api/upload-metadata", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(metadata),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || "Metadata upload failed.");
  return body.uri as string;
}
