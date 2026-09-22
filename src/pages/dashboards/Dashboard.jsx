import { useState } from "react";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import DashboardSidebar from "../../components/dashboard/DashboardSidebar";
import { APP_INFO, MyAppraisalSection } from "../../features/faculty-appraisal";
import { useAssignedFormAssignment } from "../../features/faculty-appraisal/hooks/useAssignedFormAssignment";
import { useCustomFormParts } from "../../features/faculty-appraisal/hooks/useCustomFormParts";

export default function Dashboard() {
  const [activeMainTab, setActiveMainTab] = useState("myAppraisal");
  const [appraisalSection, setAppraisalSection] = useState("partA");
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const storedAcademicYear = sessionStorage.getItem("academicYear") || APP_INFO.DEFAULT_AY;

  const { assignment, isCustomForm } = useAssignedFormAssignment();
  const customParts = useCustomFormParts(assignment, storedAcademicYear);
  const customSectionOptions = isCustomForm && customParts
    ? [...customParts.map((label) => [label, label]), ["Summary", "Summary"]]
    : null;
  // While a custom form's real parts are loading (or the stored "partA" default doesn't
  // match any of them), fall back to the first real part instead of a part that doesn't exist.
  const effectiveSection = customSectionOptions?.length && !customSectionOptions.some(([value]) => value === appraisalSection)
    ? customSectionOptions[0][0]
    : appraisalSection;

  const navItems = [
    { id: "myAppraisal", icon: "", label: "My Appraisal", sub: "View your self-appraisal form" },
  ];

  const handleSectionChange = (section) => {
    setAppraisalSection(section);
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
  };

  return (
    <DashboardLayout
      appInfo={APP_INFO}
      showLogoutModal={showLogoutModal}
      onCancelLogout={() => setShowLogoutModal(false)}
      containerStyle={{ display: "flex", minHeight: "100vh", fontFamily: "inherit", background: "#f8fafc", color: "#111827" }}
      mainStyle={{ flex: 1, padding: "40px", display: "flex", flexDirection: "column", gap: 24, overflowX: "auto", maxWidth: 1600, margin: "0 auto", width: "100%" }}
      sidebar={(
        <DashboardSidebar
          appInfo={APP_INFO}
          navItems={navItems}
          activeTab={activeMainTab}
          onTabSelect={setActiveMainTab}
          showSectionSelector={activeMainTab === "myAppraisal"}
          sectionTab={effectiveSection}
          onSectionChange={handleSectionChange}
          customSectionOptions={customSectionOptions}
          profileSubtitle={`${sessionStorage.getItem("role") || "Faculty"} ${sessionStorage.getItem("department")?.split(" ")[0] || ""}`}
          onLogout={() => setShowLogoutModal(true)}
        />
      )}
    >
      {activeMainTab === "myAppraisal" && (
        <MyAppraisalSection
          sectionTab={effectiveSection}
          onSectionTabChange={handleSectionChange}
          defaultAcademicYear={storedAcademicYear}
        />
      )}
    </DashboardLayout>
  );
}
