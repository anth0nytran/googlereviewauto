import { supabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import IntakeForm from "./intake-form";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function Page({ params }: Props) {
  const { slug } = await params;

  const { data: client } = await supabase
    .from("clients")
    .select("id, name, slug, logo_url, brand_color, active")
    .eq("slug", slug)
    .single();

  if (!client || !client.active) notFound();

  return (
    <IntakeForm
      client={{
        name: client.name,
        slug: client.slug,
        logo_url: client.logo_url,
        brand_color: client.brand_color,
      }}
    />
  );
}
