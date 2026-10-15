# TaskEdge Web Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Vite starter app with a first working React web interface for the Task Management System.

**Architecture:** Keep the web client self-contained in `taskedgeproject`. Use React state and localStorage for the first milestone, with an API module prepared to call the existing Express auth endpoints and later task CRUD endpoints.

**Tech Stack:** React 19, Vite, plain CSS, browser localStorage, Fetch API.

---

## File Structure

- Modify `src/App.jsx`: implement auth flow, protected shell, dashboard, tasks, and profile views.
- Modify `src/App.css`: replace starter styles with responsive TaskEdge interface styles.
- Modify `src/index.css`: define global reset, tokens, typography, and base element styles.
- Modify `src/main.jsx`: keep React bootstrap and import global styles.
- Keep `package.json`: avoid new dependencies for the first milestone so the app works with the already-installed Vite setup.

## Task 1: Replace Starter App With App State

**Files:**
- Modify: `src/App.jsx`
- Test: manual browser verification through Vite

- [ ] **Step 1: Define initial local task data**

Create `initialTasks` with six representative tasks using `id`, `title`, `description`, `status`, `priority`, `dueDate`, and `owner`.

- [ ] **Step 2: Add auth persistence helpers**

Add helpers for reading and writing the current user to `localStorage` under `taskedge-user`.

- [ ] **Step 3: Add app-level state**

Use React state for `user`, `activeView`, `tasks`, search query, status filter, and the task form modal state.

- [ ] **Step 4: Verify starter screen is gone**

Run `npm run dev` and confirm the Vite starter content no longer renders.

## Task 2: Build Auth Screens

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/App.css`

- [ ] **Step 1: Build registration form**

Fields must match the existing backend: first name, last name, birthday, username, email, phone, and password.

- [ ] **Step 2: Build login form**

Use `usernameOrEmail` and `password` so the frontend matches the existing backend login controller.

- [ ] **Step 3: Add API submit handlers**

Use `fetch` to call `http://localhost:8000/api/auth/register` and `http://localhost:8000/api/auth/login`. If the backend is offline, show a readable error and allow a demo session from the form values.

- [ ] **Step 4: Verify form validation**

Submit empty forms and confirm required fields block submission with clear messages.

## Task 3: Build Protected App Shell

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/App.css`

- [ ] **Step 1: Add sidebar navigation**

Add Dashboard, Tasks, and Profile navigation items.

- [ ] **Step 2: Add top bar**

Show the current page title, a search input for task-heavy views, and a logout button.

- [ ] **Step 3: Add logout**

Clear localStorage user data and return to the login screen.

- [ ] **Step 4: Verify protected behavior**

Refresh after login and confirm the app remains open; log out and confirm auth screens return.

## Task 4: Build Dashboard

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/App.css`

- [ ] **Step 1: Add summary cards**

Show total tasks, in-progress tasks, completed tasks, and urgent tasks.

- [ ] **Step 2: Add recent task list**

Render the five nearest due tasks with status and priority labels.

- [ ] **Step 3: Add workload panel**

Show compact status rows for Todo, In Progress, Review, and Done.

- [ ] **Step 4: Verify responsive dashboard**

Check that cards wrap cleanly on narrow widths.

## Task 5: Build Task CRUD UI With Local State

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/App.css`

- [ ] **Step 1: Add task table/list**

Render title, owner, due date, status, priority, and action buttons.

- [ ] **Step 2: Add filtering**

Filter by search query and status.

- [ ] **Step 3: Add create/edit modal**

Use one form for adding and editing tasks.

- [ ] **Step 4: Add delete action**

Delete tasks from local React state.

- [ ] **Step 5: Verify CRUD behavior**

Create, edit, delete, search, and filter tasks in the browser.

## Task 6: Verify Build

**Files:**
- Modify only if verification exposes errors.

- [ ] **Step 1: Run lint**

Run `npm run lint`. Fix any lint errors.

- [ ] **Step 2: Run production build**

Run `npm run build`. Fix any build errors.

- [ ] **Step 3: Start dev server**

Run `npm run dev -- --host 127.0.0.1` and provide the local URL.
