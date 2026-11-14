import { Hono } from "hono";
import { z } from "zod";
import type { ConnectorService } from "./service.ts";

/**
 * Signed-in routes. The owner always comes from the session (`c.get("owner")`), never from
 * the request, so one person cannot name another person's connections.
 */
export function connectorRoutes(service: ConnectorService) {
  const app = new Hono<{ Variables: { owner: string } }>();
  app.get("/", async (c) => c.json(await service.overview(c.get("owner"))));
  app.get("/search", async (c) => {
    const q = z.string().trim().max(60).parse(c.req.query("q") ?? "");
    return c.json({ items: await service.search(q) });
  });
  app.post("/:toolkit/connect", async (c) => {
    const body = z
      .object({ to: z.enum(["web", "native"]).optional() })
      .parse(await c.req.json().catch(() => ({})));
    const link = await service.connect(c.get("owner"), c.req.param("toolkit"), body.to);
    return c.json(link, 201);
  });
  app.delete("/:id", async (c) => {
    await service.disconnect(c.get("owner"), c.req.param("id"));
    return c.json({ ok: true });
  });
  return app;
}

const PAGES = {
  success: {
    title: "Your app is connected",
    text: "You can close this tab and go back to Debo. Your new app will be there.",
  },
  failed: {
    title: "That did not finish",
    text: "Nothing was connected. Go back to Debo and try again. If the link ran out, start a new one.",
  },
} as const;

/**
 * The page the provider sends people to after they sign in to an app. It is public, shows
 * only fixed words, and changes nothing. The only thing it reads from the request is whether
 * the status says success. (In the sample workspace it also finishes the practice connection.)
 */
export function connectorCallbackRoute(options: {
  appUrl: string;
  sampleComplete?: (accountId: string) => void;
}) {
  const app = new Hono();
  app.get("/", (c) => {
    const ok = c.req.query("status") === "success";
    const accountId = c.req.query("connected_account_id");
    if (ok && accountId && options.sampleComplete) options.sampleComplete(accountId);
    const page = PAGES[ok ? "success" : "failed"];
    if (c.req.query("to") === "native")
      return c.redirect(`debo://connectors?status=${ok ? "success" : "failed"}`, 302);
    c.header("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'");
    return c.html(
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${page.title}</title><style>body{font:16px/1.5 system-ui,sans-serif;max-width:30rem;margin:12vh auto;padding:0 1.25rem;color:#1c1b1f}a{display:inline-block;margin-top:1rem;padding:.75rem 1.25rem;border-radius:.75rem;background:#1c1b1f;color:#fff;text-decoration:none}</style></head><body><h1>${page.title}</h1><p>${page.text}</p><a href="${options.appUrl}">Back to Debo</a></body></html>`,
      ok ? 200 : 400,
    );
  });
  return app;
}
