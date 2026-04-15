import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const { data: client } = await supabase
    .from("clients")
    .select("name, brand_color, active")
    .eq("slug", slug)
    .single();

  if (!client || !client.active) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const color = client.brand_color || "#1e3a8a";
  const shortName = client.name.length > 12 ? client.name.split(" ")[0] : client.name;

  return NextResponse.json(
    {
      name: `${client.name} Intake`,
      short_name: shortName,
      description: `Send review requests for ${client.name}`,
      start_url: `/intake/${slug}`,
      scope: `/intake/${slug}`,
      display: "standalone",
      orientation: "portrait",
      theme_color: color,
      background_color: "#000000",
      icons: [
        {
          src: `/intake/${slug}/icon?size=192`,
          sizes: "192x192",
          type: "image/png",
          purpose: "any maskable",
        },
        {
          src: `/intake/${slug}/icon?size=512`,
          sizes: "512x512",
          type: "image/png",
          purpose: "any maskable",
        },
      ],
    },
    {
      headers: {
        "Content-Type": "application/manifest+json",
        "Cache-Control": "public, max-age=300",
      },
    }
  );
}
