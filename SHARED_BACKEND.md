# Shared Web and Mobile Backend

The web app and Flutter app use the same API and MongoDB database. Accounts and project tasks are therefore shared when both clients point to the same deployed backend. Signing in on each device is still separate; the login credentials are shared, not the device session.

## Backend

Deploy `project/server` once (for example, as the Render web service) and configure its production environment with:

- `NODE_ENV=production`
- `MONGO_URI` pointing to the production MongoDB database
- `JWT_SECRET` set to a strong secret value
- `CLIENT_ORIGINS` as a comma-separated list of allowed browser origins, including the Vercel production domain and any Vercel preview domains that need API access

Keep the same `MONGO_URI` and `JWT_SECRET` for the one shared backend. Do not commit `.env` files or put server secrets in either client. Native Flutter requests do not use browser CORS; Flutter Web does.

## Web

Set the Vercel environment variable to the deployed API base URL, including `/api`:

```text
VITE_API_BASE_URL=https://<your-render-service>.onrender.com/api
```

`VITE_SERVER_BASE_URL` is optional; set it to `https://<your-render-service>.onrender.com` when uploaded files need an absolute server URL. Redeploy the Vercel app after changing environment variables.

## Flutter

Pass the same API base URL at run/build time. Do not include a trailing slash after `api`.

```powershell
flutter run --dart-define=API_BASE_URL=https://<your-render-service>.onrender.com/api
flutter build apk --dart-define=API_BASE_URL=https://<your-render-service>.onrender.com/api
```

For local development, omit `API_BASE_URL`; the existing defaults continue to use localhost for Flutter Web and `10.0.2.2:8000` for the Android emulator. For a physical device, use `API_BASE_URL` with the development computer's reachable LAN address and port.

Both clients use the same `/api/auth/login`, `/api/auth/register`, and `/api/tasks` endpoints. The server remains authoritative for task visibility and role permissions. Web-created project tasks appear in mobile only for accounts the server permits to see those tasks (for example, their assignee, collaborator, watcher, or the manager of the project).
