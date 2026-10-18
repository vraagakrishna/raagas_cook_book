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

- No repository write token or secret is shipped to the browser.

- Visitors cannot use browser developer tools or direct API calls to bypass authorization.

- Write operations are authenticated and authorized outside the trusted frontend.

- Write operations validate the request and restrict writes to expected recipe, master-data, and image paths.

- A write request cannot alter workflows, application code, arbitrary repository files, or deployment configuration.

- Credentials and session tokens are not logged or included in error messages.

- Failed or unauthorized writes are rejected without changing the repository.

- Concurrent writes must detect stale versions/conflicts rather than silently overwrite a newer edit.

### Architecture decision still to settle

A static site cannot securely commit files to GitHub on its own. Before implementing create/edit/duplicate operations, choose and document a secure write mechanism that satisfies the zero-cost goal. Candidates include a tightly controlled GitHub-based workflow or a suitable free-tier serverless write boundary. Check current GitHub and provider limits and terms; do not assume that a workflow trigger is a secure submission endpoint.

If the only feasible approach would require a paid service, explain the trade-off and obtain approval before proceeding. Do not fall back to embedding a write-capable token in the frontend.

## 5. Authentication and session behavior

- Provide an owner-only sign-in mechanism for editing features.

- Public visitors may browse, search, filter, and view recipes without signing in.

- Hide or disable owner controls for signed-out visitors, but enforce authorization at the write boundary as well.

- The owner wants to remain signed in on their own device.

- Persistent login must use a properly designed session or identity mechanism. Storing a password or a long-lived repository token in `localStorage` is prohibited.

- Browser storage may hold a non-sensitive preference or an appropriately designed session reference only when the authentication implementation supports it safely.

- Provide sign-out and expire/revoke sessions as appropriate.

- Do not claim that a client-side password check protects a public repository.

- Owner identity uses a GitHub App with Device Flow. The public Client ID starts
  the flow, GitHub returns the authenticated account, and the app accepts access
  only when both its immutable numeric user ID and username match the configured
  owner. The access token is kept in `sessionStorage`, never in repository data
  or `localStorage`.

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

- Categories are managed on a settings page before implementation.

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

- Category selection (dropdown).

- Teacher selection (dropdown).

- Servings.

- Difficulty (dropdown).

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

### 9.6 Delete recipe (decision required)

Deletion was not explicitly specified as a core requirement. Do not implement destructive deletion until the owner confirms the desired behavior. If added, require confirmation, protect against unauthorized access, and avoid deleting shared ingredient images still in use.

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

- Decide whether query/filter/page state should be encoded in URL parameters before implementation.

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

- Provide confirmation for destructive actions if deletion is later approved.

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

- [ ] Public visitors can browse recipes without signing in.

- [ ] Each recipe has a stable, shareable URL.

- [ ] Recipe cards show the agreed metadata.

- [ ] Pagination works and responds correctly to filters/search.

- [ ] Search covers names, nicknames, ingredients, steps, teachers, and categories.

- [ ] Filters include teacher, category, difficulty, and duration.

- [ ] Authorized owner can add and edit recipes through forms.

- [ ] Authorized owner can duplicate an entire recipe without modifying the original.

- [ ] Recipe identity and filenames do not depend on recipe names.

- [ ] Ingredients use a master catalogue with autocomplete and reusable photos.

- [ ] Teacher and category data are structured and referenced by stable IDs.

- [ ] Recipe, ingredient, and step images are stored in the repository.

- [ ] Image extension/type, size, dimensions, and decoding are validated.

- [ ] Telugu read-aloud is available where the browser/device supports it, with a fallback.

- [ ] Voice search is available where supported, with ordinary text search as a fallback.

- [ ] Successful edits are committed to GitHub and survive a browser/device change.

- [ ] No permanent write credential is exposed to the public frontend.

- [ ] GitHub Actions validates, builds, and deploys the site.

- [ ] The project can be deployed without a paid service under the selected usage and plan limits.

- [ ] Automated tests cover core behavior, data integrity, and security boundaries.

- [ ] Setup, deployment, backup, and recovery instructions are documented.

## 21. Decisions to settle before implementation

Do not silently assume answers to these questions:

1. **Write mechanism:** Which secure, zero-cost-compatible mechanism will commit browser-submitted changes to GitHub?

2. **Authentication:** Which identity provider or authentication mechanism will protect owner-only writes and support a persistent session safely?

3. **Saving experience:** Should Save commit directly, or create a proposed change/pull request that the owner approves?

4. **Teacher/category management:** Separate settings page or add new values inline in recipe forms? _Specified above_

5. **Recipe cover photo:** Required for every recipe or optional with a placeholder? _Optional with a placeholder_

6. **Serving adjustment:** Required for v1 or deferred? _Every value can be edited_

7. **Deletion:** Is recipe deletion required? If yes, should it be soft-delete/archive or permanent delete? _Defer deletion for version 1_

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

- Recipe deletion without an agreed safety policy.

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

#### 1. Create the GitHub App

1. Sign in to GitHub.
2. Open your profile menu and select **Settings**.
3. Select **Developer settings** in the left sidebar.
4. Select **GitHub Apps**, then **New GitHub App**.
5. Enter a unique app name, such as `Raagas Cook Book Owner`.
6. For **Homepage URL**, enter the deployed GitHub Pages URL. The local
   development URL can be used temporarily while testing.
7. A callback URL is not required by this implementation because it uses Device
   Flow. GitHub ignores the callback setting for Device Flow.
8. Disable the webhook if GitHub shows the **Active** webhook checkbox. This app
   does not receive webhook events.
9. Under **Where can this GitHub App be installed?**, select **Only on this
   account**.
10. Register the app. Do not generate a Client Secret or private key for this
    frontend.

For identity-only sign-in, the GitHub App does not need repository permissions.
When repository editing is implemented, grant only the specific permission that
workflow requires and install the app only on this cookbook repository.

#### 2. Enable Device Flow

1. Return to **Settings → Developer settings → GitHub Apps**.
2. Select **Edit** next to the new app.
3. Under **Identifying and authorizing users**, enable **Device Flow**.
4. Save the changes.

#### 3. Find each configuration value

- `YOUR_GITHUB_APP_CLIENT_ID`: On the GitHub App's settings page, copy **Client
  ID**. Do not copy **App ID**; they are different values.
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
    clientId: "Iv1.EXAMPLE",
    ownerUsername: "octocat",
    ownerUserId: "1",
    repositoryOwner: "octocat",
    repositoryName: "raagas_cook_book",
  },
} as const;
```

The sign-in flow uses the Client ID, username, and numeric user ID. The numeric
ID is the durable identity check because a GitHub username can be renamed. The
repository owner and repository name are retained for the owner-only recipe
write workflow.

Never add a GitHub App Client Secret, private key, or personal access token to
this repository. Owner-only writes must still be authorized by GitHub; hiding
editor controls in the browser is not a security boundary.

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
Telugu pronunciation, and GitHub owner authentication. It is built and deployed
only through GitHub Pages and GitHub Actions. Recipe editing remains locked until
its GitHub write workflow and permissions are implemented.
