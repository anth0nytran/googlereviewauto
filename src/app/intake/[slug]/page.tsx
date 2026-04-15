import type { Metadata, Viewport } from "next";
import { supabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import IntakeForm from "./intake-form";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { data: client } = await supabase
    .from("clients")
    .select("name, brand_color, active")
    .eq("slug", slug)
    .single();

  if (!client || !client.active) {
    return { title: "Not found" };
  }

  return {
    title: `${client.name} Intake`,
    manifest: `/intake/${slug}/manifest.webmanifest`,
    appleWebApp: {
      capable: true,
      title: client.name,
      statusBarStyle: "black-translucent",
    },
    icons: {
      icon: [
        { url: `/intake/${slug}/icon?size=192`, sizes: "192x192", type: "image/png" },
        { url: `/intake/${slug}/icon?size=512`, sizes: "512x512", type: "image/png" },
      ],
      apple: [
        { url: `/intake/${slug}/icon?size=192`, sizes: "192x192" },
        { url: `/intake/${slug}/icon?size=512`, sizes: "512x512" },
      ],
    },
  };
}

export async function generateViewport({ params }: Props): Promise<Viewport> {
  const { slug } = await params;
  const { data: client } = await supabase
    .from("clients")
    .select("brand_color, active")
    .eq("slug", slug)
    .single();

  return {
    themeColor: client?.active ? client.brand_color || "#000000" : "#000000",
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  };
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
