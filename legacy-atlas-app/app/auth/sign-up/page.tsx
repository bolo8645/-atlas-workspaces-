import { redirect } from "next/navigation";
import { sanitizeNextPath } from "@/lib/auth";

type SignUpPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const params = await searchParams;
  const nextPath = sanitizeNextPath(typeof params.next === "string" ? params.next : undefined);
  const query = new URLSearchParams();
  if (nextPath) query.set("next", nextPath);

  redirect(`/signup${query.size ? `?${query.toString()}` : ""}`);
}
