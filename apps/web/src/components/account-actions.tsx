"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth/client";

/**
 * Download everything, sign out, and delete the account for good.
 * When Debo starts storing entries and files, deleting the account must also
 * remove every row and file the person owns (docs/PRIVACY-AND-TRUST.md).
 */
export function AccountActions() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function signOut() {
    setPending(true);
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  async function deleteAccount() {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/account/delete", { method: "POST" });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setPending(false);
        setMessage(body.error ?? "I couldn't delete your account. Try again in a moment.");
        return;
      }
    } catch {
      setPending(false);
      setMessage("I couldn't reach Debo. Check your connection and try again.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <section className="mt-12 border-t-2 border-ink pt-8" aria-labelledby="account-heading">
      <h2 id="account-heading" className="text-[1.375rem]">
        Your account
      </h2>
      <p className="mt-2 text-ink-soft">
        Get a zip of all your entries and your activity record to keep. It opens without Debo.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <a href="/api/export" download className="btn btn-quiet">
          Download everything
        </a>
        <button type="button" onClick={signOut} disabled={pending} className="btn btn-quiet">
          Sign out
        </button>
        {!confirming && (
          <button type="button" onClick={() => setConfirming(true)} className="btn btn-quiet">
            Delete my account
          </button>
        )}
      </div>

      {confirming && (
        <div className="mt-6 rounded-[24px] border-2 border-ink bg-paper p-6" role="group" aria-labelledby="delete-heading">
          <h3 id="delete-heading" className="text-[1.375rem]">
            Delete your account for good?
          </h3>
          <p className="mt-2 text-ink-soft">
            This removes your account, your name, your email, every journal entry and any files you added,
            right away. It cannot be undone.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" onClick={deleteAccount} disabled={pending} className="btn btn-quiet">
              Delete my account for good
            </button>
            <button type="button" onClick={() => setConfirming(false)} disabled={pending} className="btn btn-quiet">
              Keep my account
            </button>
          </div>
        </div>
      )}

      <p role="status" aria-live="polite" className="mt-4 min-h-6 font-semibold">
        {message}
      </p>
    </section>
  );
}
