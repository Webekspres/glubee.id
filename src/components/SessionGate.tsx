"use client";
import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { accountDestination, api, ApiError, type Profile } from "@/lib/ui";
import { ErrorMessage } from "./Ui";
export function SessionGate({
  children,
  onboarding = false,
  status = false,
}: {
  children: (profile: Profile) => ReactNode;
  onboarding?: boolean;
  status?: boolean;
}) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let ignore = false;
    api<Profile>("/api/profile")
      .then(({ data }) => {
        if (ignore) return;
        const target = accountDestination(data.account_status);
        if (
          !status &&
          ((onboarding && target !== "/onboarding") ||
            (!onboarding && target !== "/dashboard"))
        )
          router.replace(target);
        else setProfile(data);
      })
      .catch((e) => {
        if (ignore) return;
        if (e instanceof ApiError && e.status === 401)
          router.replace("/login?expired=1");
        else setError(e);
      });
    return () => {
      ignore = true;
    };
  }, [router, onboarding, status, attempt]);
  if (error)
    return (
      <div className="panel">
        <ErrorMessage error={error} />
        <button
          className="button"
          onClick={() => {
            setError(null);
            setAttempt(attempt + 1);
          }}
        >
          Coba lagi
        </button>
      </div>
    );
  return profile ? (
    children(profile)
  ) : (
    <p className="loading" role="status">
      Memuat akun Anda…
    </p>
  );
}
