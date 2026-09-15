import { api } from "./api";

// Bug reports / feedback, backed by the Feedback model (see feedback.py). Submission is public
// (any logged-in user); listing is admin-only.
export const FEEDBACK_CATEGORIES = ["bug", "query", "feedback", "suggestion", "other"];

const normalizeFeedback = (raw = {}) => ({
  id: raw.id,
  name: raw.name || "",
  email: raw.email || "",
  category: raw.category || "other",
  subject: raw.subject || "",
  message: raw.message || "",
  status: raw.status || "new",
  submittedAt: raw.submitted_at || "",
});

export const submitFeedback = async ({ name = "", email, category, subject, message, attachment = null }) => {
  if (!email) throw new Error("Email is required.");
  if (!category) throw new Error("Category is required.");
  if (!String(subject || "").trim()) throw new Error("Subject is required.");
  if (!String(message || "").trim()) throw new Error("Message is required.");

  const fields = {
    name: name?.trim() || undefined,
    email: email.trim().toLowerCase(),
    category,
    subject: subject.trim(),
    message: message.trim(),
  };
  let payload = fields;
  if (attachment) {
    payload = new FormData();
    Object.entries(fields).forEach(([key, value]) => {
      if (value !== undefined) payload.append(key, value);
    });
    payload.append("attachment", attachment);
  }
  const result = await api.post("/feedback", payload, attachment ? { headers: { "Content-Type": undefined } } : undefined);
  return result;
};

export const listFeedback = async ({ category, status, limit } = {}) => {
  const params = {};
  if (category) params.category = category;
  if (status) params.status = status;
  if (limit) params.limit = limit;
  const items = await api.get("/feedback", { params });
  return (Array.isArray(items) ? items : []).map(normalizeFeedback);
};

export const getFeedback = async (id) => {
  if (!id) throw new Error("Feedback id is required.");
  return normalizeFeedback(await api.get(`/feedback/${encodeURIComponent(id)}`));
};
