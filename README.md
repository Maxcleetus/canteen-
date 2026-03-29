# Canteen Management System

This repo can now deploy on Vercel in two ways:

- as one root Vercel project with:
  - `/api` for the backend
  - `/admin` for the admin dashboard
  - `/student` for the student portal
- or as three separate Vercel projects if you prefer that setup

## Vercel Deployment

### Zero-dashboard root deploy

If you do not want to change anything in Vercel project settings, deploy the repository root as a single Vercel project.

The root project now includes:

- [vercel.json](/home/max-cleetus/Videos/canteen%20management%20system/vercel.json) to force `public` as the output directory, set the root project framework to `Other`, and rewrite `/api/:path*` into the root API function
- [api/index.ts](/home/max-cleetus/Videos/canteen%20management%20system/api/index.ts) to forward Vercel Function requests into the existing Express app in `backend/src/app.ts`
- [scripts/vercel-build.mjs](/home/max-cleetus/Videos/canteen%20management%20system/scripts/vercel-build.mjs) to build `backend`, `admin`, and `student`, then publish:
  - `/api`
  - `/admin`
  - `/student`

For this mode, the repository root is the Vercel project root and no Output Directory change is needed in the dashboard.

### Three-project deploy

Create three Vercel projects and set each project's Root Directory:

1. `backend`
2. `admin`
3. `student`

Vercel supports setting a per-project Root Directory in monorepos:
https://vercel.com/docs/projects/project-configuration/general-settings

The backend Vercel entrypoint is [backend/src/app.ts](/home/max-cleetus/Videos/canteen%20management%20system/backend/src/app.ts). The local realtime server now lives in [backend/src/dev-server.ts](/home/max-cleetus/Videos/canteen%20management%20system/backend/src/dev-server.ts), so Vercel only picks up the Express app and not the Socket.IO listener:
https://vercel.com/docs/frameworks/backend/express

## Required Environment Variables

### Backend project

Copy `backend/.env.example` into Vercel environment variables:

- `DATABASE_URL`
- `JWT_SECRET`
- `CORS_ALLOWED_ORIGINS`
- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `CLOUDINARY_DISHES_FOLDER`

The backend app includes [backend/vercel.json](/home/max-cleetus/Videos/canteen%20management%20system/backend/vercel.json) so a separate backend Vercel project does not inherit a stale static output directory like `public`.

`CORS_ALLOWED_ORIGINS` is optional. If you set it, use a comma-separated list such as `https://your-admin.vercel.app,https://your-student.vercel.app`. If you leave it empty, the backend allows localhost and `*.vercel.app` origins by default.

### Admin project

Copy `admin/.env.example` into Vercel environment variables:

- `VITE_API_BASE_URL`

Optional:

- `VITE_SOCKET_URL`

The admin app includes [admin/vercel.json](/home/max-cleetus/Videos/canteen%20management%20system/admin/vercel.json) so Vercel always uses `dist` as the output directory.

### Student project

Copy `student/.env.example` into Vercel environment variables:

- `VITE_API_BASE_URL`

Optional:

- `VITE_SOCKET_URL`

The student app includes [student/vercel.json](/home/max-cleetus/Videos/canteen%20management%20system/student/vercel.json) so Vercel always uses `dist` as the output directory.

## Realtime on Vercel

Vercel Functions do not support traditional WebSocket connections:
https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections

Because of that:

- local development can use Socket.IO through `backend/src/dev-server.ts` if you set `VITE_SOCKET_URL`
- deployed `admin` and `student` apps automatically fall back to polling when `VITE_SOCKET_URL` is not set

## Recommended Production URLs

After deploying the backend, use its URL in the frontend projects:

- `VITE_API_BASE_URL=https://your-backend-project.vercel.app/api`

Set `VITE_SOCKET_URL` only if you later move realtime updates to a dedicated provider that supports WebSockets outside Vercel Functions.

## If Vercel Says "No Output Directory named public"

That error is now handled in-code for root deployments, because the repository generates a root `public/` directory during the build and serves the backend through [api/index.ts](/home/max-cleetus/Videos/canteen%20management%20system/api/index.ts) instead of framework-level Express detection.

If you are using the root deploy:

- keep the project root at the repository root
- do not change the Output Directory in Vercel

If you are using the three-project setup:

- `admin` should build to `dist`
- `student` should build to `dist`
- `backend` should be a separate Vercel project with Root Directory set to `backend`

If the dashboard still shows `public`, clear that setting or redeploy after the included `vercel.json` files are picked up.

## Backend Build Notes

The backend build now runs `prisma generate` before type-checking so fresh Vercel installs generate the Prisma client consistently. Make sure `DATABASE_URL` is configured in the backend project before deploying.
