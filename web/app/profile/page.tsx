"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useActiveAccount, useActiveWallet, useDisconnect } from "thirdweb/react";
import { CustomerShell } from "@/components/customer/Shell";
import { SignIn } from "@/components/customer/SignIn";
import { useToast } from "@/components/toast";
import { Button, Card, ErrorNote, SectionTitle, Spinner, TxReceipt } from "@/components/ui";
import { ORG_ID } from "@/lib/chain";
import {
  useAdvocateProfile,
  useCredentialName,
  useOnChainHistory,
} from "@/lib/hooks";
import { timeAgo } from "@/lib/format";
import { normaliseHandle } from "@/lib/types";

/**
 * Who you are.
 *
 * Signing in with X gives thirdweb no email and no username, so without this the app
 * shows a pseudonym derived from your wallet address — stable, but not your name. The
 * business sees this on its approvals queue and its client list, so it is worth being
 * a real person here.
 */
export default function ProfilePage() {
  const account = useActiveAccount();

  return (
    <CustomerShell>
      {account ? (
        <ProfileForm address={account.address} />
      ) : (
        <div className="pt-16 text-center">
          <p className="mb-6 text-mist-400">Sign in to set up your profile.</p>
          <SignIn />
        </div>
      )}
    </CustomerShell>
  );
}

function ProfileForm({ address }: { address: string }) {
  const me = useAdvocateProfile(address);
  const credentialName = useCredentialName();
  const wallet = useActiveWallet();
  const { disconnect } = useDisconnect();
  const router = useRouter();
  const { success, error: toastError } = useToast();

  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Seed from the stored profile, or from the login credential when they haven't
  // typed a name yet — so the field matches what the header already shows.
  useEffect(() => {
    if (me.loading) return;
    setName(me.data?.displayName ?? credentialName ?? "");
    setHandle(me.data?.xUsername ?? "");
  }, [me.loading, me.data, credentialName]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const nameRes = await fetch("/api/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: String(ORG_ID),
          address,
          displayName: name.trim(),
        }),
      });
      if (!nameRes.ok) {
        throw new Error(((await nameRes.json()) as { error?: string }).error ?? "Could not save");
      }

      const wanted = normaliseHandle(handle);
      const current = me.data?.xUsername ?? "";

      if (wanted !== current) {
        const res = wanted
          ? await fetch("/api/x-links", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orgId: String(ORG_ID), address, handle: wanted }),
            })
          : await fetch(
              `/api/x-links?orgId=${ORG_ID}&address=${address}`,
              { method: "DELETE" }
            );

        if (!res.ok) {
          throw new Error(((await res.json()) as { error?: string }).error ?? "Could not save");
        }
      }

      success("Profile saved");
      me.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not save";
      setError(msg);
      toastError(msg);
    } finally {
      setSaving(false);
    }
  }

  function signOut() {
    if (wallet) disconnect(wallet);
    success("Signed out");
    router.push("/auth");
  }

  if (me.loading && !me.data) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-6" />
      </div>
    );
  }

  return (
    <form onSubmit={save} className="animate-rise space-y-6">
      <div>
        <h1 className="text-2xl font-black">Your profile</h1>
        <p className="mt-1 text-sm text-mist-500">
          This is what businesses see next to everything you submit.
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="name"
          className="block text-xs font-semibold uppercase tracking-[0.14em] text-mist-500"
        >
          Your name
        </label>
        <input
          id="name"
          type="text"
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Amina Wanjiru"
          className="w-full rounded-xl border border-ink-700 bg-ink-850 px-4 py-3 text-sm outline-none placeholder:text-mist-500 focus:border-crimson-500"
        />
        <p className="text-xs text-mist-500">
          {credentialName
            ? `Prefilled from your sign-in (${credentialName}). Edit it anytime — this is what businesses see.`
            : "Leave it blank and we\u2019ll fall back to your X handle, or a nickname made from your account."}
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="handle"
          className="block text-xs font-semibold uppercase tracking-[0.14em] text-mist-500"
        >
          Your X handle <span className="normal-case text-mist-500">(optional)</span>
        </label>
        <input
          id="handle"
          type="text"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="@you"
          className="w-full rounded-xl border border-ink-700 bg-ink-850 px-4 py-3 text-sm outline-none placeholder:text-mist-500 focus:border-crimson-500"
        />
        <p className="text-xs text-mist-500">
          So businesses can match your posts to you. Paste the handle or your profile
          link — either works.
        </p>
      </div>

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <Button type="submit" disabled={saving} className="w-full">
        {saving ? "Saving…" : "Save"}
      </Button>

      <OnChainRecord address={address} />

      <section>
        <SectionTitle>Your account</SectionTitle>
        <Card className="space-y-4 bg-ink-850/60">
          <p className="text-xs leading-relaxed text-mist-500">
            No seed phrase, no gas, no balance to top up — your account is created from
            the social login you used, and gas is sponsored on every transaction. Prefer
            your own wallet? Core works too, from the sign-in screen.
          </p>
          <Button type="button" variant="danger" className="w-full" onClick={signOut}>
            Sign out
          </Button>
        </Card>
      </section>
    </form>
  );
}


/* -------------------------------------------------------------- on-chain record */

const HISTORY_STYLE = {
  submitted: { icon: "📤", label: "Submitted an activity" },
  approved: { icon: "✅", label: "Activity approved" },
  earned: { icon: "🎉", label: "Credit minted" },
  redeemed: { icon: "🔥", label: "Credit burned for a reward" },
} as const;

/**
 * The wallet's own story, read straight off Avalanche. Every row is a transaction —
 * open it in Snowtrace, or watch the same history from Core or any wallet that holds
 * this account. Nothing here comes from our database.
 */
function OnChainRecord({ address }: { address: string }) {
  const history = useOnChainHistory(address);
  const entries = history.data ?? [];

  if (history.loading && entries.length === 0) return null;
  if (entries.length === 0) return null;

  return (
    <section>
      <SectionTitle>Your on-chain record</SectionTitle>
      <ul className="space-y-2">
        {entries.map((e) => {
          const style = HISTORY_STYLE[e.kind];
          return (
            <li key={`${e.txHash}-${e.kind}-${e.timestamp}`}>
              <Card className="flex flex-wrap items-center gap-3 py-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-ink-700 text-base">
                  {style.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {style.label}
                    {e.valueKES ? ` · KES ${e.valueKES}` : ""}
                  </p>
                  <p className="text-xs text-mist-500">{timeAgo(e.timestamp)}</p>
                </div>
                <TxReceipt hash={e.txHash} label="On Avalanche" />
              </Card>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-mist-500">
        Read straight from Avalanche — none of this comes from our database, and any
        wallet holding this account sees the same history.
      </p>
    </section>
  );
}
