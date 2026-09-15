import { getSchoolByValue } from "./universityHierarchy";

export const FORM_TYPES = {
  DEFAULT: "FORM_A",
  MEDIA_COMM: "FORM_B",
  DESIGN_ARTS: "FORM_C",
};

export const CREATIVE_FORM_VARIANTS = {
  MEDIA_COMMUNICATION: "mediaCommunication",
  DESIGN_ARTS: "designArts",
};

const FORM_VARIANT_TO_TYPE = {
  standard: FORM_TYPES.DEFAULT,
  mediaCommunication: FORM_TYPES.MEDIA_COMM,
  designArts: FORM_TYPES.DESIGN_ARTS,
};

// If the backend only says "creative" and does not send a subtype yet, keep one deterministic
// creative variant so the app can still route without school-code checks.
const FALLBACK_CREATIVE_FORM_TYPE = FORM_TYPES.DESIGN_ARTS;
const FALLBACK_CREATIVE_VARIANT = CREATIVE_FORM_VARIANTS.DESIGN_ARTS;

export const normalizeCreativeVariant = (value) => {
  const normalized = String(value || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (["media", "mediacommunication", "mediaandcommunication", "mediaandcommunicationstudies"].includes(normalized)) {
    return CREATIVE_FORM_VARIANTS.MEDIA_COMMUNICATION;
  }
  if (["design", "arts", "designarts", "designandarts", "appliedarts"].includes(normalized)) {
    return CREATIVE_FORM_VARIANTS.DESIGN_ARTS;
  }
  return "";
};

const schoolConfigFor = (schoolValue) => getSchoolByValue(schoolValue) || null;

export const creativeFormVariantForSchool = (schoolValue) => {
  const school = schoolConfigFor(schoolValue);
  if (school?.defaultForm === "standard") return "";
  const variant = normalizeCreativeVariant(school?.formVariant || school?.creativeFormVariant || school?.form_variant);
  if (variant) return variant;
  if (school?.defaultForm === "creative") return FALLBACK_CREATIVE_VARIANT;
  return "";
};

export const formTypeForSchool = (schoolValue) => {
  const school = schoolConfigFor(schoolValue);
  if (school?.defaultForm === "standard") return FORM_TYPES.DEFAULT;
  if (school?.formVariant === "standard") return FORM_TYPES.DEFAULT;
  const variant = creativeFormVariantForSchool(schoolValue);
  if (variant) return FORM_VARIANT_TO_TYPE[variant] || FALLBACK_CREATIVE_FORM_TYPE;

  return FORM_TYPES.DEFAULT;
};

export const isCreativeAppraisalSchool = (schoolValue) => {
  const formType = formTypeForSchool(schoolValue);
  return formType === FORM_TYPES.MEDIA_COMM || formType === FORM_TYPES.DESIGN_ARTS;
};

export const isStandardAppraisalSchool = (schoolValue) =>
  formTypeForSchool(schoolValue) === FORM_TYPES.DEFAULT;

export const previousYearFormTypeForSchool = (schoolValue) => {
  const variant = creativeFormVariantForSchool(schoolValue);
  return variant || "engineering";
};
