"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { prepareContractCall } from "thirdweb";
import { useActiveAccount, useSendAndConfirmTransaction } from "thirdweb/react";
import { CustomerShell } from "@/components/customer/Shell";
import { SignIn } from "@/components/customer/SignIn";
import { useToast } from "@/components/toast";
import { Button, Card, ErrorNote, Spinner, TxReceipt } from "@/components/ui";
import { contract } from "@/lib/client";
import { formatDate, kesLabel } from "@/lib/format";
import { getCredit, type CreditState } from "@/lib/reads";
import { REWARD_TYPES, rewardLabel } from "@/lib/types";

/* ------------------------------------------------------------------ screen 5 */

export default function RedeemPage() {
  const account = useActiveAccount();
  const params = useParams<{ id: string }>();

  return (
    <CustomerShell>
      {account ? (
        <Redeem creditId={params.id} address={account.address} />
      ) : (
        <div className="pt-16 text-center">
          <p className="mb-6 text-mist-400">Sign in to claim this reward.</p>
          <SignIn />
        </div>
      )}
    </CustomerShell>
  );
}

function Redeem({ creditId, address }: { creditId: string; address: string }) {
  const [credit, setCredit] = useState<CreditState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rewardType, setRewardType] = useState<number>(REWARD_TYPES[0].id);
  const [txHash, setTxHash] = useState<string | null>(null);

  const { mutate: sendTx, isPending, error } = useSendAndConfirmTransaction();
  const { success, error: toastError } = useToast();

  useEffect(() => {
    let cancelled = false;
    getCredit(BigInt(creditId))
      .then((c) => !cancelled && setCredit(c))
      .catch((e: unknown) =>
        !cancelled && setLoadError(e instanceof Error ? e.message : String(e))
      );
    return () => {
      cancelled = true;
    };
  }, [creditId]);

  function claim() {
    const tx = prepareContractCall({
      contract,
      method: "redeem",
      params: [BigInt(creditId), rewardType],
    });

    // Gas is sponsored by the paymaster — the advocate never sees a fee prompt.
    sendTx(tx, {
      onSuccess: (receipt) => {
        setTxHash(receipt.transactionHash);
        success("Reward claimed");
      },
      onError: (e) => toastError(e.message),
    });
  }

  if (loadError) return <ErrorNote>{loadError}</ErrorNote>;

  if (!credit) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-6" />
      </div>
    );
  }

  const isHolder = credit.holder.toLowerCase() === address.toLowerCase();

  /* --- success state: the receipt the judges want to see --- */
  if (txHash) {
    return (
      <div className="animate-pop flex flex-col items-center pt-10 text-center">
        <div className="mb-6 grid size-20 place-items-center rounded-full bg-jade-500/15 text-4xl">
          🎉
        </div>
        <h1 className="text-2xl font-black">
          {kesLabel(credit.valueKES)} {rewardLabel(rewardType)} on the way
        </h1>
        <p className="mt-3 max-w-xs text-sm text-mist-400">
          Your reward is being delivered. This claim is now permanently recorded, and the
          Centre&rsquo;s outstanding balance just went down by {kesLabel(credit.valueKES)}.
        </p>

        <div className="mt-8">
          <TxReceipt hash={txHash} />
        </div>

        <div className="mt-10 flex w-full flex-col gap-3">
          <Button href="/rewards" variant="ghost">
            Back to my rewards
          </Button>
          <Button href="/submit">Earn another</Button>
        </div>
      </div>
    );
  }

  if (credit.redeemed) {
    return (
      <div className="animate-rise pt-10 text-center">
        <p className="text-lg font-bold">Already claimed</p>
        <p className="mt-2 text-sm text-mist-500">
          You claimed this {kesLabel(credit.valueKES)} reward on{" "}
          {formatDate(Number(credit.redeemedAt) * 1000)}.
        </p>
        <div className="mt-8">
          <Button href="/rewards" variant="ghost">
            Back to my rewards
          </Button>
        </div>
      </div>
    );
  }

  if (!isHolder) {
    return (
      <div className="animate-rise pt-10 text-center">
        <ErrorNote>This reward belongs to a different account.</ErrorNote>
        <div className="mt-8">
          <Button href="/rewards" variant="ghost">
            Back to my rewards
          </Button>
        </div>
      </div>
    );
  }

  /* --- choose and claim --- */
  return (
    <div className="animate-rise space-y-6">
      <Link href="/rewards" className="text-xs text-mist-500 hover:text-mist-300">
        ← My rewards
      </Link>

      <section className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-mist-500">
          Claim your reward
        </p>
        <p className="tabular mt-2 text-5xl font-black text-crimson-400">
          {kesLabel(credit.valueKES)}
        </p>
        <p className="mt-2 text-sm text-mist-500">
          Earned {formatDate(Number(credit.earnedAt) * 1000)} · 20 approved activities
        </p>
      </section>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-mist-500">
          How do you want it?
        </legend>
        {REWARD_TYPES.map((type) => {
          const active = rewardType === type.id;
          return (
            <label
              key={type.id}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition ${
                active
                  ? "border-crimson-500 bg-crimson-500/10"
                  : "border-ink-700 bg-ink-850 hover:border-ink-600"
              }`}
            >
              <input
                type="radio"
                name="rewardType"
                value={type.id}
                checked={active}
                onChange={() => setRewardType(type.id)}
                className="sr-only"
              />
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-ink-700 text-lg">
                {type.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{type.label}</span>
                <span className="block truncate text-xs text-mist-500">{type.blurb}</span>
              </span>
              <span
                className={`size-4 shrink-0 rounded-full border-2 ${
                  active ? "border-crimson-500 bg-crimson-500" : "border-ink-500"
                }`}
                aria-hidden
              />
            </label>
          );
        })}
      </fieldset>

      {error ? <ErrorNote>{error.message}</ErrorNote> : null}

      <Button onClick={claim} disabled={isPending} className="w-full">
        {isPending ? (
          <>
            <Spinner /> Claiming…
          </>
        ) : (
          `Claim ${kesLabel(credit.valueKES)}`
        )}
      </Button>

      <Card className="bg-ink-850/60">
        <p className="text-xs leading-relaxed text-mist-500">
          No fees, no wallet to top up. Claiming burns this reward so it can never be spent
          twice — and it shrinks what the business still owes.
        </p>
      </Card>
    </div>
  );
}
