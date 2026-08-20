"use client";

import { useActiveAccount, useActiveWallet, useDisconnect } from "thirdweb/react";
import { OrgShell, useOrgAccessContext } from "@/components/org/Shell";
import { ThemeToggle, useTheme } from "@/components/theme";
import { useToast } from "@/components/toast";
import { Button, Card, SectionTitle } from "@/components/ui";
import { addressUrl } from "@/lib/chain";
import { CONTRACT_ADDRESS } from "@/lib/client";
import { shortAddress } from "@/lib/format";

export default function OrgAccountPage() {
  return (
    <OrgShell>
      <AccountSettings />
    </OrgShell>
  );
}

function AccountSettings() {
  const account = useActiveAccount();
  const wallet = useActiveWallet();
  const { disconnect } = useDisconnect();
  const { success } = useToast();
  const { theme, setTheme } = useTheme();
  const { orgName, isApprover } = useOrgAccessContext();

  if (!account) return null;
  const initials = account.address.replace(/^0x/i, "").slice(0, 2).toUpperCase();

  function signOut() {
    if (wallet) disconnect(wallet);
    success("Signed out");
  }

  return (
    <div className="animate-rise space-y-6 md:space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
        <div
          className="grid size-16 shrink-0 place-items-center rounded-full border border-ink-600 bg-gradient-to-br from-ink-700 to-ink-850 text-lg font-bold uppercase tracking-wide text-mist-100"
          aria-hidden
        >
          {initials}
        </div>
        <div>
          <h1 className="text-2xl font-black md:text-3xl">Account &amp; settings</h1>
          <p className="mt-1 text-sm text-mist-500">
            Your business wallet, contract links, and appearance.
          </p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2 lg:gap-8 lg:items-start">
        <div className="space-y-6">
          <section>
            <SectionTitle>Your business</SectionTitle>
            <Card className="space-y-3 bg-ink-850/60">
              <DetailRow label="Business" value={orgName ?? "—"} />
              <DetailRow
                label="Wallet"
                value={
                  <a
                    href={addressUrl(account.address)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="tabular text-crimson-300 underline underline-offset-4 hover:text-crimson-400"
                  >
                    {shortAddress(account.address)}
                  </a>
                }
              />
              {CONTRACT_ADDRESS ? (
                <DetailRow
                  label="Contract"
                  value={
                    <a
                      href={addressUrl(CONTRACT_ADDRESS)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="tabular text-crimson-300 underline underline-offset-4 hover:text-crimson-400"
                    >
                      {shortAddress(CONTRACT_ADDRESS)}
                    </a>
                  }
                />
              ) : null}
              {isApprover ? (
                <DetailRow label="Role" value="Approver — can approve and manage campaigns" />
              ) : (
                <DetailRow label="Role" value="Read-only access" />
              )}
            </Card>
          </section>

          <section>
            <SectionTitle>Appearance</SectionTitle>
            <Card className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Theme</p>
                <p className="mt-0.5 text-xs text-mist-500">
                  Currently {theme === "dark" ? "dark" : "light"} mode
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTheme("light")}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    theme === "light"
                      ? "bg-crimson-500/15 text-crimson-300"
                      : "text-mist-500 hover:text-mist-300"
                  }`}
                >
                  Light
                </button>
                <button
                  type="button"
                  onClick={() => setTheme("dark")}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    theme === "dark"
                      ? "bg-crimson-500/15 text-crimson-300"
                      : "text-mist-500 hover:text-mist-300"
                  }`}
                >
                  Dark
                </button>
                <ThemeToggle />
              </div>
            </Card>
          </section>
        </div>

        <div className="space-y-6">
          <section>
            <SectionTitle>Portal</SectionTitle>
            <Card className="space-y-3">
              <p className="text-sm text-mist-400">
                Switch between the business dashboard and the advocate experience with the
                same wallet.
              </p>
              <Button href="/" variant="ghost" className="w-full">
                Open advocate portal →
              </Button>
              <Button href="/org/overview" variant="ghost" className="w-full">
                Back to business overview →
              </Button>
            </Card>
          </section>

          <section>
            <SectionTitle>Session</SectionTitle>
            <Card className="space-y-4 bg-ink-850/60">
              <p className="text-xs leading-relaxed text-mist-500">
                Your account comes from the social login or wallet you used to sign in.
                Every login mints its own smart account — use the same one you registered
                with.
              </p>
              <Button type="button" variant="danger" className="w-full" onClick={signOut}>
                Sign out
              </Button>
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
      <span className="shrink-0 text-xs uppercase tracking-[0.12em] text-mist-500">
        {label}
      </span>
      <span className="min-w-0 break-words text-mist-300 sm:text-right">{value}</span>
    </div>
  );
}
