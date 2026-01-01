import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function normalizeUrl(url: string | undefined | null): string {
  if (!url) return "";
  try {
    // Handle cases where URL might not have protocol (though matched_at usually does)
    const hasProtocol = url.match(/^https?:\/\//);
    const urlToParse = hasProtocol ? url : `http://${url}`;

    const parsed = new URL(urlToParse);
    // Stripping protocol (http/https treated same)
    // Stripping trailing slash
    // Stripping default ports
    const host = parsed.hostname;
    const port = parsed.port && !['80', '443'].includes(parsed.port) ? `:${parsed.port}` : '';
    const path = parsed.pathname.replace(/\/$/, "");
    const search = parsed.search; // Keep query params, they matter for XSS/SQLi contexts

    return `${host}${port}${path}${search}`;
  } catch (e) {
    // If invalid URL, return strict lowercased version as fallback
    return url.toLowerCase().replace(/\/$/, "");
  }
}
