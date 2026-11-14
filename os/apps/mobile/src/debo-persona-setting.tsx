// Settings card: the role Debo is playing, if any. She takes a role when you ask her to
// ("act as my girlfriend") in chat or on a call, and keeps it until you stop it here or tell her.
import { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";
import { errorText } from "./debo-api";
import { Button, Card, ErrorNotice, Field, s, spacing } from "./ui";
import { useWorkspace } from "./workspace";

type Persona = { role: string; notes: string } | null;

export function PersonaSetting() {
  const { api } = useWorkspace();
  const [persona, setPersona] = useState<Persona>(null);
  const [role, setRole] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const reply = await api.request<{ persona: Persona }>("/api/persona");
      setPersona(reply.persona);
    } catch (e) {
      setError(errorText(e));
    }
  }, [api]);
  useEffect(() => {
    void load();
  }, [load]);

  const run = async (work: () => Promise<{ persona: Persona }>, done?: () => void) => {
    setBusy(true);
    setError("");
    try {
      setPersona((await work()).persona);
      done?.();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={{ marginTop: spacing[5], gap: spacing[3] }}>
      <Text style={s.heading}>A role for Debo</Text>
      <Text style={s.muted} accessibilityLiveRegion="polite">
        {persona
          ? `Debo is playing: ${persona.role}. She stays in this role in chat and on calls until you stop it.`
          : "Debo is being herself. You can ask her to act as someone, like a friend or a study buddy, in chat or on a call. Or set a role here."}
      </Text>
      <ErrorNotice error={error} />
      {persona && (
        <View style={s.row}>
          <Button
            small
            busy={busy}
            onPress={() => void run(() => api.request<{ persona: Persona }>("/api/persona", undefined, "DELETE"))}
          >
            Stop this role
          </Button>
        </View>
      )}
      <Field
        label="Role"
        value={role}
        onChangeText={setRole}
        maxLength={160}
        placeholder="For example: a kind study buddy"
      />
      <View style={s.row}>
        <Button
          small
          primary
          busy={busy}
          disabled={!role.trim()}
          onPress={() =>
            void run(
              () => api.request<{ persona: Persona }>("/api/persona", { role }, "PUT"),
              () => setRole(""),
            )
          }
        >
          Save role
        </Button>
      </View>
    </Card>
  );
}
