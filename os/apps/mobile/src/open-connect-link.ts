// Opening an app's own sign-in page.
//   Web:    a new tab. It is opened empty at the tap (browsers block tabs opened after a wait),
//           then pointed at the sign-in page once the server has made the link.
//   Native: an in-app browser sheet that closes itself when the page sends people back.
import { Platform } from "react-native";

/** Call this first thing in the tap handler, before any waiting. Web only; native returns null. */
export function reserveSignInWindow(): Window | null {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  try {
    const reserved = window.open("", "_blank");
    if (reserved) reserved.opener = null;
    return reserved;
  } catch {
    return null;
  }
}

/** Closes a reserved tab that is no longer needed, for example when the server said no. */
export function dropSignInWindow(reserved: Window | null) {
  try {
    reserved?.close();
  } catch {
    // Nothing to do.
  }
}

/**
 * Opens the sign-in page. Resolves when the person is back: at once on the web (the new tab
 * stays open, and the screen checks again when they return), after the sheet closes on native.
 */
export async function openSignInPage(url: string, reserved: Window | null) {
  if (Platform.OS === "web") {
    if (reserved && !reserved.closed) reserved.location.href = url;
    // A blocked tab: fall back to this tab. The page sends people back to Debo.
    else window.location.assign(url);
    return;
  }
  const WebBrowser = await import("expo-web-browser");
  await WebBrowser.openAuthSessionAsync(url, "debo://connectors");
}
