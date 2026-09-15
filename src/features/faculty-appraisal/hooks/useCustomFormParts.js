import { useEffect, useState } from "react";
import { fetchDynamicFormSchema } from "../../dynamic-appraisal/services/dynamicFormSchemaCache";
import { buildSchemaPreview } from "../../../utils/schemaPreview";

// Returns the ordered list of Part labels ("Part A", "Part B", ...) actually configured
// for a custom (admin-built) form, so navigation can show only the parts that exist
// instead of a fixed Part A-E + Summary list. Returns null while not applicable
// (not a custom assignment, or not loaded yet) and [] if the schema has no parts.
export function useCustomFormParts(assignment, academicYear) {
  const [state, setState] = useState({ key: null, parts: null });
  const isCustom = Boolean(assignment && assignment.startsWith("custom_") && academicYear);
  const key = isCustom ? `${assignment}:${academicYear}` : null;

  useEffect(() => {
    if (!key) return undefined;
    let cancelled = false;
    fetchDynamicFormSchema({ academicYear })
      .then((records) => {
        const preview = buildSchemaPreview(records, assignment);
        // Reviewer-only parts are never filled in by faculty (see AssignedSchemaPreview.jsx)
        // so they must not get a navigation tab in the faculty's own form either.
        if (!cancelled) setState({ key, parts: preview.parts.filter((part) => !part.isReviewerOnlyPart).map((part) => part.label) });
      })
      .catch(() => { if (!cancelled) setState({ key, parts: [] }); });
    return () => { cancelled = true; };
  }, [key, assignment, academicYear]);

  if (!isCustom) return null;
  return state.key === key ? state.parts : null;
}
