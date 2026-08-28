import { checkDatabaseConnection } from "@/lib/db";

export async function GET() {
  try {
    await checkDatabaseConnection();
    return Response.json({ auth: "configured", database: "connected" });
  } catch {
    return Response.json({ auth: "configured", database: "unavailable" }, { status: 503 });
  }
}
