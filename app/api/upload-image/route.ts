import { NextRequest, NextResponse } from "next/server";

/**
 * Pins a creator-uploaded image straight to IPFS via Pinata. PINATA_JWT is
 * intentionally NOT prefixed with NEXT_PUBLIC_, it must stay server-only,
 * this route is what keeps it off the client. Requires a free Pinata
 * account: pinata.cloud → API Keys → New Key → Admin → copy the JWT → set
 * it as PINATA_JWT in Vercel Project Settings → Environment Variables
 * (Secret/Sensitive, no NEXT_PUBLIC_ prefix, Production checked).
 */
const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

export async function POST(req: NextRequest) {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) {
    return NextResponse.json(
      { error: "Image uploads aren't configured yet, PINATA_JWT is missing on the server." },
      { status: 503 }
    );
  }

  const form = (await req.formData()) as any;
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Use PNG, JPEG, GIF, or WEBP." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image must be under 5MB." }, { status: 400 });
  }

  const pinataForm = new FormData();
  pinataForm.append("file", file, file.name);

  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}` },
    body: pinataForm,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return NextResponse.json({ error: `Upload to IPFS failed: ${detail.slice(0, 200)}` }, { status: 502 });
  }

  const { IpfsHash } = (await res.json()) as { IpfsHash: string };
  return NextResponse.json({ uri: `ipfs://${IpfsHash}` });
}
