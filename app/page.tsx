import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";

export default function RootPage() {
  const user = getCurrentUser();
  redirect(user ? "/dashboard" : "/login");
}
