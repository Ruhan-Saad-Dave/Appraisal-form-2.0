import StandardMyAppraisal from "./StandardMyAppraisal";
import { useEffect, useState } from 'react';
import { isLegacyTwoPartAcademicYear } from './legacyPreviousYearReportUtils';
import { FORM_TYPES, formTypeForSchool } from "../../../../constants/formRouting";
import { useSchools } from "../../../../services/schoolsService";
import CreativeMyAppraisalSection from "../CreativeSchool/CreativeMyAppraisalSection";
import { getSchoolByValue } from "../../../../constants/universityHierarchy";
import { getActiveAcademicYear } from "../../../../auth/session";
import AssignedSchemaPreview from "../../components/AssignedSchemaPreview";
import SchemaPreviewOverview from "../../components/SchemaPreviewOverview";

export default function MyAppraisalSection({
  sectionTab,
  onSectionTabChange,
  defaultDesignation = "",
  defaultAcademicYear,
  titleNameFallback = "Faculty",
  subtitleSeparator = ".",
}) {
  useSchools();
  const [selectedYear, setSelectedYear] = useState(defaultAcademicYear || getActiveAcademicYear());
  const [progress, setProgress] = useState(null);
  useEffect(() => {
    const sync = (event) => setSelectedYear(event.detail?.academicYear || getActiveAcademicYear());
    window.addEventListener('academicYearChanged', sync);
    return () => window.removeEventListener('academicYearChanged', sync);
  }, []);
  const school = sessionStorage.getItem("school") || sessionStorage.getItem("schoolName") || "";
  const formType = formTypeForSchool(school);
  const config = getSchoolByValue(school);
  // Do not briefly mount an editable built-in form while assignment data loads.
  if (school && !config) {
    return <div role="status" style={{ padding: 20 }}>Waiting for your school assignment. If this persists, reload the page or check access to the schools service.</div>;
  }
  const assignment = config?.defaultForm || config?.formVariant || '';
  const previewYear = selectedYear;
  // Opt-in preview only; historical and built-in renderers remain unchanged.
  if (assignment.startsWith('custom_') && !isLegacyTwoPartAcademicYear(previewYear)) {
    return <SchemaPreviewOverview key={`${school}:${assignment}:${previewYear}`} school={school} academicYear={previewYear} progress={progress?.academicYear === previewYear && progress?.assignment === assignment ? progress : null}><AssignedSchemaPreview assignment={assignment} school={school} academicYear={previewYear} sectionTab={sectionTab} onSectionTabChange={onSectionTabChange} onProgressChange={setProgress} /></SchemaPreviewOverview>;
  }

  if (formType === FORM_TYPES.MEDIA_COMM || formType === FORM_TYPES.DESIGN_ARTS) {
    return (
      <CreativeMyAppraisalSection
        sectionTab={sectionTab}
        onSectionTabChange={onSectionTabChange}
        defaultDesignation={defaultDesignation}
        defaultAcademicYear={selectedYear}
      />
    );
  }

  return (
    <StandardMyAppraisal
      sectionTab={sectionTab}
      onSectionTabChange={onSectionTabChange}
      defaultDesignation={defaultDesignation}
      defaultAcademicYear={selectedYear}
      titleNameFallback={titleNameFallback}
      subtitleSeparator={subtitleSeparator}
    />
  );
}
