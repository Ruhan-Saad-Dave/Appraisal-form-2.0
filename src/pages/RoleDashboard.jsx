import { lazy, Suspense } from "react";
import { Navigate } from "react-router-dom";
import { normalizeRole } from "../auth/session";
import { departmentHasHod, getDeanTrack, getSchoolHierarchy } from "../utils/hierarchy";
import { isCisrSchool } from "../constants/universityHierarchy";
import { useSchools } from "../services/schoolsService";

// Each dashboard is its own async chunk - only the one matching the user's role
// is ever downloaded, cutting the initial JS payload by ~90% vs eager imports.
const Dashboard                 = lazy(() => import("./dashboards/Dashboard"));
const HODDashboard              = lazy(() => import("./dashboards/HODDashboard"));
const CISRFacultyDashboard      = lazy(() => import("./dashboards/CISRFacultyDashboard"));
const CISRCenterHeadDashboard   = lazy(() => import("./dashboards/CISRCenterHeadDashboard"));
const NonTeachingStaffDashboard = lazy(() => import("./dashboards/nonTeaching/NonTeachingStaffDashboard"));
const ReportingOfficerDashboard = lazy(() => import("./dashboards/nonTeaching/ReportingOfficerDashboard"));
const RegistrarDashboard        = lazy(() => import("./dashboards/nonTeaching/RegistrarDashboard"));
const DeanDashboard             = lazy(() => import("./dashboards/DeanDashboard"));
const NonEngineeringDeanDashboard = lazy(() => import("./dashboards/NonEngineeringDeanDashboard"));
const DirectorDashboard         = lazy(() => import("./dashboards/DirectorDashboard"));
const VCDashboard               = lazy(() => import("./dashboards/VCDashboard"));

function DashboardLoader() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit", color: "#64748b", fontSize: 14 }} className="fa-fade-in">
      Loading dashboard...
    </div>
  );
}

// Inner component: pure routing switch, all branches are lazy dashboard chunks.
function DashboardSwitch({ role, school, department }) {
  switch (role) {
    case "faculty":
      if (isCisrSchool(school)) return <CISRFacultyDashboard />;
      return <Dashboard />;

    case "center_head":
      return <CISRCenterHeadDashboard />;

    case "hod": {
      // An HOD-role user gets the HOD dashboard if EITHER they have a department assigned
      // (the long-standing rule) OR their school is admin-configured has_hod:true. The latter
      // covers a dynamic (admin-created) school whose HOD's department field hasn't propagated
      // to this session yet - without it they'd be shown a Director dashboard and see nothing.
      const hasHod = departmentHasHod(school, department) || getSchoolHierarchy(school)?.hasHod === true;
      if (!hasHod) return <DirectorDashboard />;
      return <HODDashboard />;
    }

    case "director": {
      return <DirectorDashboard />;
    }

    case "dean": {
      if (getDeanTrack({ school, department, appraisal_role: role }) === "non_engineering") return <NonEngineeringDeanDashboard />;
      return <DeanDashboard />;
    }

    case "vc":
      return <VCDashboard />;

    case "registrar":
      return <RegistrarDashboard />;

    case "reporting_officer":
      return <ReportingOfficerDashboard />;

    case "non_teaching_staff":
      return <NonTeachingStaffDashboard />;

    default:
      return <Navigate to="/login" />;
  }
}

export default function RoleDashboard() {
  const { isLive } = useSchools();
  const role       = normalizeRole(sessionStorage.getItem("role"), "");
  const school     = sessionStorage.getItem("school") || "";
  const department = sessionStorage.getItem("department") || "";

  sessionStorage.setItem("role", role);

  const needsSchoolConfig = ["faculty", "hod", "director", "dean", "center_head"].includes(role);
  if (needsSchoolConfig && !isLive) return <DashboardLoader />;

  return (
    <Suspense fallback={<DashboardLoader />}>
      <DashboardSwitch role={role} school={school} department={department} />
    </Suspense>
  );
}
