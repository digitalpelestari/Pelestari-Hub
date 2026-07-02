import { redirect } from "next/navigation";

export default function Page() {
  // Begitu user mengakses localhost:3000, sistem langsung mengalihkan jalur ke halaman login
  redirect("/login");
}