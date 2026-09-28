# Secure-MaintAI — Administrative Dashboard UI

**Next.js 16 + React 19 + Tailwind CSS v4 Administrative Operations Console**

This directory contains the user interface for **Secure-MaintAI**, an AI-driven university infrastructure resilience platform. The dashboard provides campus IT administrators, security engineers, and researchers with real-time operational telemetry, cybersecurity threat intelligence, ML anomaly screening, and SOAR response controls.

---

## 1. Technology Stack

- **Framework**: [Next.js 16.3.4](https://nextjs.org) (App Router, Server & Client Components, Turbopack)
- **Library**: [React 19.2.8](https://react.dev)
- **Styling**: [Tailwind CSS v4.3.3](https://tailwindcss.com) (CSS-first architecture using `@theme` and `@utility` directives)
- **Icons**: [Lucide React](https://lucide.dev)
- **Edge Routing**: Next.js 16 Edge Proxy (`src/proxy.ts`)
- **API Integration**: Direct typed fetch client with transparent reverse proxy to FastAPI (`/api/v1/:path*`)

---

## 2. All 13 Mockup-to-Route Implementations

Every page in the dashboard corresponds directly to an approved UI specification from [`.agents/plans/UIMockup/`](file:///d:/workspace/2026_2027/FirstSemester/KKU/secure-maintai/.agents/plans/UIMockup/):

| # | Route | Mockup File | Component File | Description & Key Features |
| :-: | :--- | :--- | :--- | :--- |
| **1** | `/(auth)/login` | `Login Page.jpg` | [`app/(auth)/login/page.tsx`](src/app/(auth)/login/page.tsx) | Split screen layout: Left 3D holographic security badge with resilience pitch; Right glassmorphic card with email/password form, Remember Me, and Microsoft SSO. |
| **2** | `/` | `Dashboard Page.jpg` | [`app/(dashboard)/page.tsx`](src/app/(dashboard)/page.tsx) | Executive overview: 5 KPI stat cards, circular dial gauges (CPU, RAM, Disk), Workstation Health Donut, recent alert notifications, and top resource strain rankings. |
| **3** | `/devices` | `Device Monitaring Page.jpg` | [`app/(dashboard)/devices/page.tsx`](src/app/(dashboard)/devices/page.tsx) | Fleet inventory: Total/Online/Warning/Critical counters, multi-department filter, search bar, live CPU/RAM/Disk bars, and quick isolation action menu. |
| **4** | `/devices/[id]` | `Device Details Page.jpg` | [`app/(dashboard)/devices/[id]/page.tsx`](src/app/(dashboard)/devices/[id]/page.tsx) | Next.js 16 async `params` unwrapping, header status pill, red Surgical Isolate button, live SVG telemetry line charts, hardware specifications, top 5 processes with kill button, audit logs. |
| **5** | `/alerts` | `Alerts Page.jpg` | [`app/(dashboard)/alerts/page.tsx`](src/app/(dashboard)/alerts/page.tsx) | Master-detail split view: Left searchable alerts feed by severity tabs (All, Unack, Ack, Resolved); Right inspector drawer with incident timeline, telemetry spike curve, and SOAR trigger. |
| **6** | `/cybersecurity` | `Cybersecurity Page.jpg` | [`app/(dashboard)/cybersecurity/page.tsx`](src/app/(dashboard)/cybersecurity/page.tsx) | Threat intelligence center: Global Threat Arc Map, Top Attack Origins, 24h Attack Matrix Heatmap, Attack Type Donut (Cryptojacking, APT, DDoS, Brute Force), active threats feed with investigation action. |
| **7** | `/predictions` | `AI predictions page.jpg` | [`app/(dashboard)/predictions/page.tsx`](src/app/(dashboard)/predictions/page.tsx) | ML screening stats (Model 01, 02-A, 02-B), prediction trend multi-line chart, 93.6% confidence gauge, top risk device cards, and interactive "What-If" simulator with 5-axis SVG radar chart. |
| **8** | `/maintenance` | `Maintenance Schedule.jpg` | [`app/(dashboard)/maintenance/page.tsx`](src/app/(dashboard)/maintenance/page.tsx) | Preventative maintenance operations: KPI cards (Scheduled, Completed, In Progress, Overdue), upcoming tasks table, interactive monthly calendar widget, "+ Schedule Maintenance" modal. |
| **9** | `/reports` | `Reports page.jpg` | [`app/(dashboard)/reports/page.tsx`](src/app/(dashboard)/reports/page.tsx) | Executive summary banner, 30-day fleet uptime trend line chart, incident distribution donut, AI actionable recommendations checklist, export options (PDF, Excel, CSV, PPT). |
| **10** | `/users` | `Users Management.jpg` | [`app/(dashboard)/users/page.tsx`](src/app/(dashboard)/users/page.tsx) | User role breakdown donut (`ADMIN`, `IT_OPERATOR`, `RESEARCHER`, `STUDENT`), user directory table with status lock/unlock toggle, "+ Add User" modal. |
| **11** | `/activity-logs` | `Activity Logs.jpg` | [`app/(dashboard)/activity-logs/page.tsx`](src/app/(dashboard)/activity-logs/page.tsx) | Immutable audit log viewer with search, category tabs (User, System, Security, API), severity filters, log inspection modal, and CSV/JSON export. |
| **12** | `/settings` | `Settings page.jpg` | [`app/(dashboard)/settings/page.tsx`](src/app/(dashboard)/settings/page.tsx) | Tabbed configuration (General, Security, ML Models, Notifications, Integrations, Backup, Appearance), and Emergency System Kill Switch with high-impact confirmation modal. |
| **13** | `/help` | `Help Support page.jpg` | [`app/(dashboard)/help/page.tsx`](src/app/(dashboard)/help/page.tsx) | Searchable knowledge base, 6 topic cards, FAQ interactive accordion, PDF guides download, support ticket list, and "+ Create Support Ticket" modal. |

---

## 3. Design System & Theming

The application utilizes **Tailwind CSS v4** with native `@theme` tokens in [`src/app/globals.css`](src/app/globals.css):

```css
@theme {
  --color-brand-dark: #060b18;
  --color-brand-surface: #0b1329;
  --color-brand-card: rgba(13, 22, 42, 0.78);
  --color-brand-card-border: rgba(30, 41, 59, 0.75);

  --color-brand-blue: #3b82f6;
  --color-brand-cyan: #06b6d4;
  --color-brand-purple: #8b5cf6;
  --color-brand-emerald: #10b981;
  --color-brand-amber: #f59e0b;
  --color-brand-rose: #ef4444;

  --font-sans: "Plus Jakarta Sans", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
}
```

Reusable utility classes:
- `glass-card`: Glassmorphism backdrop blur (`blur(16px)`) with semi-transparent border.
- `glass-card-hover`: Dynamic hover elevation with subtle brand glow.
- `glow-blue`, `glow-cyan`, `glow-rose`: Neon glow shadows for status indicators.

---

## 4. Edge Route Proxy (`src/proxy.ts`)

In Next.js 16, edge request interception uses `proxy.ts`:

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const token = request.cookies.get('access_token')?.value;
  const { pathname } = request.nextUrl;

  const isAuthRoute = pathname.startsWith('/login');
  const isPublic = pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname === '/favicon.ico';

  if (!token && !isAuthRoute && !isPublic) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (token && isAuthRoute) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}
```

---

## 5. Development & Build Commands

### Install Dependencies
```bash
npm install
```

### Run Development Server
```bash
npm run dev
```
Starts the local development server at `http://localhost:3000` with Turbopack fast refresh.

### Production Build
```bash
npm run build
```
Executes Turbopack compilation and static page generation. Confirmed 0 TypeScript errors across all 15 routes.

### Start Production Server
```bash
npm run start
```
Runs the compiled Next.js standalone server on port 3000.

---

## 6. Live Role Switching Simulation

To test role-sensitive authorization behavior (Rule 8 & Rule 20), the sidebar features a built-in user card selector that allows instant switching between:
- **`Dr. Sarah Al-Rashid` (`ADMIN`)** — Full destructive containment and kill switch controls.
- **`Alex Rivera` (`IT_OPERATOR`)** — Device triage, alerts acknowledgment, and maintenance actions.
- **`Dr. Tariq Al-Omari` (`RESEARCHER`)** — HPC research state preservation context.
- **`Khalid Mansoor` (`STUDENT`)** — Student lab workstation context subject to SOAR network isolation.
