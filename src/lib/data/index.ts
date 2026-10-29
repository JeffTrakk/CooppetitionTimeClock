import "server-only";
import { MemoryRepository } from "./memory/memory-repository";
import type { Repository } from "./repository";
import { SupabaseRepository } from "./supabase/supabase-repository";

let instance: Repository | null = null;

/** The app's data layer. DATA_BACKEND=memory (default) | supabase. */
export function repo(): Repository {
  if (!instance) {
    instance = process.env.DATA_BACKEND === "supabase" ? new SupabaseRepository() : new MemoryRepository();
  }
  return instance;
}

export type { Repository } from "./repository";
