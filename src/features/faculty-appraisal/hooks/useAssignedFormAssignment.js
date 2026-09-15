import { useSchools } from "../../../services/schoolsService";
import { getSchoolByValue } from "../../../constants/universityHierarchy";

export function useAssignedFormAssignment() {
  useSchools();
  const school = sessionStorage.getItem("school") || sessionStorage.getItem("schoolName") || "";
  const config = getSchoolByValue(school);
  const assignment = config?.defaultForm || config?.formVariant || "";
  return { school, config, assignment, isCustomForm: assignment.startsWith("custom_") };
}
