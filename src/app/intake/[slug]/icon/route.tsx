import { ImageResponse } from "next/og";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

function getInitials(name: string): string {
  const tokens = name.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return "?";
  if (tokens.length === 1) return tokens[0].slice(0, 2).toUpperCase();
  return (tokens[0][0] + tokens[1][0]).toUpperCase();
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const url = new URL(request.url);
  const rawSize = parseInt(url.searchParams.get("size") || "192", 10);
  const size = rawSize === 512 ? 512 : 192;

  const { data: client } = await supabase
    .from("clients")
    .select("name, brand_color, active")
    .eq("slug", slug)
    .single();

  if (!client || !client.active) {
    return new Response("Not found", { status: 404 });
  }

  const color = client.brand_color || "#1e3a8a";
  const initials = getInitials(client.name);
  const fontSize = size === 512 ? 220 : 84;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: color,
          color: "white",
          fontWeight: 700,
          fontSize,
          letterSpacing: "-0.04em",
        }}
      >
        {initials}
      </div>
    ),
    {
      width: size,
      height: size,
      headers: {
        "Cache-Control": "public, max-age=86400, immutable",
      },
    }
  );
}
