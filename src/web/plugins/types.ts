import type { PluginHost } from "../../core";

/**
 * Contract shared by ALL provider plugins — the shipped built-ins and external
 * plugins under `~/.web/plugins/<id>/` are the same thing: an id plus an
 * `activate(host)` that registers provider factories on the host.
 */
export interface WebPlugin {
  id: string;
  version?: string;
  activate(host: PluginHost): void;
}
