import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  AppState,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_URL, FuseApi } from "./api";
import {
  AuthProblem,
  type JwtSession,
  NeonAuthClient,
  type SignInResult,
  refreshDelay,
} from "./neon-auth";
import { clearSessionToken, loadSessionToken, saveSessionToken } from "./session-store";
import { Button, Card, colors, ErrorNotice, Field, fontSize, Mascot, s } from "./ui";

interface Account {
  email: string;
  name?: string;
  token: string;
  signOut: () => Promise<void>;
}
const AccountContext = createContext<Account | null>(null);
/** The signed-in person, or null when this install uses the shared access key. */
export const useAccount = () => useContext(AccountContext);

export interface AuthInfo {
  mode: "neon" | "access-key";
  neonAuthUrl?: string;
}

/**
 * Asks the API which sign-in it uses. Undefined while asking. If the API cannot be
 * reached it answers "access-key", whose screen already explains a missing server.
 */
export function useAuthInfo(): AuthInfo | undefined {
  const [info, setInfo] = useState<AuthInfo>();
  useEffect(() => {
    let live = true;
    fetch(`${API_URL}/api/health`)
      .then((response) => response.json())
      .then((body: { auth?: AuthInfo }) => {
        const neon = body.auth?.mode === "neon" && body.auth.neonAuthUrl;
        if (live) setInfo(neon ? body.auth : { mode: "access-key" });
      })
      .catch(() => live && setInfo({ mode: "access-key" }));
    return () => {
      live = false;
    };
  }, []);
  return info;
}

type Phase ="loading" | "offline" | "out" | "in";

/**
 * Shows email sign-in until the person is in, then renders the app with a Neon Auth JWT
 * as its Bearer token. It swaps in a fresh JWT before the old one runs out (they last 15
 * minutes). `sessionKey` stays the same across those swaps, so nothing below remounts.
 */
export function NeonGate({
  baseUrl,
  children,
}: {
  baseUrl: string;
  children: (token: string, sessionKey: string) => ReactNode;
}) {
  const client = useMemo(() => new NeonAuthClient(baseUrl), [baseUrl]);
  const [phase, setPhase] = useState<Phase>("loading");
  const [session, setSession] = useState<JwtSession>();
  const [notice, setNotice] = useState("");
  const stored = useRef<string | null>(null);
  const retry = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const leave = useCallback(async (message = "") => {
    clearTimeout(retry.current);
    stored.current = null;
    await clearSessionToken();
    setSession(undefined);
    setNotice(message);
    setPhase("out");
  }, []);

  const refresh = useCallback(async () => {
    const token = stored.current;
    if (!token) return;
    try {
      const next = await client.jwtFor(token);
      if (!next) return void (await leave("Your session ended. Sign in again."));
      setSession(next);
      setPhase("in");
    } catch (error) {
      // Offline or the service is busy. Keep the person signed in and try again soon.
      setPhase((current) => (current === "in" ? "in" : "offline"));
      setNotice(error instanceof AuthProblem ? error.message : "");
      clearTimeout(retry.current);
      retry.current = setTimeout(() => void refresh(), 30_000);
    }
  }, [client, leave]);

  useEffect(() => {
    let live = true;
    void loadSessionToken().then((token) => {
      if (!live) return;
      if (!token) return setPhase("out");
      stored.current = token;
      void refresh();
    });
    return () => {
      live = false;
      clearTimeout(retry.current);
    };
  }, [refresh]);

  const expiresAt = session?.expiresAt;
  useEffect(() => {
    if (!expiresAt) return;
    const timer = setTimeout(() => void refresh(), refreshDelay(expiresAt));
    return () => clearTimeout(timer);
  }, [expiresAt, refresh]);
  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active" && expiresAt && expiresAt - Date.now() < 120_000) void refresh();
    });
    return () => listener.remove();
  }, [expiresAt, refresh]);

  const signedIn = useCallback(
    async (sessionToken: string) => {
      stored.current = sessionToken;
      await saveSessionToken(sessionToken);
      setNotice("");
      await refresh();
    },
    [refresh],
  );

  const signOut = useCallback(async () => {
    const token = stored.current;
    if (token) await client.signOut(token);
    await leave();
  }, [client, leave]);

  const account = useMemo<Account | null>(
    () =>
      session
        ? { email: session.user.email, name: session.user.name, token: session.jwt, signOut }
        : null,
    [session, signOut],
  );

  if (phase === "in" && session && account)
    return (
      <AccountContext.Provider value={account}>
        {children(session.jwt, session.user.id || session.user.email)}
      </AccountContext.Provider>
    );
  return (
    <Frame>
      {phase === "loading" ? (
        <ActivityIndicator color={colors.blueDark} accessibilityLabel="Opening Debo" />
      ) : phase === "offline" ? (
        <Card style={{ width: "100%" }}>
          <ErrorNotice error={notice} />
          <Button primary onPress={() => void refresh()}>
            Try again
          </Button>
          <Button onPress={() => void leave()}>Use a different account</Button>
        </Card>
      ) : (
        <AuthScreen client={client} notice={notice} onSignedIn={signedIn} />
      )}
    </Frame>
  );
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          alignItems: "center",
          padding: 16,
        }}
      >
        <View style={{ width: "100%", maxWidth: 420, gap: 18, alignItems: "center" }}>
          <Mascot size={64} />
          <Text
            accessibilityRole="header"
            style={{ fontSize: fontSize["2xl"], color: colors.text, letterSpacing: -1, fontWeight: "500" }}
          >
            Welcome to Debo.
          </Text>
          <Text style={[s.muted, { textAlign: "center", marginTop: -8 }]}>
            A friendly place to keep your days and ask about them.
          </Text>
          {children}
          <Text style={[s.small, { textAlign: "center", maxWidth: 340 }]}>
            What you give Debo is yours. You can download it or delete it all at any time.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function AuthScreen({
  client,
  notice,
  onSignedIn,
}: {
  client: NeonAuthClient;
  notice: string;
  onSignedIn: (sessionToken: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [codeFor, setCodeFor] = useState<string>();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState(notice);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (work: () => Promise<void>) => {
    setError("");
    setNote("");
    setBusy(true);
    try {
      await work();
    } catch (e) {
      setError(e instanceof AuthProblem ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };
  const handle = async (result: SignInResult) => {
    if (result.status === "signed-in") return onSignedIn(result.sessionToken);
    if (result.status === "needs-code") return void setCodeFor(result.email);
    // Email confirmed, but no session came with it: sign in with the password.
    setCodeFor(undefined);
    setMode("sign-in");
    setNote("Your email is confirmed. Sign in to continue.");
  };
  const cleanEmail = email.trim();
  const submit = () => {
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail))
      return setError("That email doesn't look right. Check it and try again.");
    if (mode === "sign-up") {
      if (!name.trim()) return setError("Tell us what to call you.");
      if (password.length < 8) return setError("Use at least 8 characters for your password.");
      return void run(async () => handle(await client.signUp(name.trim(), cleanEmail, password)));
    }
    if (!password) return setError("Type your password.");
    void run(async () => handle(await client.signIn(cleanEmail, password)));
  };
  const confirm = () => {
    if (!/^\d{6}$/.test(code.trim()))
      return setError("The code is the 6 numbers in the email.");
    void run(async () => handle(await client.verifyEmail(codeFor ?? cleanEmail, code.trim())));
  };
  const resend = () =>
    void run(async () => {
      await client.resendCode(codeFor ?? cleanEmail);
      setNote("A new code is on its way.");
    });

  if (codeFor)
    return (
      <Card style={{ width: "100%" }}>
        <Text accessibilityRole="header" style={[s.heading, { marginBottom: 8 }]}>
          Confirm your email
        </Text>
        <Text style={[s.muted, { marginBottom: 16 }]}>
          We sent a 6-number code to {codeFor}. It works for a few minutes.
        </Text>
        <Field
          label="Code from your email"
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          maxLength={6}
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          onSubmitEditing={confirm}
        />
        <ErrorNotice error={error} />
        <Status note={note} />
        <Button primary busy={busy} onPress={confirm}>
          Confirm my email
        </Button>
        <Button style={{ marginTop: 10 }} disabled={busy} onPress={resend}>
          Send a new code
        </Button>
        <Button
          style={{ marginTop: 10 }}
          disabled={busy}
          onPress={() => {
            setCodeFor(undefined);
            setCode("");
            setError("");
          }}
        >
          Use a different email
        </Button>
      </Card>
    );

  return (
    <Card style={{ width: "100%" }}>
      <Text accessibilityRole="header" style={[s.heading, { marginBottom: 14 }]}>
        {mode === "sign-up" ? "Create your account" : "Sign in"}
      </Text>
      {mode === "sign-up" && (
        <Field
          label="Your name"
          value={name}
          onChangeText={setName}
          autoComplete="name"
          textContentType="name"
          autoCapitalize="words"
        />
      )}
      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
      />
      <Field
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
        textContentType={mode === "sign-up" ? "newPassword" : "password"}
        onSubmitEditing={submit}
      />
      {mode === "sign-up" && (
        <Text style={[s.small, { marginTop: -8, marginBottom: 14 }]}>
          At least 8 characters. We will email you a code to confirm your address.
        </Text>
      )}
      <ErrorNotice error={error} />
      <Status note={note} />
      <Button primary busy={busy} onPress={submit}>
        {mode === "sign-up" ? "Create my account" : "Sign in"}
      </Button>
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={() => {
          setMode(mode === "sign-in" ? "sign-up" : "sign-in");
          setError("");
          setNote("");
        }}
        style={{ minHeight: 44, justifyContent: "center", marginTop: 8 }}
      >
        <Text style={[s.muted, { textAlign: "center", color: colors.blueDark }]}>
          {mode === "sign-in" ? "New here? Create an account" : "Already have an account? Sign in"}
        </Text>
      </Pressable>
    </Card>
  );
}

function Status({ note }: { note: string }) {
  return note ? (
    <View accessibilityLiveRegion="polite" style={{ marginBottom: 12 }}>
      <Text style={s.text}>{note}</Text>
    </View>
  ) : null;
}

/**
 * Who is signed in, with sign out, a copy of their data, and a way to delete it.
 * Renders nothing when the install uses the shared access key.
 */
export function AccountCard() {
  const account = useAccount();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  if (!account) return null;
  const api = new FuseApi(account.token);

  const download = async () => {
    setBusy(true);
    setError("");
    try {
      const data = await api.request<unknown>("/api/account/export");
      const json = JSON.stringify(data, null, 2);
      if (Platform.OS === "web") {
        const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = "debo-data.json";
        link.click();
        URL.revokeObjectURL(url);
      } else await Share.share({ message: json, title: "My Debo data" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "I couldn't get your data. Try again.");
    } finally {
      setBusy(false);
    }
  };
  const wipe = async () => {
    setBusy(true);
    setError("");
    try {
      await api.request("/api/account", { confirm: true }, "DELETE");
      setDone("Everything Debo stored for you is deleted.");
      setConfirming(false);
      await account.signOut();
    } catch (e) {
      setError(e instanceof Error ? e.message : "I couldn't delete your data. Try again.");
      setBusy(false);
    }
  };
  return (
    <Card style={{ marginTop: 22 }}>
      <Text accessibilityRole="header" style={[s.heading, { marginBottom: 4 }]}>
        Your account
      </Text>
      <Text style={[s.muted, { marginBottom: 14 }]}>
        {account.name ? `${account.name} · ` : ""}
        {account.email}
      </Text>
      <ErrorNotice error={error} />
      <Status note={done} />
      <Button onPress={() => void account.signOut()} disabled={busy}>
        Sign out
      </Button>
      <Button style={{ marginTop: 10 }} onPress={() => void download()} disabled={busy}>
        Download my data
      </Button>
      {confirming ? (
        <View style={{ marginTop: 14 }}>
          <Text style={[s.text, { marginBottom: 10 }]}>
            This deletes everything Debo stored for you, including your journal entries and files. It can't be undone. Your
            sign-in stays, so you can start fresh.
          </Text>
          <Button danger busy={busy} onPress={() => void wipe()}>
            Yes, delete my data
          </Button>
          <Button style={{ marginTop: 10 }} disabled={busy} onPress={() => setConfirming(false)}>
            Keep my data
          </Button>
        </View>
      ) : (
        <Button danger style={{ marginTop: 10 }} onPress={() => setConfirming(true)}>
          Delete my data
        </Button>
      )}
    </Card>
  );
}

