// "Connect your apps" on the Apps screen, and the chat cards for connected-app tool calls.
// Debo reaches these apps through Composio. The person signs in on the app's own page, and
// Debo never sees the password. Colours and sizes come from ui.tsx tokens only.
import { Link2, Search, ShieldCheck } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Platform, Text, View } from "react-native";
import {
  type AppConnection,
  type AppItem,
  appFromToolName,
  connectionsBySlug,
  type ConnectorsOverview,
  disconnectApp,
  loadConnectors,
  readConnectorTool,
  searchApps,
  startConnect,
} from "./connectors-data";
import { dropSignInWindow, openSignInPage, reserveSignInWindow } from "./open-connect-link";
import { Button, Card, Chip, colors, ErrorNotice, fontSize, s, spacing } from "./ui";
import { useWorkspace } from "./workspace";

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));
const POLL_MS = 3000;

export function ConnectAppsSection({ query }: { query: string }) {
  const { api, notify } = useWorkspace();
  const [overview, setOverview] = useState<ConnectorsOverview>();
  const [error, setError] = useState("");
  const [found, setFound] = useState<AppItem[] | undefined>();
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState<string>();
  const [confirming, setConfirming] = useState<string>();
  const [watching, setWatching] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const next = await loadConnectors(api);
      if (alive.current) {
        setOverview(next);
        setError("");
      }
      return next;
    } catch (e) {
      if (alive.current) setError(errorText(e));
      return undefined;
    }
  }, [api]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Come back to the app after signing in: check again when it is visible, and while a sign-in
  // is open, every few seconds, for up to five minutes.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => sub.remove();
  }, [refresh]);
  useEffect(() => {
    if (!watching) return;
    const started = Date.now();
    const timer = setInterval(() => {
      void refresh().then((next) => {
        const waiting = next?.connections.some((c) => c.state === "waiting");
        if (!waiting || Date.now() - started > 5 * 60_000) setWatching(false);
      });
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [watching, refresh]);

  // One search box for the whole screen. Words narrow the first list at once, and also look
  // through every app Debo can reach.
  const text = query.trim();
  useEffect(() => {
    if (text.length < 2 || !overview?.configured) {
      setFound(undefined);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      searchApps(api, text)
        .then((items) => alive.current && setFound(items))
        .catch((e) => alive.current && setError(errorText(e)))
        .finally(() => alive.current && setSearching(false));
    }, 350);
    return () => clearTimeout(timer);
  }, [text, api, overview?.configured]);

  async function connect(item: { slug: string; name: string }) {
    setError("");
    const reserved = reserveSignInWindow();
    setBusy(item.slug);
    try {
      const link = await startConnect(api, item.slug, Platform.OS === "web" ? "web" : "native");
      setWatching(true);
      await refresh();
      await openSignInPage(link.url, reserved);
      notify(`Sign in to ${item.name} on the page that opened, then come back here.`);
      await refresh();
    } catch (e) {
      dropSignInWindow(reserved);
      setError(errorText(e));
      await refresh();
    } finally {
      if (alive.current) setBusy(undefined);
    }
  }
  async function disconnect(connection: AppConnection) {
    setBusy(connection.toolkit);
    setError("");
    try {
      await disconnectApp(api, connection.id);
      setConfirming(undefined);
      notify(`${connection.name} is disconnected.`);
      await refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      if (alive.current) setBusy(undefined);
    }
  }

  if (!overview && !error)
    return (
      <View style={[s.row, { gap: spacing[3] }]} accessibilityLabel="Loading your apps">
        <ActivityIndicator size="small" color={colors.blueDark} />
        <Text style={s.muted}>Loading apps…</Text>
      </View>
    );
  if (overview && !overview.configured)
    return (
      <View style={{ gap: spacing[3] }}>
        <Text style={s.heading}>Connect your apps</Text>
        <Card style={{ backgroundColor: colors.subtle, gap: spacing[2] }}>
          <Text style={s.text}>{overview.message ?? "Connecting apps is not set up yet."}</Text>
          <Text style={s.small}>Whoever runs this Debo needs to turn it on. Nothing else is affected.</Text>
        </Card>
      </View>
    );

  const connections = connectionsBySlug(overview?.connections ?? []);
  const words = text.toLowerCase();
  const curated = (overview?.curated ?? []).filter(
    (item) => !words || `${item.name} ${item.slug}`.toLowerCase().includes(words),
  );
  // Apps found by search that the first list does not already show.
  const shown = new Set(curated.map((item) => item.slug));
  const more = (found ?? []).filter((item) => !shown.has(item.slug));
  // Connected apps that are in neither list still deserve a row, so they can be disconnected.
  const known = new Set([...shown, ...more.map((item) => item.slug)]);
  const extra = [...connections.values()].filter(
    (c) => !known.has(c.toolkit) && (!words || c.name.toLowerCase().includes(words)),
  );

  const row = (item: AppItem | { slug: string; name: string; blurb: string; connectable: boolean }) => (
    <AppRow
      key={item.slug}
      item={item}
      connection={connections.get(item.slug)}
      busy={busy === item.slug}
      confirming={confirming === connections.get(item.slug)?.id}
      onConnect={() => void connect(item)}
      onAskDisconnect={(id) => setConfirming(id)}
      onKeep={() => setConfirming(undefined)}
      onDisconnect={(c) => void disconnect(c)}
    />
  );

  return (
    <View style={{ gap: spacing[3] }} accessibilityLabel="Connect your apps">
      <Text style={s.heading}>Connect your apps</Text>
      <Text style={s.muted}>
        Debo can use these apps for you. You sign in on the app’s own page, so Debo never sees your
        password. Looking things up is free. Anything that sends, posts or changes something waits
        for your yes.
      </Text>
      <ErrorNotice error={error} />
      <View style={{ gap: spacing[2] }}>
        {extra.map((c) =>
          row({
            slug: c.toolkit,
            name: c.name,
            blurb: "Connected. Debo can look things up here.",
            connectable: true,
          }),
        )}
        {curated.map((item) => row(item))}
        {!curated.length && !more.length && !extra.length && !searching && (
          <Text style={s.muted}>
            {text ? `No app matches “${text}”.` : "No apps to show yet."}
          </Text>
        )}
      </View>
      {text.length >= 2 && (
        <View style={{ gap: spacing[2] }}>
          <View style={[s.row, { gap: spacing[2] }]}>
            <Search size={16} color={colors.muted} />
            <Text style={s.small}>
              {searching ? "Searching every app…" : more.length ? "More apps" : "No other apps found"}
            </Text>
          </View>
          {more.map((item) => row(item))}
        </View>
      )}
    </View>
  );
}

function AppRow({
  item,
  connection,
  busy,
  confirming,
  onConnect,
  onAskDisconnect,
  onKeep,
  onDisconnect,
}: {
  item: { slug: string; name: string; blurb: string; connectable: boolean };
  connection?: AppConnection;
  busy: boolean;
  confirming: boolean;
  onConnect: () => void;
  onAskDisconnect: (id: string) => void;
  onKeep: () => void;
  onDisconnect: (connection: AppConnection) => void;
}) {
  const state = connection?.state;
  return (
    <Card style={{ gap: spacing[3], padding: spacing[4] }}>
      <View style={[s.row, { gap: spacing[3], alignItems: "flex-start" }]}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[s.iconBox, { backgroundColor: colors.subtle }]}
        >
          <Text style={[s.heading, { color: colors.blueDark }]}>{item.name.slice(0, 1)}</Text>
        </View>
        <View style={{ flex: 1, gap: spacing[1] }}>
          <View style={[s.row, { gap: spacing[2], flexWrap: "wrap" }]}>
            <Text style={[s.text, { fontWeight: "600" }]}>{item.name}</Text>
            {state === "connected" && <Chip tint={colors.green}>Connected</Chip>}
          </View>
          <Text style={s.small}>{item.blurb}</Text>
          {connection && state !== "connected" && (
            <Text
              style={[
                s.small,
                { color: state === "waiting" ? colors.muted : colors.danger, fontSize: fontSize.supporting },
              ]}
            >
              {connection.statusText}
            </Text>
          )}
          {!item.connectable && !connection && (
            <Text style={s.small}>Not available yet. Whoever runs this Debo needs to set it up.</Text>
          )}
        </View>
      </View>
      {confirming && connection ? (
        <View accessibilityRole="alert" style={{ gap: spacing[2] }}>
          <Text style={s.text}>
            Disconnect {connection.name}? Debo will stop using it, and the sign-in held for Debo is
            deleted. You can connect it again any time.
          </Text>
          <View style={[s.row, { gap: spacing[2], flexWrap: "wrap" }]}>
            <Button danger busy={busy} onPress={() => onDisconnect(connection)}>
              {`Yes, disconnect ${connection.name}`}
            </Button>
            <Button disabled={busy} onPress={onKeep}>
              Keep it connected
            </Button>
          </View>
        </View>
      ) : (
        <View style={[s.row, { gap: spacing[2], flexWrap: "wrap" }]}>
          {state === "connected" && connection ? (
            <Button small danger disabled={busy} onPress={() => onAskDisconnect(connection.id)}>
              {`Disconnect ${item.name}`}
            </Button>
          ) : state === "waiting" && connection ? (
            <>
              <Button small primary icon={Link2} busy={busy} onPress={onConnect}>
                {`Open ${item.name} sign-in again`}
              </Button>
              <Button small disabled={busy} onPress={() => onDisconnect(connection)}>
                Cancel
              </Button>
            </>
          ) : item.connectable ? (
            <Button small primary icon={Link2} busy={busy} onPress={onConnect}>
              {state ? `Connect ${item.name} again` : `Connect ${item.name}`}
            </Button>
          ) : null}
        </View>
      )}
    </Card>
  );
}

/**
 * The chat card for connected-app tools. It says which app was used, in plain words. A change
 * shows that it is waiting for the person's yes, with a button that opens the exact review.
 */
export function ConnectorToolCard({
  name,
  args,
  result,
  loading,
}: {
  name: "find_app_tools" | "use_app_tool";
  args: unknown;
  result: unknown;
  loading: boolean;
}) {
  const { workspace, open, refresh, notify } = useWorkspace();
  const view = loading ? undefined : readConnectorTool(name, result);
  const tool = (args as { tool?: unknown } | undefined)?.tool;
  const guess = appFromToolName(tool) ?? "your apps";
  const label = loading
    ? name === "find_app_tools"
      ? "Looking for the right tool…"
      : `Checking ${guess}…`
    : view?.kind === "found"
      ? `Looked for tools in ${view.apps.join(", ")}`
      : view?.kind === "read"
        ? `Looked in ${view.app}`
        : view?.kind === "review"
          ? `Asked to ${view.title.charAt(0).toLowerCase()}${view.title.slice(1)}: waiting for your yes`
          : view?.kind === "none"
            ? "No apps to use yet"
            : "Your apps";
  return (
    <Card
      style={{ padding: spacing[4], gap: spacing[3], backgroundColor: colors.subtle, maxWidth: 440, width: "100%" }}
    >
      <View style={[s.row, { gap: spacing[3] }]}>
        {loading ? (
          <ActivityIndicator size="small" color={colors.blueDark} />
        ) : view?.kind === "review" ? (
          <ShieldCheck size={18} color={colors.blueDark} />
        ) : (
          <Link2 size={18} color={colors.blueDark} />
        )}
        <Text style={[s.text, { flex: 1 }]}>{label}</Text>
      </View>
      {view?.kind === "error" && <ErrorNotice error={view.message} />}
      {view?.kind === "none" && <Text style={s.muted}>{view.message}</Text>}
      {view?.kind === "unreadable" && (
        <ErrorNotice error="I couldn't read that result. Ask again in a moment." />
      )}
      {view?.kind === "review" && (
        <>
          <Text style={s.muted}>Nothing has happened in {view.app} yet.</Text>
          <Button
            small
            primary
            onPress={() => {
              const action = workspace.actions.find((a) => a.id === view.actionId);
              if (action) return open({ type: "review", action });
              void refresh().then(() =>
                notify("It is ready. Open the bell at the top to review it."),
              );
            }}
          >
            {`Review before it goes to ${view.app}`}
          </Button>
        </>
      )}
    </Card>
  );
}

