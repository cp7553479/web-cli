export type OutputFormat = "json" | "markdown" | "text";

export interface GlobalFlags {
  format: OutputFormat;
  stdout: boolean;
  maxLength: number;
  timeoutMs: number;
}

/** Extension fields for vendor APIs; each provider filters by its allowlist. */
export type VendorParams = Record<string, unknown>;

export interface SearchRequest {
  query: string;
  site?: string[];
  limit: number;
  freshness?: "day" | "week" | "month" | "year";
  language?: string;
  region?: string;
  /** Unified CLI: country / region filter (mapped per provider). */
  country?: string;
  /** Unified CLI: safe search level (mapped per provider). */
  safesearch?: string | number;
  vendorParams?: VendorParams;
}

export interface FetchRequest {
  urls: string[];
  selector?: string;
  waitUntil?: "load" | "domcontentloaded" | "networkidle";
  screenshot?: boolean;
  vendorParams?: VendorParams;
}

export interface AnswerRequest {
  query: string;
  noRedirect?: boolean;
  noHtml?: boolean;
  skipDisambig?: boolean;
  /** Firecrawl interact: page URL to scrape before prompt (official two-step flow). */
  url?: string;
  vendorParams?: VendorParams;
}

export interface ResearchRequest {
  query: string;
  limit: number;
  vendorParams?: VendorParams;
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
  provider: string;
  items: ResultItem[];
  raw?: unknown;
}

import type { FileLogger } from "./logger";

export interface ProviderContext {
  timeoutMs: number;
  fileLogger?: FileLogger;
}

