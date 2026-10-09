import { redirect } from "next/navigation";

/** The M-Pesa Till pilot became Referrals; keep old links working. */
export default function OrgPilotPage() {
  redirect("/org/referrals");
}
