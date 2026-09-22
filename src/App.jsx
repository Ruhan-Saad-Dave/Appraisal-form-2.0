import { lazy, Suspense, useState, useEffect } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import ProtectedRoute from "./auth/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import { getActiveAcademicYear, normalizeRole, setActiveAcademicYear, storeUserSession } from "./auth/session";
import { APP_INFO } from "./constants/formConfig";
import { getMe } from "./services/authService";
import { refreshSchoolsOnce } from "./services/schoolsService";
import { api } from "./services/api";
import { refreshAcademicYearCycles } from "./services/academicYearCycles";

const normalizeAcademicYearCycles = (cyclesData) => {
  const normalizeAcademicYearLabel = (value) => {
    const label = String(value || "").trim();
    const shortMatch = label.match(/^(\d{2})-(\d{2})$/);
    if (shortMatch) return `20${shortMatch[1]}-20${shortMatch[2]}`;
    return label;
  };

  const normalizeCycle = (cycle) => {
    if (!cycle) return null;
    if (typeof cycle === "string") {
      return { academic_year: cycle, is_open: cycle === APP_INFO.DEFAULT_AY };
    }

    const academicYear = normalizeAcademicYearLabel(cycle.academic_year || cycle.academicYear || cycle.year || cycle.year_label || "");
    if (!academicYear) return null;

    return {
      academic_year: academicYear,
      is_open: cycle.is_open ?? cycle.isOpen ?? cycle.active ?? cycle.open ?? (String(academicYear) === APP_INFO.DEFAULT_AY),
    };
  };

  let list = [];
  if (Array.isArray(cyclesData)) {
    list = cyclesData.map(normalizeCycle).filter(Boolean);
  } else if (Array.isArray(cyclesData?.cycles)) {
    list = cyclesData.cycles.map(normalizeCycle).filter(Boolean);
  } else if (Array.isArray(cyclesData?.data)) {
    list = cyclesData.data.map(normalizeCycle).filter(Boolean);
  }

  // If backend provided no cycles (e.g. offline / fallback), keep only the active default year.
  if (list.length === 0) {
    const openYear = APP_INFO.DEFAULT_AY || "2026-2027";
    list.push({ academic_year: openYear, is_open: true });
  }

  return list
    .reduce((acc, cycle) => {
      if (!acc.some((existing) => existing.academic_year === cycle.academic_year)) {
        acc.push(cycle);
      }
      return acc;
    }, [])
    .sort((a, b) => b.academic_year.localeCompare(a.academic_year));
};

const Login        = lazy(() => import("./pages/Login"));
const Signup       = lazy(() => import("./pages/Signup"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const FacultyProfile = lazy(() => import("./pages/FacultyProfile"));
const EditProfile  = lazy(() => import("./pages/EditProfile"));
const RoleDashboard = lazy(() => import("./pages/RoleDashboard"));

// - Shared loading screen -
function PageLoader({ message = "Loading..." }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit", color: "#64748b", fontSize: 14 }} className="fa-fade-in">
      {message}
    </div>
  );
}

// - Profile Loader -
function ProfileLoader() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const profile = await getMe();
        if (cancelled) return;
        // Load live schools (incl. admin-created ones) before canonicalising this user's school,
        // so a dynamic-school user's `school` / review-queue scope resolves correctly on refresh.
        await refreshSchoolsOnce().catch(() => {});
        if (cancelled) return;
        storeUserSession({ profile });

        const storedAcademicYear = getActiveAcademicYear(profile.academic_year || profile.academicYear || profile.ay || APP_INFO.DEFAULT_AY);
        let ay = storedAcademicYear;
        let cycles = [];

        try {
          const cyclesData = await api.get("/appraisal/cycles");
          cycles = normalizeAcademicYearCycles(cyclesData);
          if (cycles.length) {
            const matchingCycle = storedAcademicYear ? cycles.find((c) => c.academic_year === storedAcademicYear) : null;
            const openCycle = cycles.find((c) => c.is_open);
            const defaultYearCycle = cycles.find((c) => c.academic_year === APP_INFO.DEFAULT_AY);
            const defaultCycle = openCycle || defaultYearCycle || matchingCycle || cycles[0];
            if (defaultCycle) {
              ay = defaultCycle.academic_year;
            }
          }
        } catch (error) {
          console.error("Could not load academic year cycles, falling back to default:", error);
        }

        if (!ay) ay = APP_INFO.DEFAULT_AY;

        setActiveAcademicYear(ay);
        sessionStorage.setItem("availableCycles", JSON.stringify(cycles));
        localStorage.setItem("availableCycles", JSON.stringify(cycles));
        sessionStorage.setItem("availableCyclesSource", "backend");
        localStorage.setItem("availableCyclesSource", "backend");
        window.dispatchEvent(new CustomEvent("academicYearChanged", { detail: { academicYear: ay } }));

        const role = normalizeRole(profile.appraisal_role || profile.role, "faculty");
        const name = profile.full_name || "";
        setUser({
          name,
          role,
          employeeId: profile.employee_id || "",
          designation: profile.designation || "",
          qualification: profile.qualification || "",
          department: profile.department || "",
          school: profile.school || "",
          experience: profile.teaching_experience || "",
          phone: profile.phone || "",
          avatarUrl: profile.profile_picture_url || profile.profilePictureUrl || profile.avatar_url || profile.avatarUrl || profile.photo_url || profile.photoUrl || "",
          avatar: name.trim().split(/\s+/).map(n => n[0]).join("").substring(0, 2).toUpperCase() || "U",
          ay,
          cycles,
        });
      } catch {
        if (!cancelled) setError("Unable to load profile. Please log in again.");
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  if (error) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit", color: "#991b1b", fontSize: 14 }} className="fa-fade-in">
        {error} <button onClick={() => navigate("/login")} style={{ marginLeft: 12, cursor: "pointer" }}>Log in</button>
      </div>
    );
  }

  if (!user) {
    return <PageLoader message="Loading profile..." />;
  }

  return (
    <FacultyProfile
      user={user}
      onProceed={() => navigate("/dashboard")}
    />
  );
}

// - App Routes -
export default function App() {
  useEffect(() => {
    const isNumberInput = (target) => target?.tagName === "INPUT" && target?.type === "number";
    const preventWheelChange = (event) => {
      if (isNumberInput(event.target) && document.activeElement === event.target) {
        event.preventDefault();
        event.target.blur();
      }
    };
    const preventArrowKeyChange = (event) => {
      if (isNumberInput(event.target) && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
        event.preventDefault();
      }
    };

    document.addEventListener("wheel", preventWheelChange, { capture: true, passive: false });
    document.addEventListener("keydown", preventArrowKeyChange, true);
    return () => {
      document.removeEventListener("wheel", preventWheelChange, { capture: true });
      document.removeEventListener("keydown", preventArrowKeyChange, true);
    };
  }, []);

  useEffect(() => {
    refreshAcademicYearCycles();
  }, []);

  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfileLoader />
              </ProtectedRoute>
            }
          />

          <Route
            path="/edit-profile"
            element={
              <ProtectedRoute>
                <EditProfile />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <RoleDashboard />
              </ProtectedRoute>
            }
          />

          <Route path="/hod-dashboard" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dean-dashboard" element={<Navigate to="/dashboard" replace />} />
          <Route path="/director-dashboard" element={<Navigate to="/dashboard" replace />} />
          <Route path="/vc-dashboard" element={<Navigate to="/dashboard" replace />} />
          <Route path="/hoddashboard" element={<Navigate to="/dashboard" replace />} />
          <Route path="/deandashboard" element={<Navigate to="/dashboard" replace />} />
          <Route path="/directordashboard" element={<Navigate to="/dashboard" replace />} />
          <Route path="/vcdashboard" element={<Navigate to="/dashboard" replace />} />

          <Route path="/" element={<Navigate to="/login" />} />
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
