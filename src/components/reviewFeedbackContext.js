import { createContext, useContext } from "react";

export const ReviewFeedbackContext = createContext(null);

export function useReviewFeedback() {
  const showFeedback = useContext(ReviewFeedbackContext);
  if (!showFeedback) throw new Error("Review feedback requires ReviewFeedbackProvider.");
  return showFeedback;
}
