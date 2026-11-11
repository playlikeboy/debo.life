import { CopilotRuntime, createCopilotRuntimeHandler } from "@copilotkit/runtime/v2";
import { getAuth } from "@/lib/auth/server";
import { AGENT_ID } from "@/lib/chat";
import { createDeboAgent } from "@/lib/copilot-agent";

export const dynamic = "force-dynamic";

// No usage data leaves Debo for CopilotKit's telemetry (AGENTS.md: no
// analytics that send data to a third party). The runtime reads this each time.
process.env.COPILOTKIT_TELEMETRY_DISABLED = "true";

const BASE_PATH = "/api/copilotkit";

/**
 * The CopilotKit runtime endpoint for the chat page, signed-in people only.
 * The agent is built per request for that person, so it can only ever read
 * their own entries.
 */
async function handle(request: Request): Promise<Response> {
  if (request.method !== "GET") {
    // Only accept writes from our own pages, never from another site.
    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(request.url).origin) {
      return Response.json({ error: "This request must come from Debo itself." }, { status: 403 });
    }
  }

  const { data: session } = await getAuth().getSession();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in first, then try again." }, { status: 401 });

  const runtime = new CopilotRuntime({
    agents: { [AGENT_ID]: createDeboAgent(userId) },
    // Scope chat threads to this person. Only the id; CopilotKit needs no name or email.
    identifyUser: () => ({ id: userId, name: userId }),
  });
  return createCopilotRuntimeHandler({ runtime, basePath: BASE_PATH })(request);
}

export const GET = handle;
export const POST = handle;
