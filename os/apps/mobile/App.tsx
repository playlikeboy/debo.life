import { CopilotKitProvider } from "@copilotkit/react-native/headless";
import { StatusBar } from "expo-status-bar";
import {
  Bell,
  BookOpen,
  Brain,
  Check,
  type LucideIcon,
  Menu,
  MessageCircle,
  PanelsTopLeft,
  Shapes,
  X,
} from "lucide-react-native";
import { createElement, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import type { Section, Workspace } from "../../packages/domain/src";
import {
  AgentActivityScreen,
  AgentStatus,
  AppsScreen,
  GoalsScreen,
  IdeasScreen,
} from "./src/agent-ui";
import { AgentWorkspaceProvider, useAgentWorkspace } from "./src/agent-workspace";
import { API_URL, createSession, FuseApi } from "./src/api";
import { ChatScreen, WorkspaceTools } from "./src/chat";
import { DeboFaceGallery } from "./src/debo-face-gallery";
import { useTaskMood } from "./src/debo-mood-hooks";
import { deboMood } from "./src/debo-mood-store";
import { PersonaSetting } from "./src/debo-persona-setting";
import { ReactionsSetting } from "./src/debo-reactions-setting";
import { TalkPopup } from "./src/debo-talk";
import { ComputerEntry } from "./src/computer";
import { ComputerDraftProvider } from "./src/computer-drafts";
import { JournalScreen } from "./src/debo-journal";
import { KnowsScreen } from "./src/debo-knows";
import { Details } from "./src/details";
import { BrowserScreen, CalendarScreen, FilesScreen, MailScreen } from "./src/screens";
import { AccountCard, NeonGate, useAuthInfo } from "./src/neon-gate";
import { ThreadsProvider, ThreadsSheet, useFuseThread } from "./src/threads";
import {
  Button,
  Card,
  colors,
  ErrorNotice,
  Field,
  fontSize,
  IconButton,
  Mascot,
  radius,
  s,
  shadow,
} from "./src/ui";
import { entryFocus } from "./src/debo-data";
import { canonicalSection, parsePath, pathFor, pathFromUrl, type Route, type RouteParams, titleFor } from "./src/routes";
import { type Detail, useWorkspace, WorkspaceContext } from "./src/workspace";

const nav: { id: Section; label: string; icon: LucideIcon }[] = [
  { id: "chat", label: "Chat", icon: MessageCircle },
  { id: "journal", label: "Journal", icon: BookOpen },
  { id: "knows", label: "What Debo knows", icon: Brain },
  { id: "activity", label: "Tasks", icon: PanelsTopLeft },
  { id: "apps", label: "Apps", icon: Shapes },
];
const titles: Partial<Record<Section, { title: string; subtitle: string }>> = {
  talk: { title: "Talk to Debo", subtitle: "Say it out loud. Debo answers and shows where it came from." },
  activity: { title: "Tasks", subtitle: "Plans, progress, decisions and results." },
  ideas: { title: "Ideas", subtitle: "Useful next steps, grounded in your world." },
  goals: {
    title: "Goals",
    subtitle: "Longer-term goals and things to keep an eye on.",
  },
  apps: {
    title: "Apps",
    subtitle: "Connections, capabilities and what your agent remembers.",
  },
  connections: { title: "Apps", subtitle: "Connections and capabilities." },
  mail: { title: "Mail", subtitle: "The conversations behind your work." },
  calendar: { title: "Calendar", subtitle: "Time for what matters." },
  browser: { title: "Browser", subtitle: "Your connected browsing sessions." },
  files: { title: "Files", subtitle: "Documents, forms and filled copies." },
  journal: { title: "Your journal", subtitle: "Write about your day. Only you can read it." },
  knows: { title: "What Debo knows", subtitle: "Memories, each with its source." },
};
/** Shown when the address matches no screen. */
function NotFound() {
  const { navigate } = useWorkspace();
  return (
    <View style={{ gap: 16, alignItems: "flex-start" }}>
      <Text accessibilityRole="header" style={[s.title, { fontSize: fontSize["2xl"] }]}>
        That page isn't here
      </Text>
      <Text style={s.muted}>The link may be old or mistyped. Your chat is one tap away.</Text>
      <Button primary onPress={() => navigate("chat")}>
        Go to Chat
      </Button>
    </View>
  );
}
/**
 * Asks the API how people sign in. Neon Auth (one account per person) shows email
 * sign-in. A local or demo install keeps the shared access key screen.
 */
export default function App() {
  const info = useAuthInfo();
  if (!info)
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: colors.canvas, justifyContent: "center" }}>
          <ActivityIndicator color={colors.blueDark} accessibilityLabel="Opening Debo" />
        </View>
      </SafeAreaProvider>
    );
  if (info.mode === "neon" && info.neonAuthUrl)
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <NeonGate baseUrl={info.neonAuthUrl}>
          {(token, sessionKey) => (
            <CopilotKitProvider
              runtimeUrl={`${API_URL}/api/copilotkit`}
              headers={{ Authorization: `Bearer ${token}` }}
            >
              <WorkspaceApp token={token} sessionKey={sessionKey} />
            </CopilotKitProvider>
          )}
        </NeonGate>
      </SafeAreaProvider>
    );
  return <AccessKeyApp />;
}
function AccessKeyApp() {
  // A developer gallery of Debo's face, on a local sample install only: /?face=gallery
  const gallery = Platform.OS === "web" && globalThis.location?.search.includes("face=gallery");
  const [token, setToken] = useState("");
  const [accessKey, setAccessKey] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const connect = useCallback(async (key?: string) => {
    setBusy(true);
    setError("");
    try {
      const session = await createSession(key);
      setToken(session.token);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    if (!gallery) void connect();
  }, [connect, gallery]);
  if (gallery)
    return (
      <SafeAreaProvider>
        <DeboFaceGallery />
      </SafeAreaProvider>
    );
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {token ? (
        <CopilotKitProvider
          runtimeUrl={`${API_URL}/api/copilotkit`}
          headers={{ Authorization: `Bearer ${token}` }}
        >
          <WorkspaceApp token={token} />
        </CopilotKitProvider>
      ) : (
        <SafeAreaView
          style={{
            flex: 1,
            backgroundColor: colors.canvas,
            justifyContent: "center",
            alignItems: "center",
            padding: 24,
          }}
        >
          <View style={{ width: "100%", maxWidth: 420, gap: 22, alignItems: "center" }}>
            <Mascot size={72} />
            <Text
              style={{
                fontSize: fontSize["3xl"],
                color: colors.text,
                letterSpacing: -1,
                fontWeight: "500",
              }}
            >
              Welcome to Debo.
            </Text>
            <Text style={[s.muted, { textAlign: "center" }]}>A little room for your day.</Text>
            {busy ? (
              <ActivityIndicator color={colors.blueDark} />
            ) : (
              <Card style={{ width: "100%" }}>
                <ErrorNotice error={error} />
                <Field
                  label="Workspace access key"
                  value={accessKey}
                  onChangeText={setAccessKey}
                  secureTextEntry
                  placeholder="Required for a live workspace"
                />
                <Button primary onPress={() => void connect(accessKey || undefined)}>
                  Open workspace
                </Button>
                <Text style={[s.small, { marginTop: 15 }]}>
                  Local workspaces open without a key. Make sure your Debo server is running at{" "}
                  {API_URL}.
                </Text>
              </Card>
            )}
          </View>
        </SafeAreaView>
      )}
    </SafeAreaProvider>
  );
}
const onWeb = Platform.OS === "web";
/**
 * Where the person is. On the web the address bar is the truth: each move adds a
 * browser history entry, so back, forward and reload work. On the phone the route
 * lives in memory and debo:// links move it. null means "no screen at this address".
 */
function useRouter() {
  const [route, setRoute] = useState<Route | null>(() =>
    onWeb ? parsePath(window.location.pathname) : { section: "chat" },
  );
  useEffect(() => {
    if (onWeb) document.title = titleFor(route);
    if (onWeb && route && window.location.pathname !== pathFor(route.section, route))
      window.history.replaceState(null, "", pathFor(route.section, route));
  }, [route]);
  useEffect(() => {
    if (onWeb) {
      const listener = () => setRoute(parsePath(window.location.pathname));
      window.addEventListener("popstate", listener);
      return () => window.removeEventListener("popstate", listener);
    }
    const apply = (url: string | null) => {
      const next = url ? parsePath(pathFromUrl(url)) : null;
      if (next) setRoute(next);
    };
    void Linking.getInitialURL().then(apply);
    const subscription = Linking.addEventListener("url", (event) => apply(event.url));
    return () => subscription.remove();
  }, []);
  const go = useCallback((section: Section, params?: RouteParams) => {
    const next: Route = { section: canonicalSection(section), ...params };
    const path = pathFor(next.section, params);
    if (onWeb && window.location.pathname !== path) window.history.pushState(null, "", path);
    setRoute(next);
  }, []);
  return { route, go };
}
function WorkspaceApp({ token, sessionKey }: { token: string; sessionKey?: string }) {
  const api = useMemo(() => new FuseApi(token), [token]);
  const [workspace, setWorkspace] = useState<Workspace>();
  const { route, go } = useRouter();
  const section: Section = route?.section ?? "chat";
  const [detail, setDetail] = useState<Detail>();
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [prompt, setPrompt] = useState<{ id: number; text: string }>();
  const refresh = useCallback(async () => {
    const snapshot = await api.request<Workspace>("/api/workspace");
    setWorkspace(snapshot);
    setError("");
  }, [api]);
  useEffect(() => {
    void refresh().catch((e) => setError(String(e)));
  }, [refresh]);
  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh().catch((e) => setError(String(e)));
    });
    return () => listener.remove();
  }, [refresh]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5500);
    return () => clearTimeout(timer);
  }, [toast]);
  const navigate = go;
  // /journal/<entry> opens that entry. Other addresses clear the choice.
  const wantedEntry = route?.section === "journal" ? route.entryId : undefined;
  useEffect(() => {
    if (wantedEntry || entryFocus.get()) entryFocus.set(wantedEntry);
  }, [wantedEntry]);
  const open = useCallback((next: Detail) => setDetail(next), []);
  const close = useCallback(() => setDetail(undefined), []);
  const ask = useCallback((text: string) => {
    setPrompt({ id: Date.now(), text });
    go("chat");
  }, [go]);
  if (!workspace)
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: colors.canvas,
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          gap: 18,
        }}
      >
        <Mascot size={56} />
        {error ? (
          <>
            <ErrorNotice error={error} />
            <Button onPress={() => void refresh().catch((e) => setError(String(e)))}>
              Try again
            </Button>
          </>
        ) : (
          <>
            <ActivityIndicator color={colors.blueDark} />
            <Text style={s.muted}>Opening your workspace…</Text>
          </>
        )}
      </SafeAreaView>
    );
  return (
    <WorkspaceContext.Provider
      value={{ workspace, api, section, route, navigate, refresh, open, close, notify: setToast, ask }}
    >
      <AgentWorkspaceProvider>
        <ComputerDraftProvider key={sessionKey ?? token}>
          <ThreadsProvider>
            <WorkspaceShell
              detail={detail}
              notFound={route === null}
              toast={toast}
              clearToast={() => setToast("")}
              error={error}
              prompt={prompt}
            />
          </ThreadsProvider>
        </ComputerDraftProvider>
      </AgentWorkspaceProvider>
    </WorkspaceContext.Provider>
  );
}
function WorkspaceShell({
  detail,
  notFound,
  toast,
  clearToast,
  error,
  prompt,
}: {
  detail?: Detail;
  notFound: boolean;
  toast: string;
  clearToast: () => void;
  error: string;
  prompt?: { id: number; text: string };
}) {
  const { workspace, section: current, navigate, open } = useWorkspace();
  const { data } = useAgentWorkspace();
  useTaskMood(data?.tasks);
  // Talk is a popup over the last screen, so the screen underneath is the last one that was not Talk.
  const lastScreen = useRef<Section>("chat");
  if (current !== "talk") lastScreen.current = current;
  /** The screen underneath; "none" while the address matches no screen. */
  const section: Section | "none" = notFound
    ? "none"
    : current === "talk"
      ? lastScreen.current
      : current;
  const {
    selection,
    visited,
    mainId,
    loading: threadsLoading,
    error: threadsError,
    retry: retryThreads,
    enabled: richThreads,
  } = useFuseThread();
  const [threadsOpen, setThreadsOpen] = useState(false);
  const { width } = useWindowDimensions();
  const desktop = width >= 900;
  const pending =
    (data?.notifications.filter((n) => !n.read).length || 0) +
    workspace.actions.filter((a) => a.status === "awaiting_review").length;
  const activeTask =
    data?.tasks.find(
      (task) => task.status === "waiting_approval" || task.status === "waiting_input",
    ) || data?.tasks.find((task) => task.status === "running");
  const agentName = data?.identity.name || "Debo";
  const status = activeTask
    ? activeTask.status === "waiting_approval"
      ? `Ready to review · ${activeTask.title}`
      : activeTask.status === "waiting_input"
        ? `Needs your input · ${activeTask.title}`
        : activeTask.plan.find((step) => step.status === "running")?.title || activeTask.title
    : data?.tasks.some((task) => task.status === "queued")
      ? "Picking up your next task…"
      : "Here when you need me";
  const title = section === "none" ? undefined : titles[section] || titles.apps;
  const Screen =
    section === "none"
      ? NotFound
      : section === "mail"
      ? MailScreen
      : section === "calendar"
        ? CalendarScreen
        : section === "browser"
          ? BrowserScreen
          : section === "files"
            ? FilesScreen
            : section === "journal"
              ? JournalScreen
              : section === "knows"
                ? KnowsScreen
                : section === "activity"
              ? AgentActivityScreen
              : section === "ideas"
                ? IdeasScreen
                : section === "goals"
                  ? GoalsScreen
                  : AppsScreen;
  const utility = ["mail", "calendar", "browser", "files", "ideas", "goals"].includes(section);
  return (
    <>
      <WorkspaceTools />
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }} edges={["top", "bottom"]}>
        <View style={{ flex: 1, width: "100%", maxWidth: 760, alignSelf: "center" }}>
          <View
            style={{
              height: desktop ? 160 : 136,
              paddingTop: desktop ? 14 : 2,
              marginHorizontal: 20,
            }}
          >
            <View style={{ position: "absolute", left: 0, top: 16 }}>
              <IconButton
                icon={Menu}
                label="Open conversations and menu"
                onPress={() => setThreadsOpen(true)}
              />
            </View>
            <View pointerEvents="box-none" style={{ alignItems: "center", gap: 1 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open ${agentName} activity and approvals`}
                onPress={() => {
                  deboMood.tap();
                  navigate("activity");
                }}
                style={({ pressed }) => ({
                  alignItems: "center",
                  maxWidth: "70%",
                  opacity: pressed ? 0.65 : 1,
                })}
              >
                <Mascot size={desktop ? 58 : 49} variant={data?.identity.avatar} />
                <Text
                  style={{
                    fontSize: fontSize.lg,
                    fontWeight: "600",
                    color: colors.text,
                    letterSpacing: -0.4,
                  }}
                >
                  {agentName}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{ fontSize: fontSize.sm, color: colors.muted, marginBottom: 6 }}
                >
                  {status}
                </Text>
              </Pressable>
              {section === "chat" && <ComputerEntry />}
            </View>
            <View style={{ position: "absolute", right: 0, top: 16 }}>
              <IconButton
                icon={Bell}
                label={`Notifications, ${pending} unread or pending`}
                onPress={() => open({ type: "notifications" })}
              />
              {pending > 0 && (
                <View
                  pointerEvents="none"
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: radius.inner,
                    position: "absolute",
                    top: 7,
                    right: 9,
                    backgroundColor: colors.blueDark,
                  }}
                />
              )}
            </View>
          </View>
          <View style={{ flex: 1, minHeight: 0 }}>
            {section !== "chat" && (
              <ScrollView
                key={section}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: desktop ? 42 : 22, paddingBottom: 28 }}
                keyboardShouldPersistTaps="handled"
              >
                {utility && (
                  <Button
                    small
                    style={{ alignSelf: "flex-start", marginBottom: 18 }}
                    onPress={() => navigate("apps")}
                  >
                    Back to Apps
                  </Button>
                )}
                {title && (
                  <Text
                    accessibilityRole="header"
                    style={[s.title, { fontSize: fontSize["2xl"], marginBottom: 22 }]}
                  >
                    {title.title}
                  </Text>
                )}
                <ErrorNotice error={error} />
                <Screen />
                {section === "apps" && <AccountCard />}
                {section === "apps" && <ReactionsSetting />}
                {section === "apps" && <PersonaSetting />}
              </ScrollView>
            )}
            <View
              style={{
                display: section === "chat" ? "flex" : "none",
                flex: 1,
                paddingHorizontal: desktop ? 42 : 17,
              }}
            >
              <AgentStatus />
              {richThreads ? (
                <>
                  <ErrorNotice error={threadsError} />
                  {threadsError ? (
                    <Button onPress={retryThreads}>Retry main chat</Button>
                  ) : threadsLoading ? (
                    <ActivityIndicator color={colors.blueDark} />
                  ) : null}
                  {!threadsLoading && selection.id !== mainId && (
                    <Text style={[s.small, { textAlign: "center", marginBottom: 8 }]}>
                      Side chat
                    </Text>
                  )}
                  {visited.map((thread) => (
                    <View
                      key={thread.id}
                      style={{ display: selection.id === thread.id ? "flex" : "none", flex: 1 }}
                    >
                      <ChatScreen
                        thread={thread}
                        active={section === "chat" && selection.id === thread.id}
                        prompt={selection.id === thread.id ? prompt : undefined}
                      />
                    </View>
                  ))}
                </>
              ) : (
                <ChatScreen prompt={prompt} active={section === "chat"} />
              )}
            </View>
          </View>
          <View
            style={{
              paddingHorizontal: 22,
              paddingTop: 10,
              paddingBottom: desktop ? 22 : 7,
              alignItems: "center",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                width: "100%",
                maxWidth: 370,
                padding: 5,
                backgroundColor: colors.card,
                borderRadius: radius.full,
                boxShadow: shadow.low,
                borderWidth: 1,
                borderColor: colors.line,
              }}
            >
              {nav.map((item) => {
                // Talk is not a tab: it is a popup over the screen underneath.
                const active = section === item.id || (item.id === "apps" && utility);
                const tabStyle = {
                  flex: 1,
                  height: 47,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: active ? colors.subtle : "transparent",
                  borderRadius: radius.chat,
                } as const;
                const icon = <item.icon size={23} strokeWidth={1.8} color={colors.text} />;
                // On the web a tab is a real link, so middle-click and "open in new tab" work.
                if (onWeb)
                  return createElement(
                    "a",
                    {
                      key: item.id,
                      href: pathFor(item.id),
                      "aria-label": item.label,
                      "aria-current": active ? "page" : undefined,
                      onClick: (event: MouseEvent) => {
                        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
                          return;
                        event.preventDefault();
                        navigate(item.id);
                      },
                      style: { ...tabStyle, display: "flex", textDecoration: "none" },
                    },
                    icon,
                  );
                return (
                  <Pressable
                    key={item.id}
                    accessibilityRole="tab"
                    accessibilityLabel={item.label}
                    accessibilityState={{ selected: active }}
                    onPress={() => navigate(item.id)}
                    style={tabStyle}
                  >
                    {icon}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
        {!!toast && (
          <View
            pointerEvents="box-none"
            style={{ position: "absolute", bottom: 94, left: 20, right: 20, alignItems: "center" }}
          >
            <View
              style={[
                s.row,
                {
                  gap: 10,
                  padding: 14,
                  backgroundColor: colors.ink,
                  borderRadius: radius.page,
                  maxWidth: 560,
                },
              ]}
            >
              <Check size={16} color={colors.blue} />
              <Text style={{ color: colors.onInk, fontSize: fontSize.base, flexShrink: 1 }}>
                {toast}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Dismiss notification"
                onPress={clearToast}
              >
                <X size={16} color={colors.onInk} />
              </Pressable>
            </View>
          </View>
        )}
        {threadsOpen && <ThreadsSheet onClose={() => setThreadsOpen(false)} />}
        {current === "talk" && <TalkPopup onClose={() => navigate(lastScreen.current)} />}
        {detail && (
          <Details
            key={
              detail.type === "task"
                ? detail.taskId
                : detail.type === "file"
                  ? detail.file.id
                  : detail.type === "browser"
                    ? detail.browser.id
                    : detail.type === "mail"
                      ? detail.mail.id
                      : detail.type === "review"
                        ? detail.action.id
                        : detail.type === "email"
                          ? JSON.stringify(detail.draft)
                          : detail.type === "event"
                            ? detail.event?.id || "event-new"
                            : detail.type
            }
            detail={detail}
          />
        )}
      </SafeAreaView>
    </>
  );
}
