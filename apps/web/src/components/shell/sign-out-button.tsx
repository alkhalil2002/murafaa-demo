"use client";

import { useRouter } from "next/navigation";
import { signOut } from "@/lib/sign-out";

export function SignOutButton({ label }: { label: string }) {
  const router = useRouter();
  return (
    <button type="button" className="logout" onClick={() => void signOut(router)}>
      {label}
    </button>
  );
}
