import * as cheerio from "cheerio";

interface BrandInfo {
  logoUrl: string | null;
  brandColor: string | null;
  favicon: string | null;
}

/**
 * Scrape a website for branding: logo, primary color, favicon.
 * Used during client onboarding to auto-populate brand fields.
 */
export async function scrapeBrand(websiteUrl: string): Promise<BrandInfo> {
  const result: BrandInfo = {
    logoUrl: null,
    brandColor: null,
    favicon: null,
  };

  try {
    const baseUrl = new URL(websiteUrl);
    const origin = baseUrl.origin;

    const res = await fetch(websiteUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; BrandScraper/1.0; +https://quicklaunchweb.com)",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return result;

    const html = await res.text();
    const $ = cheerio.load(html);

    // --- LOGO ---
    // Priority: og:image > logo in header/nav > img with "logo" in src/alt/class
    const ogImage = $('meta[property="og:image"]').attr("content");
    if (ogImage) {
      result.logoUrl = resolveUrl(ogImage, origin);
    }

    if (!result.logoUrl) {
      const logoSelectors = [
        'header img[src*="logo" i]',
        'nav img[src*="logo" i]',
        'img[alt*="logo" i]',
        'img[class*="logo" i]',
        'img[id*="logo" i]',
        ".logo img",
        "#logo img",
        '[class*="brand"] img',
        "header img:first-of-type",
      ];

      for (const selector of logoSelectors) {
        const el = $(selector).first();
        const src = el.attr("src") || el.attr("data-src");
        if (src) {
          result.logoUrl = resolveUrl(src, origin);
          break;
        }
      }
    }

    // --- FAVICON ---
    const faviconSelectors = [
      'link[rel="icon"]',
      'link[rel="shortcut icon"]',
      'link[rel="apple-touch-icon"]',
      'link[rel="apple-touch-icon-precomposed"]',
    ];

    for (const selector of faviconSelectors) {
      const href = $(selector).first().attr("href");
      if (href) {
        result.favicon = resolveUrl(href, origin);
        break;
      }
    }

    // Use favicon as logo fallback
    if (!result.logoUrl && result.favicon) {
      result.logoUrl = result.favicon;
    }

    // --- BRAND COLOR ---
    // Priority: theme-color meta > msapplication-TileColor > CSS custom properties > most common color

    const themeColor = $('meta[name="theme-color"]').attr("content");
    if (themeColor && isValidColor(themeColor)) {
      result.brandColor = normalizeColor(themeColor);
    }

    if (!result.brandColor) {
      const tileColor = $('meta[name="msapplication-TileColor"]').attr(
        "content"
      );
      if (tileColor && isValidColor(tileColor)) {
        result.brandColor = normalizeColor(tileColor);
      }
    }

    // Try to extract from inline styles / CSS
    if (!result.brandColor) {
      const colorFromCSS = extractColorFromStyles($, html);
      if (colorFromCSS) {
        result.brandColor = colorFromCSS;
      }
    }
  } catch (err) {
    console.error("Brand scrape error:", err);
  }

  return result;
}

function resolveUrl(url: string, origin: string): string {
  if (url.startsWith("http")) return url;
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("/")) return `${origin}${url}`;
  return `${origin}/${url}`;
}

function isValidColor(color: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color.trim());
}

function normalizeColor(color: string): string {
  const c = color.trim();
  // Expand shorthand hex (#RGB -> #RRGGBB)
  if (/^#[0-9a-fA-F]{3}$/.test(c)) {
    return `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`.toUpperCase();
  }
  return c.toUpperCase();
}

/**
 * Try to find the primary brand color from CSS variables or common patterns.
 */
function extractColorFromStyles(
  $: cheerio.CheerioAPI,
  html: string
): string | null {
  // Look for CSS custom properties like --primary, --brand, --accent
  const cssVarPatterns = [
    /--(?:primary|brand|main|accent)(?:-color)?:\s*(#[0-9a-fA-F]{3,6})/i,
    /--(?:color-primary|theme-primary|site-color):\s*(#[0-9a-fA-F]{3,6})/i,
  ];

  for (const pattern of cssVarPatterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      return normalizeColor(match[1]);
    }
  }

  // Look for background-color on header/nav
  const headerStyle =
    $("header").attr("style") || $("nav").attr("style") || "";
  const bgMatch = headerStyle.match(
    /background(?:-color)?:\s*(#[0-9a-fA-F]{3,6})/i
  );
  if (bgMatch && bgMatch[1]) {
    return normalizeColor(bgMatch[1]);
  }

  return null;
}
