# Repository Agent Instructions

## Community release and startup verification

For any request to build, start, inspect, or release-verify the community
edition, follow [e2e-tests/AGENT_GUIDE.md](e2e-tests/AGENT_GUIDE.md). Use
`e2e-tests/verify.sh` as the only orchestration entry point. Target the exact
worktree with `--project-root`; do not fetch, checkout, or merge as part of a
verification run.

Do not print credentials. The lifecycle writes Agent-readable credentials to a
mode-`0600` `runtime.env`; read individual values only when a check requires
them. A release verdict requires a successful `--check`, not merely a running
process or a successful curl.
