export type OutputFormat = "json" | "markdown" | "text";

export interface GlobalFlags {
  format: OutputFormat;
  stdout: boolean;
  maxLength: number;
  timeoutMs: number;
}

export interface SearchRequest {
  query: string;
  site?: string[];
  limit: number;
  freshness?: "day" | "week" | "month" | "year";
  language?: string;
  region?: string;
}

export interface FetchRequest {
  urls: string[];
  selector?: string;
  waitUntil?: "load" | "domcontentloaded" | "networkidle";
  screenshot?: boolean;
}

export interface AnswerRequest {
  query: string;
  noRedirect?: boolean;
  noHtml?: boolean;
  skipDisambig?: boolean;
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

