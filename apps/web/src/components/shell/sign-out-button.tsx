"use client";

import { useRouter } from "next/navigation";
import { signOut } from "@/lib/sign-out";

export function SignOutButton({
  label,
  className = "logout",
}: {
  label: string;
  className?: string;
}) {
  const router = useRouter();
  return (
    <button type="button" className={className} onClick={() => void signOut(router)}>
      {label}
    </button>
  );
}
