import { redirect } from "next/navigation";
import { sanitizeNextPath } from "@/lib/auth";

type SignInPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;
  const nextPath = sanitizeNextPath(typeof params.next === "string" ? params.next : undefined);
  const error = typeof params.error === "string" ? params.error : null;
  const query = new URLSearchParams();
  if (nextPath) query.set("next", nextPath);
  if (error) query.set("error", error);

  redirect(`/login${query.size ? `?${query.toString()}` : ""}`);
}
