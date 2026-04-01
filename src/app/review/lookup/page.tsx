import { supabase } from "@/lib/supabase";
import { redirect, notFound } from "next/navigation";

interface Props {
  searchParams: Promise<{ domain?: string; t?: string }>;
}

/**
 * Custom domain lookup page.
 * Middleware rewrites custom domain root "/" to "/review/lookup?domain=hostname".
 * This page looks up the client by custom_domain and redirects to their review page.
 */
export default async function LookupPage({ searchParams }: Props) {
  const { domain, t: token } = await searchParams;

  if (!domain) notFound();

  const { data: client } = await supabase
    .from("clients")
    .select("slug")
    .eq("custom_domain", domain)
    .eq("active", true)
    .single();

  if (!client) notFound();

  const target = token
    ? `/review/${client.slug}?t=${encodeURIComponent(token)}`
    : `/review/${client.slug}`;

  redirect(target);
}
