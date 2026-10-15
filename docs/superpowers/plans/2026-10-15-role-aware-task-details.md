# Role-Aware Task Details Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the clicked-task detail page around TaskEdge's existing data while making task-work controls depend on assignment rather than managerial role.

**Architecture:** Keep the existing `TaskDetailsPage` data flow and API surface, extend the shared frontend/backend permission helpers with explicit assignee-only capabilities, then replace only the task-detail markup and scoped CSS. The task queue component and its CSS remain unchanged.

**Tech Stack:** React 19, CSS, Node.js, Express, Node test runner, Vite

---

### Task 1: Define Assignee-Only Work Permissions

**Files:**
- Modify: `taskedgeproject/src/taskPermissions.test.js`
- Modify: `taskedgeproject/src/taskPermissions.js`
- Modify: `project/server/tests/taskAccess.test.js`
- Modify: `project/server/services/taskAccess.js`

- [ ] **Step 1: Write failing frontend permission tests**

Extend the role matrix to assert `isAssignee`, `canUpdateSubtasks`, and `canUploadAttachments`. Assignees receive all three; collaborators receive neither subtask nor attachment mutation; manager/admin receive them only when their user ID is the assignee ID.

- [ ] **Step 2: Run the frontend permission test and verify RED**

Run: `node --test src/taskPermissions.test.js`

Expected: FAIL because the new permission properties do not exist and collaborators currently receive attachment mutation.

- [ ] **Step 3: Implement frontend permission properties**

Update `getTaskPermissions()` to return assignment relationship flags and separate management, progress, subtask, and attachment capabilities. Keep collaborators able to update status/progress, but make subtask and attachment mutation assignee-only.

- [ ] **Step 4: Run the frontend permission test and verify GREEN**

Run: `node --test src/taskPermissions.test.js`

Expected: all permission tests pass.

- [ ] **Step 5: Write failing backend permission tests**

Assert that standard-task attachment mutation is allowed only for the assignee, and that limited task changes permit `subtasks` for the assignee but reject `subtasks` atomically for a collaborator while allowing collaborator `{ status, progress }` updates.

- [ ] **Step 6: Run the backend permission test and verify RED**

Run: `node --test tests/taskAccess.test.js`

Expected: FAIL because collaborators currently share assignee attachment and subtask permissions.

- [ ] **Step 7: Implement backend assignee-only permissions**

Split assignee and collaborator detection in `taskAccess.js`. Keep full management edits intact, permit assignee limited fields `status`, `progress`, and `subtasks`, permit collaborator limited fields `status` and `progress`, and make standard-task attachment mutation assignee-only.

- [ ] **Step 8: Run the backend permission test and verify GREEN**

Run: `node --test tests/taskAccess.test.js`

Expected: all backend permission tests pass.

### Task 2: Restructure The Task Detail Page

**Files:**
- Modify: `taskedgeproject/src/App.jsx:4905`
- Do not modify: `taskedgeproject/src/App.jsx` function `TaskQueuePanel`

- [ ] **Step 1: Add testable task-detail presentation helpers**

Add pure helpers only if required for progress counts or role labels, with failing tests in `taskLogic.test.js` before implementation. Reuse existing formatting helpers wherever possible.

- [ ] **Step 2: Replace the task-detail header**

Build a reference-aligned header containing Back, project context, title, description, status/priority/deadline badges, and assignee summary. Do not display unsupported task codes, task briefs, or acceptance criteria.

- [ ] **Step 3: Add the role-aware control bar**

Show management status/Edit/Archive/Delete only when `permissions.canManage`; show Update progress when limited progress is available; show View only for watchers. A manager-assignee receives both management and assignee work capabilities without duplicate controls.

- [ ] **Step 4: Build the two-column content hierarchy**

Place overview, dependencies, subtasks, and comments in the main column. Place task information and attachments in the side column. Render fields only when TaskEdge has values.

- [ ] **Step 5: Apply relationship-aware controls**

Enable subtask toggles and attachment Upload/Remove only for `permissions.isAssignee`. Keep Open/Download available to all authorized viewers and comments available under the existing comment rules.

### Task 3: Style And Animate The Detail Page

**Files:**
- Modify: `taskedgeproject/src/App.css:3409`
- Do not modify: task queue selectors or `TaskQueuePanel` styles

- [ ] **Step 1: Add scoped desktop layout styles**

Create task-detail-only selectors for the header, control bar, primary/side grid, information rows, progress bar, subtasks, attachments, and comments. Reuse the system's CSS variables, typography, border radius, and button classes.

- [ ] **Step 2: Add restrained motion**

Animate section entry with short staggered opacity/translate transitions and animate the subtask progress fill. Add row transitions without affecting task queue cards.

- [ ] **Step 3: Add responsive rules**

At tablet width collapse the two-column content into one column; at mobile width stack header facts and action controls, preserve readable button labels, and prevent overflow.

- [ ] **Step 4: Respect reduced motion**

Ensure the existing reduced-motion media query covers the new animation names, or add scoped overrides that disable them.

### Task 4: Verify Behavior And Visual Quality

**Files:**
- Verify only: `taskedgeproject/src/App.jsx`
- Verify only: `taskedgeproject/src/App.css`
- Verify only: `project/server/services/taskAccess.js`

- [ ] **Step 1: Run full automated verification**

Run backend `npm test`, frontend `npm test`, `npm run lint`, and `npm run build`.

Expected: all tests and lint pass; production build completes with no errors.

- [ ] **Step 2: Verify task queue isolation**

Search the diff and confirm no changes occur inside `TaskQueuePanel`, `getTaskQueueGroups`, or task-queue CSS selectors.

- [ ] **Step 3: Inspect desktop task details**

Open a populated task as a manager/admin and verify manager controls, read-only attachments, alignment, spacing, and entrance animation.

- [ ] **Step 4: Inspect assignee task details**

Open the same task as its assignee and verify Update progress, subtask mutation, attachment upload/removal, and comments.

- [ ] **Step 5: Inspect responsive layouts**

Verify desktop, tablet, and mobile widths for clipping, overlap, scroll behavior, and control visibility.
