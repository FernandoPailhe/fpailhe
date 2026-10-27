import type { FeedbackRepository } from "../domain/repositories";

/** Feedback no-op mientras no hay backend (plan universes-community). */
export function createOfflineFeedbackRepository(): FeedbackRepository {
  return {
    async submitFeedback() {
      /* sin backend: se descarta */
    },
    async recordImpression() {
      /* sin backend: se descarta */
    },
  };
}
