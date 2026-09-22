/* eslint-disable no-unused-vars */
import { useState, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { login, forgotPassword } from "../services/authService";
import { refreshAcademicYearCycles } from "../services/academicYearCycles";
import { isValidEmail, normalizeEmail } from "../utils/validation";
import {
  initiateKeycloakLogin,
  exchangeKeycloakCode,
  processSsoToken,
  getKeycloakConfig,
} from "../services/ssoService";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

function EyeIcon({ hidden = false }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {hidden ? (
        <>
          <path d="M3 3l18 18" />
          <path d="M10.6 10.6A2 2 0 0 0 12 14a2 2 0 0 0 1.4-.6" />
          <path d="M9.9 5.2A10.7 10.7 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-3 4.2" />
          <path d="M6.6 6.8C3.6 8.8 2 12 2 12s3.5 7 10 7a10.8 10.8 0 0 0 4.6-1" />
        </>
      ) : (
        <>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState(""); // This will be treated as email
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState(location.state?.message || "");
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const { isConfigured: isSsoConfigured } = getKeycloakConfig();

  // Handle SSO tokens, callbacks, and UniOne direct launches on mount
  useEffect(() => {
    let cancelled = false;

    const handleIncomingSso = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, "?"));

      const directToken =
        searchParams.get("token") ||
        searchParams.get("sso_token") ||
        searchParams.get("access_token") ||
        hashParams.get("token") ||
        hashParams.get("access_token");

      const authCode = searchParams.get("code");
      const authState = searchParams.get("state");

      if (!directToken && !authCode) {
        return;
      }

      setSsoLoading(true);
      setError("");
      setMessage("Authenticating with DYPIU SSO...");

      try {
        let accessToken = directToken;

        // If authorization code is present, exchange it via PKCE
        if (!accessToken && authCode) {
          accessToken = await exchangeKeycloakCode(authCode, authState);
        }

        if (!accessToken) {
          throw new Error("No access token obtained from identity provider.");
        }

        // Clean query parameters from URL to avoid re-running on refresh
        if (typeof window !== "undefined" && window.history?.replaceState) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }

        // Validate token with backend /auth/me and initialize session
        await processSsoToken(accessToken);

        if (!cancelled) {
          navigate("/dashboard", { replace: true });
        }
      } catch (err) {
        if (!cancelled) {
          console.error("SSO authentication error:", err);
          const rawErr = err?.response?.data?.detail || err?.userMessage || err?.message || "";
          if (err?.statusCode === 403 || err?.response?.status === 403) {
            setError(
              "Authentication succeeded with DYPIU SSO, but no Faculty Appraisal account is assigned to your institutional identity. Please contact the administrator."
            );
          } else if (err?.statusCode === 401 || err?.response?.status === 401) {
            setError("Your SSO session has expired or is invalid. Please sign in again.");
          } else {
            setError(rawErr || "Single Sign-On authentication failed. Please try again or use password login.");
          }
          setMessage("");
        }
      } finally {
        if (!cancelled) {
          setSsoLoading(false);
        }
      }
    };

    handleIncomingSso();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const handleSsoLogin = async () => {
    setError("");
    setMessage("");
    setSsoLoading(true);
    try {
      await initiateKeycloakLogin();
    } catch (err) {
      setSsoLoading(false);
      setError(err?.message || "Failed to start DYPIU SSO. Please use password login.");
    }
  };

  const handleLogin = async () => {
    const email = normalizeEmail(username);
    const pw = password.trim();

    if (!email) {
      setError("Please enter your email address.");
      return;
    }
    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!pw) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      await login(email, pw);
      // Populate every available academic year cycle (current + previous) before the dashboard
      // mounts, so the year dropdown shows previous years immediately on first login instead of
      // only the current year until a manual page refresh happens to trigger this fetch.
      await refreshAcademicYearCycles();
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err?.message || "Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleLogin();
  };

  const handleForgotPassword = async () => {
    const email = normalizeEmail(username);

    if (!email) {
      setError("Please enter your email above, then click Forgot password.");
      setMessage("");
      return;
    }
    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      setMessage("");
      return;
    }

    setResetLoading(true);
    setError("");
    setMessage("");

    try {
      await forgotPassword(email);
      setMessage("Password reset link sent. Please check your email.");
    } catch (err) {
      setError(err?.message || "Unable to send reset link. Please try again.");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <>
      <style>{`
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; font-family: 'Segoe UI', Arial, sans-serif; }

  .dyp-input {
    width: 100%;
    padding: 11px 14px;
    border: 1.5px solid rgba(255,255,255,0.55);
    border-radius: 4px;
    font-size: 14px;
    color: white;
    background: rgba(255,255,255,0.08);
    margin-bottom: 14px;
    font-family: inherit;
    transition: border-color 0.2s, box-shadow 0.2s;
    outline: none;
  }
  .dyp-input::placeholder { color: rgba(255,255,255,0.5); }
  .dyp-input:focus {
    border-color: white;
    box-shadow: 0 0 0 2px rgba(255,255,255,0.15);
  }
  .dyp-btn {
    width: 100%;
    padding: 12px;
    background: #2563eb;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.2s;
    margin-bottom: 12px;
    letter-spacing: 0.2px;
  }
  .dyp-btn:hover:not(:disabled) { background: #1d4ed8; }
  .dyp-btn:disabled { opacity: 0.72; cursor: not-allowed; }
  .dyp-sso-btn {
    width: 100%;
    padding: 11px 14px;
    background: #ffffff;
    color: #1e293b;
    border: 1px solid rgba(255,255,255,0.9);
    border-radius: 4px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.2s, box-shadow 0.2s, transform 0.1s;
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  }
  .dyp-sso-btn:hover:not(:disabled) {
    background: #f8fafc;
    box-shadow: 0 4px 14px rgba(0,0,0,0.28);
  }
  .dyp-sso-btn:disabled {
    opacity: 0.72;
    cursor: not-allowed;
  }
  .dyp-forgot {
    background: none;
    border: none;
    font-size: 13px;
    color: rgba(255,255,255,0.75);
    cursor: pointer;
    font-family: inherit;
    padding: 0;
    text-align: center;
    width: 100%;
    transition: color 0.2s;
  }
  .dyp-forgot:hover:not(:disabled) { color: white; text-decoration: underline; }
  .dyp-forgot:disabled { opacity: 0.65; }
`}</style>

      <div style={s.wrap}>
        {/* Top Left Logo */}
        <picture>
          <source srcSet="/image.webp" type="image/webp" />
          <img
            src="/image.png"
            alt="University Logo"
            style={s.topLeftLogo}
          />
        </picture>

        {/* Top Right Logo */}
        <picture>
          <source srcSet="/IQAS.webp" type="image/webp" />
          <img
            src="/IQAS.png"
            alt="IQAC Logo"
            style={s.topRightLogo}
          />
        </picture>

        <div style={s.overlay} />

        {/* - Wide Card - */}
        <div style={s.card}>

          {/* = LEFT = */}
          <div style={s.left}>

            <h1 style={s.uniName}>
              Performance Based Appraisal System(PBAS)
            </h1>
            <h1 style={s.uniName}>
              D. Y. Patil International University, Akurdi, Pune, Maharashtra
            </h1>

            <p style={s.desc}>
              To Create a vibrant learning environment - fostering innovation and creativity,
              experiential learning, which is inspired by research, and focuses on regionally,
              nationally and globally relevant areas.
            </p>
          </div>

          {/* = RIGHT: Login panel = */}
          <div style={s.right}>
            <h2 style={s.panelTitle}>Welcome! Please login to continue.</h2>

            {error && <div style={s.error}>{error}</div>}
            {message && <div style={s.success}>{message}</div>}

            {/* DYPIU SSO (Keycloak + Google Workspace) */}
            {isSsoConfigured && (
              <>
                <button
                  className="dyp-sso-btn"
                  onClick={handleSsoLogin}
                  disabled={ssoLoading || loading}
                  type="button"
                >
                  <GoogleIcon />
                  <span>{ssoLoading ? "Connecting to SSO..." : "Sign in with DYPIU SSO"}</span>
                </button>

                <div style={s.dividerWrap}>
                  <div style={s.dividerLine} />
                  <span style={s.dividerText}>or continue with email</span>
                  <div style={s.dividerLine} />
                </div>
              </>
            )}

            <input
              className="dyp-input"
              type="email"
              placeholder="Enter email address"
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete="email"
              maxLength={254}
            />

            <div style={{ position: "relative", marginBottom: 2 }}>
              <input
                className="dyp-input"
                style={{ marginBottom: 0, paddingRight: 52 }}
                type={showPw ? "text" : "password"}
                placeholder="Enter password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                autoComplete="current-password"
              />
              <button
                type="button"
                style={s.eyeBtn}
                onClick={() => setShowPw(v => !v)}
                aria-label={showPw ? "Hide password" : "Show password"}
                title={showPw ? "Hide password" : "Show password"}
              >
                <EyeIcon hidden={showPw} />
              </button>
            </div>

            <div style={{ marginBottom: 16 }} />

            <button className="dyp-btn" onClick={handleLogin} disabled={loading || ssoLoading}>
              {loading ? "Signing in..." : "Login"}
            </button>

            <button className="dyp-forgot" onClick={handleForgotPassword} disabled={resetLoading}>
              {resetLoading ? "Sending reset link..." : "Forgot password?"}
            </button>

          </div>

        </div>
      </div>
    </>
  );
}

// - Styles -
const s = {
  topLeftLogo: {
    position: "absolute",
    top: 20,
    left: 20,
    height: 100,
    zIndex: 2,
  },

  topRightLogo: {
    position: "absolute",
    top: 20,
    right: 20,
    height: 100,
    zIndex: 2,
  },

  wrap: {
    minHeight: "100vh",
    width: "100%",
    backgroundImage: "url('/dyp.jpeg')",
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px 16px",
    position: "relative",
  },

  overlay: {
    position: "absolute",
    inset: 0,
    background: "rgba(8, 16, 38, 0.30)",
    pointerEvents: "none",
  },

  card: {
    position: "relative",
    zIndex: 1,
    width: "65%",
    maxWidth: 1280,
    display: "flex",
    alignItems: "stretch",
    borderRadius: 8,
    background: "rgba(15, 25, 50, 0.72)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    boxShadow: "0 20px 60px rgba(0,0,0,0.55)",
    overflow: "hidden",
    minHeight: 260,
  },

  left: {
    flex: 1,
    color: "white",
    padding: "24px 32px",
    display: "flex",
    flexDirection: "column",
    gap: 14,
    justifyContent: "center",
  },

  uniName: {
    fontSize: 28,
    fontWeight: 700,
    margin: 0,
    lineHeight: 1.3,
    color: "white",
  },

  desc: {
    fontSize: 14,
    color: "rgba(255,255,255,0.72)",
    lineHeight: 1.8,
    margin: 0,
    maxWidth: 500,
  },

  right: {
    width: 320,
    flexShrink: 0,
    background: "transparent",
    borderLeft: "1px solid rgba(255,255,255,0.15)",
    padding: "20px 18px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },

  panelTitle: {
    fontSize: 15.5,
    fontWeight: 700,
    color: "white",
    marginBottom: 22,
    marginTop: 0,
    lineHeight: 1.45,
  },

  eyeBtn: {
    position: "absolute",
    right: 8,
    top: "50%",
    transform: "translateY(-50%)",
    width: 34,
    height: 34,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: 8,
    cursor: "pointer",
    padding: 0,
    color: "rgba(255,255,255,0.72)",
    lineHeight: 1,
    transition: "background 0.2s, border-color 0.2s, color 0.2s",
  },

  error: {
    background: "rgba(185,28,28,0.25)",
    border: "1px solid rgba(252,165,165,0.5)",
    color: "#fca5a5",
    padding: "9px 12px",
    borderRadius: 4,
    fontSize: 12,
    marginBottom: 14,
    lineHeight: 1.5,
  },

  success: {
    background: "rgba(21,128,61,0.25)",
    border: "1px solid rgba(134,239,172,0.5)",
    color: "#86efac",
    padding: "9px 12px",
    borderRadius: 4,
    fontSize: 12,
    marginBottom: 14,
    lineHeight: 1.5,
  },

  dividerWrap: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
    marginTop: 0,
  },

  dividerLine: {
    flex: 1,
    height: "1px",
    background: "rgba(255, 255, 255, 0.18)",
  },

  dividerText: {
    fontSize: "11px",
    color: "rgba(255, 255, 255, 0.6)",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    whiteSpace: "nowrap",
  },
};

