import { api } from "./api";
import { storeUserSession } from "../auth/session";
import { refreshSchoolsOnce } from "./schoolsService";
import { refreshAcademicYearCycles } from "./academicYearCycles";

/**
 * Reads Keycloak SSO configuration from runtime config (window.APP_CONFIG)
 * or Vite environment variables with sensible production and local defaults.
 */
export const getKeycloakConfig = () => {
  const runtime = (typeof window !== "undefined" && window.APP_CONFIG) || {};
  const env = import.meta.env || {};

  const keycloakUrl = (
    runtime.VITE_KEYCLOAK_URL ||
    env.VITE_KEYCLOAK_URL ||
    ""
  ).replace(/\/$/, "");

  const realm = runtime.VITE_KEYCLOAK_REALM || env.VITE_KEYCLOAK_REALM || "dypiu";
  const clientId = runtime.VITE_KEYCLOAK_CLIENT_ID || env.VITE_KEYCLOAK_CLIENT_ID || "faculty-appraisal-frontend";
  const scopes = runtime.VITE_KEYCLOAK_SCOPES || env.VITE_KEYCLOAK_SCOPES || "openid email profile";

  return {
    keycloakUrl,
    realm,
    clientId,
    scopes,
    isConfigured: Boolean(keycloakUrl),
  };
};

/**
 * Generates a cryptographically random string for PKCE code_verifier and state.
 */
function generateRandomString(length = 64) {
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const randomValues = new Uint8Array(length);
  if (typeof window !== "undefined" && window.crypto) {
    window.crypto.getRandomValues(randomValues);
  } else {
    for (let i = 0; i < length; i++) {
      randomValues[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(randomValues)
    .map((val) => charset[val % charset.length])
    .join("");
}

/**
 * Base64URL encoding according to RFC 7636.
 */
function base64UrlEncode(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Computes SHA-256 hash of a string using the Web Crypto API.
 */
async function sha256(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return await window.crypto.subtle.digest("SHA-256", data);
}

/**
 * Initiates the Keycloak OIDC Authorization Code Flow with PKCE.
 * Redirects the browser to DYPIU Keycloak.
 */
export const initiateKeycloakLogin = async (customRedirectUri = null) => {
  const { keycloakUrl, realm, clientId, scopes, isConfigured } = getKeycloakConfig();
  if (!isConfigured) {
    throw new Error("Keycloak SSO is not configured. Please specify VITE_KEYCLOAK_URL in environment.");
  }

  const codeVerifier = generateRandomString(64);
  const state = generateRandomString(32);
  const hashed = await sha256(codeVerifier);
  const codeChallenge = base64UrlEncode(hashed);

  // Store PKCE verifier and state for verification upon callback
  sessionStorage.setItem("sso_pkce_verifier", codeVerifier);
  sessionStorage.setItem("sso_pkce_state", state);

  const redirectUri = customRedirectUri || `${window.location.origin}/login`;
  sessionStorage.setItem("sso_redirect_uri", redirectUri);

  const authUrl = new URL(`${keycloakUrl}/realms/${encodeURIComponent(realm)}/protocol/openid-connect/auth`);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", scopes);
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("state", state);

  window.location.href = authUrl.toString();
};

/**
 * Exchanges the authorization code received from Keycloak for an access token.
 */
export const exchangeKeycloakCode = async (code, returnedState) => {
  const { keycloakUrl, realm, clientId } = getKeycloakConfig();
  const savedState = sessionStorage.getItem("sso_pkce_state");
  const codeVerifier = sessionStorage.getItem("sso_pkce_verifier");
  const redirectUri = sessionStorage.getItem("sso_redirect_uri") || `${window.location.origin}/login`;

  // Clean up stored PKCE state
  sessionStorage.removeItem("sso_pkce_state");
  sessionStorage.removeItem("sso_pkce_verifier");
  sessionStorage.removeItem("sso_redirect_uri");

  if (savedState && returnedState && savedState !== returnedState) {
    throw new Error("Invalid SSO state parameter. Possible CSRF detected.");
  }
  if (!codeVerifier) {
    throw new Error("PKCE code verifier not found. Please try logging in again.");
  }

  const tokenUrl = `${keycloakUrl}/realms/${encodeURIComponent(realm)}/protocol/openid-connect/token`;

  const body = new URLSearchParams();
  body.set("grant_type", "authorization_code");
  body.set("client_id", clientId);
  body.set("code", code);
  body.set("redirect_uri", redirectUri);
  body.set("code_verifier", codeVerifier);

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok || !data?.access_token) {
    const errorMsg = data?.error_description || data?.error || `Token exchange failed (${res.status})`;
    throw new Error(errorMsg);
  }

  return data.access_token;
};

/**
 * Validates the SSO access token against the backend (/auth/me),
 * links/resolves the local user profile, stores the session, and prepares the dashboard.
 */
export const processSsoToken = async (token) => {
  if (!token) {
    throw new Error("Missing access token for SSO authentication.");
  }

  // Set the token into session so subsequent API requests include it in the Authorization header
  sessionStorage.setItem("accessToken", token);
  sessionStorage.setItem("token", token);

  try {
    // 1. Fetch user profile from backend (validates token cryptographically and links account)
    const profile = await api.get("/auth/me");

    // 2. Refresh dynamic schools before canonicalising session school
    await refreshSchoolsOnce().catch(() => {});

    // 3. Store user session
    storeUserSession({ token, profile });

    // 4. Preload academic year cycles
    await refreshAcademicYearCycles().catch(() => {});

    return { success: true, profile };
  } catch (err) {
    // Clean up temporary token if profile fetch / authorization failed
    sessionStorage.removeItem("accessToken");
    sessionStorage.removeItem("token");
    throw err;
  }
};
