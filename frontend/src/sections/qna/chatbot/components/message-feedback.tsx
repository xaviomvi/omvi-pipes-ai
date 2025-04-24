import { Icon } from '@iconify/react';
import React, { useState } from 'react';
import checkCircleIcon from '@iconify-icons/mdi/check-circle';
import thumpUpIcon from '@iconify-icons/mdi/thumb-up-outline';
import thumpDownIcon from '@iconify-icons/mdi/thumb-down-outline';

import {
  Box,
  Chip,
  Fade,
  Stack,
  Alert,
  Rating,
  Button,
  Tooltip,
  Collapse,
  Snackbar,
  IconButton,
  Typography,
} from '@mui/material';

interface RatingsState {
  [key: string]: number;
}

interface FeedbackData {
  isHelpful: boolean;
  ratings: Partial<Record<ValidRating, number>>;
  categories: ValidCategory[];
}

interface MessageFeedbackProps {
  messageId: string;
  conversationId: string | null;
  onFeedbackSubmit: (messageId: string, feedback: FeedbackData) => Promise<void>;
}

type ValidRating = 'accuracy' | 'relevance' | 'completeness' | 'clarity';
type ValidCategory =
  | 'incorrect_information'
  | 'missing_information'
  | 'irrelevant_information'
  | 'unclear_explanation'
  | 'poor_citations'
  | 'excellent_answer'
  | 'helpful_citations'
  | 'well_explained'
  | 'other';

const validRatings: ValidRating[] = ['accuracy', 'relevance', 'completeness', 'clarity'];
const validCategories: ValidCategory[] = [
  'incorrect_information',
  'missing_information',
  'irrelevant_information',
  'unclear_explanation',
  'poor_citations',
  'excellent_answer',
  'helpful_citations',
  'well_explained',
  'other',
];

// Map for user-friendly category labels
const categoryLabels: Record<ValidCategory, string> = {
  incorrect_information: 'Incorrect Information',
  missing_information: 'Missing Information',
  irrelevant_information: 'Irrelevant Information',
  unclear_explanation: 'Unclear Explanation',
  poor_citations: 'Poor Citations',
  excellent_answer: 'Excellent Answer',
  helpful_citations: 'Helpful Citations',
  well_explained: 'Well Explained',
  other: 'Other',
};

const MessageFeedback = ({ messageId, conversationId, onFeedbackSubmit }: MessageFeedbackProps) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [selectedCategories, setSelectedCategories] = useState<ValidCategory[]>([]);
  const [ratings, setRatings] = useState<RatingsState>({});
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error',
  });

  const handleCloseSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  const showSuccessSnackbar = (message: string) => {
    setSnackbar({
      open: true,
      message,
      severity: 'success',
    });
  };

  const showErrorSnackbar = (message: string) => {
    setSnackbar({
      open: true,
      message,
      severity: 'error',
    });
  };

  const handlePositiveFeedback = async (): Promise<void> => {
    try {
      await onFeedbackSubmit(messageId, {
        isHelpful: true,
        ratings: { clarity: 5 },
        categories: ['excellent_answer', 'well_explained'],
      });
      setIsSubmitted(true);
      showSuccessSnackbar('Thank you for your positive feedback');
    } catch (error) {
      console.error('Error submitting feedback:', error);
      // showErrorSnackbar('Failed to submit feedback. Please try again.');
    }
  };

  const handleNegativeFeedbackSubmit = async (): Promise<void> => {
    try {
      const validatedRatings: Partial<Record<ValidRating, number>> = {};
      Object.entries(ratings).forEach(([key, value]) => {
        if (validRatings.includes(key as ValidRating) && value >= 1 && value <= 5) {
          validatedRatings[key as ValidRating] = value;
        }
      });

      const validatedCategories = selectedCategories.filter((cat) => validCategories.includes(cat));

      await onFeedbackSubmit(messageId, {
        isHelpful: false,
        ratings: validatedRatings,
        categories: validatedCategories,
      });
      setIsSubmitted(true);
      setIsExpanded(false);
      showSuccessSnackbar('Thank you for your detailed feedback');
    } catch (error) {
      console.error('Error submitting feedback:', error);
      // showErrorSnackbar('Failed to submit feedback. Please try again.');
    }
  };

  const handleCategoryToggle = (categoryId: ValidCategory): void => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId]
    );
  };

  const handleRatingChange = (type: string, value: number | null): void => {
    if (value && value >= 1 && value <= 5) {
      setRatings((prev) => ({
        ...prev,
        [type]: value,
      }));
    }
  };

  if (isSubmitted) {
    return (
      <Fade in>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            color: 'success.main',
          }}
        >
          <Icon icon={checkCircleIcon} width={16} height={16} />
          <Typography variant="caption">Thank you for your feedback</Typography>
        </Box>
      </Fade>
    );
  }

  return (
    <Box>
      {/* Quick Feedback Buttons */}
      {!isExpanded && (
        <Stack direction="row" spacing={1}>
          <Tooltip title="This was helpful">
            <IconButton
              size="small"
              onClick={handlePositiveFeedback}
              sx={{
                '&:hover': {
                  color: 'success.main',
                },
              }}
            >
              <Icon icon={thumpUpIcon} width={16} height={16} />
            </IconButton>
          </Tooltip>
          <Tooltip title="This needs improvement">
            <IconButton
              size="small"
              onClick={() => setIsExpanded(true)}
              sx={{
                '&:hover': {
                  color: 'error.main',
                },
              }}
            >
              <Icon icon={thumpDownIcon} width={16} height={16} />
            </IconButton>
          </Tooltip>
        </Stack>
      )}

      {/* Detailed Negative Feedback Form */}
      <Collapse in={isExpanded}>
        <Box
          sx={{
            mt: 2,
            p: 2,
            bgcolor: 'background.paper',
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography variant="subtitle2" gutterBottom>
            What could be improved?
          </Typography>

          {/* Ratings */}
          <Stack spacing={1.5} sx={{ mb: 2 }}>
            {validRatings.map((ratingId) => (
              <Box key={ratingId} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="caption" sx={{ width: 100, textTransform: 'capitalize' }}>
                  {ratingId}
                </Typography>
                <Rating
                  size="small"
                  value={ratings[ratingId] || 0}
                  onChange={(_, value) => handleRatingChange(ratingId, value)}
                />
              </Box>
            ))}
          </Stack>

          {/* Categories */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
            {validCategories.map((categoryId) => (
              <Chip
                key={categoryId}
                label={categoryLabels[categoryId]}
                size="small"
                onClick={() => handleCategoryToggle(categoryId)}
                color={selectedCategories.includes(categoryId) ? 'primary' : 'default'}
                variant={selectedCategories.includes(categoryId) ? 'filled' : 'outlined'}
              />
            ))}
          </Box>

          {/* Action Buttons */}
          <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
            <Button size="small" variant="outlined" onClick={() => setIsExpanded(false)}>
              Cancel
            </Button>
            <Button
              size="small"
              variant="contained"
              onClick={handleNegativeFeedbackSubmit}
              disabled={Object.keys(ratings).length === 0 && selectedCategories.length === 0}
            >
              Submit
            </Button>
          </Stack>
        </Box>
      </Collapse>

      {/* Snackbar for feedback submission status */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          variant="filled"
          sx={{
            width: '100%',
            boxShadow: '0px 3px 8px rgba(0, 0, 0, 0.12)',
          }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default MessageFeedback;
