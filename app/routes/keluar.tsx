import { redirect } from "react-router";

import { buatAuth } from "~/lib/auth/server";
import { cloudflareContext } from "~/lib/context";

import type { Route } from "./+types/keluar";

/** Keluar hanya boleh lewat POST, agar tidak bisa dipicu tautan dari luar. */
export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const auth = buatAuth(env, request);

  const headers = new Headers();
  try {
    const respons = await auth.api.signOut({ headers: request.headers, asResponse: true });
    for (const cookie of respons.headers.getSetCookie()) {
      headers.append("Set-Cookie", cookie);
    }
  } catch {
    // Sesi mungkin sudah kedaluwarsa. Tetap arahkan ke beranda.
  }

  return redirect("/", { headers });
}

export function loader() {
  return redirect("/");
}
