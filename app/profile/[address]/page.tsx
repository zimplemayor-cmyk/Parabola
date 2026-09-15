"use client";

import { use } from "react";
import { useAccount } from "wagmi";
import { ProfileView } from "@/components/ProfileView";

export default function PublicProfilePage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = use(params);
  const { address: connectedAddress } = useAccount();
  const isOwnProfile = connectedAddress?.toLowerCase() === address.toLowerCase();

  return <ProfileView address={address as `0x${string}`} isOwnProfile={isOwnProfile} />;
}
