# Release v0.8.0

- Version: `0.7.0` → `0.8.0`
- Bump rationale: **MINOR** (pre-1.0). Substantial backward-compatible feature
  growth — a platform administrator role, workspace edit / soft-delete /
  recycle bin / restore, ACP conversation elicitation, server-side executor
  launch-command and launch-options generation with matching MCP tools, a
  Qoder provider model catalog refreshed from idle runtimes, work-item CLI
  download tokens, work-item credits aggregation, skill-package file browsing,
  and scheduled-task logical delete. 56 `feat:` commits, 68 `fix:` commits,
  three additive migrations. **Zero `BREAKING CHANGE` markers** in any subject
  or body across the window and zero `!:` breaking suffixes; no public REST
  path was removed or renamed. That is MINOR under SemVer, not MAJOR.
  It is not PATCH because the change is far beyond fixes, docs and deployment
  process. It is not "no bump" because the tree moved by 309 paths.
- Previous master baseline: `25371cb104ac019fb26674f0c495c410c01e5041`
- New master baseline (merged target — **candidate**, see the note below):
  `b52cdeeea3b82316ee370e56d5533e6a8d9245b3`
- Release-parent Community commit: `c3a75ae60462e3bdc93d1e9fb82041dc9d442f51`
- Community merge commit: `616b84687e15702cbc42ac677021499352037e8f`
- Scope: 276 upstream commits (225 non-merge, 51 merge), 335 upstream changed
  paths, 309 final changed paths against the previous community tip
  (+34,004 / −1,872).

**Note on the recorded baseline.** Per `docs/community/upstream-sync-guide.md`
("Never move the recorded baseline until the merge and required verification
have completed and the independent sync review has passed"), **two** conditions
gate the move, and this note originally stated only one of them. The baseline
recorded in `docs/community/upstream-sync-log.md` remains
`25371cb104ac019fb26674f0c495c410c01e5041`.
`b52cdeeea3b82316ee370e56d5533e6a8d9245b3` is the *candidate* new baseline.
Status of the two conditions as of SDLC step `400360`:

1. **Independent sync review — PASSED.** Step `400360` performed the three-stage
   review; its findings and disposition are recorded in the 2026-09-07 entry of
   `docs/community/upstream-sync-log.md`. No finding was critical.
2. **Merge completed — NOT YET.** `refs/remotes/origin/community` is still
   `c3a75ae60462e3bdc93d1e9fb82041dc9d442f51`. Merge `616b84687` sits on the sync
   branch `aw/community-sync-b52cdeeea-20260906` and cannot land until a human
   reviews and merges the internal MR, because `community` is protected and
   AGENT.md responsibility 2 forbids auto-merging it (SDLC step `400361`).

The candidate therefore becomes the recorded baseline only **after** the human
merges that MR. Moving it now would advertise a synchronized baseline that
`community` does not contain. Ancestry was proved, not assumed:
`25371cb1` is an ancestor of `c3a75ae6`; `c3a75ae6` and `b52cdeeea` are both
ancestors of the merge commit `616b84687`.

**Note on the `VERSION` file — no historical gap this time.** Release v0.7.0 had
to repair a real inconsistency (v0.6.0 declared `0.5.0` → `0.6.0` but `VERSION`
stayed at `0.5.0`). This release was checked for the same defect and **none was
found**: before this commit `VERSION` read `0.7.0` and the newest release file
`releases/release_v0.7.0_20260902.md:3` declares `0.6.0` → `0.7.0`, so the two
agreed. `VERSION` is now written as `0.8.0` (6 bytes, `0.8.0\n`, byte-format
unchanged) and cross-checked against this file's first bullet. It also satisfies
the deployment gate `skills/deploying-autowonder-on-alibaba-cloud/scripts/build-release.sh:44`
(`^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$`) — verified by running the same
regex against the file, `REGEX_MATCH=YES`. The external repository copy at
`ai-sdlc/auto-wonder/VERSION` must match `0.8.0` exactly.

## Feature Summary

Product behavior, APIs, schema evolution, UI behavior and tests are owned by
master (sync guide Rule 3) and were accepted as delivered except where noted in
*Community Adaptations*.

| Feature | Key new production classes | Schema | Config |
| --- | --- | --- | --- |
| Platform administrator role | `SystemAdminBootstrap`, `PlatformAdminController`, `AddPlatformAdminRequest`, `PlatformAdminVO`, `PlatformAdminListVO`, `PlatformAdminCandidateVO` | `user.is_admin` — `V050`, **includes DML** | none |
| Workspace edit, soft delete, recycle bin, restore | `RecycleBinItemVO`, `RestoreWorkspaceRequest`, `WorkspaceDeletionLinkage`, `WorkspaceDeletedEvent`, `WorkspaceDeletedDispatchLinkageListener`, `WorkspaceUpdateRequest` | `org.active_name_key`, `org.deleted_at`, `org.deleted_by`, unique-key swap `uk_name` → `uk_active_name`, `idx_org_recycle_bin` — `V051`, **includes DML** | none |
| ACP conversation elicitation (agent asks the user) | `AgentConversationElicitationDao`, `AgentConversationElicitationDO`, `ConversationElicitationService`, `ConversationElicitationExpiryTask`, `ClarificationElicitationVO`, `ElicitationReplyRequest` | new table `agent_conversation_elicitation` — `V049`, pure DDL | none |
| Qoder provider model catalog | `ProviderModelCatalogService`, `ProviderModelCatalogScheduler`, `ProviderModelCatalogProperties`, `ProviderModelCatalogVO`, `ProviderModelCatalogItemVO` | none | **new group `autowonder.provider-model-catalog.*`, 7 keys** |
| Executor launch command and launch options, exposed over MCP | `ExecutorLaunchCommandService`, `ExecutorLaunchCommandVO`, `ExecutorLaunchOptionsService`, `ExecutorLaunchOptionsVO`, `CreatedExecutorVO` | none | none |
| Work-item CLI download token and streaming | `WorkitemCliDownloadController`, `WorkitemCliDownloadTokenService`, `WorkitemCliDownloadTokenVO` | none | none |
| Work-item credits / usage aggregation | `WorkitemUsageAggregator`, `WorkitemUsageRunVO`, `WorkitemUsageSummaryVO` | none | none |
| Runtime activity timeline | `RuntimeActivityTimelineVO`, `ConversationBrowserEventPublisher` | none | none |
| Skill package file browsing (tree, text content, raw package) | `SkillPackageFilesVO`, `SkillPackageFileVO`, `SkillPackageFileContentVO` | none | none |
| Scheduled task logical delete, fully stopping the schedule | — | none | none |
| Clarification conversation rework (docked card → floating step wizard, inline "other idea", per-message copy, URL-persisted state, historical session resume) | — | none | none |
| Executor list grouped and collapsed by digital-worker Agent | — | none | none |

Fix volume: 68 `fix:` commits, 61 `test:` commits, 27 `docs:` commits,
5 `refactor:`, 3 `style:`, 3 `chore:`, 2 `build:`.

The recommended executor runtime advanced `0.2.150` → `0.2.152`
(master commit `8dc6afe2a`). The supported release target remains Linux x86_64;
no upstream change alters that.

## Community Adaptations

Only the external-deployability boundary was adapted (sync guide Rule 4). Every
adaptation below keeps master's behavior intact.

1. **Rule 12 runtime-version alignment — the one blocking sync defect this step
   fixed.** Master advanced `autowonder.runtime.recommended-version` to
   `0.2.152` and community's `application.yml` took it unchanged, but
   community's own deploy/upgrade Skills still pinned `0.2.150`. Master has no
   deploy/upgrade Skills at all, so these are community-owned assets and Rule 9
   makes aligning them part of this sync. Seven literals across four files were
   moved to `0.2.152`:
   `skills/deploying-autowonder-on-alibaba-cloud/assets/templates/deployment-manifest.json:57`,
   `skills/deploying-autowonder-on-alibaba-cloud/tests/test_manifest.py:110`,
   `skills/deploying-autowonder-on-alibaba-cloud/tests/test_script_contracts.py:561`
   and `:1190`, and
   `skills/upgrading-autowonder-on-alibaba-cloud/tests/test_upgrade_info.py:41`,
   `:183`, `:332`. All five Rule-12 sources now agree at `0.2.152` and zero
   `0.2.150` remains under `skills/`.
   Deliberately **not** changed: `test_script_contracts.py:547` stays at
   `0.2.110` because it is the stale *input* the replacement logic must
   overwrite; the *Local startup smoke* row of
   `docs/community/verification.md` and
   `docs/community/upstream-sync-log.md:914,1034` are historical measurement
   records, and rewriting them to claim `0.2.152` without re-measuring would be
   fabricated evidence. Both are identified by text as well as by line, because
   the log is append-heavy and its line numbers move: `:914` is "Recommended
   executor runtime advances to `0.2.150`" and `:1034` is "runtime-version
   sources of truth were confirmed by hand at `0.2.150`". This citation was
   `:36,156` when the release file was authored at `2813b524f`, against a
   924-line log; ten later accepted doc commits grew it to 1760 lines and this
   step's own commit took it to 1802, moving both records without anyone
   re-checking the numbers.
   Step `400360` has since rewritten
   `docs/community/verification.md` and honored that principle: the startup-smoke
   row now reads `NOT RE-RUN`, last measured 2026-09-02, deferred to step
   `400785` because no dependency service could be started — it does **not**
   claim `0.2.152`. All five
   Rule-12 source locations cited above were re-read at the reviewed tip
   `579225caf` by step `400360` and still hold.
   **Superseded by step `400785`, and in the opposite direction from what an
   earlier draft of this paragraph said.** The startup-smoke row of
   `docs/community/verification.md` briefly read `FAIL (environment, attributed —
   not a product defect)`; that verdict was correct when measured and is
   withdrawn, because the dependency services were then started and the smoke
   ran to a **serving** instance twice (host JVM and the documented container
   path). Rule 12 therefore now has a **runtime** confirmation, not just five
   agreeing source locations: `GET /api/platform/branding/public` on the live
   v0.8.0 instance returned HTTP 200 with `recommendedRuntimeVersion:"0.2.152"`
   and `deploymentVersion:"0.8.0"`. The principle was honored rather than
   bypassed — `0.2.152` is asserted here because it was **observed in a response
   body**, exactly the re-measurement the paragraph above said would be required.
2. **`SecretCrypto` in place of KeyCenter.** Master's new `NotifyService`
   plumbing in `AoneInboundSyncService` was carried over in full on community's
   constructor shape (import, field, assignment, the `notifyService == null`
   guard, the `notify(event)` call, all four constructor overloads); only the
   `KeyCenterClient` parameter type is community's `SecretCrypto`. Zero
   `KeyCenter` occurrences remain. Master's tests are preserved 1:1 — 27
   `@Test` on master, 27 in the merge.
3. **Internal endpoints redacted in master's new test literals.**
   `frontend/src/features/executor/ExecutorListPage.test.tsx` lines 660 and 673
   carried an internal MCP host in master's new tests; both were redacted to
   `https://community.example/api/mcp`, matching the existing `handlers.ts`
   convention. `CommunityDependencyBoundaryTest` forbids that host anywhere
   under `frontend/src`, so taking the file wholesale would have failed the
   boundary gate.
4. **Internal build/runtime dependencies excluded**, per Rule 4: the internal
   `akless:` block (master removed it from four `application*.yml` files in this
   window; community already excluded it), BUC integration, internal SLS
   `roag.log4j2` (community uses `autowonder.sls.*`), and hardcoded internal
   credentials. `package-lock.json` was **not** merged from master because
   master's lockfile resolves the new coverage subtree from an internal npm
   registry; it was regenerated from the public registry and the
   internal-reference scan stays clean.
   **Corrected by step `400785`: the decision not to merge was right, but the
   regeneration itself was defective.** It ran under the machine's npm `11.17.0`
   instead of the documented npm `10`, and npm 11 prunes optional
   peerDependencies that npm 10 still materialises, so it removed 36 lock keys —
   23 of which `npm ci --include=dev --include=optional`, the exact arguments
   `frontend-maven-plugin` runs, demands. The result was a community branch that
   **could not be built from a fresh clone at all**, which no gate in steps
   `400358`–`400360` could surface because the documented verification command
   carries `-DskipFrontend=true` and the standalone `npm ci` that did pass ran
   under the tolerant npm 11. Step `400360`'s independent review had named the
   toolchain drift as finding `F6` and prescribed re-measuring on the documented
   toolchain, but graded it `Low`. Repaired with `npm install
   --package-lock-only` so npm resolved the entries itself (23 keys added, 0
   removed, 0 versions changed), then proven by the decisive gate:
   `mvn -B -DskipGitCommitId=true clean verify` **without** `-DskipFrontend`,
   i.e. `docs/community/README.md:69` verbatim → `MVN_VERIFY_EXIT=0`, in-build
   install `added 739 packages`, `✓ 4923 modules transformed`, surefire
   `Tests run: 3171, Failures: 0, Errors: 0, Skipped: 8`, and the repaired lock
   blob unchanged afterwards. `verification.md`'s Automated Gates section now
   requires that build and requires the frontend gates to run under `target/node`.
   **Superseded in part by step `400360`'s final attempt:** the same command,
   re-run twice, now exits `1` — `MVN_VERIFY_EXIT=1` and
   `MVN_VERIFY_EXIT_DETERMINISTIC=1`, both with
   `Tests run: 3171, Failures: 0, Errors: 2, Skipped: 6`. **The lock-repair
   conclusion is unaffected and is re-proven by the same two runs**: the frontend
   half is fully green in both, `npm ci --include=dev --include=optional` under
   the plugin's npm 10.9.7 reporting `added 739 packages` and `npm run build`
   reporting `✓ 4923 modules transformed`. The two errors are
   `V037LegacyArtifactServiceFlowMySqlTest » ContainerFetch` and
   `ScheduledTaskSpringMybatisIntegrationTest » ContainerFetch`, caused by the
   Testcontainers/`docker-java` API-version mismatch and reproduced on pristine
   `origin/master` `b52cdeeea`, so they are neither this sync's nor the lock's.
   The earlier `Errors: 0, Skipped: 8` reading was taken while no daemon answered
   the handshake, which makes those two suites skip instead of error.
5. **Executor create flow stays Qoder-CLI-only with no community-specific edit.**
   Rule 4 requires preserving this restriction, but master converged to it on
   its own: `ExecutorLaunchOptionsService.CREATABLE_CLIENT_KINDS` is
   byte-identical between master and community (only `QODER_CLI` and
   `QODER_CN_CLI`), and community's frontend derives
   `CREATABLE_CLIENT_KINDS = CLIENT_KINDS.filter((k) => isQoderClientKind(k.value))`,
   asserted by
   `ExecutorListPage.test.tsx:624`. Under Rule 5 no community difference is
   preserved where master's new implementation is already community-compatible,
   so **no adaptation was needed here**. Legacy `CLAUDE_CODE` executors still
   render and still resolve a provider for launch-command generation; they are
   simply not creatable.
6. **Three post-merge breakages Git did not report as conflicts** were fixed,
   all in test code, all preserving master's assertions:
   `AuthFilterTest.java` (master added a 5th `WorkspaceDao` constructor argument
   inside the window while community's own test still called the 4-arg form);
   `ExecutorListPage.test.tsx` (item 3 above); and
   `PlatformBrandingServiceTest.java`, where master's new Rule-12 drift guard
   loads `application.yml` from the classpath and community's deliberate
   `src/test/resources/application.yml` stub shadows it under surefire ordering —
   the helper now reads `src/main/resources/application.yml` by filesystem path,
   the pattern community's own `CommunityDependencyBoundaryTest` already uses.
   **Every assertion, message and return value in that guard is unchanged**, so
   it still verifies the shipped config pins `0.2.152` and retains the
   `AUTOWONDER_RUNTIME_RECOMMENDED_VERSION` override. 20/20 tests in the class
   pass.
7. **Migrations renumbered** from upstream `docs/migrations/V045,V046,V047` to
   community `docs/migration/V049,V050,V051` (different directory name and
   different numbering scheme). Content is byte-identical to the corresponding
   upstream file; only the filename differs.
8. **Documentation filtered through `docs-policy.md`.** 24 upstream paths were
   not carried into community, each with cited docs-policy authority and a
   cited deliberate community removal commit. The 19 newly added
   `docs/superpowers/` documents are excluded development history.
9. **Three post-sync repairs, found only by executing the documented commands
   rather than by reading the diff.** None is a conflict resolution and none
   changes product behaviour; all three are enumerated here so a reviewer sees
   every non-documentation change in the tree.
   * `6fa57221a` — `frontend/package-lock.json`, **361 insertions, 0 deletions**.
     npm 11's optional-peer pruning had left the lock non-installable by the npm
     10.9.7 that `frontend-maven-plugin` actually installs (`npm ci` → `EUSAGE`,
     23 `Missing: … from lock file`), so `docs/community/README.md:69` could not
     build. 716 + 23 = 739, and the repaired lock installs `added 739 packages`.
   * `fcaec187d` — `docs/autowonder-schema.sql`, **4+/3−**, every changed line an
     SQL comment: three migration references still cited upstream numbering, two of
     them pointing at unrelated community migrations. No rule in the sync guide
     names that file — a Rule-11 coverage gap handed over below.
   * `624bde76e` — `APP-META/docker-config/Dockerfile`, **1 insertion**,
     `COPY scripts ./scripts`. `V037DockerReleaseGateScriptContractTest` resolves
     `scripts/verify-v037-docker-gates.sh` relative to the process working
     directory (`/workspace` in the build stage) and the build stage never copied
     `scripts/`, so the documented `docker build` at `README:70` failed. The script
     and its contract test were both added 2026-08-18 by `12c7c1d82` and `18efee248`,
     ancestors of pre-sync community, the merge base and pristine master alike, and
     `git diff c3a75ae6 HEAD` on the Dockerfile was empty before the edit — so the
     documented build had been broken **since 2026-08-18**, consistent with this
     gate's last green reading being 2026-08-04. Graded **low risk** under AGENT.md
     rule 4: a community-owned deployment-config file, a one-line additive change,
     and no shared-code behaviour at stake. Verified *safe*, not merely effective —
     `scripts_dir_in_runtime=ABSENT` and `workspace_in_runtime=ABSENT`, so the added
     directory reaches only the discarded build stage and the runtime image still
     holds just `/app/auto-wonder.jar` and `/app/logs`.

**Stripped per operator ruling (R7).** Master added a fifth Aone feature
iteration, `a1b6228bc feat(integration): wake agents from Aone mentions`, which
adds a `GuidanceService.createForComment` call site inside
`AoneInboundSyncService`. This release originally **kept** it and escalated the
Rule 4 exclusion versus the v0.7.0 keep-precedent to the human gate. The
operator ruled on 2026-09-08 (workitem comment `126197`): 「如果是aone的新功能的话，
就剥离，如果是存量功能的话就保留」 — strip if it is a new Aone feature, keep if it is
pre-existing. That rule is conditional, so the commit was measured rather than
assumed, and the measurement **split** it:

- **New → stripped.** The Aone hookup is not an ancestor of the previous master
  baseline `25371cb104ac019fb26674f0c495c410c01e5041`, not an ancestor of
  pre-sync community `c3a75ae60462e3bdc93d1e9fb82041dc9d442f51`, and occurs
  exactly once in `git rev-list 25371cb1..b52cdeeea`. `AoneInboundSyncService`
  and `AoneInboundSyncServiceTest` were restored **byte-identical to pre-sync
  community** (`git diff c3a75ae6 -- <file>` empty for both), the constructor
  count is back to 3 from 4, production `createForComment` callers are back to 3
  from 4, and `GuidanceService` now has **0** references anywhere in the
  `integration/` package.
- **Pre-existing → kept.** `GuidanceService.createForComment` itself is 存量:
  it has 3 non-Aone production callers and `resolveLeadingMention` already
  existed in pre-sync community. Master's 175-line improvement to that shared
  mechanism (HTML/plain-text mention resolution, `mentionComparableContent`,
  `normalizeMentionName`) is therefore retained untouched — stripping it would
  violate Rule 3, which gives master ownership of shared product behaviour.
- **The alias sub-piece needed no action.** Master had *already reverted*
  `resolveMentionAlias` / `SystemSettingService` / `agent.mention.aliases` in
  `1e84fedc0`, so there was nothing to strip.
- **Test-count effect is exactly one method.** Removing
  `refreshIssueIdsCreatesGuidanceForNewInboundMention` — whose only substantive
  assertion was `verify(guidanceService).createForComment(...)`, unsatisfiable
  once the call site is gone — moves the backend total from the prior accepted
  `3212` to `3211`. This is removing the test *of a removed capability*, not
  lowering an assertion to go green.
- **Observable effect on a compliant community deployment: none.** Aone is
  optional and disabled by default (`AUTOWONDER_AONE_ENABLED=false`, the only
  Aone key in `application.env.example`), `AoneInboundPoller` and
  `AoneIntegrationController` are both gated by
  `@ConditionalOnProperty(... havingValue = "true", matchIfMissing = false)`, and
  both deployment Skills `die "Aone must be disabled"`. The stripped call site
  was already unreachable; the strip removes dead-for-community code rather than
  changing behaviour.

## Upgrade And Data Impact

**Fresh install — no action.** A fresh community install imports the complete
`docs/autowonder-schema.sql`, which already contains
`agent_conversation_elicitation`, `user.is_admin`, `org.active_name_key`,
`org.deleted_at`, `org.deleted_by`, `uk_active_name` and `idx_org_recycle_bin`
(each verified present; the superseded `uk_name` has zero occurrences). The
scheduled-task module is ready immediately because the three
`autowonder.scheduled-task.*` switches default to `true` in community.

**Upgrade of an existing deployment — three actions, in this order.**

1. **`V050` grants platform-administrator rights to one existing user. Read
   this before upgrading.** Its DML is
   `UPDATE user SET is_admin = 1 WHERE is_deleted = 0 AND status = 0 ORDER BY id ASC LIMIT 1`,
   i.e. the system's *first active* user becomes a platform administrator,
   matching `SystemAdminService`'s existing `isFirstActiveUser` semantics so that
   somebody can manage the new recycle bin after the upgrade. On a deployment
   whose first registered account is not the intended administrator, this
   silently confers the ability to view and restore **every** workspace's
   recycle-bin records. There is no interactive prompt. Review the target row
   before applying, and revoke or reassign `is_admin` afterwards if it is the
   wrong account. The migration is byte-identical to upstream and is **not**
   modified by community — master owns schema evolution (Rule 3) — so the
   remedy is an operator data action, not a patch to the migration.
2. **`V051` swaps a unique key on `org`.** It backfills `active_name_key`
   (`= name` for in-use rows, `NULL` for soft-deleted rows), then
   `DROP INDEX uk_name` and `ADD UNIQUE KEY uk_active_name (active_name_key)`.
   This is safe because `name` was already unique, and it is what enables
   re-creating a workspace with the name of a deleted one. It is nonetheless a
   destructive index operation on a live table: verify it on a shadow database
   first if `org` is large, and note that rolling back is **not** symmetric —
   re-adding `uk_name` will fail if duplicate names exist among soft-deleted
   rows.
3. **Multi-node deployments must gate the scheduled-task switches.** When
   upgrading an existing multi-node deployment, set
   `AUTOWONDER_SCHEDULED_TASK_ENABLED`, `..._SCANNER_ENABLED` and
   `..._CLUSTER_READY` all to `false` until every node runs the new schema,
   then remove the overrides so the community default `true` takes effect.
   `CLUSTER_READY` must never be inferred by a single node from its own schema
   state. Follow `docs/scheduled-task-operations.md`. A single-node deployment
   may apply the change and restart once. This is unchanged from v0.7.0.

**Runtime version convergence.** An upgrade must also move the executor runtime
recommendation to `0.2.152`. The deployment manifest is the source of truth:
`runtime-config` validates `recommendedRuntimeVersion` as semver and rewrites any
stale `AUTOWONDER_RUNTIME_RECOMMENDED_VERSION` in the environment file to the
manifest value, so a deployment left at `0.2.150` self-corrects on the next
run — **provided the operator regenerates from this release's manifest**. Had the
seven literals in *Community Adaptations* item 1 not been aligned, external
deployments and upgrades would have installed the outdated `0.2.150` executor
runtime, which is exactly what sync guide Rule 12 calls a blocking defect.

**No breaking runtime, configuration or data-format change** beyond the three
items above. No public REST path was removed or renamed, no environment variable
was removed or renamed, and no existing configuration key changed its meaning.
The `autowonder.provider-model-catalog` group is new and uses hardcoded
defaults, so an upgrading deployment needs no new environment variable and no
new infrastructure — it reads and writes Redis, which community already requires.

## DDL/DML/Migration Impact

Three new migration files, all additive at the file level; **zero** previously
published migrations were modified, renamed or deleted
(`git diff --name-status c3a75ae6..616b84687 -- docs/migration` reports three
`A` entries and no `M` or `D`).

| Community file | Upstream equivalent | DDL | DML |
| --- | --- | --- | --- |
| `docs/migration/V049__conversation_elicitation.sql` | `docs/migrations/V045__conversation_elicitation.sql` | `CREATE TABLE IF NOT EXISTS agent_conversation_elicitation` with `uk_conv_request (tenant_id, conversation_id, request_id)`, `idx_turn`, `idx_pending_expiry`; `ENGINE=InnoDB AUTO_INCREMENT=10000 CHARSET=utf8mb4` | **none** |
| `docs/migration/V050__user_is_admin.sql` | `docs/migrations/V046__user_is_admin.sql` | `ALTER TABLE user ADD COLUMN is_admin TINYINT NOT NULL DEFAULT 0 AFTER status` | **YES** — promotes the first active user to platform administrator. See *Upgrade And Data Impact* item 1 |
| `docs/migration/V051__org_recycle_bin.sql` | `docs/migrations/V047__org_recycle_bin.sql` | `ALTER TABLE org ADD COLUMN active_name_key / deleted_at / deleted_by`; `DROP INDEX uk_name`, `ADD UNIQUE KEY uk_active_name (active_name_key)`; `ADD KEY idx_org_recycle_bin (is_deleted, deleted_at, id)` | **YES** — backfills `active_name_key` from `name` for in-use rows and to `NULL` for soft-deleted rows. See *Upgrade And Data Impact* item 2 |

Each renumbered file is byte-identical to its upstream counterpart; only the
filename differs. `docs/autowonder-schema.sql` was updated in the same merge and
carries all of the above, so the full schema and the incremental migrations
agree (sync guide Rule 11 — updating the full schema alone is not sufficient).

**Corrected by step `400785` — that agreement held for DDL but not for the
schema file's comments.** Three SQL comments in `docs/autowonder-schema.sql`
still cited *upstream* migration numbers, and two of them pointed at
**different, unrelated** community migrations, which is worse than a dangling
reference: `V045__conversation_elicitation` (introduced by this cycle's merge —
a straight miss of the renumbering instruction) and `V044__workspace_access_request`
(predating this sync; community `V044` is a different migration). A third cited
`V018__dingtalk_agent_conversation`, which is unrelated in community numbering.
Fixed in commit `fcaec187d`: now `V049` and `V048`, both real files, and the
dingtalk comment states plainly that those tables predate the community migration
baseline. **Comment text only — 4 insertions, 3 deletions, 0 changed lines that
are not SQL comments**, so no `CREATE TABLE`, column, key or engine clause moved;
`ConversationElicitationSchemaContractTest` (which asserts the
`agent_conversation_elicitation` definition is byte-identical between migration
and schema file), `ExecutorSchemaContractTest` and the 14 `SystemSettingServiceTest`
cases that read this file all pass in the full build. `docs/autowonder-schema.sql`
is not a published migration, so Rule 11's prohibition on modifying published
migrations did not apply and the correction was in scope.
**Rule coverage gap, handed over:** no rule in `upstream-sync-guide.md` names
`docs/autowonder-schema.sql`, so nothing in the current guide would have caught
this. Recommend the renumbering rule name that file explicitly and the sync
checklist grep it for `V0\d\d__` after every merge.

**No manual data action is required beyond reviewing the `V050` promotion.**
There is no backfill an operator must script by hand and no data export/import.

**Pre-existing defect left untouched, disclosed:** published
`docs/migration/V048__workspace_access_request.sql` contains a stale
`-- V044__` self-header comment inside it. Rule 11 forbids modifying a
published migration, so it was **not** corrected here. It is cosmetic (a comment,
not a statement) and predates this sync.

## Configuration And Deployment Impact

**Environment contract: unchanged. No key was added, removed or renamed.**
The deployment environment contract is the union of
`docs/community/application.env.example` and the `${VAR}` placeholders in
`application*.yml` (`plan-upgrade.sh` collects both). Measured this sync:
37 keys in the example, 54 placeholders in the yml, union 54, and the example is
a strict subset of the yml. The 17 yml-only keys are **not** missing and were
**not** bulk-added, per sync guide lines 135-139 — adding them would change their
contract hash and make the upgrade planner report them as changed env for no
functional gain.

Master's window changed `src/main/resources/application*.yml` in exactly three
ways:

1. Removed the internal `akless:` block from four files — community already
   excludes it (Rule 4). No action.
2. `recommended-version` `0.2.150` → `0.2.152` — the Rule-12 trigger, handled
   above.
3. Added the new `autowonder.provider-model-catalog` block: 7 keys
   (`refresh-fixed-delay-ms` 86400000, `refresh-lock-ttl-ms` 120000,
   `request-timeout-seconds` 20, `ticket-ttl-seconds` 30, `max-candidates` 3,
   `failure-cooldown-seconds` 300, `worker-queue-capacity` 8).

**Explicit Rule-9 conclusion for item 3: no deployment update required.** All
seven keys are hardcoded literals with **no `${VAR}` placeholder**, so none is a
member of the environment contract. Community's `application.yml` already
contains the block identically. Its readers (`ExecutorController`,
`ExecutorLaunchOptionsService`, `ProviderModelCatalogProperties`,
`ProviderModelCatalogScheduler`, `ProviderModelCatalogService`,
`ProviderModelCatalogItemVO`, `ProviderModelCatalogVO`, `InboundFrameRouter`) use
Redis, already mandatory in community — no new infrastructure, port, credential
or environment variable. Therefore `application.env.example`, the deployment
scripts, preflight checks, input collection and the runbook all need **no**
change for this feature.

**The only deployment-asset change this sync requires is the Rule-12 alignment.**
Its third place — operator documentation — needed **no numeric edit** because it
is already correct by reference:
`skills/deploying-autowonder-on-alibaba-cloud/references/operations-runbook.md:121-122`
names the manifest as the source of truth instead of hardcoding a version, and
`references/input-catalog.md` no longer carries a version literal. Bumping the
manifest therefore keeps the operator guidance correct automatically.

`AUTOWONDER_RUNTIME_RECOMMENDED_VERSION` remains **deliberately absent** from
`application.env.example`. It is still collected by `plan-upgrade.sh` from the
yml placeholder, required non-empty by
`skills/deploying-autowonder-on-alibaba-cloud/scripts/internal/operations.sh:392`,
and written from the manifest at `:372`.

`AUTOWONDER_VERSION` remains the `x.x.x` placeholder in both
`application.yml:52` and `application.env.example:10`; the real value is injected
at deploy time from the `VERSION` file by `build-release.sh:42-45` and recorded
into `.runtimeConfig.applicationVersion`. Bumping `VERSION` to `0.8.0` therefore
requires **no** yml or example edit.

**Community-specific defaults were re-verified in all three places. One gap was
found and closed in this step.** No community-versus-upstream default difference
*changed* in this window, but `autowonder.community-edition` — the most
identity-defining of them — had **no operator-facing documentation at all**. An
earlier draft of this table cited `docs/community/upstream-sync-log.md` as its
third place; a sync log is an audit record, not a document an operator reads, so
the citation concealed the gap instead of closing it. `docs/community/README.md`
now documents both community-default groups in a new final section,
§Community-Specific Defaults (lines `111-116` and `118-123`), and the sync log
cites them. The section is appended rather than inserted into §Configuration on
purpose: a 15-line insertion at `:44` shifts every later README line and stale-d
roughly 15 pre-existing numeric `README.md:NN` citations in
`docs/community/upstream-sync-log.md`, `docs/community/verification.md` and this
file. Appending leaves the README's first 107 lines identical to the whole file
at pre-edit commit `ce8721243` (both `2a247dbcc0c8618ff5ce0bdca099084e089a46f9`),
so closing the documentation gap does not create a stale-citation gap.

The set was enumerated mechanically, not from memory: every `${VAR:default}`
placeholder in `src/main/resources/application.yml` was extracted and compared
against the same extraction at `b52cdeeea`. Result — **exactly 4** defaults
differ (the four rows below), 26 placeholders are community-only, and 2 are
master-only (`autowonder.jwt.secret`, a hardcoded development secret, and
`profile_env: daily`; both are deliberate community removals under Rule 8, not
defaults to synchronize).

**Which filter that count of 2 belongs to, stated so it reconciles with
`verification.md`.** The comparison above admits *every* `${…}` target, including
Spring property references such as `${autowonder.jwt.secret:…}`, and under that
filter master has 20 distinct targets against HEAD's 54, so 2 are master-only.
Restricting to environment-variable placeholders (`${UPPER_SNAKE}`) — the filter
the 54 / 37 / 17 contract figures use — master has 18 against HEAD's 54, the
union is 54, and **master-only is 0**: master's env-var set is a strict subset of
HEAD's. Both numbers are correct and neither is a loss; the word "removals" above
is loose for one of the two and is corrected here. `autowonder.jwt.secret` was
**re-expressed, not removed**: HEAD `application.yml:82` reads
`secret: ${AUTOWONDER_JWT_SECRET:}`, so the same setting became a genuine
environment variable and master's hardcoded base64 development default was
dropped. That is a Rule 8 hardening, and it is also why this key is invisible to
the env-var-only filter. Only `profile_env` — master `application.yml:3`,
`active: ${profile_env:daily}`, excluding the internal `daily` profile via commit
`65371c7b5` — is a genuine removal.

| Default | `application.yml` | `application.env.example` | Operator docs |
| --- | --- | --- | --- |
| `autowonder.community-edition` (edition flag; master is `false`) | `:56` `${AUTOWONDER_COMMUNITY_EDITION:true}` | `:28` `AUTOWONDER_COMMUNITY_EDITION=true` | **added this step** — `docs/community/README.md:111-116` (previously only `docs/community/upstream-sync-log.md`, which is not operator-facing) |
| `autowonder.scheduled-task.enabled` (master `false`) | `:72` `true` | `:33` `true` | `docs/scheduled-task-operations.md:9`, `docs/community/README.md:118-123` |
| `autowonder.scheduled-task.scanner-enabled` (master `false`) | `:73` `true` | `:34` `true` | `docs/scheduled-task-operations.md:10`, `docs/community/README.md:118-123` |
| `autowonder.scheduled-task.cluster-ready-attestation` (master `false`) | `:74` `true` | `:35` `true` | `docs/scheduled-task-operations.md:11`, and `:22` forbids single-node inference; `docs/community/README.md:118-123` |
| `autowonder.runtime.recommended-version` (**same as master**) | `:58` `0.2.152` | deliberately absent (yml-only, guide 135-139) | runbook `:121-122` by reference + manifest |
| `autowonder.version` | `:52` `x.x.x` | `:10` `x.x.x` | injected from `VERSION` at deploy time |

What the edition flag actually controls, so the new documentation is checkable:
`PlatformBrandingService` publishes it as `communityEdition` on
`GET /api/platform/branding/public`, and `McpTokenSettingsPanel.tsx:525` omits
the 「更多客户端接入」 collapse item when it is `true`. That behaviour is covered
by `McpTokenSettingsPanel.test.tsx:93` ("hides 更多客户端接入 when the deployment
is a community edition"). Step `400785` observed `communityEdition:true` live.

**Disclosed, not changed:** `PlatformBrandingService.java:54` declares
`@Value("${autowonder.community-edition:false}")` — the constructor fallback is
upstream's `false`, not community's `true`. This is not a contradiction, because
`application.yml:56` always supplies the property and the fallback never fires;
but were that yml key ever removed, a deployment would silently stop being a
community edition. It is the same class of second literal as Rule-12 source #9.
Aligning it would modify master-owned product code for no behavioural gain, so it
is recorded instead.

Other retained community-only configuration, unchanged: `autowonder.sls.*`
(public SLS remains supported), `autowonder.security.secret-crypto.master-key`
(SecretCrypto replaces KeyCenter), `autowonder.integration.aone.enabled`
(`false`) and `.web-base-url`, `autowonder.metrics.sigar.enabled` (`true`),
`oss.*` (OSS remains mandatory and env-driven), `s3.enabled`,
`autowonder.public-base-url` (defaults to `http://localhost:7001`),
`autowonder.jwt.secret` (no hardcoded default), and
`spring.profiles.active` (`local`).

**Deployment Skill surface.** The deploy and upgrade Skills were touched by this
sync **only** through the seven Rule-12 literals. The merge itself changed
**zero** files under `skills/deploying-autowonder-on-alibaba-cloud` or
`skills/upgrading-autowonder-on-alibaba-cloud` (proved two ways: the
`--name-only` diff between the community tip and the merge commit reports 0
paths, and the `skills/` subtree hash is identical on both sides,
`729d40ec323ffe29056d580a701b6ebcdf692073`).

## Verification Results

Exit codes were captured from the build tools themselves, never from a command
downstream of a pipe.

**Read the table below against a named generation.** Most rows were measured on
2026-09-07 at the pre-strip delivery tip. A **third generation was measured on
2026-09-08** after the operator ruled on R7 and the Aone strip was executed, and it
supersedes the backend, frontend, Skill and `cl_2` figures wherever the two
disagree. Its full table — every exit code, every summary line, and an explicit
`NOT RE-RUN` list of what it did *not* repeat — is in `docs/community/verification.md`
under the section titled *2026-09-08 re-measurement generation*. The rows whose
verdict or numbers actually moved also carry an inline **2026-09-08** clause below,
so this table cannot be read as current by accident. Nothing here was made greener
by lowering an assertion or skipping a test.

| Gate | Result | Evidence |
| --- | --- | --- |
| Backend `mvn clean verify` on the merged tree | **PASS. 2026-09-08 (current, post-strip): the documented command was re-run on the stripped tree and returned `MVN_CONTAINERS_EXIT=0`, `BUILD SUCCESS`, `[WARNING] Tests run: 3211, Failures: 0, Errors: 0, Skipped: 1`, `grep -c '^\[ERROR\]'` over the whole 8510-line log = **0**, `CONTAINERS_CREATED=8` (7 × `mysql:8.4.4`, 1 × `redis:7-alpine`), `Total time: 02:54 min`, **371** suites, and `target/auto-wonder.jar` at **73044853 bytes**. The frontend half ran inside it (`Installing node version v22.22.2`, `added 739 packages, and audited 740 packages in 30s`, `✓ 4923 modules transformed.`, `✓ built in 9.39s`), and `antrun … verify-frontend-static-assets` executed. **The count closed against a prediction written into the log header before Maven started** — `PREDICTION=Tests run: 3211 (3212 minus the 1 deleted Aone feature test)` — so the 3212 → 3211 movement is exactly the one stripped `@Test` method and nothing else; the sole skip is the documented manual `AoneUserApiManualTest`. The jar is 224 bytes smaller than the prior reading, which is the stripped code. **2026-09-07 prior reading, kept for continuity — and the decisive reading of that generation, not the build stage's.** With the container images pre-pulled, `TESTCONTAINERS_RYUK_DISABLED=true`, `DOCKER_HOST` exported to the Docker Desktop socket and `-DargLine="-Dapi.version=1.44"`, the documented command run **on the host** at measurement tip `a144a5da0` returned `MVN_CONTAINERS_EXIT=0`, `BUILD SUCCESS`, `[WARNING] Tests run: 3212, Failures: 0, Errors: 0, Skipped: 1`, `grep -c '^\[ERROR\]'` over the whole log = **0**, `CONTAINERS_CREATED=8`, and `target/auto-wonder.jar` at **73045077 bytes** — the same artefact size the earlier reading produced. **This is the only reading of this cycle in which the 8 Docker-backed classes *execute* rather than skip or error**, and its count closes exactly against the two rejected readings: **3171 − 7 + 48 = 3212**, because the first run executed 3171 tests with 7 erroring inside container setup, the decisive run executed those same classes fully, and the container-backed classes contribute 48 more individual test methods than the errored-out stubs did — no test appears or disappears unexplained. Two readings were **refused as passes** rather than published green: the plain run (`MVN_FULL_EXIT=1`, `3171/0/7/8`, `BUILD FAILURE`, all 7 errors `ContainerFetch`) and the same with images pre-pulled but no API-version property (`MVN_MIRROR_EXIT=0`, `3171/0/0/8`, `BUILD SUCCESS`), whose 8 skips are precisely the 8 Docker-backed classes, so it proves compilation and every non-container test and **nothing** about the container paths. **Caveat, recorded rather than hidden: `-DargLine="-Dapi.version=1.44"` is a diagnostic override supplied by the verifier, not a project setting.** Testcontainers `1.20.6` *shades* docker-java, and its env-var whitelist carries 13 `DOCKER_*` names but **not** `DOCKER_API_VERSION`, so the version can only reach the shaded client as a JVM system property; the plain documented command therefore still fails on any host whose daemon `MinAPIVersion` exceeds docker-java's `1.32` default. That is a pre-existing property of the pinned version and not something this sync introduced — see *Gates that could NOT run*, whose earlier "neither mode is a pass" framing is **corrected there** by this reading. **Prior reading, kept because it is a real measurement of a different host state rather than a superseded mistake:** "PASS (exit 0) inside the build stage; the host-side FAIL (environment, attributed) reading stands as a Testcontainers-pull artefact and no longer describes the tree" — step `400785` ran the documented command to completion inside a `linux/amd64` container and captured `DOCKER_BUILD_EXIT=0` from `docker build` itself, with in-container `BUILD SUCCESS`, `Tests run: 3171, Failures: 0, Errors: 0, Skipped: 8`, `Total time: 03:37 min`, `Finished at: 2026-09-07T06:09:31Z`. **This is not a claim that the two Docker-backed suites passed.** With no daemon inside the build stage their `Assumptions.assumeTrue(…isDockerAvailable())` guard is false, so they *skip* — which is exactly why this reading is `Skipped: 8` / `Errors: 0` while the host's is `Skipped: 6` / `Errors: 2`. What it does prove is that the merged tree compiles, bundles and passes all **3163 executing** tests with the frontend half **included** (no `-DskipFrontend`), which is the documented command in `docs/community/README.md:69`. The host-side reading follows, kept because it is a real measurement of a different host state rather than a superseded mistake: step `400360`'s final attempt re-ran the documented command twice: `MVN_VERIFY_EXIT=1` (01:48) and `MVN_VERIFY_EXIT_DETERMINISTIC=1` (01:42), both `[ERROR] Tests run: 3171, Failures: 0, Errors: 2, Skipped: 6`. The two errors are `V037LegacyArtifactServiceFlowMySqlTest » ContainerFetch` and `ScheduledTaskSpringMybatisIntegrationTest » ContainerFetch`. The frontend half of both builds is green (`added 739 packages`, `✓ 4923 modules transformed`), as are all seven community boundary gates inside the failed build. **Prior reading, earlier in this cycle:** `MVN_EXIT=0`, `Tests run: 3171, Failures: 0, Errors: 0, Skipped: 8`, `BUILD SUCCESS` — measured while no Docker daemon answered the handshake, which makes those two suites skip instead of error. An earlier draft of this row called that reading "no longer reproducible", and step `400785` falsified the claim: the build stage has no daemon either, so it reproduced the identical `Tests run: 3171, Failures: 0, Errors: 0, Skipped: 8` and `BUILD SUCCESS`. The prior reading was therefore never wrong — it was a correct measurement of a no-daemon host state, and both host states are now measured rather than argued about. **A third green reading closes the loop:** step `400785` also ran `mvn -B -DskipGitCommitId=true clean verify` on the **host**, with `DOCKER_HOST` set to the user socket and `TESTCONTAINERS_RYUK_DISABLED=true`, and captured `MVN_VERIFY_EXIT=0`, `BUILD SUCCESS`, `Tests run: 3171, Failures: 0, Errors: 0, Skipped: 8`, `Total time: 02:32 min`, with the frontend included (`added 739 packages`, `✓ 4923 modules transformed`) at HEAD `9856387065`. So the host verdict moved from `Errors: 2` in step `400360` to `Skipped: 8` in step `400785` with **no change to the tree** — the two readings sit in the two Testcontainers discovery modes described under *Gates that could NOT run*, which is direct evidence that skip-versus-error tracks host state alone. No assertion was lowered and no test was edited, excluded or skipped | `backend-verify-build4.txt` (prior), `docs/community/verification.md` *Full documented build* row (host) and *Linux image build* row (in-container exit 0, current) |
| Backend baseline on pristine `origin/master` `b52cdeeea` | **PASS as an attribution baseline — and this attempt's decisive pristine run *passed outright*, which retired a stale claim of ours.** In an isolated detached worktree on pristine `b52cdeeea3b82316ee370e56d5533e6a8d9245b3`, `mvn -B -DskipGitCommitId=true -DskipFrontend=true -Dtest=ScheduledTaskSpringMybatisIntegrationTest,V037LegacyArtifactServiceFlowMySqlTest -DfailIfNoTests=false test` → `WORKTREE_AD_EXIT=0`, `MVN_PRISTINE_EXIT=0`, `BUILD SUCCESS`, **`Tests run: 27, Failures: 0, Errors: 0, Skipped: 0`, 3 containers created**. The worktree was verified clean (0 tracked modifications, no untracked source), the delivery branch was never checked out for it, `git status --porcelain` stayed at 0 lines throughout, and it was then removed with `REMOVE_EXIT=0`. **That run was made specifically to test `upstream-sync-log.md`'s "upstream time-bomb fixture" claim — that the scheduled-task suite "passed on master's CI in August and fails on any run after the seeded dates". Pristine master passes, so the bomb does not fire and the claim was WITHDRAWN, not defended.** The reason is that master independently fixed the same mechanism at *scanner* level in `21e28e0f4` (2026-09-05) while community had fixed it at *seed-INSERT* level in `0e76ae22f` (2026-09-02), and merge `616b8468` kept **both**; the mechanism was verified in product code at `ScheduledTaskScheduler.java:78`/`:80`/`:87` with the no-op at `:44`, and community's two INSERT-level pins were then shown **not** to be load-bearing at HEAD. This was graded a labelling defect in **our own documentation**, not an upstream product defect, and the log's heading says so now. **Prior reading, kept for continuity:** the two errors below are upstream's, proved by measurement rather than inference. In an isolated detached worktree on pristine master, while the daemon was answering, `mvn -B -DskipGitCommitId=true -DskipFrontend=true -Dtest=ScheduledTaskSpringMybatisIntegrationTest,V037LegacyArtifactServiceFlowMySqlTest -DfailIfNoTests=false test` → `MVN_EXIT_pristine=1`, `Tests run: 2, Failures: 0, Errors: 2, Skipped: 0`, with the identical `ContainerFetchException: Can't get Docker image: RemoteDockerImage(imageName=testcontainers/ryuk:0.11.0)` at the identical `ScheduledTaskSpringMybatisIntegrationTest.setup:130`. Four seconds later the same command on pre-sync community `c3a75ae6` returned `MVN_EXIT_pre=0` / `BUILD SUCCESS` only because the daemon had stopped answering, which is itself the proof that skip-versus-error tracks host state and not any tree. Three source-level facts make the conclusion timing-independent: Testcontainers is pinned `1.20.6` at HEAD, `c3a75ae6` and `b52cdeeea`; `V037LegacyArtifactServiceFlowMySqlTest.java` is blob-identical (`9ae45f40a7b5…`) at all three; and `ScheduledTaskSpringMybatisIntegrationTest.java`'s guard and both container declarations are structurally unchanged, `diff(b52cdeeea, HEAD)` being 3+/3− fixture `INSERT`s adding an explicit `gmt_create`. **Prior reading, kept for continuity:** pristine master's full suite gave `Tests run: 3151, Failures: 0, Errors: 0, Skipped: 8`, `BUILD SUCCESS`, so the merge adds 20 tests and no regression | `master-test-baseline.md` (prior), `docs/community/verification.md` *Backend regression comparison* row (current) |
| Backend `main` **and** `test` compilation | **PASS** — `mvn testCompile` clean after the three post-merge fixes | `postmerge-selfchecks.md` |
| Frontend lint | **PASS** — **2026-09-08 (current, post-strip): `NPM_LINT_EXIT=0`, `✖ 2 problems (0 errors, 2 warnings)`**, at `MemoryListPage.tsx:78:9` and `RightPanel.tsx:114:6`. 2026-09-07 prior reading identical (`LINT_EXIT=0`, same two pre-existing `react-hooks/exhaustive-deps` warnings, same files, same lines). No error, only the two long-standing warnings | `frontend-verify.txt` |
| Frontend production build (`tsc -b && vite build`) | **PASS** — **2026-09-08 (current, post-strip): `NPM_BUILD_EXIT=0`, `✓ 4923 modules transformed.`, `✓ built in 10.53s`, and the `dist` inventory is identical *including content hashes*: `index.html 0.60 kB │ gzip: 0.32 kB`, `index-Bn8zSGCu.css 20.14 kB │ gzip: 4.18 kB`, `index-sMm4vivb.js 4,147.58 kB │ gzip: 1,251.01 kB`.** Same module count and same three asset filenames across every reading of this cycle, so no module entered or left the bundle graph and only wall-clock moved. 2026-09-07 prior reading: `BUILD_EXIT=0`, `✓ 4923 modules transformed.`, `✓ built in 9.29s`, with the `dist` byte-total (4.1M) quoted from an earlier reading at `✓ built in 5.97s` | `frontend-verify.txt` |
| Frontend unit tests | **10 failed / 1459 passed (1469)** — **2026-09-08 (current, post-strip): `NPM_TEST_EXIT=1`, `Test Files 3 failed \| 144 passed (147)`, `Tests 10 failed \| 1459 passed (1469)`, `Duration 223.28s`**, that exit code being vitest's own. **Total test count is unchanged at 1469** — no test was added, removed, skipped or excluded. **The tenth failure is a *rotating* load-sensitive slot, and the earlier attribution of it to one named file is corrected here.** This run's tenth was `src/features/statemachine/StatusTemplatePage.test.tsx > keeps node creation visible but does not open its modal for a read-only member`, and `AllWorkspacesTab` — the file the 2026-09-07 generation named — **passed**. Both pass in isolation on the same machine within the same hour: `ISO_STP_EXIT=0`, `Tests 3 passed (3)`, 6.25s; `ISO_AWT_EXIT=0`, `Tests 25 passed (25)`, 9.39s. The failing DOM dump ends in `ant-spin-dot-item`, i.e. the page was still loading when `findByRole` timed out, and the expected button label occurs exactly once in that dump — inside the expected error message, never in the rendered tree. That is the same timeout mechanism as the prior generation's `Unable to find an element with the text: 别的空间`. **So the classification is unchanged (concurrency/load sensitive, not a functional defect, not a sync regression) but the honest statement is that the slot rotates between at least two files, which is stronger evidence of load-sensitivity than one repeated observation was.** The other nine are deterministic and were re-measured in isolation this round: `HEAD_EXECUTOR_EXIT=1`, `Tests 6 failed \| 56 passed (62)`; `HEAD_WDP_EXIT=1`, `Tests 3 failed \| 63 passed (66)` — the same six and three names as every prior reading. **`frontend/` could not have moved:** its tree hash `6235c7e5ad11…` is identical at HEAD and at `origin/community`, and the worktree diff contains **zero** frontend paths, so the strip cannot have caused any of these. 2026-09-07 prior readings: two runs (227.54s, 222.30s) both `10 failed \| 1459 passed (1469)`; one run `9 failed / 1460 passed (1469)`, `Test Files 2 failed \| 145 passed (147)`. None of the failures is introduced by conflict resolution | `frontend-verify.txt` (prior), `docs/community/verification.md` *2026-09-08 re-measurement generation* (current) |
| Rule-12 source #3 `deploying.../tests/test_manifest.py` | **PASS (prior) / NOT RE-RUN as a targeted run** — the standalone `pytest tests/test_manifest.py -q` → 4 passed, `PYTEST_EXIT=0` was measured earlier in this cycle and not repeated. The file *is* inside the deploy Skill full suite that step `400360` did re-run, whose pass count is unchanged at 72, so the assertion still holds indirectly | `rule12-runtime-version-alignment.md` |
| Rule-12 source #5 `upgrading.../tests/test_upgrade_info.py` | **PASS (prior) / NOT RE-RUN as a targeted run** — the standalone `pytest tests/test_upgrade_info.py -q` → 11 passed, `PYTEST_EXIT=0` was measured earlier in this cycle and not repeated. The file is inside the upgrade Skill full suite that step `400360` did re-run, whose pass count is unchanged at 66 | `rule12-runtime-version-alignment.md` |
| Deploy Skill full suite | **29 failed / 72 passed**, `PYTEST_EXIT=1` — **2026-09-08 (current, post-strip): re-run again → `DEPLOY_PYTEST_EXIT=1`, `29 failed, 72 passed in 28.54s`,** identical counts. It carries forward on **bit-identity, not on trust**: `git rev-parse HEAD:skills` = `91ad71bc7f2c4c226fadf2b20b8dd86511c0c409` at HEAD, at `origin/community` and in the worktree, with **0** worktree modifications under `skills/`, so the accepted four-class root-cause split still describes these 29 exactly. 2026-09-07 prior reading, from the real directory `skills/deploying-autowonder-on-alibaba-cloud`: `29 failed, 72 passed in 38.86s`. The failure-name set was extracted, normalized, sorted and diffed **in both directions** against the accepted evidence: `NAMES_NOW=29`, `NAMES_ACCEPTED=29`, `ONLY_IN_NOW` empty, `ONLY_IN_ACCEPTED` empty, `FAILSET_EQ_ACCEPTED=YES`; and against a real pre-sync baseline worktree at `c3a75ae6`, `PRESYNC_NAMES=29` with both difference sets empty and `DEPLOY_FAILSET_EQ_PRESYNC=YES`. Environment causes: `TERRAFORM=ABSENT`, `ALIYUN=ABSENT`, `ALIYUN_CONFIG_PRESENT=NO`, accounting for 9 of the 29 — **NOT RE-RUN** on 2026-09-08, last measured 2026-09-07; the credential file was deliberately **not** created because AGENT.md Rule 8 forbids credentials entering this work | `skill-deploy-FULL-pytest.txt`, `skill-deploy-FULL-BASELINE-preedit.txt`, `step400360-skill-failure-classification.txt` |
| Upgrade Skill full suite | **6 failed / 66 passed / 1 skipped**, `PYTEST_EXIT=1` — **2026-09-08 (current, post-strip): re-run again → `UPGRADE_PYTEST_EXIT=1`, `6 failed, 66 passed, 1 skipped in 26.00s`,** identical counts, on the same unchanged `skills/` subtree hash `91ad71bc7f2c…`. 2026-09-07 prior reading, from `skills/upgrading-autowonder-on-alibaba-cloud`: `6 failed, 66 passed, 1 skipped in 38.57s`. Same bidirectional comparison: `NAMES_NOW=6`, `NAMES_ACCEPTED=6`, both difference sets empty, `FAILSET_EQ_ACCEPTED=YES`, with the sealed evidence also recording `UPGRADE_FAILSET_EQ_PRESYNC=YES`. All 6 are in `tests/test_split_contract.py::UpgradeSkillSplitContractTests`; the 1 skip is `tests/test_windows_native_adapters.py:96`, PowerShell being unavailable on this macOS control host. **No pre-sync baseline run was required for this suite and the argument is structural:** its only sync-changed file is `tests/test_upgrade_info.py`, which is **not** among the failing files, and a change confined to a non-failing file cannot alter the failing set — unlike the deploy suite, where the changed file *was* the failing file and a real baseline run was therefore mandatory. **No upstream baseline is possible for either Skill suite**: `git cat-file -e b52cdeeea:skills` fails, i.e. `skills/` does not exist in `origin/master`, so pre-sync community is the only valid comparison | `skill-upgrade-FULL-pytest.txt`, `skill-upgrade-FULL-BASELINE-preedit.txt`, `step400360-skill-failure-classification.txt` |
| Migration renumbering (Rule 11) | **PASS after step `400785` correction** — 3 additions `V049`/`V050`/`V051`, byte-identical to upstream modulo filename, **zero** published migrations changed. Step `400785` then found three SQL comments in `docs/autowonder-schema.sql` still citing upstream numbers (two pointing at unrelated community migrations) and fixed them in commit `fcaec187d`: 4+/3−, **0 changed lines that are not SQL comments**. No rule in the sync guide names that file — coverage gap handed over | `postmerge-selfchecks.md`, `step400785-schema.txt` |
| Internal-reference rescan (Rule 8 / cl_2) | **PASS** — the authoritative gate is the internal-host scan defined in `docs/community/verification.md` (its **Automated Gates** `! rg -i 'alibaba-inc\.com|aliyun-inc\.com|daily-keycenter\.alibaba\.net'` command, tabulated there as the *Internal-reference scan* row — cited by name, not by line number, because step `400360` rewrote that file and any line citation would already be stale). Its scope (`pom.xml`, `frontend/package-lock.json`, `frontend/.npmrc`, `APP-META`, `src/main`, `src/main/resources`) returns **0 hits**, re-measured at this release's tip. The broader cl_2 rescan, which also matches the *names* of the excluded internal dependencies, is a **review aid, not a gate**, and its tree-wide count legitimately rises whenever a boundary document explains an exclusion — so every figure below is **anchored at a named commit** and stays true no matter how many further documentation commits land: **62** at the community tip `c3a75ae6`, **62** at the merge `616b84687` (so the merge added **zero**), **70** once the v0.8.0 release file landed at `2813b524f`, **78** once the sync-log entry landed at `fe22d55dc`, and **80** at `17fc0bdaf`. The mechanism is precise and was measured rather than assumed: the count is **deduped per matching line**, so it rises only when a commit adds a *new* matching line — which is exactly how `17fc0bdaf` took 78 to 80, by adding two. Rewriting a line that already matched cannot raise it; the commit that anchored these figures re-measured **80**, unchanged from `17fc0bdaf`, and its matching line set is byte-for-byte the same 80 lines. This is also why no number here can state the SHA of its own commit: the figure is stable across that commit, so it is stated as a relationship instead. **Step `400360` must still re-measure at whatever the final tip is and must not quote any count from this row.** The **+16** between `c3a75ae6` and `fe22d55dc` sits entirely in the two documentation files this release added (this file and the 2026-09-07 sync-log entry): 15 are prose mentions of `KeyCenter` / `akless` / `Normandy` / `SecuritySDK` / `BUC` explaining *why* they are excluded, and 1 is the internal code-review URL that guide line 181 mandates. **This sync introduced zero code-scope hits and removed zero**: measured over `src`, `pom.xml`, `frontend`, `skills`, `APP-META`, `docs/migration` and `*.sh`, the broad rescan returns **39** at the community tip and the **same 39** at the merge commit, the adaptation commit, the sync-log commit and this release's tip. All 39 are pre-existing and classified — 16 are the negative assertions inside the boundary guard tests (`CommunityDependencyBoundaryTest`, `CommunityBuildInputTest`, `test_squad_template_seed.py`) where the forbidden strings *are* the guard, 2 are a .NET BCL false positive (`[Security.Cryptography.SHA256]` matching the `Cryptograph` alternative) in two PowerShell scripts, 3 are SQL `COMMENT` text in the test-only legacy fixture `autowonder-pre-v037.sql`, 16 are Aone integration test-fixture URLs (11 Java, 5 frontend `*.test.tsx`) for a module that is master-owned and disabled by default in community, and 2 are an internal git URL used as a unit-test fixture. None is a live endpoint, a build input, a dependency coordinate or a shipped configuration value; the authoritative gate stays at **0** precisely because its scope is `src/main` and not `src/test`. An earlier draft of this row claimed "zero hits in any source, build, config, dependency, manifest, script or schema file", which is false as an absolute and is corrected here. **0** redaction points were removed, restored or weakened. Supersedes the "77 vs 76" measured at the merge commit in step 400358. **Step `400360` re-measured as this row instructed.** It first re-ran the scan with a *narrower* pattern (the dependency-name alternatives only, omitting `alibaba-inc\.com|aliyun-inc\.com`) and obtained a misleadingly low figure; rather than publish it, it re-read the exact pattern and normalization recorded in the step-`400359` evidence (`git grep -IE`, ref prefix stripped, `sort -u`) and re-ran. With the correct pattern every anchored figure above **reproduces exactly**: `c3a75ae6`=62, `616b84687`=62, `2813b524f`=70, `fe22d55dc`=78, `c8bdfd59c`=78, `7d4ae7bcd`=79, `17fc0bdaf`=80, `bf6419279`=80, `579225caf`=80 (RAW=83). Step `400360`'s own documentation edits are now committed at this step's tip, so this is no longer a worktree-only reading: the tree measures RAW=**89** / DEDUP=**86**, a net **+6** over `579225caf`'s 80. The gross churn is **+8 added / −2 removed** matching lines, and the two removals are *rewritten* lines, not deleted redaction points — the old one-line `Community boundary tests` row in `docs/community/verification.md` (which named KeyCenter, Normandy, AkLess, RASS and BUC inline) was replaced by two rows that carry the same names plus their exit codes, and this row itself was replaced by its corrected form. Net by file: `docs/community/upstream-sync-log.md` **+5**, `docs/community/verification.md` **+1**, this file **0**. All eight additions are prose that *names* the excluded internal dependencies precisely in order to explain their exclusion — exactly the mechanism this row describes. These digits sit inside lines that already match, so recording them does not itself move the count; that was verified by re-measuring after the edit rather than assumed. Through all of it the two figures that actually matter do not move: **code-scope is 39 at `c3a75ae6`, at `579225caf` and at this step's tip**, and the authoritative gate returns **0 hits** (`GATE_B_RG_EXIT=1`) at every one of them, with `KeyCenterClient` in `src` + `pom.xml` = **0** | **2026-09-08 (current, post-strip): this row's own instruction was obeyed and every figure re-measured at the final tip with the exact recorded pattern and normalization.** **Code-scope — the figure that matters — is `39` at pre-sync community `c3a75ae6`, at the merge, at HEAD `6c297bf6e` and in the final worktree, with all six bidirectional `comm` set deltas = `0`**, so the operator-ruled R7 strip neither introduced nor removed a single code-level reference. **Tree-wide, per ref:** `c3a75ae6` RAW 65 / DEDUP 62 · `616b84687` 65 / 62 · `2813b524f` 73 / 70 · `fe22d55dc` 81 / 78 · `17fc0bdaf` 83 / 80 · `579225caf` 83 / 80 · **HEAD 95 / 92** · `origin/community` 95 / 92 (`SET_IDENTICAL=yes`, both deltas 0) · **final worktree 96 / 93**. Every anchored figure quoted above reproduces exactly, and the accepted generation's `RAW=89 / DEDUP=86` is **superseded** — it was measured at an earlier tip, and the +6 to HEAD is later documentation that *names* an excluded internal dependency in order to record its exclusion. The worktree's +1 over HEAD is the new *2026-09-08 re-measurement generation* section in `docs/community/verification.md`, whose rows name those dependencies for the same reason; this row was **re-measured after being corrected rather than adjusted by the expected delta**, which is why the reading is 96 / 93 and not the 97 / 94 taken before the correction below. `GATE_B_RG_EXIT=1` re-confirmed at the final tip, `GATE_A_RG_EXIT=1`, `RESIDUAL_SENSITIVE_EXIT=1`. **One defect was found and fixed while measuring this, and it is reported because it is evidence rather than because it is flattering:** the out-of-scope surface under `docs/` + `releases/` is **4 files / 4 live host literals** under the plain pattern and **5 files / 8 lines** under an optional-backslash variant that also catches the gate's own pattern text quoted in escaped form. A first draft of the new *Gate B surface* row in `verification.md` **spelled out one of those internal hosts in order to describe it**, thereby introducing the first live host literal that file had ever contained — `git show HEAD:docs/community/verification.md` returns **0** plain-pattern hits, so it entered only in this step's uncommitted edit. It was removed and the file re-measured to **0**, which took the surface from 5 live literals back to 4. Rule 8 forbids *introducing* an internal endpoint regardless of how H-1 is ruled, so no operator decision was needed for that one; **the 4 survivors are deliberately left untouched pending the H-1 ruling rather than redacted unilaterally.** They classify **3 + 1**: three internal code-review URLs (v0.3.5 and v0.7.0 published precedent, v0.8.0 new and guide-mandated) plus one pre-existing internal test-fixture host in `docs/community/upstream-sync-log.md` named there while recording that the same host had been redacted out of a frontend test file. **The lesson is that a document written to report a scope blind spot fell into it on the first attempt** — a gate's scope exclusion can blind it to the very artifact a governing rule mandates publishing, and the person writing about that blind spot is not exempt | `internal-reference-rescan-remeasured.txt`, `final-state-reverification-7d4ae7bcd.txt`, `cl2-internal-reference-rescan.txt`, `step400360-independent-review.md`, `step400360-cl2-remeasure.txt`, `docs/community/verification.md` *cl_2 broad internal-reference rescan* and *Gate B surface* rows |
| Environment-contract union (cl_1) | **PASS** — 37 ⊆ 54, union 54; 17 yml-only keys correctly not treated as missing; `AUTOWONDER_AONE_ENABLED=false` is the only Aone key in the example | `cl1-env-contract-union.txt` |
| Executable file modes (cl_4) | **PASS — re-measured 2026-09-08 on the post-strip tree, every figure unchanged** | 28 executable paths before and after, 0 drift. **The re-measurement was taken against the exact tree object that will be committed, not against a stale HEAD:** everything was staged and `git write-tree` produced that tree *before* any commit existed, so the figures below describe the committed artefact rather than an earlier tip — and they are stable across this row's own edit, which is why no tree hash is quoted here (a hash cannot be recorded inside the object it hashes). `git ls-tree -r` over that tree → **1899** paths, **1871** × `100644` + **28** × `100755`, **0** symlinks (`120000`). The identical manifest at HEAD and at pre-sync community `c3a75ae6` gives `EXEC_PATHS_NEW=28`, `EXEC_PATHS_HEAD=28`, `EXEC_PATHS_PRESYNC=28`. Mode drift was computed by `join` on path across the two manifests rather than eyeballed: `PATHS_IN_BOTH=1899`, `JOINED=1899`, **`MODE_CHANGE_COUNT=0`**, `ONLY_IN_NEW=0`, `ONLY_IN_HEAD=0`. All **28** `.sh` paths in the tree carry the executable bit (`SH_TOTAL=28`, `NONEXEC_SH_COUNT=0`), enumerated by name in `cl4-executable-modes-postmerge.txt` and re-listed in this step's evidence | `cl4-executable-modes-postmerge.txt`, `step400360-poststrip-tree-measurements.txt` |
| No lost master feature (cl_6) | **PASS** — constructive proof over the 53 paths where merged ≠ master (24 deletions, 29 modifications); all 24 deletions carry docs-policy authority plus a cited deliberate removal commit; 21 of 29 modifications have zero absent master lines; the 96 absent lines are 80 lockfile + 16 mandatory boundary adaptations | `cl6-no-lost-master-feature.md` |
| Dependency boundary | **PASS (boundary) / PASS after step `400785` repair (installability)** — `CommunityDependencyBoundaryTest` green; `KeyCenterClient` 0 occurrences; no internal SDK required; `package-lock.json` regenerated from the public registry. The regeneration ran under npm `11.17.0`, whose optional-peer pruning left the lock non-installable by the npm `10.9.7` the build actually uses; step `400785` repaired it (23 keys added, 0 removed). **Installability re-proven by step `400360`'s final attempt on the same two runs whose backend half failed for container reasons**: inside `mvn -B -DskipGitCommitId=true clean verify` without `-DskipFrontend`, the plugin's npm 10.9.7 reported `added 739 packages` and `npm run build` reported `✓ 4923 modules transformed`. The prior reading `MVN_VERIFY_EXIT=0` was taken while no Docker daemon answered; an earlier draft of this row called it "no longer reproducible", and step `400785` falsified that by reproducing `BUILD SUCCESS` / `Skipped: 8` inside the daemon-less build stage. The frontend half is green in all three readings — two host runs and one in-container run. **Explicit boundary conclusion: the community tree requires no internal SDK, no internal Maven repository and no internal npm registry to compile, install or bundle** — proved by `npm ci` resolving all 739 packages from `registry.npmjs.org` alone per `frontend/.npmrc`. The boundary itself was never violated | `cl6-no-lost-master-feature.md`, `step400785-lock-regression.txt`, `docs/community/verification.md` *Dependency tree scan* row |
| Rule-12 five-source agreement | **PASS** — all five read `0.2.152`; residual `0.2.150` under `skills/` = 0 matches | `rule12-runtime-version-alignment.md` |
| Independent sync review (guide Procedure step 6) | **PASSED WITH FINDINGS** — step `400360`, three stages, first performed at tip `579225caf`. Stage 1 three-way set comparison: `A−B` = 29 paths all attributed to a recorded boundary, `B−A` = 10 community-owned release artifacts at the sealed tip, **re-measured as 13 at this attempt's tip** — the difference is reconciled rather than left as two numbers for one name: 10 at the sealed tip plus 2 later-step fixes plus 1 further documentation path, enumerated by name in `step400360-attempt1-stage1-sets.txt`, 26/26 changed mapper/DAO files `IDENTICAL_TO_MASTER`, schema delta 6+/6− all `SecretCrypto` widenings, **zero** environment-variable loss *under the env-var filter* (union 54 = pre-sync 54; master's 18 env-var placeholders are a strict subset of HEAD's 54), with 2 master-only keys under the wider all-`${…}`-targets filter, both deliberate Rule 8 and neither a loss — reconciled in *Environment contract*. Stage 2 rule-by-rule compliance: Rules 1, 2, 3, 4 (all nine sub-bullets), 5, 6, 8, 9, 11, 12 all verified by measurement; all 9 release-file fields and all 12 log fields present. Stage 3 consistency, **re-measured 2026-09-08 on the post-strip tree with every figure unchanged**: 1899 paths, 0 symlinks, `EXEC_MODE_DRIFT=0` — taken against the tree object `git write-tree` produced from the staged index, i.e. the artefact this commit will create, not against an earlier tip (see the *Executable file modes* row). **6 findings, none critical**: F1/F2/F3 fixed in step; F4/F5/F6 reported and carried to the human gate. The recorded baseline is deliberately **not** moved — see *Risks* and the sync log. **Final-attempt supplement, performed because re-reading that review found two gaps in it:** (a) its Stage-2 rule table covers Rules 1–6, 8, 9, 11 and 12 and **omits Rules 7 and 10**; (b) the log entry *counted* the overlapping files and the yml-only environment keys but did not *name* them all, which the guide requires literally — "record every intentional Community difference" and "An unexplained missing key is a blocking sync defect". **Rule 7 measured, not assumed:** `git diff --name-status c3a75ae6 HEAD` → **0 deletions**, and of **161** community-only paths present at the pre-sync tip **0** are missing at HEAD, so no unrelated local file was dropped. **Rule 10 is discharged by this supplement itself.** **Overlap files enumerated mechanically from the merge base** rather than guessed: `git merge-base b52cdeeea c3a75ae6` = `25371cb10`, master changed **335** paths and community changed **545** paths since it, and their intersection — the **38** files Git had to merge across a standing community divergence — splits at HEAD into **6** whose blob is byte-identical to master, **5** absent at HEAD (docs-policy exclusions and internal-only `application-daily.yml`/`application-testing1.yml` plus their test), and **27** genuinely divergent. Of those **32** non-identical files, matching each by basename *or* stem against the 2026-09-07 entry text and measuring both with and without this step's new subsection: **19** were already named by the 25 recorded textual-conflict decisions and the surrounding prose, **13** were strictly unnamed, and the **15** now classified into nine justified Rule-4/Rule-8/Rule-11 classes cover those 13 plus 2 that were named only indirectly, through the test file exercising them. All 15 were read in full at `-U0` before being classified. Re-measured after the correction, the same match over all 32 gives **`NAMED_IN_ENTRY=32`, `UNNAMED_IN_ENTRY=0`**. The largest and riskiest was verified rather than eyeballed: `AoneInboundSyncServiceTest.java` (+113/−109) preserves master's tests exactly — 27/27 `@Test` annotations, an identical method-name set (both `comm` difference sets empty), and a strict 28↔28 `KeyCenter`→`SecretCrypto` substitution with `HEAD_KEYCENTER=0`. **That reading is SUPERSEDED by the operator-ruled R7 strip and is kept only as the prior measurement.** Re-measured on the final tree the file is **26** `@Test` methods against master's **27**, and the method-name `comm` difference is **empty in one direction only**: `ONLY_IN_MASTER = refreshIssueIdsCreatesGuidanceForNewInboundMention`, `ONLY_IN_FINAL = 0`. So exactly one master test is absent — the test of the stripped capability — and no other master test was touched. Against **pre-sync community** `c3a75ae6` the method set is identical in both directions (`PRESYNC_ONLY=0`, `FINAL_ONLY=0`) and the file is byte-identical. `KeyCenter` occurrences in the final file remain **0**. **All 17 yml-only environment keys are now named in the log entry** with a measured per-class rationale (4 Redis tuning knobs whose host/port/password *are* documented; 1 OSS switch defaulting to the mandated `true`; 3 OSS bucket overrides that all default to the documented `OSS_BUCKET`; 6 S3 keys on a `false`-by-default path; 1 launcher-owned profile key; 1 Aone key under the permanent-omission clause; 1 runtime-version key), and the guide's coverage claim was checked against the script rather than trusted: `collect_env_contract` at `plan-upgrade.sh:65-87` does scan `src/main/resources/application*.yml` for `${VAR}` at `:72-73` alongside the example's `KEY=` lines at `:70-71`, and its S3 handling at `:108-118` matches the optionality the log now claims. Both the backend and frontend rows above were re-measured in this attempt and **both changed verdict**; the review's conclusions were re-derived at the new tip rather than carried forward. No branch-tip SHA is quoted for the supplement, because the commit that records it moves it — the same reason `verification.md`'s header refuses to name the tip. The tree-wide `cl_2` RAW/DEDUP counts are likewise recorded only in the step evidence file, since this supplement's own Markdown necessarily perturbs them; the **code-scope** count excludes `docs/` and `releases/` and is therefore stable at **39**, identical to pre-sync community `c3a75ae6` | `step400360-independent-review.md`, `step400360-stage2-supplement.md` |
| Export mechanism for step `400362` | **PASS — re-run 2026-09-08 against the pre-commit tree object, not against `HEAD`** | The earlier reading `git archive --format=tar HEAD` was correct when taken but describes a superseded tip, since the operator-ruled R7 strip and this step's documentation edits came after it. Re-run: everything staged, `git write-tree` → the exact tree the commit will create, then `git archive --format=tar <tree>` extracted and checked → `GIT_ARCHIVE_TAR_EXIT=0`, **`EXTRACTED_FILES=1899`**, **`EXTRACTED_SYMLINKS=0`**, `EXTRACTED_DIRS=276`. Per-file Python recheck recomputing each blob SHA-1 and each executable bit against the `ls-tree` manifest of that same tree → **`MISSING=0`, `CONTENT_MISMATCH=0`, `MODE_MISMATCH=0`, `EXTRA=0`** → **`ARCHIVE_ROUNDTRIP_BYTE_AND_MODE_IDENTICAL: YES`**. All four counters were also 0 in the earlier `HEAD` reading, so the mechanism is unchanged by the strip: **content moved, the file inventory and every mode did not.** The tar's byte count is deliberately **not** quoted here — it is content-dependent, so this row's own edit changes it, and a number that cannot survive the sentence recording it belongs in the evidence file rather than in the document. What is quoted is the part step `400362` depends on: `git archive` of a commit tree reproduces the community tree byte-for-byte **and** mode-for-mode, which is the export mechanism the public-output step will use | `step400360-archive-roundtrip.txt`, `step400360-poststrip-tree-measurements.txt` |
| Documented image build (`README:70`) | **PASS after a one-line fix to a pre-existing community defect** — step `400785` ran `docker build --platform linux/amd64 -f APP-META/docker-config/Dockerfile -t autowonder-community:local .` and the **first attempt failed with `docker build`'s own exit code 1**: `V037DockerReleaseGateScriptContractTest` gave 1 failure (`release gate script must exist ==> expected: <true> but was: <false>`) plus 1 `» IO` error, because that test resolves `scripts/verify-v037-docker-gates.sh` relative to the process CWD (`/workspace` in the build stage) and the build stage's `COPY` set was `pom.xml`, `frontend`, `src`, `docs`, `APP-META` — never `scripts`. `.dockerignore` is exonerated (it excludes only `.git`, `.worktrees`, `.idea`, `.vscode`, `target`, `logs`, `frontend/node_modules`, `frontend/dist`, `frontend/tsconfig.tsbuildinfo`). **Attributed before anything was edited:** the Dockerfile is community-owned (`git diff c3a75ae6 HEAD` on it was empty; master's version of that path is an entirely different internally-based Dockerfile the community tree replaces wholesale), while the script and its contract test were both added 2026-08-18 by `12c7c1d82` and `18efee248`, ancestors of pre-sync community, of the merge base and of pristine master alike. So the documented build has been broken **since 2026-08-18**, consistent with this gate's last green reading being 2026-08-04 — a pre-existing community defect, **not** a regression from this sync. Graded **low risk** under AGENT.md rule 4 and fixed with one line, `COPY scripts ./scripts` (commit `624bde76e`, `1 file changed, 1 insertion(+)`, blob `b4a5d4636..2c473744d`). Re-run → **`DOCKER_BUILD_EXIT=0`**, image `sha256:53d7388ccc08…41242059`. Verified *safe*, not merely effective: `scripts_dir_in_runtime=ABSENT`, `workspace_in_runtime=ABSENT` (the runtime image still holds only `/app/auto-wonder.jar` and `/app/logs`), and `scripts/` passes the internal-reference gate (`rg` exit 1 = 0 hits). **Two caveats on how it was run here:** Docker Hub egress is filtered so BuildKit cannot fetch the external frontend named by the Dockerfile's line 1 `# syntax=docker/dockerfile:1`, and a scratch copy with **only that line removed** (`diff` = `1d0`) was built instead — **equivalent on behaviour, not on byte count**, because the *builtin* frontend already supports `RUN --mount=type=cache` and that first, failing build reached the Maven phase through it, so the external frontend is not load-bearing here. The scratch file's identity rests **solely on that `diff` record** (the scratch directory was deleted at teardown and cannot be re-derived), and §3 of the cited evidence discloses an **unreconciled** gap between BuildKit's reported `transferring dockerfile` sizes and the repo file's byte counts (+39, +39, +145; the last carries +106 nothing now explains) — **no conclusion in this row depends on those three numbers**; and base images were pulled from `public.ecr.aws/docker/library/…` and `quay.io/minio/…` then retagged to the Docker Hub names, so **no community file was edited to fit this host**. A contributor with Hub access runs `README:70` verbatim | `step400785-image-build.txt`, `docs/community/verification.md` *Linux image build* / *Runtime image identity* / *Runtime base image* rows |
| Fresh-volume schema import (`README:59`) | **PASS (live)** — `docker compose -p aw400785smoke -f docs/community/docker-compose.dependencies.yml down -v` destroyed the previous volume, `up -d --wait` recreated `aw400785smoke_mysql-data` from nothing under an independent project name, and the entrypoint logged `running /docker-entrypoint-initdb.d/001-autowonder-schema.sql` (`13:39:38`) then `MySQL init process done. Ready for start up.` (`13:39:41`). **`live_tables=65` against `file_create_table=65`, `match=YES`.** This cycle's new tables are present and empty — `agent_conversation_elicitation` (`V049`) and `workspace_access_request` (`V048`), both `rows=0` — as are the `V050`/`V051` columns `user.is_admin`, `org.deleted_at`, `org.active_name_key`, `org.deleted_by`. All **4** guarding unique keys read back `unique=YES` (`uk_active_name`, `uk_conv_request`, `uk_dispatch_normalized_idempotency`, `uk_workspace_access_request_pending`) and the superseded `uk_name` gives `uk_name_occurrences=0`. Server version **8.0.46** from `mysql:8.0`. Credentials passed via `MYSQL_PWD`, never `-p` on argv. **Corrects a previously published figure:** there are exactly **2** true computed columns, not 114 — `information_schema.columns` also sets `EXTRA=DEFAULT_GENERATED` on 112 `DATETIME(3) … DEFAULT CURRENT_TIMESTAMP(3)` columns, and conflating the two produced 114. Index totals disambiguated: **452** `statistics` rows (one per index *column*) = **208** DISTINCT `(table,index)` pairs, **51** of them unique non-PRIMARY | `step400785-schema.txt`, `docs/community/verification.md` *Database schema* row |
| Local startup smoke on a fresh install (`README:73`, `:80-81`) | **PASS — run twice; the `FAIL (environment, attributed)` verdict published earlier this cycle is withdrawn.** See the *Risks* section for why the earlier verdict was correct when measured. **Run A** host JVM `java -jar target/auto-wonder.jar` → `Started Bootstrap in 3.666 seconds`. **Run B** the documented container path verbatim → `DOCKER_RUN_EXIT=0`, healthy after 13 × 2 s polls, `CONTAINER_STARTUP_OK=1`, `container_state=running running=true exitcode=0`, `Started Bootstrap in 20.704 seconds`, `SCRIPT_EXIT=0` captured from the script itself. Shared landmarks: profile `local`, `Tomcat initialized with port(s): 7001 (http)`, `HikariPool-1 - Start completed.`, `V037 schema capability: mode=V037_READY, mapper_mode=SOURCE_AWARE, scheduled_available=true, missing_count=0`, `AiWorkerPool started with 3 workers`. **The documented checks both pass:** `GET /checkpreload.htm` → 200 `success`; `GET /api/integrations/capabilities` → 200 `{"aoneEnabled":false}`, exactly what `README` promises. **Community defaults confirmed live** via `GET /api/platform/branding/public` → 200 with `communityEdition:true`, `recommendedRuntimeVersion:"0.2.152"`, `deploymentVersion:"0.8.0"`, `platformName:"AutoWonder"`, `themeKey:"aliyun-orange"`; unauthenticated **and** bogus-token `GET /api/workspaces/mine` both → 401 `{"code":"10401"}`. **Real auth chain walked: 26 numbered steps, 27 HTTP calls, every one HTTP 200** — register → login → create workspace → switch → then this cycle's new endpoints (`V048` request create/read/approve, `V051` soft-delete → recycle-bin → restore with `version` advancing `0`→`2`, `V049` conversation list, and the two genuinely new elicitation routes, which return the correct business error `{"success":false,"code":"10001","message":"conversation not found"}` — proof the routes are registered and authorisation runs, not a 404). **Env-var quoting proven with a negative control first:** the shipped `application.env.example` line 1 is 167 chars / value 145 / 4 `&`; `eval`'d naively it leaves the variable **empty with exit 0** (`TRUNCATED_LEN=0`), while `docker --env-file` on the **unmodified** template gives `container_env_url_len=145`, `container_env_url_ampersands=4`, `container_env_url_host=mysql:3306`. **Log scan: 0 ERROR.** Host log 61622 B / 323 lines → 309 INFO, 5 WARN, 0 ERROR/FATAL/SEVERE, 0 stack frames, 0 `Caused by:`, 38 × `status=200`; all 5 WARN are `GlobalExceptionHandler\|biz exception` idempotency guards (4 × `code=12013 已是该工作空间成员`, 1 × `code=12012 已有待审批的申请`) triggered by this verification's own repeated probes and correlated line-for-line with the probe log. Container log 47 lines, **0 ERROR, 0 WARN**. `eyJ`=0 and `password=`=0 in both. **Not claimed:** an end-to-end elicitation round trip (needs a running digital worker). **Corrected:** this row previously ended by saying the two Docker-backed Testcontainers *suites* still **skipped** rather than passed — they no longer do. Step `400360`'s decisive run executed all eight container classes (`CONTAINERS_CREATED=8`, `Tests run: 3212, Failures: 0, Errors: 0, Skipped: 1`, exit 0), so this smoke is now **corroboration of a proven suite result rather than the only proof of the DDL** — see *Gates that could NOT run*, where the withdrawn wording and its cause are recorded. **The 2026-09-08 re-run gives `Tests run: 3211`, `Failures: 0`, `Errors: 0`, `Skipped: 1`, `MVN_CONTAINERS_EXIT=0`, `BUILD SUCCESS`, `CONTAINERS_CREATED=8` — one fewer test, and the delta is accounted for rather than left as two numbers for one name:** the operator-ruled R7 strip removed exactly one `@Test` method, `refreshIssueIdsCreatesGuidanceForNewInboundMention`, from `AoneInboundSyncServiceTest.java` (3212 − 1 = 3211). No other test was added, removed, skipped or excluded, and the zero-failure verdict is unchanged | `step400785-smoke-report.md`, `step400785-jdbc-quoting.txt`, `docs/community/verification.md` *Local startup smoke* row |
| Teardown and residue (step `400785` cl_5) | **PASS** — after the smoke, the host was returned to zero and measured rather than assumed: containers **4 → 0**, images **9 → 0**, volumes **3 → 0**, non-default networks **1 → 0**, build cache **32 entries / 1.554GB → 0 B**, `docker system df` all zeros. All **7** ports (7001, 33060, 63790, 9000, 9001, 3306, 6379) report **0 listeners**; `pgrep -l java` empty; `app.pid` absent. Nine scratch files holding generated secrets were deleted, including the JWT-bearing first-pass auth log and the 73 MB extracted JAR; a rescan for residual secret-bearing files under the scratch directory returns **none**, and `~/.testcontainers.properties` was never created. `CLEANUP_EXIT=0`. **One self-inconsistency is disclosed rather than hidden:** a named `docker rmi` returned exit 1 (`No such image`) because untagging a sibling tag had already consumed the shared layers, leaving `<none>` entries; a follow-up `docker image prune -a -f` reclaimed `2.035GB` and produced the all-zero final state. The repository itself was left at `git status --porcelain` = **0 lines** with the step's two commits in place | `step400785-cleanup.txt` |

### The 10 frontend failures, attributed

**Heading corrected from "The 9 frontend failures".** Nine failures are
deterministic and their names never move; the tenth is a **rotating
load-sensitive slot** and this section previously attributed it to one named file,
which the 2026-09-08 run falsified. Both groups were reproduced on a baseline and
are **not** caused by this sync's conflict resolution.

- **6 in `ExecutorListPage.test.tsx`** (Context Window persistence and Qoder
  startup-preference cases) — these are **master's own pre-existing failures**
  from the new Agent-grouping UI, recorded as risk R1 in the step-`400357`
  analysis and reproduced on pristine `origin/master`. After the internal-host
  redaction in *Community Adaptations* item 3, the file's failures are back to
  exactly master's 6.
- **3 in `WorkitemDetailPage.test.tsx`** (clarify panel width, and two
  clarify-URL-persistence cases) — deterministic failures caused by community's
  own earlier frontend toolchain bump in `86e3614ff`, **not** by this merge.
  A reproduction worktree (`master-comtoolchain-wt`: pristine master plus only
  community's toolchain change) reproduces them, which isolates the toolchain as
  the cause. Step `400360` re-ran that experiment itself rather than trusting the
  earlier report: `npx vitest run src/features/workitem/WorkitemDetailPage.test.tsx`
  in that worktree → `COMTOOLCHAIN_WDP_EXIT=1`, `Test Files 1 failed (1)`,
  `Tests 3 failed | 63 passed (66)`, the same three names. It also re-confirmed
  the executor group at the community tip:
  `npx vitest run src/features/executor/ExecutorListPage.test.tsx` →
  `HEAD_EXECUTOR_EXIT=1`, `Tests 6 failed | 56 passed (62)`, the same six names,
  which also proves that group is deterministic and not load sensitive.
- **1 load-sensitive, a rotating slot — the earlier naming of one file as *the*
  tenth is corrected here.** The 2026-09-08 run gave
  `src/features/statemachine/StatusTemplatePage.test.tsx > keeps node creation
  visible but does not open its modal for a read-only member`
  (`TestingLibraryElementError: Unable to find role="button" and name /添加节点/`,
  test line 97) while `AllWorkspacesTab` — the file the previous generation
  attributed the tenth failure to — **passed**. Its mechanism is the same one the
  earlier generation saw: the failing DOM dump ends in `ant-spin-dot-item`, i.e.
  the page was still rendering its spinner when a `findByRole` timed out, and
  `添加节点` occurs exactly once in the dump, inside the error message itself.
  **Both candidates pass in isolation, re-measured this round:**
  `npx vitest run src/features/statemachine/StatusTemplatePage.test.tsx` →
  `ISO_STP_EXIT=0`, `Tests 3 passed (3)`, 6.25s;
  `npx vitest run src/features/auth/AllWorkspacesTab.test.tsx` →
  `ISO_AWT_EXIT=0`, `Tests 25 passed (25)`, 9.39s. So the tenth slot is
  **which-ever `findByRole` loses the race under full-suite load**, not a fixed
  defect in either file. Classification is unchanged — fails only under
  full-suite load, so **concurrency/load sensitive**, not a functional defect and
  not a sync regression — but a single repeated observation was weaker evidence
  than the rotation now is, and the honest statement to a contributor is that the
  normal full-suite result is `10 failed | 1459 passed (1469)` with the tenth
  name varying between runs.
  **The strip cannot have moved any frontend result:** `frontend/`'s tree hash
  `6235c7e5ad11b18b7ba0bed1875a38227ea4c541` is identical at HEAD and at
  `origin/community`, and the worktree diff against pre-sync community contains
  **zero** frontend paths. The prior pristine-`origin/master` reproduction (the 6
  executor names byte-identical across both trees) and the `master-comtoolchain-wt`
  reproduction therefore carry forward on **bit-identity, not on trust**.

The 6-name executor isolation at HEAD *was* re-measured on 2026-09-08
(`HEAD_EXECUTOR_EXIT=1`, `Tests 6 failed | 56 passed (62)`, 37.34s) and so was the
3-name `WorkitemDetailPage` group (`HEAD_WDP_EXIT=1`, `Tests 3 failed | 63 passed
(66)`, 33.39s); the toolchain-worktree reproduction `COMTOOLCHAIN_WDP_EXIT=1` is a
2026-09-07 reading and was **NOT RE-RUN**. What the full suite itself gave on
2026-09-08 is `NPM_TEST_EXIT=1`, `Test Files 3 failed \| 144 passed (147)`,
`Tests 10 failed \| 1459 passed (1469)`, `Duration 223.28s` — total unchanged at
1469, so no test was added, removed, skipped or excluded.

**Net attribution: 6 upstream defects + 3 community-toolchain defects + 1
load-sensitive flake occupying a rotating slot = zero sync-introduced
regressions.** No assertion was weakened and no test was skipped to obtain a
greener number. **The operator's instruction that the frontend unit-test pass rate
must reach 100% is not met and cannot be met within this step's mandate**, for a
reason recorded rather than worked around: the 6 belong to `origin/master` and
fixing them in community would violate Rule 3 (master owns product behaviour), so
they must be fixed on master; the 3 are community's own pre-existing debt from the
toolchain bump in `86e3614ff` and repairing them here would be 扩大无关重构; and the
tenth is not a defect at all. That is a decision for the operator, not a number to
be adjusted.

### Gates that could NOT run — reported as SKIPPED, never as PASS

- **The Docker-backed Testcontainers suites DO run here now — this bullet's opening
  claim that two of them "still cannot run here" is withdrawn, and its earlier
  diagnosis of why was incomplete in a second way as well.** They run when the API
  version is delivered as a **JVM system property**
  (`-DargLine="-Dapi.version=1.44"`) rather than as an environment variable, with
  the images pre-pulled and `TESTCONTAINERS_RYUK_DISABLED=true`; step `400360`
  measured `MVN_CONTAINERS_EXIT=0`, `BUILD SUCCESS`,
  `Tests run: 3212, Failures: 0, Errors: 0, Skipped: 1` and `CONTAINERS_CREATED=8`.
  **Every `3212` in this narrative — including the `3171 − 7 + 48 = 3212`
  derivation below — is the pre-strip 2026-09-07 reading; the post-strip
  re-measurement on 2026-09-08 gives `3211` with the same zero failures, zero
  errors and one skip, and the one-test delta is reconciled in *Stripped per
  operator ruling (R7)*. The arithmetic is left as measured rather than restated
  at 3211, because it derives the pre-strip number and restating it would hide
  which tree it describes.**
  What is still true is that they do **not** run under the documented *plain*
  command on this host, and the account of why follows. When the v0.8.0 evidence was
  first measured this host had no container runtime at all, so 7
  Testcontainers/MySQL-gated backend suites plus `AoneUserApiManualTest` skipped and
  the backend skip count was 8 rather than v0.7.0's 1. Docker Desktop is **now
  running**: `/Users/honeyfamily/.docker/run/docker.sock` exists, a raw `GET /info`
  returns a 59-key object with `ServerVersion 29.7.2`, and Testcontainers logs
  `Connected to docker`. That flips the two `Assumptions.assumeTrue(…isDockerAvailable())`
  suites from `Skipped` to `Errors`, so the host attempt measured `Skipped: 6`
  with `Errors: 2`. **An earlier draft of this bullet called the blocker "an
  API-version incompatibility, not an absent runtime"; step `400785` found the
  failure is bimodal and that label describes only one of the two modes.** Mode 1
  is discovery-fail, and the API-version mechanism is exactly right for it:
  `DockerClientProviderStrategy` logs `Could not find a valid Docker environment`
  with `EnvironmentAndSystemPropertyClientProviderStrategy: failed with exception
  BadRequestException (Status 400: {…all-empty Info object…})` and
  `DockerDesktopClientProviderStrategy` failing identically, because the daemon
  reports `ApiVersion 1.55` / `MinAPIVersion 1.40` while the `docker-java`
  transport bundled with the pinned Testcontainers `1.20.6` negotiates client
  version `1.32`; the third strategy gives
  `UnixSocketClientProviderStrategy: InvalidConfigurationException … NoSuchFileException (/var/run/docker.sock)`,
  and `/var/run/docker.sock` genuinely does not exist on this host — `DOCKER_HOST`
  must be set to the user socket. With discovery failing, every
  `Assumptions.assumeTrue(…isDockerAvailable())` guard is false and **all eight**
  Docker-gated suites **skip**. Mode 2 is discovery-succeed:
  `ContainerFetchException: Can't get Docker image: RemoteDockerImage(imageName=testcontainers/ryuk:0.11.0)`,
  i.e. **Docker Hub egress is policy-filtered** (DNS sinkholed, `curl` exit 28),
  which turns two of the eight from skip into **error**. `DOCKER_API_VERSION=1.44`
  fixes `/info` but not the pull; `DOCKER_HOST=tcp://127.0.0.1:1` does not disable
  discovery either, because Testcontainers logs the refusal and then falls through
  to the Docker Desktop socket strategy. **`TESTCONTAINERS_RYUK_DISABLED=true` was
  actually set on this cycle's host run and changed nothing**, because Mode 1
  fails before any image is requested — the ryuk workaround only matters in Mode 2.
  **Superseded: an earlier draft concluded "Neither mode is a pass". A third channel
  does pass, and it was found after that draft was written.** The env-var
  observation above was true but incomplete, because it tested only the *environment
  variable* channel: Testcontainers `1.20.6` **shades** docker-java, and its
  whitelist has 13 `DOCKER_*` names but **not** `DOCKER_API_VERSION`, so that
  variable never reaches the shaded client at all. Delivered instead as a **JVM
  system property**, `-DargLine="-Dapi.version=1.44"`, it does reach it; combined
  with pre-pulled images and `TESTCONTAINERS_RYUK_DISABLED=true` this cycle measured
  `MVN_CONTAINERS_EXIT=0`, `BUILD SUCCESS`,
  `Tests run: 3212, Failures: 0, Errors: 0, Skipped: 1` and `CONTAINERS_CREATED=8`,
  with the count closing exactly as `3171 − 7 + 48 = 3212`. That is recorded as
  **"The only pass branch"** in `docs/community/verification.md`. **What survives of
  the original conclusion:** the flag is a verifier-supplied diagnostic override and
  *not* a project setting, so the documented plain command still fails on such a
  host, and Testcontainers is pinned
  `1.20.6` identically at HEAD, at pre-sync community `c3a75ae6` and at pristine
  `origin/master` `b52cdeeea`, with the same two errors reproducing on pristine
  master — so this is upstream/host debt and not this sync's. Making the plain
  command work unflagged means upgrading a
  master-owned dependency version, which is a decision handed over, not taken here.
  **Withdrawn: the claim that SDLC step `400785` (local startup smoke) and the
  image-dependent rows of `docs/community/verification.md` "still cannot be
  executed as specified".** Both were executed. The four options put to the human in
  step `400356` (install a runtime / remote `DOCKER_HOST` / authorize brew MySQL 8 +
  Redis with a logged deviation / accept `NOT RUN`) are now largely moot for that
  purpose: option 1 was satisfied by the running daemon, and the image-availability
  problem was solved without any of them by pulling from reachable registries
  (`public.ecr.aws/docker/library/…`, `quay.io/minio/…`) and `docker tag`-ing back
  to the Docker Hub names, so the community compose file, `Dockerfile` and `README`
  were all consumed **byte-for-byte unmodified**. Editing them to fit this host
  would have been an environment-driven product change.
  **What step `400785` proved live, replacing the "Not proven, and not claimed"
  list an earlier draft of this bullet carried:** fresh-volume schema import into a
  brand-new `aw400785smoke_mysql-data` (65 live tables against 65 `CREATE TABLE`),
  `/checkpreload.htm` → 200 `success`, `/api/integrations/capabilities` → 200
  `{"aoneEnabled":false}`, the community default values in
  `/api/platform/branding/public`, and the full
  register→login→create-workspace→switch→new-feature auth chain — 26 numbered steps,
  27 HTTP calls, every one HTTP 200. The earlier `grep -c 'jdbc:mysql'` = `0` was
  a true reading of a log that terminated at `RedisManager.testEnterprise(RedisManager.java:249)`
  before MySQL was reached, not evidence about the product.
  **What genuinely remains unrun, and the honest statement of why — corrected by
  this cycle's decisive run.** The eight Docker-backed suites are
  `AoneUserApiManualTest`,
  `V037SchemaCapabilityDetectorMySqlTest`, `V037LegacyWorkitemIntegrationTest`,
  `V037CompatibilityMatrixTest`, `ScheduledTaskConcurrencyTest`,
  `ScheduledTaskSpringMybatisIntegrationTest`, `ScheduledTaskEndToEndTest` and
  `V037LegacyArtifactServiceFlowMySqlTest`. **Superseded: an earlier draft of this
  paragraph said they "skip in every reading this cycle — host and in-container
  alike — so no test here exercises a real MySQL through Testcontainers", and that
  the blocker "only a dependency upgrade can fix". Both are now false.** With the
  images pre-pulled, `TESTCONTAINERS_RYUK_DISABLED=true` and
  `-DargLine="-Dapi.version=1.44"`, step `400360` measured
  `MVN_CONTAINERS_EXIT=0`, `BUILD SUCCESS`,
  `Tests run: 3212, Failures: 0, Errors: 0, Skipped: 1` and
  `CONTAINERS_CREATED=8`: **all eight container classes executed rather than
  skipped or errored, and the MySQL 8.4.4 / Redis 7 suites really ran against real
  servers.** `docs/community/verification.md` tabulates that shape as **"The only
  pass branch."** So a real MySQL *is* now exercised through Testcontainers, and
  the live smoke below is corroboration of a proven suite result rather than the
  only proof of the DDL.
  **What is still honestly open, and it is narrower than the withdrawn claim.**
  (a) The property is a **verifier-supplied diagnostic override, not a project
  setting** — Testcontainers `1.20.6` shades docker-java and its env-var whitelist
  carries 13 `DOCKER_*` names but *not* `DOCKER_API_VERSION`, so only a JVM system
  property reaches the shaded client. A contributor running the documented plain
  command on a daemon whose `MinAPIVersion` exceeds docker-java's `1.32` default
  still gets the failure. Making that work without a flag is a **project-level**
  change to a master-owned pinned version, and Community Boundary Rule 5 forbids
  moving dependency versions as part of a sync — so *that* part of the handover
  stands, while "only a dependency upgrade can fix" does not: the suites can be
  exercised today with one flag. (b) `Skipped: 1` remains, and **the identity of
  that single skip is not attributed anywhere in this cycle's evidence**; it is
  recorded as an open item rather than guessed at, and it is one test rather than
  the eight previously claimed. (c) A divergence is recorded rather than silently
  reconciled: the suites declare `mysql:8.4.4` while the community compose file
  ships `mysql:8.0` (resolved 8.0.46), so even the green suite run does **not**
  test the server version a community deployment actually runs.
  **Kept as history, since it explains how the withdrawn claim arose.** An earlier
  draft said a mirror-retag path for `mysql:8.4.4` "was not attempted"; that was
  itself wrong and was corrected once already — the image *was* pulled,
  `public.ecr.aws/docker/library/mysql:8.4.4` → `MYSQL844_PULL_EXIT=0`, digest
  `sha256:23818b7d7de4…`. The draft then reasoned that a `docker tag` back plus a
  suite re-run "would not have helped, because Mode 1 fails at *discovery*, before
  Testcontainers ever asks for an image". That reasoning was sound about the
  env-var channel and wrong about the outcome, because it never tried the
  **system-property** channel; once that channel was used, discovery succeeded and
  eight containers were created. The error was generalizing from one channel to all
  of them.
- **`terraform` and `ossutil` are not installed**, and
  `~/.aliyun/config.json` does not exist. This is the direct cause of most of the
  deploy Skill's 29 failures (`ERROR: required command missing: terraform`,
  `ERROR: required file missing: .../.aliyun/config.json`) and of 5 of the
  upgrade Skill's 6. **The credential file was deliberately not created** —
  AGENT.md Rule 8 forbids credentials entering this work.
- **PowerShell is unavailable on this macOS control host** — 1 upgrade Skill test
  skipped (`tests/test_windows_native_adapters.py:96`).
- **`docs/community/verification.md` was not rewritten by this step.** It still
  carries measurements from the v0.7.0 cycle, including a startup smoke that
  reported runtime `0.2.150`. Rewriting it to claim `0.2.152` without
  re-measuring would be fabricated evidence. Steps `400360` and `400785` own it
  and must mark every un-rerun row `NOT RE-RUN` with its last measurement date.
  **Resolution: step `400360` has since rewritten the file** with this cycle's
  measured values (backend **`Tests run: 3211, Failures: 0, Errors: 0, Skipped: 1`**
  with `MVN_CONTAINERS_EXIT=0`, `BUILD SUCCESS` and `CONTAINERS_CREATED=8` — the
  **post-strip** total; the `3212` quoted elsewhere in this file is the pre-strip
  2026-09-07 reading and the one-test delta is reconciled in *Stripped per
  operator ruling (R7)*; the
  intermediate `MVN_FULL_EXIT=1` / `3171` / `Errors: 7` and
  `MVN_MIRROR_EXIT=0` / `3171` / `Skipped: 8` readings being retained in that file
  as two **explicitly refused passes** rather than deleted; frontend 147 files /
  1469 tests / `TEST_RUN1_EXIT=1`, Skill suites re-measured, dependency and
  internal-reference gates re-measured), marked every un-rerun row `NOT RE-RUN`
  with its last measurement date, and corrected a stale npm-audit paragraph that
  described two high React Router RSC-mode advisories npm no longer reports —
  the measured posture is now a single high **nanoid** `GHSA-2v37-7h3g-55p8`,
  itself marked `NOT RE-RUN` in the final attempt because the audit was not
  repeated.
  *(History, superseded below.)* The image and startup-smoke rows stayed `NOT RE-RUN`
  because no container image could be pulled here and no local `mysql`/`redis-server`
  binary existed; step `400785` still owned them.
  **Further resolution by step `400785`, which re-ran all of them rather than
  leaving any `NOT RE-RUN`:** *Local startup smoke* now reads **PASS — run twice
  this cycle; the prior FAIL (environment, attributed) verdict is withdrawn**,
  with both runs, the full auth chain and an explicit list of what is still *not*
  claimed. The image rows are likewise measured: *Linux image build* **`PASS, after
  a one-line fix to a community-owned defect this step found`** (`DOCKER_BUILD_EXIT=0`),
  *Runtime image identity* **`PASS`** and *Runtime base image* **`PASS — digest
  unchanged since 2026-08-04`**; *Database schema* is **`PASS (live import into a
  brand-new volume)`**. An earlier draft of this paragraph said the smoke row read
  `FAIL (environment, attributed — not a product defect)` and that the image rows
  remained `NOT RE-RUN`; both statements were true when written and are withdrawn
  now that they have been superseded by measurement. Step `400785` also corrected
  `verification.md`'s stale "64 tables" figure to the measured 65 (the old number
  came from the schema file's own stale `-- 表清单（64 张）` footer, which is equally
  wrong on master and was deliberately left alone), replaced the now-false
  "documentation-only" header claim with re-checkable facts about the two later
  non-Markdown commits, and hardened the Automated Gates recipe so a
  non-installable frontend lock can no longer pass the whole matrix.

### Pre-existing Skill-test debt, disclosed and deliberately not fixed here

Beyond the missing tools, a large part of the deploy Skill's 29 failures comes
from `test_script_contracts.py` assertions that read
`scripts/initialize-and-verify.sh`, `scripts/release-transfer.sh` and
`scripts/build-release.sh` and expect **inline implementation text** which a
prior community refactor moved into `scripts/internal/operations.sh` and
`scripts/internal/release-transfer.sh`. The public entrypoints are now
deliberately thin wrappers ("Keep the public deployment entrypoint intentionally
thin"). Example:
`AssertionError: 'connection=${SPRING_DATASOURCE_URL#jdbc:mysql://}' not found in '#!/usr/bin/env bash ... exec bash "$SCRIPT_DIR/internal/operations.sh" "$@"'`.

This debt is **unrelated to this upstream sync** (proved: the merge touched zero
Skill files and the `skills/` subtree hash is identical across it) and repairing
~20 stale assertions would multiply the diff without serving external
deployability, which the step instruction forbids ("只做外部可部署所必需的最小适配")
and which AGENT.md's ban on 扩大无关重构 also forbids. It is carried forward as an
open item. Consequence to note honestly: **Rule-12 source #4 is not guarded by a
passing test in this environment**, so its three literals were confirmed by
direct inspection instead; sources #1, #2, #3 and #5 are confirmed by passing
tests or by exact file content.

## Risks

- **`V050` privilege grant is the highest-visibility risk.** Upgrading confers
  platform-administrator rights on the system's first active user with no prompt,
  and that role can view and restore every workspace's recycle-bin records.
  Operators must review the target row before applying and revoke or reassign
  afterwards if it is the wrong account. This is a permission/security surface
  change and is escalated for explicit human acknowledgement before release.
- **`V051` performs a destructive index operation** (`DROP INDEX uk_name`) on a
  live table and its rollback is not symmetric. Verify on a shadow database
  first if `org` is large.
- **The absent-container-runtime risk is withdrawn; four narrower verification
  gaps replace it.** An earlier draft of this bullet said verification depth was
  "reduced by the absent container runtime — narrowed by step `400785`, not
  closed", that the step "did **not** prove the application serves a request:
  there is no observed health check, no observed capability response, and no
  observed auth chain", and that "全新安装可用" was asserted "from build,
  boot-to-init and static schema audit — **not** from an observed running
  instance". **All three statements are falsified and withdrawn.** Step `400785`
  observed a serving instance twice — once as a host JVM
  (`Started Bootstrap in 3.666 seconds`) and once through the documented container
  path verbatim (`Started Bootstrap in 20.704 seconds`, `CONTAINER_STARTUP_OK=1`,
  `container_state=running`) — with `/checkpreload.htm` → 200, the capability
  response, the community branding defaults and a 27-call auth chain all returning
  HTTP 200, against a MySQL and Redis started from the community compose file into
  a brand-new volume. What actually remains:
  1. **The eight Testcontainers-gated suites do run — but only with a
     verifier-supplied flag.** **Corrected: this item previously read "Eight
     Testcontainers-gated suites still skip", so "no automated test exercises a
     real MySQL" and "the fresh-install claim rests on the live smoke alone". All
     three are falsified by this cycle's own decisive run and withdrawn.** That run
     created all eight containers (`CONTAINERS_CREATED=8`) and reported
     `Tests run: 3212, Failures: 0, Errors: 0, Skipped: 1` with exit code `0` and
     `BUILD SUCCESS`, so automated tests did exercise a real MySQL and Redis. What
     survives is narrower and still true: reaching that run required
     `-DargLine="-Dapi.version=1.44"`, a **diagnostic override supplied by the
     verifier, not a project setting**. Testcontainers `1.20.6` shades
     `docker-java`, and its environment-variable whitelist omits
     `DOCKER_API_VERSION`, so the documented plain command still negotiates
     `RemoteApiVersion 1.32` and fails with HTTP 400 against a daemon whose
     `MinAPIVersion` is `1.40`. Removing that need means moving a **master-owned**
     pinned dependency version, which Community Boundary Rule 5 forbids as part of
     a sync — so the handover stands even though the suites are not blocked. Two
     honest gaps remain inside the pass: the single `Skipped: 1` is attributed
     nowhere in this cycle's evidence, and the suites declare `mysql:8.4.4` while
     the community compose file ships `mysql:8.0`, so even the green run does not
     exercise the server version a community deployment actually starts.
  2. **Object storage was proven through the MinIO S3 path, not the shipped
     default.** The run used `OSS_ENABLED=false` + `S3_ENABLED=true` with bucket
     `autowonder-local` on a local MinIO, which is the documented local path in
     `docs/autowonder-s3-storage.md` §7 — but the community default is
     `oss.enabled=true` against Alibaba Cloud OSS, and **that default path has no
     runtime evidence this cycle** because no real OSS credentials exist here and
     AGENT.md Rule 8 forbids introducing them.
  3. **The image is `linux/amd64` run under emulation on an arm64 host.** An
     arm64-native community deployment is therefore untested, and `README:70`
     itself prescribes `--platform linux/amd64`.
  4. **Only a fresh install was proven.** Secrets were locally generated, one
     instance ran, unloaded and without concurrency, and no upgrade from an
     existing 0.7.0 database was attempted. The `V050` privilege grant and the
     `V051` `DROP INDEX uk_name` above *were* executed — by the fresh-volume
     import, which is why `uk_name_occurrences=0` is a live reading — but against
     an **empty** `org` table and a database with one newly registered user, never
     against a populated production dataset.
- **Rule-12 source #4 has no passing guard here**, so a future manifest bump
  could again drift from `test_script_contracts.py` unnoticed — the same failure
  mode as commit `f9ba26785`, which bumped only the manifest and left the tests
  behind. Fixing the stale Skill assertions would restore that guard.
- **R7 Aone mention wake — CLOSED, no longer residual.** The operator ruled on
  2026-09-08 (comment `126197`) 「如果是aone的新功能的话，就剥离，如果是存量功能的话就保留」,
  the new Aone call site and its test were stripped byte-identical to pre-sync
  community, and the pre-existing shared `GuidanceService` mechanism was kept.
  The executed detail, including the ancestry measurement that split the commit
  and the `3212 → 3211` test-count reconciliation, is in the section titled
  "Stripped per operator ruling (R7)" above. What *does* remain residual is the
  process consequence: the strip is a code change made **after** the first
  internal MR was merged, so a second internal MR against `community` is
  required before this tree can be published.
- **Frontend carries 9 deterministically attributed failures, and the full-suite
  total measured 10.** 6 are master's own and 3 come from community's toolchain
  bump. **The tenth is a rotating load-sensitive slot, not a fixed file**: on
  2026-09-08 it was occupied by `StatusTemplatePage.test.tsx` while the file the
  previous generation blamed, `AllWorkspacesTab.test.tsx`, passed, and both pass
  in isolation (`ISO_STP_EXIT=0`, `ISO_AWT_EXIT=0`, re-measured this round). It is
  counted in the total but attributed to no file and to no sync. The full
  reconciliation is in the section titled "The 10 frontend failures, attributed"
  above — cited by title, not by line number, because line numbers in this file
  have already gone stale. None blocks the production build (`NPM_BUILD_EXIT=0`),
  but the suite is not green, must not be reported as green, and **the operator's
  100%-pass instruction is not met and cannot be met within this step's mandate**
  for the three reasons stated in that section.
- **Toolchain drift.** This environment runs Node v26.4.0 / npm 11.17.0 while
  the documented community toolchain is Node v22 / npm 10; npm 11's
  optional-peer pruning reshaped the lockfile (36 removals). `allowScripts` was
  adopted with `esbuild@0.25.12`, and because `vite 6.4.3` depends on
  `esbuild ^0.25.0`, a drift to 0.25.13 would silently re-block postinstall.
- **`fastjson2` version decrease** `2.0.58` → `2.0.31` was resolved per Rule 5
  and community declares `fastjson2` directly, so it must be reviewed for
  advisories independently of the internal SDKs that used to supply it.
- **A stale prior-release note.** `releases/release_v0.7.0_20260902.md:217` still
  says the upstream pull request was "not opened yet", although
  `upstream/master` already contains the merged sync `#115`. That file is a
  published historical record and was not edited; the discrepancy is disclosed
  here instead.

## MR/PR Links

- **Internal `community` branch review — MR NOT YET CREATED.** Open it from this
  entry (target base `community`, source branch
  `aw/community-sync-b52cdeeea-20260906`):
  [Create internal code review](https://code.alibaba-inc.com/sdlc-autopilot/auto-wonder/codereview/new?from=community&to=aw/community-sync-b52cdeeea-20260906)
  The sync branch is pushed, **and step `400361` has since pushed it again** — that
  is a permanent fact about the step, unlike the ref values below. The invariant a
  reviewer should hold this file to is that **at the tip presented for review nothing
  is unpushed**: verify with `git rev-list --count
  refs/remotes/origin/aw/community-sync-b52cdeeea-20260906..HEAD`, which **must
  return `0`**. It returned `0` when this correction was measured, and any step that
  commits here afterwards must push before presenting the branch again. **Corrected:
  this bullet previously asserted "the remote ref lags the local HEAD of that branch"
  and named `ce87212436fcc98355b701134b2f21c56f0cb476` as the remote value. That was
  true when written and the re-push falsified it; the named tip is withdrawn rather
  than updated, because the next documentation commit would stale it again.** This
  file names neither the local tip nor a commit count: a documentation commit moves
  both, the defect `a3b7547e0` exists to stop. Measure instead —
  `git ls-remote origin refs/heads/aw/community-sync-b52cdeeea-20260906` for
  server-side truth and `git rev-parse HEAD` for the local side. **Corrected: this
  sentence previously read "The unpushed commits are step `400359`'s documentation
  corrections", and that attribution is false for at least three of them.**
  **Corrected a second time, because the first correction was itself written as a
  count, a position and a date span, and all three drifted within the hour.** It
  gave the series a date span and said "its last three commits belong to step
  `400360`", citing that step's evidence record by section for each hash. A fifth
  correction commit then landed, which falsified "last three", falsified the date
  span, and moved one cited hash out of the section cited for it. The attribution
  is now stated as a RANGE, which cannot drift:
  `git log --oneline a144a5da0..HEAD` enumerates the documentation-correction commits
  added to this branch after `a144a5da0`, the measurement tip recorded in step
  `400360`'s own evidence. **Corrected: this sentence previously asserted that the
  range "returns exactly the commits step `400360` made". That attribution is
  withdrawn, for three reasons. Git records no SDLC step against a commit, so the
  claim was never measurable from the repository. More than one later step has since
  committed into the range. And the sentence making the attribution was itself
  written by a commit inside the range, so it cannot be used to date the range — a
  self-referential claim of exactly the kind this paragraph warns about.** The range
  is therefore offered only as something to enumerate, not as an attribution. It is a
  claim about nothing more than position on this branch, and not a permanent property
  of it: if a later step commits here, the range simply grows.
  The range used to be described as a strict subset of the unpushed series
  `origin/aw/community-sync-b52cdeeea-20260906..HEAD`; **that series is required to
  be empty at any tip presented for review — step `400361` pushed it to `0` — so the
  subset relation says nothing and is withdrawn rather than left implying unpushed
  work.** The commits before
  `a144a5da0` are **deliberately not attributed here** — git records no SDLC step
  against a commit, so naming one would be a guess dressed as a measurement.
  Neither range is counted in this file; enumerate both, because any further
  correction commit extends them. The attribution is not what the MR depends on —
  the consequence is: **step `400361` had to push again before opening the MR**,
  otherwise the review would present the pre-correction tree. **That re-push has
  been done** — a pure fast-forward, no force, no amend, no history rewritten.
  Re-check the remote with
  `git ls-remote origin refs/heads/aw/community-sync-b52cdeeea-20260906`. Above the
  merge commit `616b84687e15702cbc42ac677021499352037e8f` the branch carries
  `2813b524f7d8aa8c8919ef7ab72b03c7769aa032` (this release file, `VERSION` and the
  Rule-12 runtime-version alignment),
  `fe22d55dcb3d97bb57e31687115473182d312a81` (the `upstream-sync-log.md` entry).
  Above those three sit a **series of documentation-correction commits**, each one
  fixing a factual defect found in an already-committed artifact of this release
  cycle (an earlier draft of this section named `616b84687` as the branch tip,
  which stopped being true the moment the next commit existed — a defect this
  paragraph would otherwise keep re-inheriting). Five such corrections had landed
  as of `579225caf`, and the independent sync review of step `400360` adds
  further ones, so **no count written here can stay true**. Enumerate the branch
  exactly instead of trusting this file:
  `git log --oneline c3a75ae60462e3bdc93d1e9fb82041dc9d442f51..<branch-tip>` and
  read the tip from `git rev-parse HEAD`. Measured since `2813b524f` — and the
  earlier wording of this sentence claimed the branch touched "only `releases/`,
  `docs/community/` and `docs/autowonder-schema.sql`", which the very next sentence
  contradicted by naming two code commits. Re-measured against
  `git diff --name-only 2813b524f..HEAD` at the time of this correction, the range
  touches four Markdown paths (`releases/release_v0.8.0_20260907.md`,
  `docs/community/README.md`, `docs/community/upstream-sync-log.md`,
  `docs/community/verification.md`) **plus three paths that are not Markdown**:
  `APP-META/docker-config/Dockerfile`, `frontend/package-lock.json` and
  `docs/autowonder-schema.sql`. **Corrected: this bullet previously said "exactly
  two non-documentation paths" and named only the Dockerfile and the lockfile. The
  third is `docs/autowonder-schema.sql`, a shipped SQL file rather than prose; its
  change was comments-only (Rule 11 renumbering of three stale migration
  references, zero non-comment lines), but a reviewer reproducing this with
  `grep -v '\.md$'` gets three paths, not two, so the number is corrected and the
  reason stated instead of leaving the two figures to disagree.**
  `git log 2813b524f..HEAD -- skills` is still empty (re-measured `0` commits).
  Code changes are confined to `2813b524f` (Rule 12, four `skills/` files),
  `624bde76e` (the Dockerfile) and `6fa57221a` (the lockfile). That correspondence
  between the code commits and the non-Markdown paths is what makes this claim
  checkable rather than merely asserted. **No commit count is maintained here any
  more. The previous draft recorded that the correspondence "held at 26 commits in
  `2813b524f..HEAD`"; the same range measured 31 commits immediately before this
  correction commit was made, and this commit extends it again — which is the whole
  argument for not writing the number down. Enumerate the range.**
  `community` is a protected branch
  and was **not** auto-merged; per AGENT.md responsibility 2 a human must review
  and merge it. Record the resulting MR number here and in
  `docs/community/upstream-sync-log.md` at step `400364`.
- **External GitHub output branch — NOT YET PUSHED.** SDLC step `400362` will
  copy the complete community tree into `ai-sdlc/auto-wonder/` on the fork
  `caihe-ch/alibabacloud-landing-zone`, on a branch to be named
  `sync/autowonder-community-v0.8.0-20260907`, based on the then-current
  `upstream/master`. It will contain `ai-sdlc/auto-wonder/VERSION` = `0.8.0` and
  this release file, matching the community branch byte for byte.
- **Upstream pull request into `aliyun/alibabacloud-landing-zone` — PR 尚未创建
  (NOT YET CREATED).** This link is only a **creation entry**; it does not mean a
  pull request exists:
  [Create GitHub upstream PR](https://github.com/aliyun/alibabacloud-landing-zone/compare/master...caihe-ch:sync/autowonder-community-v0.8.0-20260907?expand=1)
  It will not resolve until step `400362` has pushed the branch. `gh pr create`
  is **not** called by this workflow (step `400363`); a human creates, reviews
  and merges the upstream PR.
- **Release tag — NOT CREATED.** `autowonder-community-v0.8.0` must not be
  created until the upstream PR is merged **and** a human explicitly confirms,
  per AGENT.md responsibility 9. No `autowonder-community-v*` tag exists on any
  remote today. Step `400364` backfills the real PR link into this section and
  into the sync log.
