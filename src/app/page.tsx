import { redirect } from "next/navigation";

/** Root simply forwards into the app; middleware handles the auth gate. */
export default function Home() {
  redirect("/today");
}
