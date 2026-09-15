import { NonTeachingReviewDashboard } from "./NonTeachingStaffDashboard";

// Registrar owns two queues (Non-Teaching Staff review, and the Part D track for teaching
// staff). Both render inside NonTeachingReviewDashboard's single sidebar/layout as ordinary
// nav tabs, so switching between them stays on the same page instead of swapping dashboards.
export default function RegistrarDashboard() {
  return (
    <NonTeachingReviewDashboard
      reviewerRole="registrar"
      title="Registrar"
      subtitle="Reporting Officer and staff review"
      accent="#155e75"
      showPartD
    />
  );
}
