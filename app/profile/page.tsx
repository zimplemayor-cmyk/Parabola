"use client";

import { useAccount } from "wagmi";
import { ProfileView } from "@/components/ProfileView";

export default function ProfilePage() {
  const { address, isConnected } = useAccount();

  if (!isConnected || !address) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <p className="text-paper-dim">Connect your wallet to see your profile.</p>
      </div>
    );
  }

  return <ProfileView address={address} isOwnProfile />;
}
