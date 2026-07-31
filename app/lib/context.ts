import { createContext } from "react-router";

/**
 * Isi konteks Cloudflare yang tersedia di setiap loader dan action.
 *
 * React Router v8 tidak lagi memakai `AppLoadContext`; konteks diberikan
 * lewat `RouterContextProvider`. Objek ini diisi di `workers/app.ts` dan
 * dibaca dengan `context.get(cloudflareContext)`.
 */
export type CloudflareContext = {
  env: Env;
  ctx: ExecutionContext;
};

export const cloudflareContext = createContext<CloudflareContext>();
