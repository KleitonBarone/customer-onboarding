# Deploy the browser demo on Vercel

The browser demo uses the same React UI as the full application. It starts as Ada
with the fictional accounts and simulates submission, review, activation and
reminders entirely in the visitor's tab. Refresh or **Reset demo** restores the
fixtures. Uploaded PDF/CSV files stay in browser memory and disappear on reset.
Tabs and visitors have independent state.

## Deploy

1. Import this GitHub repository into a new Vercel project.
2. Set **Root Directory** to the repository root (`.`), **Framework Preset** to
   **Vite**, and **Node.js Version** to **24.x**.
3. Use the settings committed in [vercel.json](../vercel.json):

   | Setting | Value |
   | --- | --- |
   | Install command | `npx --yes pnpm@11.23.0 install --frozen-lockfile` |
   | Build command | `npx --yes pnpm@11.23.0 build:demo` |
   | Output directory | `apps/web/dist-demo` |

4. Deploy. No environment variables, database or storage integration is required.

The configuration pins pnpm for Vercel's build image and rewrites SPA routes to
`index.html`, so direct links such as `/onboardings/juniper` work. Only the static
demo output is deployed. The API and PostgreSQL remain part of the local full app.
See Vercel's [Vite guide](https://vercel.com/docs/frameworks/frontend/vite) and
[package manager support](https://vercel.com/docs/package-managers).

Open the deployed production URL in a private browser window before adding it to
your portfolio. Check the queue, change personas, complete a correction, download
a file, and reset. Also open a direct onboarding link and refresh it.

## Run and verify locally

Use the pinned Node and pnpm versions in the [README](../README.md).

```sh
pnpm install --frozen-lockfile
pnpm dev:demo
```

The demo normally opens at `http://127.0.0.1:4312`. To inspect the exact static
build Vercel will serve:

```sh
pnpm build:demo
pnpm preview:demo
```

For automated checks, install the browser once and run:

```sh
pnpm browser:install
pnpm verify:demo
```

Playwright starts the built demo on an available port, blocks all `/api` requests,
and tests the complete workflow, exact file downloads, independent tabs, refresh,
reset, scope, filters and reminders. It stops its server and closes its browser
contexts afterward. CI also runs the full application's PostgreSQL/API suite.

## Boundaries

Vite's `demo` mode selects `apps/web/src/demo/api.ts` at build time. Shared types,
fixture definitions and derived workflow rules live in `packages/contracts/src`.
The standard build continues to use `apps/web/src/api.ts` and the real API.

The demo has no persistent storage and sends no uploads or workflow data to a
server. Sample documents are public fictional build assets. Its role checks
simulate the interface; server authorization, durable transactions and outbox
recovery are exercised by the full application's tests.
