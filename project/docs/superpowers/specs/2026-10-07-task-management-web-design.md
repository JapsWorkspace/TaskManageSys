# Task Management System Web Design

## Context

The project brief requires a full-stack MERN web application using MongoDB, Express.js, React.js, and Node.js. The selected system is a Task Management System. The existing workspace is currently a Flutter project intended for mobile work later, with a small Express/Mongo authentication server already present in `server/`.

The React web application will be created separately from the Flutter project so the mobile code remains untouched.

## Decision

Create a new React + Vite frontend in `frontend/` and connect it to the existing Express backend in `server/`.

This keeps the project aligned with the MERN requirement while preserving the Flutter scaffold for future mobile work.

## First Milestone Scope

The first milestone creates the web application foundation and a usable task management interface:

- Scaffold a separate React + Vite app in `frontend/`.
- Add routing for authentication and the main application.
- Build login and registration screens connected to the existing `/api/auth/register` and `/api/auth/login` endpoints.
- Build an authenticated app shell with sidebar navigation and a top bar.
- Add a dashboard page with task summary cards and recent task sections.
- Add a tasks page with task list, search field, status filtering, pagination-ready layout, and add/edit/delete task UI.
- Add a centralized Axios API client with a backend base URL.
- Store the logged-in user locally for the first milestone, while keeping the API layer ready for JWT once the backend is updated.

## Backend Assumptions

The existing backend currently supports registration and login, but it does not yet issue JWT tokens. The frontend will integrate with the current response shape for now and isolate auth persistence behind frontend utilities so the later JWT upgrade is straightforward.

Task CRUD endpoints are not present yet. For the first frontend milestone, the task UI can use local state or a local mock service while the app structure is prepared for real API integration.

## Frontend Structure

Expected folder layout:

```text
frontend/
  src/
    api/
    components/
    pages/
    routes/
    styles/
```

Key responsibilities:

- `api/`: Axios client and API functions.
- `components/`: Shared layout, forms, task cards, tables, and controls.
- `pages/`: Login, register, dashboard, tasks, and profile views.
- `routes/`: Route definitions and protected-route behavior.
- `styles/`: Global styling and design tokens.

## UI Direction

The interface should feel like a focused productivity tool: responsive, clear, professional, and optimized for repeated task tracking. It should avoid a marketing landing-page style. The first screen after login should be the dashboard, not a hero page.

The visual design should include:

- A compact navigation sidebar.
- Clear task status indicators.
- Search and filtering controls.
- Responsive layouts for desktop and mobile browser widths.
- Form states for loading, success, validation errors, and server errors.

## Error Handling

Forms should validate required fields before sending requests. API failures should show readable messages near the form or affected view. Empty states should clearly explain when no tasks match the current filter.

## Testing And Verification

Implementation should include tests where practical for auth utilities, route protection, task filtering, and form validation. Manual verification should include:

- Frontend dev server starts successfully.
- Login/register screens render.
- Dashboard and task pages are reachable through app navigation.
- Task add/edit/delete UI works with local state.
- Auth state persists across refreshes for the current milestone.

## Out Of Scope For First Milestone

- Flutter mobile changes.
- Deployment.
- Full JWT backend upgrade.
- Real task CRUD persistence in MongoDB.
- Role-based permissions.
- Team collaboration features.
