/**
 * web domain request/response types. These live OUTSIDE core (core is generic
 * over <Req, Res>); only the web layer knows the shape of a search/fetch call.
 */

export interface SearchRequest {
  query: string;
  site?: string[];
  limit: number;
  freshness?: "day" | "week" | "month" | "year";
  language?: string;
  country?: string;
  safesearch?: string | number;
  vendorParams?: Record<string, unknown>;
}

export interface FetchRequest {
  urls: string[];
  selector?: string;
  waitUntil?: "load" | "domcontentloaded" | "networkidle";
  vendorParams?: Record<string, unknown>;
}

export interface ResultItem {
  title?: string;
  url?: string;
  content?: string;
  snippet?: string;
  source?: string;
  raw?: unknown;
}

export interface ProviderResponse {
  /** Account alias that produced this (or "a+b" after any future merge). */
  provider: string;
  items: ResultItem[];
  /** Preserved for diagnostics; never rendered to default stdout. */
  raw?: unknown;
}

export type SegmentName = "search" | "fetch";
