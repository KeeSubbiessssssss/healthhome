import { redirect } from "next/navigation";
import { currentMember, currentUser } from "@/lib/household";
import { FamilyBoard } from "./family-board";

export const dynamic = "force-dynamic";

export default async function AppPage() {
  const local = process.env.NODE_ENV === "development";
  if (!local) {
    if (!await currentUser()) redirect("/auth/sign-in");
    if (!await currentMember()) redirect("/onboarding");
  }
  return <FamilyBoard local={local} />;
}
