import { NextRequest, NextResponse } from "next/server";
import { scrapeBrand } from "@/lib/brand-scraper";
import { supabase } from "@/lib/supabase";
import { timingSafeEqual } from "crypto";

export async function POST(request: NextRequest) {
  // Admin auth check
  const authHeader = request.headers.get("authorization");
  const expectedAuth = `Basic ${Buffer.from(
    `${process.env.ADMIN_USERNAME}:${process.env.ADMIN_PASSWORD}`
  ).toString("base64")}`;

  if (
    !authHeader ||
    !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expectedAuth))
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { url?: string; client_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.url) {
    return NextResponse.json({ error: "URL required" }, { status: 400 });
  }

  // Scrape the website
  const brand = await scrapeBrand(body.url);

  // If a client_id is provided, update the client record
  if (body.client_id && (brand.logoUrl || brand.brandColor)) {
    const updates: Record<string, string> = {};
    if (brand.logoUrl) updates.logo_url = brand.logoUrl;
    if (brand.brandColor) updates.brand_color = brand.brandColor;

    await supabase
      .from("clients")
      .update(updates)
      .eq("id", body.client_id);
  }

  return NextResponse.json(brand);
}
