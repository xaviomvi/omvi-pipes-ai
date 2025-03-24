export const CONFIDENCE_LEVELS = {
  HIGH: 'High' as const,
  MEDIUM: 'Medium' as const,
  LOW: 'Low' as const,
  VERY_HIGH: 'Very High' as const,
  UNKNOWN: 'Unknown' as const,
} as const;

// Create a type from the object values
export type ConfidenceLevel =
  (typeof CONFIDENCE_LEVELS)[keyof typeof CONFIDENCE_LEVELS];
