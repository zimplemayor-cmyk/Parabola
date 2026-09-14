"use client";

import { useState, useMemo, useRef } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId } from "wagmi";
import { parseEventLogs } from "viem";
import { FACTORY_ADDRESS, LaunchFactoryAbi, FACTORY_CONFIGURED } from "@/lib/contracts";
import { parseQuote } from "@/lib/format";
import { uploadImage, uploadMetadata } from "@/lib/upload";

const MAX_NAME = 32;
const MAX_SYMBOL = 12;
const MAX_DESCRIPTION = 280;
const VESTING_OPTIONS = [
  { label: "90 days (minimum)", seconds: 90 * 86400 },
  { label: "180 days", seconds: 180 * 86400 },
  { label: "365 days", seconds: 365 * 86400 },
  { label: "2 years", seconds: 2 * 365 * 86400 },
];

type UploadStage = "idle" | "image" | "metadata" | "error";

export function LaunchForm() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [track, setTrack] = useState<"meme" | "builder">("meme");
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [uploadStage, setUploadStage] = useState<UploadStage>("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [teamPct, setTeamPct] = useState(10);
  const [vestingSeconds, setVestingSeconds] = useState(VESTING_OPTIONS[1].seconds);
  const [initialBuy, setInitialBuy] = useState("");

  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({ hash });

  const launchedToken = useMemo(() => {
    if (!receipt) return null;
    try {
      const logs = parseEventLogs({ abi: LaunchFactoryAbi, logs: receipt.logs }) as unknown as Array<{
        eventName: string;
        args: { token: `0x${string}` };
      }>;
      return logs.find((log) => log.eventName === "LaunchCreated")?.args.token;
    } catch {
      return null;
    }
  }, [receipt]);

  const nameError = name.length > 0 && name.length > MAX_NAME ? `Max ${MAX_NAME} characters` : null;
  const symbolError = symbol.length > 0 && symbol.length > MAX_SYMBOL ? `Max ${MAX_SYMBOL} characters` : null;
  const canSubmit =
    isConnected &&
    name.length > 0 &&
    name.length <= MAX_NAME &&
    symbol.length > 0 &&
    symbol.length <= MAX_SYMBOL &&
    uploadStage !== "image" &&
    uploadStage !== "metadata";

  function pickImage(file: File | undefined) {
    setImageError(null);
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/gif", "image/webp"].includes(file.type)) {
      setImageError("Use PNG, JPEG, GIF, or WEBP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setImageError("Image must be under 5MB.");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function submit() {
    setUploadError(null);
    let metadataURI = "";

    // Uploads happen from the creator's own device — chosen via the file
    // picker below, not a pasted link — then pinned to IPFS through our
    // own server route (keeps the pinning API key server-side) before the
    // on-chain launch call fires.
    if (imageFile || description) {
      try {
        let imageURI: string | undefined;
        if (imageFile) {
          setUploadStage("image");
          imageURI = await uploadImage(imageFile);
        }
        setUploadStage("metadata");
        metadataURI = await uploadMetadata({ name, symbol, description: description || undefined, image: imageURI });
        setUploadStage("idle");
      } catch (e) {
        setUploadStage("error");
        setUploadError(e instanceof Error ? e.message : "Upload failed.");
        return;
      }
    }

    const value = initialBuy ? parseQuote(initialBuy) : 0n;
    if (track === "meme") {
      writeContract({
        address: FACTORY_ADDRESS,
        abi: LaunchFactoryAbi,
        functionName: "createMemeLaunch",
        args: [name, symbol, metadataURI, 0n],
        value,
      });
    } else {
      writeContract({
        address: FACTORY_ADDRESS,
        abi: LaunchFactoryAbi,
        functionName: "createBuilderLaunch",
        args: [name, symbol, metadataURI, BigInt(teamPct * 100), BigInt(vestingSeconds), 0n],
        value,
      });
    }
  }

  if (isSuccess && launchedToken) {
    return (
      <div className="card p-8 text-center">
        {imagePreview && (
          <img src={imagePreview} alt="" className="mx-auto h-20 w-20 rounded-2xl object-cover" />
        )}
        <p className="mt-4 text-stable">Launch confirmed.</p>
        <h2 className="mt-2 font-display text-2xl font-semibold text-paper">{name} is live</h2>
        <a href={`/token/${launchedToken}`} className="btn-primary mt-6 inline-flex">
          View token page
        </a>
      </div>
    );
  }

  return (
    <div className="card p-6 md:p-8">
      <div className="mb-6 flex rounded-full border border-ink-border p-1">
        {(["meme", "builder"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTrack(t)}
            className={`flex-1 rounded-full py-2 text-sm font-medium transition ${
              track === t ? "bg-ignite text-ink" : "text-paper-dim hover:text-paper"
            }`}
          >
            {t === "meme" ? "Meme launch" : "Builder launch"}
          </button>
        ))}
      </div>
      <p className="mb-6 text-xs text-paper-faint">
        {track === "meme"
          ? "100% of supply goes to the public curve. No team allocation, fully fair-launch."
          : "Reserve up to 20% for your team, linear-vested over a schedule you set — locked on-chain, not just promised."}
      </p>

      <div className="space-y-5">
        <Field label="Name" hint={`${name.length}/${MAX_NAME}`} error={nameError}>
          <input
            className="input-field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Doge on Arc"
            maxLength={MAX_NAME + 5}
          />
        </Field>

        <Field label="Symbol" hint={`${symbol.length}/${MAX_SYMBOL}`} error={symbolError}>
          <input
            className="input-field uppercase"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            placeholder="DOGARC"
            maxLength={MAX_SYMBOL + 5}
          />
        </Field>

        <Field label="Token image" hint="optional" help="PNG, JPEG, GIF, or WEBP, up to 5MB. Uploaded straight from your device — no link needed.">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            onChange={(e) => pickImage(e.target.files?.[0])}
            className="hidden"
          />
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-ink-border text-paper-faint transition hover:border-ignite/50 hover:text-ignite"
            >
              {imagePreview ? (
                <img src={imagePreview} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-2xl">+</span>
              )}
            </button>
            <div className="text-xs text-paper-faint">
              {imageFile ? (
                <>
                  <p className="text-paper-dim">{imageFile.name}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setImageFile(null);
                      setImagePreview(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="mt-1 text-ignite-soft hover:text-ignite"
                  >
                    Remove
                  </button>
                </>
              ) : (
                <p>Tap to choose an image from your device.</p>
              )}
            </div>
          </div>
          {imageError && <p className="mt-1.5 text-xs text-ignite-soft">{imageError}</p>}
        </Field>

        <Field label="Description" hint={`${description.length}/${MAX_DESCRIPTION} · optional`}>
          <textarea
            className="input-field min-h-[80px] resize-none"
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESCRIPTION))}
            placeholder="What is this token about?"
          />
        </Field>

        {track === "builder" && (
          <>
            <Field label="Team allocation" hint={`${teamPct}%`}>
              <input
                type="range"
                min={0}
                max={20}
                value={teamPct}
                onChange={(e) => setTeamPct(Number(e.target.value))}
                className="w-full accent-ignite"
              />
            </Field>
            <Field label="Vesting schedule">
              <select
                className="input-field"
                value={vestingSeconds}
                onChange={(e) => setVestingSeconds(Number(e.target.value))}
              >
                {VESTING_OPTIONS.map((o) => (
                  <option key={o.seconds} value={o.seconds}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
          </>
        )}

        <Field label="Your first buy" hint="optional — executes atomically, before anyone else can buy">
          <div className="relative">
            <input
              className="input-field pr-16"
              value={initialBuy}
              onChange={(e) => setInitialBuy(e.target.value)}
              placeholder="0.00"
              inputMode="decimal"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-paper-faint">USDC</span>
          </div>
        </Field>
      </div>

      {!FACTORY_CONFIGURED && (
        <p className="mt-6 text-xs text-ignite-soft">
          Factory address not configured — set NEXT_PUBLIC_FACTORY_ADDRESS in .env after deploying the contracts.
        </p>
      )}
      {uploadError && <p className="mt-6 text-xs text-ignite-soft">{uploadError}</p>}
      {error && <p className="mt-6 text-xs text-ignite-soft">{error.message.slice(0, 200)}</p>}

      <button
        onClick={submit}
        disabled={!canSubmit || !FACTORY_CONFIGURED || isPending || isConfirming}
        className="btn-primary mt-8 w-full disabled:cursor-not-allowed disabled:opacity-50"
      >
        {!isConnected
          ? "Connect wallet to launch"
          : uploadStage === "image"
            ? "Uploading image…"
            : uploadStage === "metadata"
              ? "Pinning metadata…"
              : isPending
                ? "Confirm in wallet…"
                : isConfirming
                  ? "Launching…"
                  : `Launch on Parabola`}
      </button>
      <p className="mt-3 text-center text-xs text-paper-faint">Chain ID {chainId} · {address ?? "not connected"}</p>
    </div>
  );
}

function Field({
  label,
  hint,
  help,
  error,
  children,
}: {
  label: string;
  hint?: string;
  help?: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <label className="text-sm font-medium text-paper">{label}</label>
        {hint && <span className="font-mono text-xs text-paper-faint">{hint}</span>}
      </div>
      {children}
      {help && <p className="mt-1.5 text-xs text-paper-faint">{help}</p>}
      {error && <p className="mt-1.5 text-xs text-ignite-soft">{error}</p>}
    </div>
  );
}
