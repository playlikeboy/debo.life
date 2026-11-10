"use client";

import "@copilotkit/react-core/v2/styles.css";
import { CopilotChat, CopilotKitProvider, defineToolCallRenderer } from "@copilotkit/react-core/v2";
import { z } from "zod";

// Must match SOURCES_TOOL and the agent id in lib/copilot-agent.ts and the route.
const SOURCES_TOOL = "show_sources";
const AGENT_ID = "debo";

/** Generative UI: the agent's `show_sources` call is drawn as mint source chips. */
const sourcesRenderer = defineToolCallRenderer({
  name: SOURCES_TOOL,
  args: z.object({ sources: z.array(z.object({ id: z.string(), label: z.string() })) }),
  render: ({ args }) => {
    const sources = args.sources ?? [];
    if (sources.length === 0) return null;
    return (
      <ul className="mt-2 flex flex-wrap gap-2" aria-label="Where this answer came from">
        {sources.map((source) =>
          source?.id && source.label ? (
            <li key={source.id}>
              <a href={`/home#entry-${source.id}`} className="chip no-underline">
                {source.label}
              </a>
            </li>
          ) : null,
        )}
      </ul>
    );
  },
});

/** Debo's look for CopilotKit's chat: ink on paper, our fonts, 16px text. */
const theme = `
.debo-chat [data-copilotkit], .debo-chat .copilotKitChat {
  font-family: var(--font-body);
  font-size: 1rem;
  color: var(--color-ink);
  --cpk-text-sm: 1rem;
  --cpk-text-xs: 1rem;
  --cpk-color-black: var(--color-ink);
  --cpk-color-zinc-900: var(--color-ink);
  --cpk-color-zinc-800: var(--color-ink);
}
.debo-chat textarea:focus-visible, .debo-chat button:focus-visible {
  outline: 3px solid var(--color-ink);
  outline-offset: 3px;
}
`;

export function DeboChat() {
  return (
    <div className="debo-chat h-[70dvh] min-h-[28rem] overflow-hidden rounded-[24px] border-2 border-ink bg-paper">
      <style>{theme}</style>
      <CopilotKitProvider runtimeUrl="/api/copilotkit" renderToolCalls={[sourcesRenderer]} showDevConsole={false} enableInspector={false}>
        <CopilotChat
          agentId={AGENT_ID}
          className="h-full"
          labels={{
            modalHeaderTitle: "Chat with Debo",
            welcomeMessageText:
              "Ask me about your entries. I only answer from what you wrote, and I show where it came from.",
            chatInputPlaceholder: "When did I last see Riya?",
            chatInputToolbarSendButtonLabel: "Ask Debo",
            chatDisclaimerText: "Debo is an AI assistant, not a person. It only uses your own entries.",
          }}
        />
      </CopilotKitProvider>
    </div>
  );
}
