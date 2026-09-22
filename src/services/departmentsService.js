import { api } from "./api";
import { UNIVERSITY_SCHOOLS, getSchoolKey } from "../constants/universityHierarchy";

// School-scoped department list, managed by the Director of that school.
// Backend contract documented in backend_changes_requied.md.
const normalizeDepartment = (raw = {}) => ({
  id: raw.id ?? raw.department_id ?? raw.departmentId ?? "",
  name: raw.name ?? raw.department_name ?? raw.departmentName ?? "",
  schoolCode: raw.school_code ?? raw.schoolCode ?? raw.school ?? "",
});

// The School object from GET /schools carries its own `departments` string array. For
// admin-created schools that can be populated while GET /schools/{code}/departments is still
// empty (the two are separate backend tables and don't always stay in sync). Use it as a
// fallback so a faculty on such a school still gets a department picker - without one they
// submit with no department and the appraisal skips the HOD stage entirely.
const departmentsFromSchoolObject = (schoolCode) => {
  const code = getSchoolKey(schoolCode) || String(schoolCode || "").trim();
  const school = UNIVERSITY_SCHOOLS.find((entry) => entry.code === code);
  return (Array.isArray(school?.departments) ? school.departments : [])
    .map((name) => String(name || "").trim())
    .filter(Boolean)
    .map((name) => ({ id: name, name, schoolCode: code }));
};

export const listSchoolDepartments = async (schoolCode) => {
  if (!schoolCode) return [];
  let fromEndpoint = [];
  try {
    const items = await api.get(`/schools/${encodeURIComponent(schoolCode)}/departments`);
    fromEndpoint = (Array.isArray(items) ? items : []).map(normalizeDepartment).filter((dept) => dept.name);
  } catch {
    // fall through to the School-object fallback below
  }
  return fromEndpoint.length ? fromEndpoint : departmentsFromSchoolObject(schoolCode);
};

export const addSchoolDepartment = async (schoolCode, name) => {
  if (!schoolCode || !String(name || "").trim()) {
    throw new Error("School and department name are required.");
  }
  const created = await api.post(`/schools/${encodeURIComponent(schoolCode)}/departments`, {
    name: String(name).trim(),
  });
  return normalizeDepartment(created || {});
};

export const removeSchoolDepartment = async (schoolCode, departmentId) => {
  if (!schoolCode || !departmentId) {
    throw new Error("School and department are required.");
  }
  return await api.delete(`/schools/${encodeURIComponent(schoolCode)}/departments/${encodeURIComponent(departmentId)}`);
};
