import { redirect } from "next/navigation";

import { createHousehold } from "@/app/onboarding/actions";
import { currentMember, currentUser } from "@/lib/household";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await currentUser();
  if (!user) redirect("/auth/sign-in");
  if (await currentMember()) redirect("/app");
  return <main className="data-lab-shell"><p className="eyebrow">HealthHome</p><h1>Create your private household</h1><p className="data-lab-intro">This creates the private owner record that protects your medication and future Dexcom data.</p><form action={createHousehold}><button type="submit">Create my HealthHome</button></form></main>;
}
