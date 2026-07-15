import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getScoringWeights } from "@/lib/settings";
import { ScoringWeightsForm } from "@/components/settings/ScoringWeightsForm";

export const dynamic = "force-dynamic";

export default async function ScoringSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/settings/profile");

  const weights = await getScoringWeights();
  return <ScoringWeightsForm initialWeights={weights} />;
}
