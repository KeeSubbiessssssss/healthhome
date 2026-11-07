import { redirect } from "next/navigation";

import { createHousehold } from "@/app/onboarding/actions";
import { currentMember, currentUser } from "@/lib/household";
import { isHouseholdOwner } from "@/lib/access-policy";
import { AccountControls } from "@/app/account-controls";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await currentUser();
  if (!user) redirect("/auth/sign-in");
  if (await currentMember()) redirect("/app");
  return <main className="data-lab-shell"><p className="eyebrow">HealthHome</p><h1>{!user.emailVerified ? "Verify your email" : isHouseholdOwner(user) ? "Your private household" : "An invitation opens the door."}</h1><p className="data-lab-intro">Signed in as {user.email}.</p>{!user.emailVerified ? <p>Verify your email address before accessing a household. Enter the six-digit code from your email below. You’ll then sign in with your verified address.</p> : isHouseholdOwner(user) ? <><p>Create your household once, then invite people and manage their access in Settings.</p><form action={createHousehold}><button type="submit">Create my HealthHome</button></form></> : <><p>This board is invitation-only. Open the private invitation link shared by the owner. If your access was turned off, ask the owner to restore it.</p><a href="/join">Return to my invitation</a></>}<AccountControls email={user.email} verify={!user.emailVerified}/></main>;
}
