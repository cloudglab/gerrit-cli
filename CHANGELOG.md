# Changelog

## 0.0.3 - 2026-06-12

Follow-up release after the `v0.0.2` publish workflow failed in CI.

### Fixed

- Use namespace imports for `node:child_process` to avoid Bun/Linux ESM named export compatibility failures in CI.

## 0.0.2 - 2026-06-12

Follow-up release after the initial public publish.

### Fixed

- Pin GitHub Actions publish workflow to Bun `1.3.14` to avoid `latest` runtime drift during npm publishing.

## 0.0.1 - 2026-06-12

Initial public baseline for `@cloudglab/gerrit-cli`.

### Added

- Gerrit CLI entrypoints for change viewing, review, workspace, CI, group, and configuration workflows.
- Structured output modes for human CLI usage, JSON pipelines, XML/CDATA LLM consumption, and automation scripts.
- README hero artwork and GitHub Pages quick reference surface.
- `gerrit-workflow` skill package for AI Agent driven Gerrit review scenarios.
- Productization docs covering roles, scenarios, install/update chain, release planning, and ADRs.
- Daily update probe and enhanced `config show` source/masking output.

### Release Notes

- This release intentionally starts from `0.0.1` as the first public version baseline.
- GitHub Release tags should start at `v0.0.1`.
