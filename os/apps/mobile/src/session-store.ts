import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// The long-lived session token is the key to a person's account, so on iOS and Android it
// goes in the Keychain / Keystore through expo-secure-store. The web has no secure store:
// it uses this site's localStorage, which any script on the same site can read. Keep that
// in mind before adding third-party scripts to the web build.
const KEY = "debo.session";

export async function loadSessionToken(): Promise<string | null> {
  try {
    if (Platform.OS === "web") return globalThis.localStorage?.getItem(KEY) ?? null;
    return await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}

export async function saveSessionToken(token: string): Promise<void> {
  try {
    if (Platform.OS === "web") globalThis.localStorage?.setItem(KEY, token);
    else await SecureStore.setItemAsync(KEY, token);
  } catch {
    // The person stays signed in until they close the app; the next launch asks again.
  }
}

export async function clearSessionToken(): Promise<void> {
  try {
    if (Platform.OS === "web") globalThis.localStorage?.removeItem(KEY);
    else await SecureStore.deleteItemAsync(KEY);
  } catch {
    // Nothing more to do.
  }
}
