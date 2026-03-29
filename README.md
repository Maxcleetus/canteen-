# Canteen Management System

This repo is structured to deploy on Vercel as a monorepo with three separate projects:

- `backend`: Express API deployed from `src/app.ts` as a Vercel Function
- `admin`: Vite admin dashboard
- `student`: Vite student portal

## Vercel Deployment

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
- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `CLOUDINARY_DISHES_FOLDER`

### Admin project

Copy `admin/.env.example` into Vercel environment variables:

- `VITE_API_BASE_URL`

Optional:

- `VITE_SOCKET_URL`

### Student project

Copy `student/.env.example` into Vercel environment variables:

- `VITE_API_BASE_URL`

Optional:

- `VITE_SOCKET_URL`

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

## Backend Build Notes

The backend build now runs `prisma generate` before type-checking so fresh Vercel installs generate the Prisma client consistently. Make sure `DATABASE_URL` is configured in the backend project before deploying.
