import { useEffect, useState } from "react";
import { listAnnouncements } from "../services/announcementsService";
import { getSchoolKey } from "../constants/universityHierarchy";

const DISMISSED_KEY = "dismissedAnnouncementIds";

const readDismissed = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]"));
  } catch {
    return new Set();
  }
};

const persistDismissed = (ids) => {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]));
  } catch {
    // localStorage unavailable (private browsing, quota) - dismissal just won't persist.
  }
};

const matchesCurrentUser = (announcement) => {
  const role = String(sessionStorage.getItem("role") || "").toLowerCase();
  const schoolKey = getSchoolKey(sessionStorage.getItem("school") || "");
  const tokens = String(announcement.audience || "all")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  if (tokens.includes("all")) return true;
  if (role && tokens.includes(role)) return true;
  if (schoolKey && tokens.includes(String(schoolKey).toLowerCase())) return true;
  return false;
};

// Shared by NoticesBanner (top-of-page, new-only, auto-dismiss) and NoticesBell (persistent
// access point in the sidebar - shows every active notice targeting this user, dismissed or
// not, so a notice someone closed on the banner is still reachable later).
export function useAnnouncements() {
  const [all, setAll] = useState([]);
  const [dismissed, setDismissed] = useState(readDismissed);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => listAnnouncements()
      .then((items) => {
        if (!cancelled) {
          setAll(items.filter(matchesCurrentUser));
          setError(false);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    const handleVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };

    refresh();
    const timer = window.setInterval(refresh, 30000);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const dismiss = (id) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      persistDismissed(next);
      return next;
    });
  };

  const visible = all.filter((a) => !dismissed.has(a.id));

  return { all, visible, dismissed, dismiss, error };
}
