import axios from "axios";
import i18n, { cacheDetectedLanguage } from "./index";
import { currentLanguage, hasExplicitLanguage, setLanguage } from "./locale";
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_NOTICE_KEY,
  isLanguage,
  type LanguageCode,
} from "./config";

export interface DetectionResult {
  language: LanguageCode;
  country: string | null;
  source: "profile" | "country" | "accept-language" | "default";
}

/**
 * Ask the API which language this caller should see.
 *
 * Uses a bare axios instance: this runs before sign-in, and the shared client
 * would attach an Authorization header and a refresh interceptor we do not
 * want on a public endpoint.
 */
export async function fetchDetection(): Promise<DetectionResult | null> {
  try {
    const { data } = await axios.get<DetectionResult>("/api/i18n/detect/", { timeout: 3000 });
    return isLanguage(data?.language) ? data : null;
  } catch {
    // Offline or the API is down — the time-zone detector already ran.
    return null;
  }
}

/**
 * Apply location-based detection, but only on a first visit.
 *
 * Re-applying it on every load would fight the user: a Spanish speaker working
 * in Saudi Arabia, or anyone on a VPN, would have their choice overwritten on
 * each refresh. Once someone picks a language it is theirs until they change it.
 *
 * Returns the country that triggered a switch, so the UI can explain itself.
 */
export async function applyDetectedLanguage(): Promise<{
  switchedTo: LanguageCode;
  country: string | null;
} | null> {
  if (hasExplicitLanguage()) return null;

  const detection = await fetchDetection();
  if (!detection) return null;
  cacheDetectedLanguage(detection.language);

  if (detection.language === currentLanguage()) return null;
  // Persist so the nudge happens once, not on every page load.
  await setLanguage(detection.language);
  return { switchedTo: detection.language, country: detection.country };
}

/** True while the first-visit "we switched your language" notice is unseen. */
export function shouldShowSwitchNotice(): boolean {
  try {
    return localStorage.getItem(LANGUAGE_NOTICE_KEY) !== "seen";
  } catch {
    return false;
  }
}

export function dismissSwitchNotice() {
  try {
    localStorage.setItem(LANGUAGE_NOTICE_KEY, "seen");
  } catch {
    // Nothing to do — the notice simply reappears next session.
  }
}

/**
 * Align the UI with a signed-in user's stored preference.
 *
 * Called after the profile loads. The stored preference is authoritative
 * because the user set it deliberately, and it follows them between devices.
 */
export async function syncProfileLanguage(preferred: string | null | undefined) {
  if (!isLanguage(preferred)) return;
  if (preferred !== currentLanguage()) {
    await setLanguage(preferred);
  }
}

/** Language header value for API requests. */
export function acceptLanguageHeader(): string {
  const active = currentLanguage();
  return active === DEFAULT_LANGUAGE ? active : `${active},${DEFAULT_LANGUAGE};q=0.8`;
}

export { i18n };
