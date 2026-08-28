import { auth } from "@/lib/auth/server";

export const { DELETE, GET, PATCH, POST, PUT } = auth.handler();
