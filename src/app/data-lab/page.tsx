import { redirect } from "next/navigation";

export default function DataLabPage() {
  redirect("/app?view=medications");
}
