# Production Session and Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden JWT session expiration and make the React frontend configurable for Vercel deployment.

**Architecture:** Centralize deployment configuration in small frontend and backend helpers. API clients notify the React shell when authentication expires; the server validates production secrets and applies configured CORS consistently to HTTP and Socket.IO.

**Tech Stack:** React, Vite, Express, Socket.IO, JSON Web Tokens, Node test runner

---

### Task 1: Protect repository configuration

**Files:**
- Modify: `project/.gitignore`
- Modify: `taskedgeproject/.gitignore`
- Create: `project/server/.env.example`
- Create: `taskedgeproject/.env.example`

- [ ] Ignore all environment files while allowing example files.
- [ ] Document every required production variable without real credentials.

### Task 2: Add frontend deployment configuration

**Files:**
- Create: `taskedgeproject/src/appConfig.js`
- Create: `taskedgeproject/src/appConfig.test.js`
- Modify: `taskedgeproject/src/App.jsx`
- Create: `taskedgeproject/vercel.json`

- [ ] Write failing tests for normalized environment URLs and localhost defaults.
- [ ] Implement the configuration helper and replace hardcoded localhost URLs.
- [ ] Add an SPA rewrite for browser routes.

### Task 3: Expire invalid browser sessions

**Files:**
- Modify: `taskedgeproject/src/authApi.js`
- Modify: `taskedgeproject/src/taskApi.js`
- Modify: `taskedgeproject/src/authApi.test.js`
- Modify: `taskedgeproject/src/taskApi.test.js`
- Modify: `taskedgeproject/src/App.jsx`

- [ ] Write failing tests proving Axios and Fetch `401` responses invoke `onUnauthorized` while `403` responses do not.
- [ ] Add unauthorized callbacks to both API clients, including CSV export requests.
- [ ] Add one idempotent React handler that clears authentication and resets workspace state.

### Task 4: Harden backend production configuration

**Files:**
- Create: `project/server/config/runtime.js`
- Create: `project/server/tests/runtimeConfig.test.js`
- Modify: `project/server/utils/token.js`
- Modify: `project/server/utils/token.test.js`
- Modify: `project/server/server.js`

- [ ] Write failing tests for production JWT-secret enforcement and origin parsing.
- [ ] Implement runtime configuration helpers.
- [ ] Use configured CORS for Express and Socket.IO and reject missing `MONGO_URI` in production.

### Task 5: Verify the release baseline

- [ ] Run all frontend tests.
- [ ] Run all backend tests.
- [ ] Run frontend lint.
- [ ] Run the production build.
- [ ] Confirm no real `.env` file is included by the ignore rules.
