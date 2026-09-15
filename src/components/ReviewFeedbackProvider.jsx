import { useCallback, useRef, useState } from "react";
import SubmissionConfirmDialog from "../features/faculty-appraisal/components/SubmissionConfirmDialog";
import { ReviewFeedbackContext } from "./reviewFeedbackContext";

// Keep feedback above review panels so closing a completed form cannot hide it.
export default function ReviewFeedbackProvider({ children }) {
  const [queue, setQueue] = useState([]);
  const nextId = useRef(0);
  const settledId = useRef(-1);
  const showFeedback = useCallback((message, state = "error", title) => new Promise((resolve) => {
    const entry = { id: nextId.current++, message, state, title, resolve };
    setQueue((current) => [...current, entry]);
  }), []);
  const active = queue[0];

  const dismiss = (confirmed = false) => {
    if (!active || active.id <= settledId.current) return;
    settledId.current = active.id;
    setQueue((current) => current.slice(1));
    active.resolve(confirmed);
  };

  return (
    <ReviewFeedbackContext.Provider value={showFeedback}>
      {children}
      {active && <SubmissionConfirmDialog
        key={active.id}
        state={active.state}
        eyebrow="Appraisal review"
        title={active.title || (active.state === "reject" ? "Reject appraisal?" : active.state === "success" ? "Review submitted" : "Review requires attention")}
        confirmMessage={active.message}
        confirmLabel={active.state === "reject" ? "Yes, reject" : undefined}
        showSubmissionNote={active.state !== "reject"}
        successMessage={active.message}
        errorMessage={active.message}
        closeLabel="OK"
        onCancel={() => dismiss(false)}
        onConfirm={() => dismiss(true)}
      />}
    </ReviewFeedbackContext.Provider>
  );
}
