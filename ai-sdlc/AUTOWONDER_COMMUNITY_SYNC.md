# AutoWonder Community GitHub Sync Guide

## Purpose and ownership

This runbook publishes an already-reviewed internal `community` commit into
`ai-sdlc/auto-wonder/` in this GitHub monorepo. It does not merge internal
`master`, reinterpret community adaptations, or edit the mirrored files.

The internal `community` tree is the sole source of truth. Keep this runbook
outside `ai-sdlc/auto-wonder/` so the published subtree can remain an exact Git
tree mirror.

## Safety rules

1. Fetch the internal `community` branch, record its full commit ID, and use
   that immutable ID for the entire run. Stop if the source ref moves before
   export.
2. Start from the latest fetched GitHub `upstream/master` in a dedicated
   worktree and branch. Never sync directly on `master`.
3. Export with `git archive`. Never copy a working directory: untracked files,
   ignored build output, local credentials, and work notes must not be
   published.
4. Replace only `ai-sdlc/auto-wonder/`, with deletion semantics. This preserves
   upstream deletions, renames, symlinks, and executable bits.
5. Do not add GitHub-only edits inside the mirrored subtree. Put GitHub
   publication documentation, like this file, outside it.
6. Treat any `docs/superpowers/` entry, secret material, Alibaba-internal
   dependency, or unexplained internal hostname in the exported community tree
   as a blocking defect. Fix it on the internal community branch first, then
   restart this procedure from a new immutable source commit.
7. Push only to the maintainer fork and open a pull request. Never push or merge
   directly to GitHub upstream `master`.

If a boundary check finds a community-source defect, stop the GitHub sync. Fix
the defect on an isolated internal branch, merge its reviewed change into
`community`, fetch `origin/community` again, and restart from a newly pinned
commit. Do not patch the GitHub mirror independently, and do not publish a
commit that is merely based on `community` but has not been merged into it.

## 1. Pin both repositories

Use two clean local checkouts: one for the internal AutoWonder repository and
one for this GitHub repository.

```bash
set -euo pipefail

: "${INTERNAL_REPO:?set INTERNAL_REPO to the internal AutoWonder checkout}"
: "${GITHUB_REPO:?set GITHUB_REPO to the GitHub monorepo checkout}"

INTERNAL_REPO=$(cd "$INTERNAL_REPO" && pwd -P)
GITHUB_REPO=$(cd "$GITHUB_REPO" && pwd -P)

git -C "$INTERNAL_REPO" fetch origin community
git -C "$GITHUB_REPO" fetch origin master --prune
git -C "$GITHUB_REPO" fetch upstream master --prune

SOURCE_COMMIT=$(git -C "$INTERNAL_REPO" rev-parse origin/community)
GITHUB_BASE=$(git -C "$GITHUB_REPO" rev-parse upstream/master)
printf 'SOURCE_COMMIT=%s\nGITHUB_BASE=%s\n' "$SOURCE_COMMIT" "$GITHUB_BASE"
```

Confirm the fork base and upstream base agree, or explicitly review the
difference before continuing:

```bash
git -C "$GITHUB_REPO" rev-parse origin/master upstream/master
```

Before creating the worktree, require `git`, `tar`, and `rsync`. On macOS,
install missing commands with Homebrew. On CentOS, install them with the host's
package manager (`dnf install git tar rsync` or `yum install git tar rsync`).
Stop if a prerequisite cannot be installed; never substitute a working-directory
copy for `git archive` plus `rsync --delete`.

## 2. Create an isolated GitHub worktree

Choose a unique date and the pinned source's short commit ID:

```bash
SOURCE_SHORT=$(git -C "$INTERNAL_REPO" rev-parse --short=9 "$SOURCE_COMMIT")
RUN_DATE=$(date +%Y%m%d)
BRANCH="sync/autowonder-community-${SOURCE_SHORT}-${RUN_DATE}"
WORKTREE_BASE=${WORKTREE_BASE:-"$(dirname "$GITHUB_REPO")/worktrees"}
WORKTREE="$WORKTREE_BASE/autowonder-community-${SOURCE_SHORT}-${RUN_DATE}"

mkdir -p "$WORKTREE_BASE"
git -C "$GITHUB_REPO" worktree add "$WORKTREE" -b "$BRANCH" "$GITHUB_BASE"
```

`INTERNAL_REPO`, `GITHUB_REPO`, and optionally `WORKTREE_BASE` are execution
inputs, not repository constants. The operator or Agent supplies them for the
current machine. Never commit a developer home directory or machine-specific
absolute path into this runbook or a helper script.

Run the current GitHub baseline verification from
`$WORKTREE/ai-sdlc/auto-wonder` before replacing any file. Use the commands in
that version's `docs/community/verification.md`. A failing baseline must be
recorded and investigated before attributing failures to the new sync.

## 3. Export and mirror the pinned community tree

The target guard prevents an incorrectly resolved variable from widening the
deletion scope:

```bash
TARGET="$WORKTREE/ai-sdlc/auto-wonder"
STAGE=$(mktemp -d)

test "$(git -C "$INTERNAL_REPO" rev-parse origin/community)" = "$SOURCE_COMMIT"
test -d "$TARGET"
test "$(git -C "$WORKTREE" rev-parse --show-toplevel)" = "$WORKTREE"

git -C "$INTERNAL_REPO" archive --format=tar "$SOURCE_COMMIT" |
  tar -xf - -C "$STAGE"
rsync -a --delete "$STAGE/" "$TARGET/"
```

The temporary stage may be deleted after all verification is complete. Never
use a broad cleanup command or an unresolved path.

## 4. Prove exact tree identity

Stage the mirror and compare the source and destination Git trees. `ls-tree`
compares every relative path, Blob ID, and Git file mode, so an empty diff
proves content and executable-bit identity without reading ignored files.

```bash
git -C "$WORKTREE" add -A ai-sdlc/auto-wonder
INDEX_TREE=$(git -C "$WORKTREE" write-tree)

git -C "$INTERNAL_REPO" ls-tree -r "$SOURCE_COMMIT" >"$STAGE/source.tree"
git -C "$WORKTREE" ls-tree -r "$INDEX_TREE:ai-sdlc/auto-wonder" \
  >"$STAGE/github.tree"
diff -u "$STAGE/source.tree" "$STAGE/github.tree"
```

Also require these boundary checks:

```bash
test -z "$(git -C "$INTERNAL_REPO" ls-tree -r --name-only "$SOURCE_COMMIT" |
  grep -E '(^|/)docs/superpowers/')"
git -C "$WORKTREE" diff --check --cached
git -C "$WORKTREE" status --short
```

Run the repository's established secret scanner and community dependency checks.
Do not paste matching secret values into logs or pull-request text.

## 5. Verify the published result

Follow `ai-sdlc/auto-wonder/AGENTS.md` and
`ai-sdlc/auto-wonder/e2e-tests/AGENT_GUIDE.md`. At minimum:

1. Run the complete Maven build with the repository-pinned frontend toolchain.
2. Run deployment and upgrade Skill test suites named by
   `docs/community/verification.md`.
3. Run internal-reference and dependency-boundary scans.
4. Start the exact GitHub worktree with `e2e-tests/verify.sh --start
   --project-root "$WORKTREE/ai-sdlc/auto-wonder" --mode image
   --keep-on-failure`.
5. Run `verify.sh --check`; `VERDICT=STARTED` alone is not a release verdict.
6. Always run `verify.sh --clean-up` after inspection, even after a failure.

Do not source or print `runtime.env`. It is mode `0600`; read an individual
value only when a test needs it.

### macOS GNU checksum compatibility

Some deployment and upgrade tests execute Linux remote-operation fixtures on
the macOS control host and therefore require a command named `sha256sum`.
Homebrew installs that command as `gsha256sum`. If the pinned community source
does not yet bootstrap `coreutils`, install it and expose only the checksum
command for the verification process:

```bash
brew install coreutils
CHECKSUM_BIN=$(mktemp -d)
ln -s "$(brew --prefix coreutils)/bin/gsha256sum" "$CHECKSUM_BIN/sha256sum"
PATH="$CHECKSUM_BIN:$PATH" python3 -m pytest tests -q
```

Do not prepend the complete Homebrew `coreutils/libexec/gnubin` directory on
macOS. That also replaces BSD `stat` with GNU `stat`, causing mode-`0600`
checks to report false failures. Record this compatibility override in the pull
request; it is verifier environment state, not a source-tree modification.

## 6. Commit, push, and open the pull request

Record both immutable commits in the commit message:

```bash
git -C "$WORKTREE" add -A ai-sdlc/auto-wonder \
  ai-sdlc/AUTOWONDER_COMMUNITY_SYNC.md
git -C "$WORKTREE" commit -m "sync(autowonder): publish community ${SOURCE_SHORT}"
git -C "$WORKTREE" push -u origin "$BRANCH"
```

After committing, repeat the `ls-tree` comparison against
`HEAD:ai-sdlc/auto-wonder`, confirm the remote branch resolves to local `HEAD`,
and include the following evidence in the pull request:

- full internal community source commit;
- GitHub upstream base commit;
- source/destination tree identity result;
- changed-file summary;
- Maven, frontend, Skill, boundary, E2E start/check, and cleanup results;
- confirmation that `VERSION` and its matching release file are unchanged or
  updated together;
- any known warning or deferred follow-up.
