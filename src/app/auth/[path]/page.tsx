import { AuthView } from "@neondatabase/auth-ui";
import { authViewPaths } from "@neondatabase/auth-ui/server";

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.values(authViewPaths).map((path) => ({ path }));
}

export default async function AuthPage({ params }: { params: Promise<{ path: string }> }) {
  const { path } = await params;
  return <main className="data-lab-shell"><p className="eyebrow">HealthHome</p><h1>Your private space</h1><AuthView path={path as keyof typeof authViewPaths} /></main>;
}
