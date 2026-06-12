/**
 * Utility functions for working with Gerrit
 * @module utils
 */

// Change ID utilities
export {
  getIdentifierType,
  isChangeId,
  isChangeNumber,
  isValidChangeIdentifier,
  normalizeChangeIdentifier,
} from './change-id'
export {
  type CommentWithContext,
  formatCommentsPretty,
  formatCommentsXml,
} from './comment-formatters'
export {
  extractDiffStats,
  formatDiffPretty,
  formatDiffSummary,
  formatFilesList,
} from './diff-formatters'
// Formatters
export {
  colors,
  formatDate,
  formatRelativeTime,
  formatTimeAgo,
  getStatusIndicator,
} from './formatters'
// Git commit utilities
export {
  extractChangeIdFromCommitMessage,
  GitError,
  getChangeIdFromHead,
  getLastCommitMessage,
  NoChangeIdError,
} from './git-commit'
// Message filtering
export { filterMeaningfulMessages, sortMessagesByDate } from './message-filters'
// Shell safety
export { sanitizeCDATA } from './shell-safety'
// URL parsing
export {
  extractChangeNumber,
  isValidChangeId,
  normalizeGerritHost,
} from './url-parser'
