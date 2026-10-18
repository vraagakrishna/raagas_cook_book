# Raaga's Cook Book

> **Purpose:** This README is the product requirements baseline for Raaga's Cook Book. It defines what the application must do, how its data must be stored, and the constraints that implementation decisions must preserve.
>
> **Status:** Requirements and architecture baseline. Where a decision is marked **TBD**, settle it before implementing that part. Do not silently weaken a requirement to make implementation easier.

## 1. Product vision

Build a personal, public-facing digital cookbook that lets its owner collect, organize, search, read, and maintain cooking recipes through a website.

The application must be free to host using GitHub Pages and GitHub Actions, with the repository as the canonical source of recipe data and images. It must **not** depend on a paid server, a conventional always-on backend, a database service, or browser/device storage as the authoritative recipe store.

The public can browse and share recipes. Only the owner (or explicitly authorized editors, if that policy is changed later) may make changes.

## 2. Non-negotiable principles

1. **Repository is the source of truth.** Recipes, master data, and uploaded images must be committed to the GitHub repository.

2. **No local-only recipe storage.** `localStorage`, IndexedDB, cookies, or browser cache may not be the sole or canonical store for recipe content. Browser storage may be used for non-sensitive preferences and a persistent login/session indicator only if the authentication design makes that safe.

3. **Free-first hosting.** Use GitHub Pages and GitHub Actions within the applicable free-plan limits and terms. Do not introduce a paid dependency without explicit approval.

4. **Public read access.** The deployed cookbook and its repository-backed content are public. Do not store secrets or private information in recipe files.

5. **Protected writes.** The public frontend must never contain a permanent GitHub token, private key, or other credential that grants repository write access.

6. **Stable identity.** Recipes and master-data records must use stable unique IDs, not display names, as their identity.

7. **Validate before commit.** Validate all recipe data and image uploads before writing them to the repository.

8. **Accessible and responsive.** The site must work on mobile and desktop and support keyboard navigation and clear labels.

9. **Preserve data integrity.** Saving or duplicating a recipe must not accidentally overwrite another recipe or lose unrelated data.

10. **No unapproved paid or hosted dependencies.** Any proposed third-party service must be reviewed for cost, privacy, availability, and necessity first.

## 3. Intended technology and deployment

### 3.1 Preferred frontend

- React

- TypeScript

- Vite

- Tailwind CSS for utility-first component styling, with small scoped CSS rules
  retained where the cookbook's visual system needs custom artwork or animation.

- Static-site deployment to GitHub Pages

- Automated checks, build, and deployment through GitHub Actions

Equivalent technology changes require a clear reason and must preserve all product requirements.

### 3.2 Repository responsibilities

The repository must contain:

- Application source code and dependency manifests.

- Structured recipe records.

- Master ingredient, teacher, and category data.

- Recipe, ingredient, and step images.

- Validation logic and tests.

- GitHub Actions workflows for checks and deployment.

- This README and any setup/developer documentation.

### 3.3 Deployment rules

- A push to the configured deployment branch should run automated validation, build, and deployment.

- Failed validation or build must not publish a broken release.

- Configure the correct GitHub Pages base path so routes and assets work when hosted under a repository subpath.

- Document the one-time GitHub Pages and Actions setup.

- Use least-privilege workflow permissions. Grant write permissions only to workflows that demonstrably require them.

- Do not assume GitHub Actions is an HTTP API or that a public website can securely trigger a privileged workflow without an authenticated, controlled mechanism.

## 4. Critical architecture requirement: secure writes

The site is public, but recipe changes must be **restricted to the owner**.

A login screen that merely hides edit buttons is not security. Any authorization decision made only in public frontend JavaScript can be bypassed.

### Required security properties

- No repository write token or secret is embedded in the source, build,
  deployment, URL, or browser storage.

- The owner supplies a fine-grained GitHub personal access token at sign-in.
  The token is restricted to this repository and `Contents: read and write`.

- The supplied token is held only in JavaScript memory. Signing out, refreshing,
  closing, or navigating away from the tab erases it.

- Visitors cannot use browser developer tools or direct API calls to bypass authorization.

- Write operations are authenticated and authorized by GitHub's API, not by the
  visibility of frontend controls.

- Write operations validate the request and restrict writes to expected recipe, master-data, and image paths.

- The token does not receive `Workflows` permission, so it cannot modify files
  under `.github/workflows`. The application must only offer writes to expected
  recipe, master-data, and image paths. Because `Contents: write` applies across
  the selected repository, the owner must use the token only on the trusted
  deployed site or local development copy.

- Credentials and session tokens are not logged or included in error messages.

- Failed or unauthorized writes are rejected without changing the repository.

- Concurrent writes must detect stale versions/conflicts rather than silently overwrite a newer edit.

### Selected write architecture

The application is frontend-only and uses no service other than GitHub. The
owner manually enters a fine-grained personal access token for an editing
session. GitHub validates the token, owner identity, repository access, and each
write request. Create/edit/delete operations use GitHub's repository
contents API and the current file SHA so concurrent changes fail instead of
silently overwriting newer content.

This is an explicit usability/security trade-off required by the frontend-only
architecture. A conventional password or automatic "Sign in with GitHub" flow
would require a backend to protect credentials and exchange authorization
codes. The token must therefore never be persisted, and it should have a short
expiration and the minimum repository permissions documented below.

## 5. Authentication and session behavior

- Provide an owner-only sign-in mechanism for editing features.

- Public visitors may browse, search, filter, and view recipes without signing in.

- Hide or disable owner controls for signed-out visitors, but enforce authorization at the write boundary as well.

- Owner access lasts for the current browser session. The validated token is
  kept in `sessionStorage` so a refresh in the same tab does not sign the owner
  out; signing out or closing the tab clears it.

- Never store a repository token in `localStorage`, IndexedDB, cookies, or the
  repository. `sessionStorage` is used only for the current-tab session and is
  cleared on sign-out.

- Browser storage may hold a non-sensitive preference or an appropriately designed session reference only when the authentication implementation supports it safely.

- Provide sign-out and expire/revoke sessions as appropriate.

- Do not claim that a client-side password check protects a public repository.

- Owner identity uses a fine-grained GitHub personal access token entered at
  runtime. The app accepts access only when GitHub returns both the configured
  immutable numeric user ID and username and confirms push access to the
  configured repository. The token stays in the current tab session.

## 6. Recipe data model

Each recipe must support the following fields.

### 6.1 Required and optional recipe fields

| Field                    | Requirement                                                                                                                       |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `id`                     | Stable, unique generated ID. Never derive identity from the recipe name.                                                          |
| `name`                   | Display name.                                                                                                                     |
| `nickname`               | Informal name, e.g. “Brother’s favourite curry” (Optional).                                                                       |
| `coverImage`             | Stores a repository-relative path, not embedded image bytes (Optional).                                                           |
| `categoryId`             | Category.                                                                                                                         |
| `teacherId`              | Teacher reference.                                                                                                                |
| `servings`               | Positive number or clearly defined serving count.                                                                                 |
| `difficulty`             | enum: `easy`, `medium`, `hard`.                                                                                                   |
| `prepDurationMinutes`    | Preparation duration, including any active prep time (Optional).                                                                  |
| `waitingDurationMinutes` | Waiting/marinating/resting time (Optional).                                                                                       |
| `cookDurationMinutes`    | Cooking duration (Optional).                                                                                                      |
| `totalDurationMinutes`   | Derived from the duration fields; do not double-count overlapping periods. Store `null` if the duration fields are not populated. |
| `ingredients`            | Ordered list of ingredient entries.                                                                                               |
| `steps`                  | Ordered list of preparation steps.                                                                                                |
| `createdAt`              | Metadata maintained by the trusted write process.                                                                                 |
| `updatedAt`              | Metadata maintained by the trusted write process.                                                                                 |

Duration filters should use a clearly documented total-duration rule. Add "Not defined" if the duration is not specified.

### 6.2 Recipe identity and filenames

- Each recipe gets a generated unique ID (UUID or another collision-resistant ID).

- Recipe filenames must not be based on the recipe name. Multiple recipes may have identical names.

- Prefer a predictable scheme such as `recipes/<id>.json`.

- Renaming a recipe must not change its ID, URL, or filename.

- Duplicating a recipe must always create a new ID and a new recipe file.

- Never overwrite a recipe merely because another recipe has the same name.

- Detect ID collisions and fail safely.

### 6.3 Ingredient entry fields

Each recipe ingredient must contain:

- A reference to a master ingredient when one exists.

- A quantity as entered by the owner.

- Optional preparation note (e.g. chopped, finely sliced, soaked).

- Optional ordering/section information if needed.

Quantities should preserve human-readable input (e.g. `2 medium`, `500 g`, `1 tsp`) rather than forcing every quantity into a numeric/unit pair. Any future scaling feature must explicitly handle quantities it cannot safely scale.

For legacy or custom ingredients, define how a recipe can reference a newly created master ingredient. Avoid duplicating the master ingredient's name and image in every recipe as the canonical record.

### 6.4 Preparation steps

Each step must contain:

- Stable step ID or unambiguous order.

- Instruction text.

- Optional image path.

- Display order.

Users must be able to add, edit, remove, and reorder steps. The saved order must be preserved.

### 6.5 Schema validation

- Validate required fields, field types, enum values, positive serving counts, non-negative durations, and valid references.

- Validate uniqueness of IDs.

- Reject invalid JSON and broken image references.

- Define a schema version and a migration approach before schema-breaking changes.

- Validation must run before data is committed and during automated checks.

## 7. Master data

Master data is separate from individual recipe records.

### 7.1 Ingredients catalogue

Each master ingredient must have:

- Stable unique ID.

- English display name.

- Telugu display name, when known.

- Optional shared image path.

- Telugu-in-English transliteration when a Telugu name is present.

- Optional repository-relative pronunciation audio path.

- Optional aliases/search terms.

- Optional metadata such as timestamps.

Rules:

- An ingredient image is uploaded once and reused by all recipes referencing that ingredient.

- Recipes reference the ingredient ID, not a copy of its image.

- As the owner types an ingredient, show matching autocomplete suggestions.

- The owner can select an existing ingredient or create a new one.

- Detect likely duplicates, including case differences and whitespace differences. Do not silently merge distinct ingredients without confirmation.

- If an ingredient name is not known in Telugu, allow it to be blank rather than inventing a translation.

- If an ingredient is renamed, all recipe references remain valid because they use IDs.

- Deleting a master ingredient that is in use must be blocked or require an explicit migration/replacement plan.

- Custom recipe-only ingredients must have a defined path to become master ingredients.

### 7.2 Teachers

- Store teachers in a separate master-data file or equivalent structured collection.

- Each teacher has a stable unique ID and display name.

- Teacher selection is a dropdown/autocomplete in recipe forms.

- The owner can add a teacher inline while adding a recipe.

- Renaming a teacher must not break recipe references.

- Do not delete a teacher while recipes still reference them without an explicit reassignment strategy.

### 7.3 Categories

- Store categories in master data.

- Each category has a stable ID and display name (e.g. curry, rice, snack, breakfast, sweets).

- Recipes reference category IDs.

- Category selection is available in recipe forms and filters.

- Categories are shown from a pre-defined list.

- Categories can be added by the owner from the recipe editor; the new record is
  committed to `data/categories.json` before it is selected in the recipe.

- Renaming a category must not break references.

- Prevent deletion of a category that is still in use unless its recipes are reassigned.

## 8. Image upload and storage rules

All images must be stored in the repository. External image hosting is not the default.

### 8.1 Image types

Support:

- Recipe cover photos.

- Shared ingredient photos.

- Optional step photos.

### 8.2 Upload validation

Enforce configurable limits for:

- Allowed file extensions: Allow JPEG, PNG, and WebP.
  - Actual decoded file type/MIME signature (do not trust the extension alone).

- Maximum input file size: 3 MB per image.

- Maximum width and height.

- Maximum total pixel count to avoid decompression/resource exhaustion.

- Successful image decoding.

- Final encoded file size.

The application should have an option to take a photo within the website. These images are not saved on the user's device, and the user can zoom in and has an option to take another image or choose it.

The application should also allow a user to upload an image from their device.

These are application defaults, not claims about GitHub's own file limits. Make limits easy to adjust in one place and document them.

### 8.3 Image handling

- Resize/compress in the browser where supported, then validate again at the trusted write boundary.

- Generate safe filenames from IDs or random identifiers; do not use raw user-supplied filenames as paths.

- Prevent path traversal and arbitrary file writes.

- Use repository-relative paths in data.

- Show an image preview before save.

- Provide clear validation errors and allow the owner to replace/remove optional images.

- Reuse shared ingredient images by reference.

- Avoid committing duplicate copies of the same shared ingredient photo.

- Ensure replacing/deleting an image does not break other recipes that use it.
  - When an image is deleted, and validations pass, the image should be deleted from the Git as well.

- Consider Git history growth: replacing a file does not remove old versions from repository history. Prefer resizing/compression before the first commit.

- Do not introduce Git LFS or external storage without reviewing cost and hosting implications.

## 9. Application pages and features

### 9.1 Recipe library/home page

Display recipes as cards. Each card should show:

- Cover photo (or a consistent placeholder).

- Recipe name.

- Nickname under the name, using smaller text (if available).

- Category.

- Teacher.

- Number of servings.

- Total duration (if available).

- Difficulty.

Also provide:

- Search input.

- Filters.

- Pagination (20 per page).

- Clear indication of active filters and result count.

- Empty state when no recipes match.

- Placeholder loading and error states where applicable.

- Responsive layout for mobile and desktop.

A grid is the default presentation. Whether to provide an additional list view is a product choice to settle before implementation.

### 9.2 Recipe detail page

- Every recipe has a stable, shareable URL based on its unique ID, not its name.

- Directly opening or refreshing a recipe URL must work on GitHub Pages.

- Show recipe metadata, ingredients, and ordered preparation steps.

- Show optional ingredient and step photos where available.

- Provide a clear way back to the recipe library while preserving useful search/filter context when practical.

- Display not-found and invalid-recipe states cleanly.

- Public users can view and share a recipe without logging in.

- Show edit/duplicate controls only to authorized users, while protecting the underlying write operations independently.

Use routing that works with GitHub Pages base paths and fallback behavior. Avoid relying on server-side route rewrites that GitHub Pages does not provide.

### 9.3 Add recipe form

Authorized users can create a complete recipe through the website.

The form must support:

- Name and nickname.

- Cover image upload or take photo.

- Every image control provides separate **Browse device** and **Take photo**
  actions, validates the selected file, previews it, and stores the final image
  in the repository.

- Category selection (searchable dropdown; no value is preselected).

- Teacher selection (searchable dropdown; no value is preselected).

- Servings.

- Difficulty (searchable dropdown; no value is preselected).

- Preparation, waiting, and cooking durations (Optional).

- Dynamic ingredient rows with autocomplete.

- Quantity and optional preparation note for each ingredient.

- Shared ingredient image selection/management.

- Dynamic preparation steps with optional step photos.

- Reordering and deleting ingredient rows and steps.

- Validation before save.

- Preview or review before committing where practical.

- Clear saving, success, and error states.

Do not lose entered data on a validation error or recoverable network/write failure. Temporary form drafts may be kept in memory or non-canonical browser storage, but a successful save must commit the canonical data to the repository.

The current editor stores incomplete form fields in `localStorage` under a
draft-only key and restores them when the owner returns. **Clear form** removes
that draft after confirmation. Draft storage is never the canonical recipe
store; a completed recipe is saved to GitHub.

### 9.4 Edit recipe

- Load the existing recipe by ID.

- Populate all form fields correctly.

- Allow the owner to update metadata, ingredients, steps, and images.

- Preserve the recipe ID and URL.

- Detect if the recipe changed in the repository since it was loaded.

- Prevent silent lost updates; provide a conflict/reload/retry path.

- Save changes to the repository through the protected write mechanism.

### 9.5 Duplicate recipe

- Duplicate the entire recipe, including ingredients, steps, quantities, durations, difficulty, category, teacher, and reusable image references.

- Assign a new unique recipe ID.

- Do not overwrite or modify the original.

- Preserve references to shared ingredient images.

- Do not blindly duplicate image files that are already shared or reusable.

- Open the duplicate in an editable form so the owner can change it before saving.

- Require a valid unique ID and confirm that the new record does not already exist.

### 9.6 Delete recipe

- The owner can delete a recipe from its detail page.

- The confirmation dialog requires typing the exact recipe name.

- Deletion removes the recipe JSON and images referenced by that recipe.

- Public visitors never see this control.

## 10. Search

Search across:

- Recipe name.

- Nickname.

- English ingredient names.

- Telugu ingredient names where present.

- Ingredient quantities and preparation notes where useful.

- Preparation-step text.

- Teacher name.

- Category name.

Behavior:

- Case-insensitive for languages where case applies.

- Match partial words and phrases.

- Tolerate speech-recognition spacing changes and small spelling errors, then
  rank the closest matches first.

- Search should update results promptly as the user types.

- Combine search with active filters.

- Define and test Unicode normalization for Telugu text.

- Handle empty queries and no-result states.

- Search should operate on the loaded repository-backed recipe catalogue; it must not require a paid search service.

- Search results must link to each recipe's stable URL.

For a personal cookbook of typical size, client-side search should be adequate. If the collection becomes very large, measure performance before adding complexity.

## 11. Voice search

- Provide a microphone control next to or within the search field.

- Request microphone permission only when the owner/user activates voice search.

- Convert speech to text using browser capabilities where available.

- Put recognized text into the normal search field and run the same search logic as typed text.

- Show listening, recognized, unsupported, and permission-denied states.

- Allow the user to stop/cancel listening.

- Never require voice input; text search must always remain available.

- Do not record or upload audio as a default behavior.

- Browser speech-recognition support and language availability vary. Detect support and provide a graceful fallback.

- Voice search is not allowed to bypass recipe access controls (recipe viewing is public; editing remains protected).

## 12. Telugu pronunciation and transliteration

The owner can understand spoken Telugu but cannot comfortably read Telugu script.

- Store a readable `teluguInEnglish` transliteration for Telugu ingredient names so the owner can pronounce them without reading Telugu script.

- An ingredient may optionally reference a repository-hosted pronunciation audio file.

- Prefer a repository-hosted recording when one is available.

- When no recording is available, generate Telugu audio URLs with
  `google-tts-api` using language code `te`.

- Keep pronunciation recordings in the repository and validate their paths before committing.

- Keep both Telugu script and Telugu-in-English text visible whether or not audio is available.

- Google pronunciation requires an internet connection and sends the Telugu text
  being pronounced to Google Translate's TTS endpoint. `google-tts-api` is an
  unofficial wrapper around that endpoint, not the paid Google Cloud TTS API.

## 13. Filters, sorting, and pagination

### Filters

At minimum:

- Teacher.

- Category.

- Difficulty.

- Total duration (include "Not Specified").

The implementation may add serving count and other useful filters. Define sensible duration bands or allow min/max duration. Filters must combine with search.

### Sorting

Provide at least a predictable default ordering. Recommended options:

- Name.

- Recently added/updated, if reliable timestamps exist.

- Duration (show Not Specified on top if sorted from lowest to highest).

### Pagination

- Display a configurable number of recipes per page (default is 20 per page).

- Provide previous/next and page navigation.

- Show the current page and total pages or equivalent accessible status.

- Reset or clamp the current page when filters/search reduce the result count.

- Keep page state consistent with the active result set.

- Keep query, filter, and page state in the current page session rather than URL
  parameters. Opening or refreshing the library starts on page 1.

- Recipe detail URLs must remain stable regardless of pagination.

## 14. Serving-size behavior

**Decision to confirm:** whether serving-size adjustment is required in the initial release.

If implemented:

- Show original servings and quantities.

- Let the user choose a target serving count.

- Scale numeric quantities where safe.

- Preserve or flag quantities that cannot be scaled reliably (e.g. “salt to taste”, “1 handful”, some compound units).

- Do not change the saved original recipe merely because a visitor changes the display serving count.

- Do not imply that scaled quantities are guaranteed culinary equivalents.

If not implemented, display original servings and quantities only.

## 15. User interface and accessibility

- Use clear, consistent navigation and labels.

- Support mobile and desktop screen sizes.

- All key functionality must be usable by keyboard.

- Associate form labels with controls.

- Provide meaningful alternative text for recipe/ingredient images where practical.

- Use visible focus states and sufficient color contrast.

- Do not communicate errors or difficulty using color alone.

- Provide useful validation messages near the relevant fields.

- Require exact-name confirmation for destructive recipe deletion.

- Keep text readable, including Telugu script.

- Respect reduced-motion preferences if animations are used.

- Do not rely on hover-only controls.

## 16. Error handling and reliability

Handle at least:

- Invalid recipe data.

- Missing/broken image paths.

- Recipe not found.

- Unsupported or invalid image upload.

- Image too large or dimensions too large.

- Authentication expired or denied.

- Repository/API rate limit or network failure.

- GitHub Actions/write workflow failure.

- Concurrent modification/conflict.

- Invalid master-data reference.

- Build/deployment failure.

Errors must be understandable and must not reveal secrets. Failed writes must not display a success message. Preserve the user's form input after recoverable failures. Provide a retry path when safe.

## 17. Performance and repository health

- Compress images before committing.

- Avoid unnecessary duplicate assets.

- Lazy-load non-critical recipe images when appropriate.

- Avoid downloading full-size photos for small cards if responsive variants can be generated safely.

- Keep data files structured and small enough for easy validation.

- Avoid a giant single file for all recipe content; use one file per recipe plus separate master-data files.

- Be mindful that Git history grows as files are changed.

- Monitor repository size and GitHub Pages/Actions usage.

- Do not introduce a database or search backend unless requirements and scale justify revisiting the architecture.

## 18. Suggested repository structure

This is a starting proposal, not a final locked layout:

```text
raagas_cook_book/
├── .github/
│   └── workflows/
│       ├── ci.yml
│       ├── deploy.yml
│       └── save-recipe.yml          # only if the selected write design needs it
├── public/
│   └── images/
│       ├── recipes/
│       ├── ingredients/
│       └── steps/
├── data/
│   ├── recipes/
│   │   └── <recipe-id>.json
│   ├── ingredients.json
│   ├── teachers.json
│   └── categories.json
├── src/
│   ├── components/
│   ├── pages/
│   ├── forms/
│   ├── services/
│   ├── search/
│   ├── routing/
│   └── validation/
├── tests/
├── README.md
├── package.json
├── tsconfig.json
└── vite.config.ts
```

Keep generated build output out of the source data structure. Do not put secrets in the repository. The final structure may change as long as the separation of code, data, and images is maintained.

## 19. Testing requirements

Automated tests should cover at least:

### Data and validation

- Valid and invalid recipe records.

- Duplicate IDs.

- Missing ingredient/teacher/category references.

- Negative durations and invalid servings.

- Missing image references.

- Schema migration behavior.

### Recipe management

- Create recipe.

- Edit recipe without changing ID.

- Duplicate recipe with a new ID.

- Same-name recipes coexist.

- Ingredient and step addition, removal, and ordering.

- Shared ingredient image references remain intact.

- Concurrent edits do not silently overwrite each other.

### Search and browsing

- Search every required field.

- Partial and case-insensitive matching.

- Telugu text matching and Unicode handling.

- Filters combine with search.

- Pagination updates after filtering.

- Direct navigation to a recipe URL and refresh work on GitHub Pages.

### Security

- Signed-out visitor cannot write.

- Direct API/workflow attempts without valid authorization are rejected.

- User input cannot write arbitrary paths or workflow files.

- No write token appears in built assets or client-side configuration.

- Invalid images and malformed data are rejected.

- Workflow permissions are least-privilege.

### Accessibility and compatibility

- Keyboard navigation and form labels.

- Mobile and desktop layout.

- Unsupported speech recognition fallback.

- Missing Telugu speech voice fallback.

- Error and empty states.

## 20. Acceptance criteria for the first release

The application is not ready for release until all of the following are true:

- [x] Public visitors can browse recipes without signing in.

- [x] Each recipe has a stable, shareable URL.

- [x] Recipe cards show the agreed metadata.

- [x] Pagination works and responds correctly to filters/search.

- [x] Search covers names, nicknames, ingredients, steps, teachers, and categories.

- [x] Filters include teacher, category, difficulty, and duration.

- [x] Authorized owner can add and edit recipes through forms.

- [x] Authorized owner can duplicate an entire recipe without modifying the original.

- [x] Recipe identity and filenames do not depend on recipe names.

- [x] Ingredients use a master catalogue with autocomplete and reusable photos.

- [x] Teacher and category data are structured and referenced by stable IDs.

- [x] Recipe, ingredient, and step images are stored in the repository.

- [ ] Image extension/type, size, dimensions, and decoding are validated.

- [x] Telugu read-aloud is available where the browser/device supports it, with a fallback.

- [ ] Voice search is available where supported, with ordinary text search as a fallback.

- [x] Successful edits are committed to GitHub and survive a browser/device change.

- [x] No write credential is embedded in the public frontend or persisted in
      browser storage.

- [x] GitHub Actions validates, builds, and deploys the site.

- [x] The project can be deployed without a paid service under the selected usage and plan limits.

- [ ] Automated tests cover core behavior, data integrity, and security boundaries.

- [ ] Setup, deployment, backup, and recovery instructions are documented.

## 21. Decisions to settle before implementation

Do not silently assume answers to these questions:

1. **Write mechanism:** _Settled: a repository-limited fine-grained GitHub token
   entered by the owner for the current browser-tab session._

2. **Authentication:** _Settled: GitHub validates the fine-grained token and the
   configured username, numeric user ID, and repository. The session is
   survives refresh in the current tab via `sessionStorage`._

3. **Saving experience:** _Settled: Save commits directly to the configured
   branch. Existing recipes use their previously loaded GitHub file SHA to
   prevent silent overwrites._

4. **Teacher/category management:** Separate settings page or add new values inline in recipe forms? _Specified above_

5. **Recipe cover photo:** Required for every recipe or optional with a placeholder? _Optional with a placeholder_

6. **Serving adjustment:** Required for v1 or deferred? _Every value can be edited_

7. **Deletion:** _Settled: permanent owner-only delete with exact recipe-name confirmation; delete the recipe JSON and its recipe-specific images._

8. **Pagination size:** Default recipes per page and whether the user can change it. _20 items per page, as specified above_

9. **Duration model:** Exact treatment of overlapping marinating, resting, preparation, and cooking time. _Treat this as optional. This will be updated after some real recipes start coming in_

10. **Image limits:** Confirm allowed formats, input file size, dimensions, and compression quality. _Specified above_

11. **Master ingredient duplicates:** Confirm the workflow for detecting and resolving near-duplicate ingredients.

12. **Browser support:** Confirm primary browsers/devices for voice search and Telugu read-aloud.

## 22. Explicit non-goals unless approved later

Do not add these by default:

- Paid hosting, a paid database, paid image hosting, or paid speech APIs.

- Public recipe editing or public account registration.

- Storing recipe data only in the browser.

- A permanent repository write token in client code.

- External ingredient image URLs as the canonical image store.

- AI-generated recipe content or translations that alter saved recipes without owner approval.

- Nutritional or medical claims.

- Unconfirmed or unauthorised destructive deletion.

- Social features, ratings, comments, or user profiles.

## 23. Definition of done for any feature

A feature is complete only when:

1. It meets the relevant behavior in this README.

2. Data validation and authorization are enforced at the appropriate trusted boundary.

3. Loading, empty, success, and failure states are handled.

4. Tests cover normal cases and relevant failure/security cases.

5. The feature works in the GitHub Pages deployment path, not only in local development.

6. Documentation is updated if setup, data format, security, or deployment behavior changes.

7. It does not violate the zero-cost, repository-as-source-of-truth, or credential-security principles.

---

**Rule for future changes:** Update this README whenever an agreed requirement changes. Treat the latest approved version as the product contract. If implementation convenience conflicts with a requirement, document the conflict and ask for a decision rather than silently changing the requirement.

---

## Running the application

The public cookbook is implemented with React, TypeScript, and Vite.

```bash
npm install
npm run dev
```

Production checks:

```bash
npm test
npm run build
```

### Owner sign-in configuration

The values used by owner sign-in are stored in
`src/config/appConfig.ts`. They are public identifiers, not secrets.

#### 1. Create the fine-grained token

1. Sign in to GitHub.
2. Open **Settings → Developer settings → Personal access tokens → Fine-grained
   tokens**.
3. Select **Generate new token**.
4. Set a recognizable name such as `Raagas Cook Book editing`.
5. Choose a short expiration. Thirty days is recommended; generate a replacement
   when it expires.
6. For **Resource owner**, select the account that owns this repository.
7. Under **Repository access**, choose **Only select repositories** and select
   only `raagas_cook_book`.
8. Under **Repository permissions**, set **Contents** to **Read and write**.
   `Metadata: Read-only` is added automatically.
9. Leave every other permission at **No access**. In particular, do not grant
   **Workflows**, **Administration**, or organization permissions.
10. Generate the token and copy it immediately. GitHub shows its full value only
    once. A fine-grained token begins with `github_pat_`.

Never put this token in a source file, `.env` file used by Vite, GitHub Actions
build variable, commit, issue, screenshot, URL, or chat message. If it is ever
exposed, revoke it immediately in the fine-grained token settings and create a
replacement.

#### 2. Find each public configuration value

- `YOUR_GITHUB_USERNAME`: Open your GitHub profile. The username is the segment
  after `github.com/` in the profile URL. For `https://github.com/octocat`, the
  value is `octocat`.
- `YOUR_GITHUB_NUMERIC_USER_ID`: Visit
  `https://api.github.com/users/YOUR_GITHUB_USERNAME`, replacing the final
  segment with the username above. Copy the integer beside `"id"`. Do not use
  `"node_id"`.
- `YOUR_GITHUB_REPOSITORY_OWNER`: Open the cookbook repository. In
  `https://github.com/OWNER/REPOSITORY`, copy the `OWNER` segment. For a personal
  repository this is normally the same as the GitHub username.
- `YOUR_GITHUB_REPOSITORY_NAME`: From the same repository URL, copy the
  `REPOSITORY` segment exactly, without `.git`.

#### 4. Replace the placeholders

Edit `src/config/appConfig.ts` and preserve the quotation marks:

```ts
export const appConfig = {
  github: {
    ownerUsername: "octocat",
    ownerUserId: "1",
    repositoryOwner: "octocat",
    repositoryName: "raagas_cook_book",
    repositoryBranch: "main",
  },
} as const;
```

The numeric ID is the durable identity check because a GitHub username can be
renamed. All four configured values are public; the token is the only credential
and is entered at runtime.

#### 5. Sign in and sign out

1. Open the cookbook and select **Owner sign in**.
2. Paste the fine-grained token into the password-style field.
3. Select **Unlock owner access**. The app asks GitHub to verify the token,
   configured owner identity, and repository write access.
4. Use the sign-out button when finished.

After signing in:

- Open the recipe library and select **Add recipe** to create a recipe.

- The editor uses the shareable `/recipe/new` route, so the browser URL changes
  while a new recipe is being created. The recipe UUID is generated only when
  Save is pressed; the app checks GitHub for a collision before committing it.

- Open an existing recipe and select **Edit** to change it.

- Open an existing recipe and select **Duplicate** to make an independent copy
  with a new UUID. The copy opens in the editor before anything is saved.

- The owner **Catalogue** button opens the clean `/catalogue` route, where all
  ingredients, teachers, and categories can be searched and managed.

- Ingredient rows and method steps can be added, removed, and reordered.

- Use **Create a new ingredient**, **Add teacher**, or **Add category** beside
  the relevant recipe field. New master records are committed to their
  catalogue JSON first, then become selectable in the current form. Ingredients
  may include Telugu script, Telugu-in-English pronunciation, and an optional
  ingredient image.

- Use the owner **Catalogue** screen to view, add, edit, and delete ingredients,
  teachers, and categories. Entries still referenced by a recipe cannot be
  deleted until those recipes are updated.

- A recipe cover is optional. JPEG, PNG, and WebP uploads are validated for
  declared type, file signature, decoding, file size, dimensions, and pixels.

- Save commits the recipe JSON to `data/recipes/<recipe-id>.json`. A new cover
  image is committed to `public/images/recipes/`.

The token is held in the current tab's `sessionStorage` so refreshes preserve
access. It is not written to `localStorage`, IndexedDB, a cookie, or the
repository. Sign out or close the tab to clear it.

If login fails, confirm that the token has not expired, belongs to the configured
owner, selects the configured repository, and grants `Contents: Read and write`.
Do not replace it with a classic token, repository-wide password, GitHub App
secret, or hard-coded credential.

## GitHub Pages deployment

The generated static site is written to `dist/`. The workflow in
`.github/workflows/deploy.yml` validates, builds, uploads, and deploys that
directory to GitHub Pages whenever a change is pushed to `main`. It can also be
started manually.

### One-time Pages setup

GitHub Pages must be enabled in the repository before the deployment workflow
can query or deploy the site. A repository administrator or maintainer should:

1. Open the repository on GitHub.

2. Select **Settings**. If the tab is hidden, open the repository navigation
   dropdown and select **Settings**.

3. In the left sidebar, under **Code and automation**, select **Pages**.

4. Find **Build and deployment**.

5. Set **Source** to **GitHub Actions**.

6. Leave the other Pages settings at their defaults unless a custom domain is
   intentionally being configured.

Do not select **Deploy from a branch**. This project already has a custom build
workflow and does not commit generated files to a `gh-pages` branch.

GitHub Pages is available for public repositories on GitHub Free. Private
repository availability depends on the account or organization plan. If the
**Pages** settings screen is unavailable, confirm that Pages and GitHub Actions
are permitted by the account or organization policy and that the current user
has repository administration or maintenance access.

### Run or rerun the deployment

After choosing **GitHub Actions** as the Pages source:

1. Open the repository's **Actions** tab.

2. Select **Validate and deploy to GitHub Pages**.

3. Either open the failed run and select **Re-run all jobs**, or select **Run
   workflow**, choose the `main` branch, and confirm **Run workflow**.

4. Wait for both the `build` and `deploy` jobs to complete.

5. Open **Settings → Pages** to find the published URL. GitHub also displays the
   URL in the completed deployment job.

Future pushes to `main` deploy automatically. Pushes to other branches do not
deploy unless the workflow triggers are changed.

### Fixing `Get Pages site failed` / `Not Found`

The following error means the workflow called GitHub's Pages API before a Pages
site existed for the repository:

```text
Error: Get Pages site failed. Please verify that the repository has Pages
enabled and configured to build using GitHub Actions.
Error: Not Found
```

Resolve it by completing the one-time setup above and rerunning the failed
workflow. The existing workflow already declares the permissions used by the
official Pages actions:

```yaml
permissions:
  contents: read
  pages: write
  id-token: write
```

`actions/configure-pages` also exposes an `enablement: true` option, but its own
documentation says automatic enablement requires a token other than the normal
workflow `GITHUB_TOKEN`, with additional administration and Pages write
permissions. This repository deliberately uses the safer one-time Settings UI
step instead of adding a privileged personal token solely to enable Pages.

If the error remains after enabling Pages:

1. Reopen **Settings → Pages** and confirm **Source: GitHub Actions** is still
   selected.

2. Confirm the workflow file exists on `main` at
   `.github/workflows/deploy.yml`.

3. Confirm GitHub Actions is enabled under **Settings → Actions → General**.

4. Check whether an organization policy prevents Pages, GitHub Actions, or
   deployment to the `github-pages` environment.

5. Open the failed workflow and verify whether the failing step is **Configure
   Pages**, **Upload artifact**, or **Deploy to GitHub Pages**; each indicates a
   different stage of the deployment.

The current release implements public browsing, device-local favourites, Google
Telugu pronunciation, current-tab owner authentication, owner-only
create/edit/duplicate/delete recipe forms, and catalogue management that commit
through GitHub's repository API.
It is built and deployed only through GitHub Pages and GitHub Actions. The
authenticated token is kept only in the current tab's `sessionStorage` and is
cleared when that tab is closed or the owner signs out.
