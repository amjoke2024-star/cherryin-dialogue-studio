# CherryIN Private Online Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a separate invitation-only CherryIN online studio where each authenticated user has an encrypted API key, private history, private images, and durable generation jobs.

**Architecture:** Build the online edition in an isolated git worktree and adapt the existing React interface to the Sites vinext/Cloudflare runtime. Use platform-authenticated user headers for identity, D1 for structured per-user state, R2 for private image bytes, and AES-GCM with a hosted master secret for user API keys. Keep the local Next.js application and its local files unchanged.

**Tech Stack:** React 19, TypeScript 5.9, vinext, Vite 8, OpenAI Sites, Cloudflare Workers, D1/SQLite, R2, Web Crypto AES-GCM, Tesseract.js 7, Node test runner.

## Global Constraints

- Keep `/Users/xieyingjun/Documents/画室` local startup tools, `data/history.json`, `public/generated`, and local production service unchanged.
- Build online work in an isolated git worktree and branch; do not copy local history, generated images, credentials, logs, or runtime binaries.
- Use invitation-only platform access; do not build username/password authentication.
- Derive ownership only from authenticated request headers on the server; never accept a browser-supplied user id.
- Store structured state in D1 and image bytes in R2.
- Encrypt every user API key with a hosted master secret; never return plaintext keys or include them in logs and errors.
- Do not automatically retry paid image generation requests.
- Preserve partial successes and make generation submission idempotent.
- Keep browser-side offline Chinese OCR and the current image-text-edit interaction.
- Automated tests must not make paid image-generation requests.
- The online edition starts with empty history and does not migrate local private files.

---

### Task 1: Create the isolated Sites-compatible online edition

**Files:**
- Create in worktree: `.openai/hosting.json`
- Create in worktree: `vite.config.ts`
- Create in worktree: `worker/index.ts`
- Create in worktree: `tests/rendered-html.test.mjs`
- Modify in worktree: `package.json`
- Modify in worktree: `package-lock.json`
- Modify in worktree: `app/layout.tsx`
- Modify in worktree: `app/page.tsx`
- Delete from online branch only: `runtime/`, `启动工具/`, `运行日志/`

**Interfaces:**
- Consumes: current CherryIN page, styles, OCR assets, image-model assets, and pure helper libraries.
- Produces: a vinext application whose `npm run dev`, `npm test`, and `npm run build` run in the Cloudflare-compatible environment; logical bindings named `DB` and `ASSETS`.

- [ ] **Step 1: Create an isolated worktree**

Use `superpowers:using-git-worktrees` to create a branch named `feat/private-online-studio` in a sibling worktree. Confirm the source repository's existing modified and untracked files remain untouched.

- [ ] **Step 2: Write the failing rendered-page test**

Create `tests/rendered-html.test.mjs` that starts the built worker through the starter test pattern and asserts the root response contains `CherryIN` and `图片改字`, and does not contain the starter marker `codex-preview`.

```js
assert.match(html, /CherryIN/);
assert.match(html, /图片改字/);
assert.doesNotMatch(html, /codex-preview/);
```

- [ ] **Step 3: Run the test to verify the current runtime is incompatible**

Run: `npm test`

Expected: FAIL because the existing Next.js build does not emit the Sites worker entrypoint.

- [ ] **Step 4: Apply the Sites vinext runtime without replacing product UI**

Start from the Sites starter configuration, retain existing `app/`, `lib/`, `public/ocr/`, `public/model-logos/`, and `public/xie-studio-logo.png`, and set `.openai/hosting.json` to:

```json
{
  "project_id": null,
  "d1": "DB",
  "r2": "ASSETS"
}
```

Use `sites()` and Cloudflare `nodejs_compat` in `vite.config.ts`. Remove the starter skeleton, its dependency, and all starter metadata. Ensure `package.json` retains Tesseract dependencies and existing pure tests.

- [ ] **Step 5: Prove the migrated shell builds**

Run: `npm test && npm run build`

Expected: PASS, with `dist/server/index.js` present.

- [ ] **Step 6: Commit the isolated runtime migration**

```bash
git add .openai package.json package-lock.json vite.config.ts worker tests app public lib
git commit -m "build: create Sites online edition"
```

### Task 2: Add authenticated identity boundaries

**Files:**
- Create: `app/auth.ts`
- Create: `app/auth.test.ts`
- Create: `app/api/session/route.ts`
- Modify: `app/page.tsx`

**Interfaces:**
- Produces: `getAuthenticatedUser(headersLike): AuthenticatedUser | null`, `requireApiUser(request): AuthenticatedUser`, and `AuthenticatedUser = { id: string; email: string; displayName: string }`.
- Consumers: every persistence, key, history, asset, model, and generation route.

- [ ] **Step 1: Write identity tests**

Test that missing either required header returns `null`, a valid pair returns the stable id and email, and a percent-encoded display name is decoded only with the expected encoding header.

```ts
assert.equal(getAuthenticatedUser(new Headers()), null);
assert.deepEqual(getAuthenticatedUser(validHeaders), {
  id: "user-1",
  email: "one@example.com",
  displayName: "用户一",
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --experimental-strip-types --test app/auth.test.ts`

Expected: FAIL because `app/auth.ts` does not exist.

- [ ] **Step 3: Implement the server identity helper**

Read `oai-authenticated-user-id`, `oai-authenticated-user-email`, and the optional encoded full-name headers. `requireApiUser` must return a uniform 401 result without accepting user identity from query parameters or JSON.

- [ ] **Step 4: Protect the page and expose safe session information**

Make the root page dynamic and sign-in gated. Add `/api/session` returning only `{ email, displayName }`. Add a visible account label and sign-out link while preserving the current studio layout.

- [ ] **Step 5: Run tests and build**

Run: `node --experimental-strip-types --test app/auth.test.ts && npm run build`

Expected: PASS.

- [ ] **Step 6: Commit identity enforcement**

```bash
git add app/auth.ts app/auth.test.ts app/api/session/route.ts app/page.tsx
git commit -m "feat: require authenticated studio users"
```

### Task 3: Define D1 ownership schema and repositories

**Files:**
- Create: `db/schema.ts`
- Create: `db/index.ts`
- Create: `db/repositories.ts`
- Create: `db/repositories.test.ts`
- Create: `drizzle.config.ts`
- Create: `drizzle/0000_private_studio.sql`

**Interfaces:**
- Produces repository operations keyed by `ownerId`: `getUserSettings`, `saveEncryptedKey`, `deleteEncryptedKey`, `listHistory`, `replaceHistory`, `createJob`, `getOwnedJob`, `updateJob`, `createAsset`, and `getOwnedAsset`.
- Produces records `UserSettings`, `HistoryTurnRow`, `GenerationJobRow`, and `AssetRow`.

- [ ] **Step 1: Write repository contract tests against local D1**

Tests must create two owners, insert records for both, and prove every read/update method requires the matching owner id. Include an attempted cross-user asset and job lookup returning `null`.

```ts
assert.equal(await repo.getOwnedAsset("user-b", assetForUserA.id), null);
assert.equal(await repo.getOwnedJob("user-b", jobForUserA.id), null);
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `node --experimental-strip-types --test db/repositories.test.ts`

Expected: FAIL because schema and repository functions are missing.

- [ ] **Step 3: Add the minimum schema**

Create tables for `user_settings`, `history_turns`, `generation_jobs`, and `assets`. Each owned table includes `owner_id`; add indexes matching `(owner_id, created_at)` history listing, `(owner_id, status)` job recovery, and unique `(owner_id, id)` ownership lookups. Store JSON payloads only for bounded generation metadata, not image bytes or plaintext keys.

- [ ] **Step 4: Implement repository methods with ownership in SQL predicates**

Use prepared D1 statements. Updates and deletes must use both `id = ?` and `owner_id = ?`. Cap history at the latest 60 turns per owner and prune completed job metadata only after its retention window.

- [ ] **Step 5: Generate and inspect the migration**

Run: `npm run db:generate`

Expected: one migration containing four tables and only the query-driven indexes described above. Run `PRAGMA optimize` at the end of the migration.

- [ ] **Step 6: Run repository tests**

Run: `node --experimental-strip-types --test db/repositories.test.ts`

Expected: PASS for two-user isolation.

- [ ] **Step 7: Commit persistence**

```bash
git add db drizzle drizzle.config.ts package.json package-lock.json
git commit -m "feat: add per-user studio persistence"
```

### Task 4: Encrypt and manage per-user API keys

**Files:**
- Create: `lib/key-vault.ts`
- Create: `lib/key-vault.test.ts`
- Create: `app/api/settings/api-key/route.ts`
- Create: `app/api/settings/api-key/route.test.ts`
- Modify: `db/repositories.ts`

**Interfaces:**
- Produces: `encryptApiKey(key: string, masterSecret: string): Promise<EncryptedSecret>` and `decryptApiKey(secret: EncryptedSecret, masterSecret: string): Promise<string>` where `EncryptedSecret = { version: 1; iv: string; ciphertext: string }`.
- Produces authenticated `GET`, `PUT`, and `DELETE /api/settings/api-key`; GET returns `{ configured: boolean, hint?: string }` only.

- [ ] **Step 1: Write crypto tests**

Cover round-trip encryption, unique IVs for identical input, failure with the wrong master secret, rejection of blank keys, and verification that serialized ciphertext does not contain the plaintext key.

- [ ] **Step 2: Run and verify failure**

Run: `node --experimental-strip-types --test lib/key-vault.test.ts`

Expected: FAIL because the vault does not exist.

- [ ] **Step 3: Implement AES-GCM encryption with Web Crypto**

Derive a 256-bit AES-GCM key from the hosted master secret with HKDF and a fixed application context string. Generate a fresh 96-bit IV per write. Keep encoding helpers local and never log inputs.

- [ ] **Step 4: Add the authenticated settings route**

`PUT` validates length, encrypts, and stores only ciphertext plus a non-sensitive last-four hint. `GET` returns configuration status. `DELETE` removes only the current user's secret. Read `STUDIO_KEY_ENCRYPTION_SECRET` exclusively from the server environment.

- [ ] **Step 5: Test route serialization and crypto behavior**

Run: `node --experimental-strip-types --test lib/key-vault.test.ts app/api/settings/api-key/route.test.ts`

Expected: PASS and no response body contains the supplied test key.

- [ ] **Step 6: Commit the key vault**

```bash
git add lib/key-vault.ts lib/key-vault.test.ts app/api/settings/api-key db/repositories.ts
git commit -m "feat: encrypt per-user API keys"
```

### Task 5: Store and serve private images through R2

**Files:**
- Create: `lib/assets.ts`
- Create: `lib/assets.test.ts`
- Create: `app/api/assets/[id]/route.ts`
- Modify: `db/repositories.ts`
- Modify: `app/api/import-image/route.ts`
- Remove from online branch: `app/generated/[filename]/route.ts`

**Interfaces:**
- Produces: `saveOwnedAsset(ownerId, bytes, contentType, kind): Promise<AssetRow>` and `readOwnedAsset(ownerId, assetId): Promise<{ body; contentType } | null>`.
- Asset URLs have the form `/api/assets/<opaque-id>` and never expose R2 object keys.

- [ ] **Step 1: Write asset isolation tests**

Use fake R2 and repository implementations. Verify owner A can read an asset, owner B receives the same not-found response as a missing id, unsupported types are rejected, and object keys begin with an opaque user hash rather than an email.

- [ ] **Step 2: Run and verify failure**

Run: `node --experimental-strip-types --test lib/assets.test.ts`

Expected: FAIL because asset storage is missing.

- [ ] **Step 3: Implement R2 write/read helpers**

Allow PNG, JPEG, and WebP within a documented byte limit. Write bytes first, then metadata; if metadata insertion fails, delete the just-written object. Never return permanent public R2 URLs.

- [ ] **Step 4: Add the protected asset route and adapt imports**

Authenticate every request, fetch metadata by `(owner_id, id)`, and stream bytes with the stored content type, `X-Content-Type-Options: nosniff`, and private cache headers. Replace local filesystem imports and generated-file reads with owned R2 assets.

- [ ] **Step 5: Run tests and build**

Run: `node --experimental-strip-types --test lib/assets.test.ts && npm run build`

Expected: PASS.

- [ ] **Step 6: Commit private object storage**

```bash
git add lib/assets.ts lib/assets.test.ts app/api/assets app/api/import-image db/repositories.ts app/generated
git commit -m "feat: store studio images privately"
```

### Task 6: Persist history and idempotent generation jobs

**Files:**
- Modify: `app/api/history/route.ts`
- Modify: `app/api/jobs/route.ts`
- Modify: `app/api/jobs/[id]/route.ts`
- Delete from online branch: `app/api/jobs/store.ts`
- Modify: `app/api/generate/route.ts`
- Create: `lib/online-generation.ts`
- Create: `lib/online-generation.test.ts`

**Interfaces:**
- History endpoints read and replace only the authenticated user's latest 60 turns.
- Job submission consumes `{ jobId, prompt, model, size, quality, count, references }` but never consumes `apiKey` or `ownerId` from the browser.
- `submitOwnedJob(ownerId, jobId, request)` returns the existing job when `(ownerId, jobId)` already exists and never calls the provider twice.

- [ ] **Step 1: Write job idempotency and isolation tests**

Test two simultaneous submissions with the same owner/job id result in one provider call; the same id under different owners remains isolated; partial success persists each image; provider failure is recorded without retry.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `node --experimental-strip-types --test lib/online-generation.test.ts`

Expected: FAIL because durable generation orchestration does not exist.

- [ ] **Step 3: Replace filesystem history with D1 history**

Authenticate GET and POST, discard any client owner fields, validate the existing turn shape, and store asset ids/URLs belonging to the same owner.

- [ ] **Step 4: Replace the in-memory job map with D1 state**

Atomically create a `queued` job before any paid call. Only the successful creator starts provider work. Persist `running`, per-image progress, `completed`, or `failed` state and bounded error summaries.

- [ ] **Step 5: Move API Key resolution fully server-side**

Remove `apiKey` from browser request types. The generation and model routes authenticate, load the current user's encrypted key, decrypt it, and pass it only to the existing upstream request functions. Sanitize upstream errors before persistence and response.

- [ ] **Step 6: Save provider outputs to R2**

Convert provider URL/base64 results to bytes, save each successful image as an owned asset, and return protected asset URLs. Preserve `requestedCount`, `completedCount`, and `failedCount` without automatic retries.

- [ ] **Step 7: Run generation, lifecycle, and build checks**

Run: `npm test && npm run build`

Expected: PASS with mocked providers and zero live paid requests.

- [ ] **Step 8: Commit durable generation**

```bash
git add app/api/history app/api/jobs app/api/generate app/api/models lib/online-generation.ts lib/online-generation.test.ts
git commit -m "feat: persist private generation jobs"
```

### Task 7: Adapt the existing UI to cloud identity and key settings

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/globals.css`
- Modify: `app/refinements.css`
- Create: `app/components/ApiKeySettings.tsx`
- Create: `app/components/ApiKeySettings.test.tsx`

**Interfaces:**
- `ApiKeySettings` consumes `{ configured, hint, onChanged }` and never receives a stored plaintext key.
- Page requests omit `apiKey`, use protected asset URLs, and keep existing OCR/text-edit props unchanged.

- [ ] **Step 1: Write UI behavior tests**

Test the unconfigured prompt, masked configured state, replace flow, delete confirmation, absence of a reveal control, and that generation payloads contain no `apiKey` or `ownerId`.

- [ ] **Step 2: Run and verify failure**

Run: `node --test app/components/ApiKeySettings.test.tsx`

Expected: FAIL because settings UI does not exist.

- [ ] **Step 3: Add minimal account and key controls**

Place the signed-in identity and sign-out action in existing secondary chrome. Show the Key editor only when requested or unconfigured. After successful save, clear the input value from component state.

- [ ] **Step 4: Remove browser-side persistent API Key use**

Delete Key reads/writes from local storage and all client request payloads. Keep only device-local, non-authoritative UI preferences in browser storage.

- [ ] **Step 5: Wire cloud history, jobs, and protected assets**

Retain current conversation behavior, refresh recovery, partial progress, bottom positioning, attachments across mode switches, and image-text-edit OCR. Ensure missing/invalid saved Key errors lead to the settings control without exposing provider credentials.

- [ ] **Step 6: Run UI and regression tests**

Run: `npm test && npm run build`

Expected: all prior pure OCR, text-edit, scheduler, lifecycle, and payload tests plus new UI tests pass.

- [ ] **Step 7: Commit the online UI adaptation**

```bash
git add app/page.tsx app/globals.css app/refinements.css app/components/ApiKeySettings.tsx app/components/ApiKeySettings.test.tsx
git commit -m "feat: connect studio UI to private cloud state"
```

### Task 8: Security, migration, and responsive acceptance checks

**Files:**
- Create: `tests/security-boundaries.test.mjs`
- Create: `tests/online-acceptance.test.mjs`
- Modify: `.gitignore`
- Modify: `app/layout.tsx`

**Interfaces:**
- Produces a release gate proving no local private files, plaintext keys, cross-user access, or paid test calls enter the deployable build.

- [ ] **Step 1: Add static privacy tests**

Fail when the tracked or packaged tree contains `.env`, local history JSON, files from `public/generated`, runtime logs, launchers, a known test Key, or a client payload property named `apiKey`.

- [ ] **Step 2: Add two-user boundary acceptance tests**

Exercise settings, history, jobs, and assets with user A and user B headers. Assert cross-user reads and writes fail uniformly and that anonymous API calls return 401.

- [ ] **Step 3: Run the full non-paid suite**

Run: `npm test`

Expected: PASS with provider calls mocked and an assertion of zero unexpected network calls.

- [ ] **Step 4: Run type, lint, and deployment builds**

Run: `npx tsc --noEmit && npm run lint && npm run build`

Expected: PASS; inspect that `dist/server/index.js`, `.openai/hosting.json`, and D1 migrations are present.

- [ ] **Step 5: Complete the first meaningful preview handoff**

Start the retained development server, make one lightweight request to the exact local URL, and open the coherent existing CherryIN interface in Codex. Do not perform screenshots or browser interaction unless the user separately requests browser testing.

- [ ] **Step 6: Commit release gates**

```bash
git add tests .gitignore app/layout.tsx
git commit -m "test: verify online studio privacy boundaries"
```

### Task 9: Create, configure, and privately publish the Site

**Files:**
- Modify: `.openai/hosting.json`
- Create temporarily outside source: packaged deployment archive

**Interfaces:**
- Produces: one saved Sites version, one invitation-only production deployment URL, D1/R2 bindings, and hosted secret `STUDIO_KEY_ENCRYPTION_SECRET`.

- [ ] **Step 1: Run final verification on the exact source state**

Run: `git status --short && npm test && npm run build`

Expected: only intended clean source, all checks PASS.

- [ ] **Step 2: Create the Site exactly once**

Create an invitation-only Site, persist the returned opaque `project_id` in `.openai/hosting.json`, and configure D1 `DB`, R2 `ASSETS`, and a newly generated high-entropy `STUDIO_KEY_ENCRYPTION_SECRET` as a hosted secret. Never print the secret.

- [ ] **Step 3: Commit and push the exact validated source**

```bash
git add .openai/hosting.json
git commit -m "chore: configure private studio hosting"
```

Push using the Sites-provided source credential without storing it in git configuration or a remote URL.

- [ ] **Step 4: Package and save one Site version**

Use the Sites `package-site.sh` helper on the exact committed source. Inspect that the archive excludes local history, generated images, credentials, logs, runtime binaries, and launchers. Save the version using the pushed HEAD commit SHA.

- [ ] **Step 5: Deploy owner-only, then configure invitations**

Deploy the saved version privately first and wait for a successful deployment. Open the exact production URL in the existing Site tab. Keep the site owner-only until the owner supplies the invitee email addresses; adding external visitors is a separate access-list action that may send invitation emails.

- [ ] **Step 6: Perform owner smoke checks without paid generation**

Confirm login, empty history, Key configured/unconfigured status, protected routes, OCR assets, and no production worker errors. Do not run a real generation.

- [ ] **Step 7: Hand off the paid-generation verification**

Ask the owner to log in, save their own API Key, and intentionally run one low-cost image generation. Record this as real-provider verification only after the owner confirms the image result and history persistence.

---

## Completion Conditions

- The local CherryIN application remains operational and unchanged.
- The online edition is deployed at an invitation-only production URL.
- Two-user automated tests prove history, jobs, images, and key state are isolated.
- No plaintext API Key is stored, returned, logged, or bundled.
- Refresh restores durable task state without duplicate paid submission.
- Existing image-text edit and offline Chinese OCR remain available.
- Automated validation makes zero paid generation calls.
