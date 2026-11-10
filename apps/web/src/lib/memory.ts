import "server-only";
import { createMemory, type MemoryStore } from "@debo/memory";
import { serverEnv } from "@/lib/server-env";

/**
 * What Debo knows (Mem0, through @debo/memory), or null when MEM0_API_KEY is
 * not set. Then memory is simply off: entries, search and answers still work.
 */
export function memoryStore(): MemoryStore | null {
  return createMemory(serverEnv());
}
