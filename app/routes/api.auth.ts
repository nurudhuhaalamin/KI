import { buatAuth } from "~/lib/auth/server";
import { cloudflareContext } from "~/lib/context";

import type { Route } from "./+types/api.auth";

/** Seluruh endpoint Better Auth (/api/auth/*) diteruskan ke handler-nya. */
export function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  return buatAuth(env, request).handler(request);
}

export function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  return buatAuth(env, request).handler(request);
}
