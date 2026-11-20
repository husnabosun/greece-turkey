import { notFound } from "next/navigation";

/** Catch-all so unknown locale routes use `[locale]/not-found.tsx` instead of the English Next default. */
export default function CatchAll() {
  notFound();
}
