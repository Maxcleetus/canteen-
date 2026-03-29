import { execSync } from 'node:child_process';
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');

const run = (command, env = {}) => {
  execSync(command, {
    cwd: rootDir,
    env: {
      ...process.env,
      ...env
    },
    stdio: 'inherit'
  });
};

const landingPage = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>RIT Canteen</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #020617;
        --panel: rgba(15, 23, 42, 0.86);
        --border: rgba(148, 163, 184, 0.2);
        --text: #e2e8f0;
        --muted: #94a3b8;
        --admin: #16a34a;
        --student: #2563eb;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 32px 20px;
        font-family: Inter, system-ui, sans-serif;
        color: var(--text);
        background:
          radial-gradient(circle at top left, rgba(37, 99, 235, 0.24), transparent 30%),
          radial-gradient(circle at bottom right, rgba(22, 163, 74, 0.24), transparent 30%),
          var(--bg);
      }

      main {
        width: min(960px, 100%);
      }

      .hero {
        margin-bottom: 28px;
      }

      .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border: 1px solid var(--border);
        border-radius: 999px;
        background: rgba(15, 23, 42, 0.72);
        color: var(--muted);
        font-size: 13px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      h1 {
        margin: 16px 0 10px;
        font-size: clamp(2.5rem, 6vw, 4.5rem);
        line-height: 0.96;
      }

      p {
        margin: 0;
        max-width: 680px;
        color: var(--muted);
        font-size: 1.05rem;
        line-height: 1.7;
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 18px;
        margin-top: 28px;
      }

      .card {
        display: block;
        padding: 24px;
        border-radius: 24px;
        text-decoration: none;
        color: inherit;
        background: var(--panel);
        border: 1px solid var(--border);
        backdrop-filter: blur(18px);
        box-shadow: 0 20px 60px rgba(2, 6, 23, 0.4);
        transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
      }

      .card:hover {
        transform: translateY(-4px);
        box-shadow: 0 24px 72px rgba(2, 6, 23, 0.5);
      }

      .card.admin:hover {
        border-color: rgba(22, 163, 74, 0.45);
      }

      .card.student:hover {
        border-color: rgba(37, 99, 235, 0.45);
      }

      .tag {
        display: inline-flex;
        padding: 6px 10px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .tag.admin {
        background: rgba(22, 163, 74, 0.14);
        color: #86efac;
      }

      .tag.student {
        background: rgba(37, 99, 235, 0.14);
        color: #93c5fd;
      }

      h2 {
        margin: 16px 0 10px;
        font-size: 1.4rem;
      }

      .footer {
        margin-top: 24px;
        color: var(--muted);
        font-size: 0.95rem;
      }

      code {
        color: #f8fafc;
      }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <div class="eyebrow">RIT Canteen Management</div>
        <h1>Single Vercel deploy for admin, student, and API.</h1>
        <p>
          This deployment serves the backend at <code>/api</code>, the admin dashboard at
          <code>/admin</code>, and the student portal at <code>/student</code>.
        </p>
      </section>

      <section class="grid">
        <a class="card admin" href="/admin/">
          <span class="tag admin">Admin</span>
          <h2>Open Admin Dashboard</h2>
          <p>Menu management, live orders, reports, and canteen analytics.</p>
        </a>
        <a class="card student" href="/student/">
          <span class="tag student">Student</span>
          <h2>Open Student Portal</h2>
          <p>Browse dishes, pay securely, and track the live canteen queue.</p>
        </a>
      </section>

      <p class="footer">
        Health check: <code>/api/health</code>
      </p>
    </main>
  </body>
</html>
`;

const build = async () => {
  await rm(publicDir, { recursive: true, force: true });

  run('npm run build --workspace backend');
  run('npm run build --workspace admin', { VITE_APP_BASE_PATH: '/admin/' });
  run('npm run build --workspace student', { VITE_APP_BASE_PATH: '/student/' });

  await mkdir(publicDir, { recursive: true });
  await cp(path.join(rootDir, 'admin', 'dist'), path.join(publicDir, 'admin'), {
    recursive: true
  });
  await cp(path.join(rootDir, 'student', 'dist'), path.join(publicDir, 'student'), {
    recursive: true
  });
  await writeFile(path.join(publicDir, 'index.html'), landingPage, 'utf8');
};

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
