import { NextRequest, NextResponse } from "next/server";

export interface TokenMetadata {
  name: string;
  symbol: string;
  description?: string;
  image?: string; // ipfs:// or https:// URI, from /api/upload-image
  links?: { website?: string; x?: string; telegram?: string };
}

export async function POST(req: NextRequest) {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) {
    return NextResponse.json(
      { error: "Metadata uploads aren't configured yet — PINATA_JWT is missing on the server." },
      { status: 503 }
    );
  }

  const metadata = (await req.json()) as TokenMetadata;
  if (!metadata?.name || !metadata?.symbol) {
    return NextResponse.json({ error: "name and symbol are required." }, { status: 400 });
  }

  const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      pinataContent: metadata,
      pinataMetadata: { name: `${metadata.symbol}-metadata` },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return NextResponse.json({ error: `Metadata pin failed: ${detail.slice(0, 200)}` }, { status: 502 });
  }

  const { IpfsHash } = (await res.json()) as { IpfsHash: string };
  return NextResponse.json({ uri: `ipfs://${IpfsHash}` });
}
