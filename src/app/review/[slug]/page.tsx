import { supabase } from "@/lib/supabase";
import { verifyReviewToken } from "@/lib/tokens";
import { notFound } from "next/navigation";
import ReviewPage from "./review-page";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ t?: string }>;
}

export default async function Page({ params, searchParams }: Props) {
  const { slug } = await params;
  const { t: token } = await searchParams;

  // Look up client
  const { data: client } = await supabase
    .from("clients")
    .select("id, name, slug, google_review_url, logo_url, brand_color, active")
    .eq("slug", slug)
    .single();

  if (!client || !client.active) notFound();

  // Verify token if provided
  let contactId: string | null = null;
  let clientId: string | null = null;
  let hasVerifiedToken = false;
  if (token) {
    const verified = verifyReviewToken(token);
    if (verified && verified.clientId === client.id) {
      contactId = verified.contactId;
      clientId = verified.clientId;
      hasVerifiedToken = true;
    }
  }

  return (
    <ReviewPage
      client={client}
      contactId={contactId}
      clientId={clientId}
      hasVerifiedToken={hasVerifiedToken}
      token={hasVerifiedToken ? token || null : null}
      tokenWasProvided={Boolean(token)}
    />
  );
}
