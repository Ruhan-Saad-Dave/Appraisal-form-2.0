import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Avatar } from "./dashboardPrimitives";
import { ReportBugButton } from "./ReportBugModal";
import NoticesBell from "./NoticesBell";
import { FilePenLine, GraduationCap, Users, ShieldCheck, Building2, ClipboardCheck, BookOpen, Layers, UserRound, Mail, LogOut, ChevronDown, FlaskConical, CalendarDays, ListChecks } from "lucide-react";
import "./DashboardSidebar.css";

const sidebarShellStyle = {
  width: 272,
  height: "100vh",
  minHeight: "100vh",
  boxSizing: "border-box",
  overflow: "hidden",
  background: "#ffffff",
  display: "flex",
  flexDirection: "column",
  padding: "20px 14px",
  gap: 14,
  position: "sticky",
  top: 0,
  alignSelf: "flex-start",
  flexShrink: 0,
  borderRight: "1px solid rgba(148,163,184,0.12)",
  boxShadow: "4px 0 20px rgba(15,23,42,0.04)",
};

function Icon({ name, active = false, size = 19 }) {
  const Glyph = ({ self: FilePenLine, school: GraduationCap, faculty: Users, hod: ShieldCheck, director: Building2, review: ClipboardCheck, guidelines: BookOpen, sections: Layers, profile: UserRound, mail: Mail, logout: LogOut, chevron: ChevronDown })[name] || FilePenLine;
  return <Glyph size={size} strokeWidth={1.8} aria-hidden="true" style={{ color: name === "logout" ? "#b91c1c" : active ? "#4338ca" : "#64748b" }} />;
}

function getNavIconName(tab) {
  const id = String(tab?.id || "").toLowerCase();
  const label = String(tab?.label || "").toLowerCase();

  if (id.includes("guideline")) return "guidelines";
  if (id.includes("my") || label.includes("my appraisal")) return "self";
  if (id.includes("school") || label.includes("school appraisal")) return "school";
  if (id.includes("director") || label.includes("director")) return "director";
  if (id.includes("hod") || label.includes("hod")) return "hod";
  if (id.includes("faculty") || label.includes("faculty")) return "faculty";
  if (id.includes("approval") || id.includes("review") || label.includes("appraisal")) return "review";
  return "self";
}

function SidebarIcon({ id, active, label }) {
  return <Icon name={getNavIconName({ id, label })} active={active} />;
}

const SECTION_ICON_CYCLE = [BookOpen, FlaskConical, Building2, CalendarDays, ShieldCheck, ListChecks];

function SectionIcon({ section, index = 0 }) {
  const KNOWN_ICONS = { partA: BookOpen, partB: FlaskConical, partC: Building2, partD: CalendarDays, partE: ShieldCheck, summary: ListChecks };
  const isSummary = String(section || "").toLowerCase() === "summary";
  const Glyph = KNOWN_ICONS[section] || (isSummary ? ListChecks : SECTION_ICON_CYCLE[index % SECTION_ICON_CYCLE.length]);

  return (
    <span style={{ width: 24, height: 24, borderRadius: 8, background: "#e2e8f0", border: "1px solid #e2e8f0", color: "#475569", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, fontWeight: 900 }}>
      <Glyph size={16} aria-hidden="true" />
    </span>
  );
}

const isLegacyTwoPartAcademicYear = (academicYear = "") =>
  String(academicYear).replace(/\s+/g, "") === "2025-2026" ||
  String(academicYear).replace(/\s+/g, "") === "2025-26";

export default function DashboardSidebar({
  appInfo,
  navItems,
  activeTab,
  onTabSelect,
  showSectionSelector = false,
  sectionTab = "partA",
  onSectionChange,
  customSectionOptions = null,
  isSectionOpen = () => true,
  afterNavItem,
  beforeNav,
  afterNav,
  profileSubtitle,
  onLogout,
}) {
  const navigate = useNavigate();
  const [sectionMenuOpen, setSectionMenuOpen] = useState(false);
  const [menuRect, setMenuRect] = useState(null);
  const sectionTriggerRef = useRef(null);
  const [currentAcademicYear, setCurrentAcademicYear] = useState(() => sessionStorage.getItem("academicYear") || "");
  const isLegacyTwoPartYear = isLegacyTwoPartAcademicYear(currentAcademicYear);
  const showCurrentYearSectionSelector = showSectionSelector && (Boolean(customSectionOptions) || !isLegacyTwoPartYear);
  const sectionOptions = customSectionOptions || (isLegacyTwoPartYear
    ? [
        ["partA", "Part A"],
        ["partB", "Part B"],
      ]
    : [
        ["partA", "Part A"],
        ["partB", "Part B"],
        ["partC", "Part C"],
        ["partD", "Part D"],
        ["partE", "Part E"],
        ["summary", "Summary"],
      ]);
  const selectedSectionLabel = sectionOptions.find(([value]) => value === sectionTab)?.[1] || "Part A";
  const profileName = sessionStorage.getItem("name") || "User";
  const profileDisplayName = profileName.split(" ").slice(0, 2).join(" ");
  const profileInitials = profileName.split(" ").map((name) => name[0]).join("").toUpperCase();
  const cleanProfileSubtitle = String(profileSubtitle || "").replace(/\s+-\s*$/, "").trim();
  const profileImageUrl = sessionStorage.getItem("profilePictureUrl") || sessionStorage.getItem("profile_picture_url") || sessionStorage.getItem("avatarUrl") || "";

  useEffect(() => {
    const syncAcademicYear = (event) => {
      setCurrentAcademicYear(event?.detail?.academicYear || sessionStorage.getItem("academicYear") || "");
    };
    window.addEventListener("academicYearChanged", syncAcademicYear);
    window.addEventListener("storage", syncAcademicYear);
    return () => {
      window.removeEventListener("academicYearChanged", syncAcademicYear);
      window.removeEventListener("storage", syncAcademicYear);
    };
  }, []);

  // The section dropdown used to render inline inside .appraisal-sidebar-scroll, which has
  // overflow-y: auto for the nav list above it - that clips the expanded options list the
  // moment it extends past the scroll container's own viewport, instead of floating on top of
  // it. Rendering it through a portal (positioned from the trigger button's live screen rect)
  // escapes that clipping entirely, regardless of the sidebar's scroll position.
  useEffect(() => {
    if (!sectionMenuOpen) return undefined;
    const updateRect = () => {
      const rect = sectionTriggerRef.current?.getBoundingClientRect();
      if (rect) setMenuRect(rect);
    };
    updateRect();
    const scrollHost = document.querySelector(".appraisal-sidebar-scroll");
    scrollHost?.addEventListener("scroll", updateRect);
    window.addEventListener("resize", updateRect);
    return () => {
      scrollHost?.removeEventListener("scroll", updateRect);
      window.removeEventListener("resize", updateRect);
    };
  }, [sectionMenuOpen]);

  useEffect(() => {
    if (!sectionMenuOpen) return undefined;
    const handleClickOutside = (event) => {
      if (sectionTriggerRef.current?.contains(event.target)) return;
      if (event.target.closest?.('[data-section-dropdown="true"]')) return;
      setSectionMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [sectionMenuOpen]);

  return (
    <aside className="appraisal-sidebar appraisal-sidebar--light" style={sidebarShellStyle}>
      <div
        className="appraisal-sidebar-scroll"
        style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", display: "flex", flexDirection: "column", gap: 14, scrollbarWidth: "thin", scrollbarColor: "rgba(148,163,184,0.35) transparent" }}
      >
      <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "2px 2px 4px" }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: "linear-gradient(135deg,#6366f1 0%,#4338ca 100%)", border: "1px solid rgba(199,210,254,0.35)", display: "flex", alignItems: "center", justifyContent: "center", color: "#ffffff", fontWeight: 900, fontSize: 13, boxShadow: "0 10px 22px rgba(79,70,229,0.38), 0 0 0 3px rgba(99,102,241,0.10)", letterSpacing: 0, flexShrink: 0 }}>FA</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: "#1e293b", fontWeight: 900, fontSize: 13.5, lineHeight: 1.2, letterSpacing: 0 }}>{appInfo.PORTAL_NAME}</div>
          <div style={{ color: "#7c8698", fontSize: 10, lineHeight: 1.3, marginTop: 3 }}>{appInfo.UNIVERSITY_NAME}</div>
        </div>
      </div>

      <div style={{ height: 1, background: "linear-gradient(90deg,transparent,rgba(148,163,184,0.22) 20%,rgba(148,163,184,0.22) 80%,transparent)" }} />

      <div style={{ display: "flex", flexDirection: "column", gap: 10, minHeight: 0 }}>
        {beforeNav}
        <div style={{ padding: "0 4px", fontSize: 9.5, fontWeight: 800, color: "#5b667a", textTransform: "uppercase", letterSpacing: 1.1 }}>Menu</div>
        <nav style={{ display: "grid", gap: 5 }} aria-label="Dashboard sections">
          {navItems.filter((tab) => tab.id !== "guidelines").map((tab) => {
          const isActive = activeTab === tab.id;
          // No hue anywhere: the active item is unmistakable purely from an elevated glass
          // panel, a crisp left edge, and full-bright text/icon - not a color code, so it
          // reads clearly for every user regardless of color vision.
          const button = (
            <button
              key={tab.id}
              onClick={() => {
                onTabSelect?.(tab.id);
              }}
              onMouseEnter={(event) => {
                if (!isActive) event.currentTarget.style.background = "rgba(255,255,255,0.045)";
              }}
              onMouseLeave={(event) => {
                if (!isActive) event.currentTarget.style.background = "transparent";
              }}
              className={isActive ? "is-active" : ""}
              style={{
                position: "relative",
                background: isActive ? "#eef2ff" : "transparent",
                border: "1px solid transparent",
                borderRadius: 8,
                padding: "10px 12px 10px 15px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 12,
                width: "100%",
                fontFamily: "inherit",
                transition: "background 0.15s ease",
                overflow: "hidden",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: 0,
                  top: isActive ? 6 : "50%",
                  bottom: isActive ? 6 : "50%",
                  width: 3,
                  borderRadius: 999,
                  background: isActive ? "#4f46e5" : "transparent",
                  transition: "background 0.15s ease",
                }}
              />
              <span style={{ position: "relative", width: 34, height: 34, borderRadius: 11, background: isActive ? "#e0e7ff" : "#f1f5f9", border: isActive ? "1px solid #c7d2fe" : "1px solid #e2e8f0", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.15s ease, border-color 0.15s ease" }}>
                <SidebarIcon id={tab.id} label={tab.label} active={isActive} />
              </span>
              <div style={{ position: "relative", flex: 1, minWidth: 0, textAlign: "left" }}>
                <div style={{ color: isActive ? "#1e293b" : "#475569", fontWeight: isActive ? 900 : 700, fontSize: 12.5, lineHeight: 1.15, whiteSpace: "normal" }}>{tab.label}</div>
                <div style={{ color: isActive ? "#64748b" : "#6b7686", fontSize: 10.5, marginTop: 3, lineHeight: 1.3 }}>{tab.sub}</div>
              </div>
              {tab.badge > 0 && (
                <div
                  aria-label={`${tab.badge} pending`}
                  style={{
                    position: "relative",
                    background: isActive ? "#ede9fe" : "#f1f5f9",
                    color: isActive ? "#5b21b6" : "#64748b",
                    border: isActive ? "1px solid #c4b5fd" : "1px solid #dbe3ee",
                    fontWeight: 800,
                    fontSize: 10,
                    minWidth: 21,
                    height: 21,
                    borderRadius: 999,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 6px",
                    flexShrink: 0,
                    boxShadow: isActive ? "0 1px 2px rgba(91, 33, 182, 0.10)" : "none",
                  }}
                >
                  {tab.badge}
                </div>
              )}
            </button>
          );

          if (afterNavItem?.id === tab.id) {
            return (
              <div key={tab.id} style={afterNavItem.wrapperStyle || { display: "grid", gap: 10 }}>
                {button}
                {afterNavItem.content}
              </div>
            );
          }

          return button;
          })}
        </nav>
      </div>

      {afterNav}

      {showCurrentYearSectionSelector && (
        <div className="sidebar-section-picker" style={{ marginTop: 3, background: "#fff", border: "1px solid #b8c5d6", borderRadius: 8, padding: "12px 10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 9.5, color: "#7c8698", fontWeight: 900, textTransform: "uppercase", marginBottom: 8, letterSpacing: 0.6 }}>
            <Icon name="layers" size={13} />
            My Appraisal Section
          </div>
          <div style={{ position: "relative" }}>
            <button
              ref={sectionTriggerRef}
              type="button"
              onClick={() => setSectionMenuOpen((open) => !open)}
              aria-haspopup="listbox"
              aria-expanded={sectionMenuOpen}
              style={{ width: "100%", height: 40, border: sectionMenuOpen ? "1px solid #a5b4fc" : "1px solid #e0e7ff", borderRadius: 12, padding: "0 11px 0 9px", color: "#1e293b", background: "#f1f5f9", fontFamily: "inherit", fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: 9, boxShadow: sectionMenuOpen ? "0 0 0 3px rgba(255,255,255,0.06)" : "none" }}
            >
              <SectionIcon section={sectionTab} index={sectionOptions.findIndex(([value]) => value === sectionTab)} />
              <span style={{ flex: 1, textAlign: "left", fontSize: 12.5 }}>{selectedSectionLabel}</span>
              <Icon name="chevron" size={15} />
            </button>
          </div>
        </div>
      )}
      </div>

      {sectionMenuOpen && menuRect && createPortal(
        <div
          data-section-dropdown="true"
          role="listbox"
          style={{ position: "fixed", zIndex: 2000, top: menuRect.bottom + 7, left: menuRect.left, width: menuRect.width, padding: 6, background: "#ffffff", border: "1px solid #e0e7ff", borderRadius: 12, boxShadow: "0 12px 28px rgba(15,23,42,0.12)", display: "grid", gap: 3 }}
        >
          {sectionOptions.map(([value, label], index) => {
            const disabled = !isSectionOpen(value);
            const selected = value === sectionTab;
            return (
              <button
                key={value}
                type="button"
                role="option"
                aria-selected={selected}
                disabled={disabled}
                onClick={() => {
                  if (disabled) return;
                  onSectionChange?.(value);
                  setSectionMenuOpen(false);
                }}
                style={{ minHeight: 34, border: "1px solid transparent", borderRadius: 9, background: selected ? "#e0e7ff" : "transparent", color: disabled ? "#4b5563" : selected ? "#1e293b" : "#475569", cursor: disabled ? "not-allowed" : "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: selected ? 900 : 750, display: "flex", alignItems: "center", gap: 8, padding: "0 9px", textAlign: "left" }}
              >
                <SectionIcon section={value} index={index} />
                <span>{label}</span>
              </button>
            );
          })}
        </div>,
        document.body
      )}

      <section className="sidebar-account" aria-label="Your account">
        <button
          type="button"
          className="sidebar-account__profile"
          onClick={() => navigate("/edit-profile")}
          title="Edit profile"
          aria-label={`Edit profile for ${profileName}`}
        >
          <span className="sidebar-account__avatar">
            <Avatar initials={profileInitials} src={profileImageUrl} color="#0f766e" size={42} />
          </span>
          <span className="sidebar-account__identity">
            <span className="sidebar-account__name" title={profileName}>{profileDisplayName}</span>
            <span className="sidebar-account__role" title={cleanProfileSubtitle}>{cleanProfileSubtitle || "Dashboard"}</span>
          </span>
          <UserRound size={17} className="sidebar-account__edit" aria-hidden="true" />
        </button>
        <div className="sidebar-account__tools" role="group" aria-label="Account actions">
          <NoticesBell plainIcon className="sidebar-account__tool sidebar-account__tool--notices" style={{ position: "relative" }} />
          <ReportBugButton plainIcon className="sidebar-account__tool sidebar-account__tool--feedback" style={{ position: "relative" }} />
          <button type="button" className="sidebar-account__tool sidebar-account__tool--logout" onClick={onLogout} title="Logout" aria-label="Logout">
            <LogOut size={19} aria-hidden="true" />
          </button>
        </div>
      </section>
    </aside>
  );
}
