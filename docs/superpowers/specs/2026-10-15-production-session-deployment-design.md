# Production Session and Deployment Design

## Goal

Prepare TaskEdge for a public GitHub repository and a Vercel-hosted React frontend without breaking local development.

## Architecture

- Keep the existing one-day JWT authentication model and bearer-token API contract.
- Persist the JWT in browser storage for this release, but validate it through protected requests and end the local session immediately on any `401` response.
- Read frontend API and realtime server locations from Vite environment variables, with localhost defaults for development.
- Require a real `JWT_SECRET` in production and restrict HTTP and Socket.IO CORS to configured origins.
- Deploy the Vite application as an SPA on Vercel. The Express API can run on a separately configured host until attachment storage and realtime hosting are migrated.

## Session Behavior

All authenticated API clients receive a shared unauthorized callback. The first `401` clears stored credentials, resets authenticated application state, and displays an expired-session message. Ordinary `403` permission errors do not end the session.

## Configuration

The frontend uses `VITE_API_BASE_URL` and optional `VITE_SERVER_BASE_URL`. The backend uses `JWT_SECRET`, `JWT_EXPIRES_IN`, `MONGO_URI`, and `CLIENT_ORIGINS`. Checked-in example files document names without containing secrets.

## Repository Safety

All `.env` variants are ignored except explicit `.env.example` files. Production startup fails instead of using a known JWT secret.

## Deferred Work

Task and activity uploads currently use local disk. Moving uploads to Vercel Blob or Cloudinary is a separate migration because it requires a provider choice and credentials.

## Verification

Unit tests cover configuration parsing, production JWT enforcement, API unauthorized callbacks, and existing auth persistence. Full frontend tests, backend tests, lint, and production build must pass.
