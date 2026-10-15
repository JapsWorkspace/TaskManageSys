# JWT Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add JWT authentication to the existing Express backend and prepare the React frontend to store and send JWTs.

**Architecture:** Backend JWT code stays in `project/server`. Frontend token persistence and auth headers stay in `taskedgeproject`. Auth responses return `{ message, token, user }`; protected backend routes use `Authorization: Bearer <token>`.

**Tech Stack:** Node.js, Express, MongoDB/Mongoose, bcryptjs, jsonwebtoken, React, Vite, browser localStorage.

---

## File Structure

- Create `server/utils/token.js`: signs and verifies JWTs.
- Create `server/middleware/authMiddleware.js`: validates bearer tokens and loads the authenticated user.
- Create `server/utils/authResponse.js`: converts Mongoose user docs into safe auth payloads.
- Create `server/utils/token.test.js`: Node tests for signing and verifying tokens.
- Modify `server/controllers/authController.js`: include tokens in login/register responses and add `getCurrentUser`.
- Modify `server/routes/authRoutes.js`: add protected `GET /me`.
- Modify `server/package.json`: add `jsonwebtoken` and a real test script.
- Modify `taskedgeproject/src/App.jsx`: store token, read token, clear token, and send auth headers.

## Tasks

- [ ] Add failing backend token tests for `signAuthToken` and `verifyAuthToken`.
- [ ] Install/add `jsonwebtoken` and implement the token utility.
- [ ] Add auth response helper and update login/register responses to include `token`.
- [ ] Add auth middleware and protected `/api/auth/me`.
- [ ] Update frontend localStorage auth state to include token and attach bearer headers.
- [ ] Run backend tests and frontend tests/lint/build.
