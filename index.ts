// ─── API Client ────────────────────────────────────────────────────────────
export { GerritApiService, ApiError, GerritApiServiceLive } from './src/api/gerrit'
export type { GerritApiServiceImpl, ApiErrorFields } from './src/api/gerrit-types'

// ─── Services ──────────────────────────────────────────────────────────────
export { ConfigService, ConfigServiceLive } from './src/services/config'

// ─── Core Schemas & Types ──────────────────────────────────────────────────
export type {
  GerritCredentials,
  ChangeInfo,
  CommentInfo,
  MessageInfo,
  ReviewerInput,
  ReviewInput,
  DiffOptions,
  FileDiffContent,
  FileInfo,
  ProjectInfo,
  RevisionInfo,
  SubmitInfo,
  GroupInfo,
  GroupDetailInfo,
  AccountInfo,
} from './src/schemas/gerrit'

// ─── CLI Bootstrap ─────────────────────────────────────────────────────────
// Architecture aligned with zentao-cli: separate SDK exports from CLI bootstrap
export { runCli } from './src/cli-bootstrap'
