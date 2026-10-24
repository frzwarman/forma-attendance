# Forma — a better rhythm for work

A mobile-first, universal workforce attendance prototype for the fictional Northstar Technologies in Jakarta. Built with Expo and React Native primitives. The employee experience keeps a phone layout (up to 480px) with bottom tabs, including on desktop previews; the HR workspace adapts to wider screens. No backend credentials required.

## Run

Use Node **24 LTS (24.3+)** or supported Node 22 (22.13+).

```sh
npm ci
npm run web
```

Expo prints a local URL (normally http://localhost:8081). Open it on desktop or use your browser’s mobile device mode. On a physical phone, use an HTTPS deployment for camera and geolocation; plain HTTP LAN URLs do not satisfy browser permission requirements.

```sh
npm run typecheck
npm run lint
npm test
npm run build:web
```

The web build is written to `dist/`. Deploy to an HTTPS static host with an SPA fallback rewriting non-asset routes to `/index.html`.

### iOS / Android later

```sh
npx expo run:ios
npx expo run:android
```

These generate native projects and require Xcode / Android tooling. Native packaging has not been verified in this initial web phase. Use an Expo development build compatible with SDK 58; store Expo Go support may lag the SDK release. Permissions are configured in `app.json`.

## Demo access

The first launch opens the employee demo, clearly labeled in the header. Log out to explore the sign-in experience, or use the workspace badge / workspace selector to change roles.

| Role | Email | Password |
| --- | --- | --- |
| Employee, Alex Morgan | alex@northstar.demo | Forma2026! |
| HR, Kevin Santoso | hr@northstar.demo | Forma2026! |

These are fictional demo identities, not secure authentication. Preferences and a demo identity are stored locally; no real access tokens are stored. Profile → Reset demo data restores the seed.

## Stack and compatibility

Expo SDK 58, Expo Router, React 19.3, React Native 0.88, React Native Web 0.21; TypeScript; stable NativeWind v4 / Tailwind v3; SDK-pinned Reanimated 4 and Worklets; Lucide React Native and react-native-svg; Expo Camera, Location, Image, Linear Gradient, Haptics, Document Picker, SecureStore; AsyncStorage; Zustand; TanStack Query; React Hook Form and Zod. Plus Jakarta Sans is bundled through Expo Google Fonts.

Expo dependencies follow SDK 58’s `bundledNativeModules.json`, rather than independently selecting incompatible platform versions. NativeWind v4 is used instead of the v5 release candidate. Semantic dynamic themes use a context and native styles, with NativeWind configured for universal utilities. Charts are built from React Native views for web/native compatibility. There is no browser-only chart dependency.

References checked before implementation:

- [Expo SDK 58 release](https://expo.dev/changelog/sdk-58)
- [Expo SDK reference](https://docs.expo.dev/versions/v58.0.0/)
- [NativeWind installation](https://www.nativewind.dev/docs/getting-started/installation)
- [Talenta attendance workflows](https://www.talenta.co/en/features/attendance-app/)
- [Talenta configurable branch radius](https://help-center.talenta.co/hc/en-us/articles/12173252263833-How-to-Activate-Live-Attendance-per-Branch)

Talenta informed the GPS/office-radius, shift, selfie, and approval workflows. Forma’s identity and interface are original; no Talenta assets are used.

## Architecture

```text
src/
  app/                  Expo Router layout and routes
  components/           Theme-aware universal primitives, calendar, responsive shell
  features/             Employee and HR screens
    attendance/         Location/camera/confirmation/success flow
  domain/               Pure attendance rules, geofence math, request validation
  services/
    data.tsx             TanStack Query data boundary
    repository.ts        Typed repository/auth interfaces and transactional mock
    seed.ts              36 employees, 3 months of records, schedules, offices
    location.ts          On-demand Expo Location and labeled simulations
    storage.ts           AsyncStorage + native secure-token integration boundary
  stores/                Persisted Zustand preferences and demo session
  theme/                 Semantic light/dark tokens and typography
  types/                 Domain entities, raw events, sessions, policies, audit
```

Presentation uses the repository/query boundary. It does not seed or mutate hardcoded screen data. Raw attendance events and calculated sessions are separate. Mock writes serialize through a transaction queue, persist before publishing, and reject duplicate transitions. A submission key makes attendance retries idempotent. Timestamps are UTC; company date/time uses Asia/Jakarta (id-ID date keys, English interface). Schedules contain explicit UTC instants so overnight durations are computed from actual elapsed timestamps, independent of wall-clock changes. Future timezone-aware schedule creation belongs on the backend; do not construct other timezones with Jakarta’s fixed offset.

## Implemented

- Employee overview with live clock, scheduled shift, attendance state, elapsed time, metrics, shortcuts, history and upcoming items.
- Attendance clock-in/out with inside/outside/unavailable simulations and real, foreground-only GPS. Haversine distance and accuracy uncertainty block unverifiable submissions. Active overnight sessions remain available for clock-out.
- Optional front-camera selfie with live view, camera-ready state, full-size captured preview, retake, explicit Use photo confirmation, and recoverable permission errors. No face recognition or identity claims. Selfie previews stay in memory; persisted events record capture metadata, not biometric photos.
- Smooth confirmation/success states, press feedback, reduced-motion handling and native haptic success.
- Searchable, filterable, monthly attendance calendar/list and daily details. Several months of sample records.
- Mobile schedule with today’s plan first, a swipeable week strip, expandable month calendar, arrangements, rest days and configurable shifts.
- Annual/sick/personal/unpaid leave with working-day calculations, balance and overlap validation. Attendance correction requests with dates, times, reason, optional supporting filename.
- Persistent request history, HR decisions, notifications and audit records.
- Compact employee profile with content-sized cards, a single-row appearance selector, notification preferences, light/dark/system themes, sign-out and demo reset.
- HR dashboard, native-view weekly charts, department attendance, employee search/filter/detail, attendance monitoring with date/department/status filters, approval/rejection confirmation and geofence editing.
- Employee bottom tabs at every preview width; adaptive HR sidebar/mobile tabs. Content scrolls clear of the bottom navigation. 44px minimum primary touch targets; keyboard-friendly forms and focus outlines.

## Known prototype limitations

- **Demo security only.** The role switcher and local identity do not enforce production authorization. Users can change local data. Never use this mock with real employee information.
- Mock authoritative timestamps use device time behind an injectable clock. Production must use database timestamps and server validation. Offline multi-device conflict resolution is not implemented.
- Leave/correction approvals update request status, audit trail and notifications. They do not yet apply corrections to raw attendance or update future leave schedules/payroll; preserving original events is deliberate.
- Leave cancellations, full localization, rotating-shift assignment UI, holiday calendars, absence reconciliation, and automated missing-clock-out reminders are future work. Seed contains rest days, leave, late and absent examples.
- No email is sent by password reset. No native push notifications. Personal identity/work details are read-only; appearance and notification preferences persist.
- Attachments store the filename only; no files are uploaded. Selfie capture is not identity verification. Photos are not persisted to browser storage.
- Location preview is an illustrative diagram, not a live map. A real map provider can be added behind a platform adapter.
- Demo seeds today as a working shift even on a weekend to make attendance immediately testable. Other dates use the organization’s configured workweek. Demo office policy still requires a geofence check for all attendance actions; production remote/field rules should be enforced per shift on the server.
- Office coordinate fields are numeric inputs; a map picker and richer native date pickers are future polish. Current request forms use explicitly labeled ISO dates and 24-hour times.
- Demo portraits are bundled locally from Pravatar (https://pravatar.cc). Replace them with organization-controlled employee assets for production.

## Backend integration roadmap

1. Implement `AuthRepository` using Supabase Auth. For web, use a server/BFF session with secure HttpOnly cookies; for native, SecureStore is the provided token boundary. Do not store production bearer tokens in AsyncStorage/localStorage.
2. Replace `WorkforceRepository` with Supabase reads and server RPCs. Use organization-scoped foreign keys and indexes, UTC `timestamptz`, transactional attendance transitions, unique organization/employee/idempotency constraints, database timestamps and immutable audit logs.
3. Enable Row Level Security on every table. Derive organization/employee membership from `auth.uid()`. Employees may read only their own records and submit their own requests. HR reads only their organization. Validate HR membership inside privileged RPCs, never from the client role flag. No direct client writes to calculated attendance or approval/audit tables.
4. Store selfie/attachment assets in private organization-scoped buckets with restricted policies and short-lived signed URLs. Apply consent, retention, deletion, and access-audit policies before collecting real photos.
5. Enforce schedules, office activation, GPS uncertainty, selfie policy, grace periods, overlapping leave and balances on the server. GPS and selfies alone do not establish identity. Integrate an approved verification provider separately if needed.
6. Apply approved corrections through append-only adjustment events and approval transactions; reconcile leave/holidays/absences/missed clock-outs with scheduled jobs. Add conflict/retry UX, monitoring, recovery and organization onboarding.

`.env.example` documents future public configuration. No Supabase SDK or unused credentials are required in this mock. Never expose a Supabase service-role secret in an `EXPO_PUBLIC_` variable.

## Verification

Verified in this workspace:

- TypeScript: passes.
- ESLint: passes without warnings.
- Domain/service suite: **28 tests pass**, including transitions, concurrent duplicates, overnight timestamps, geofence uncertainty, malformed coordinates, permission denial/timeouts, leave dates, persistence, approval audit history, and storage failures.
- Production web export: passes.
- Playwright: **12 end-to-end tests pass** against the built web application, including clock-in/out, invalid location blocking, reload persistence, leave/correction submissions, HR approval, employee search, office editing, light/dark settings, selfie preview/retake, camera permission denial, and non-remembered login sessions. All employee and HR screens pass a 320px overflow check; the dashboard is additionally checked at 375, 390, 430 and 1440px.
- Clean installation (`npm ci`) and a subsequent `npm install` pass using an offline package cache. All lockfile package entries have valid versions.
- Expo's offline compatibility check reports dependencies up to date; it warns that offline dependency validation is less reliable.

To repeat browser verification:

```sh
npm run build:web
npx playwright install chromium
npm run test:e2e
```

To test Expo development startup and theme switching (including absence of the Expo error overlay):

```sh
npm run test:e2e:dev
```

This starts or reuses the Expo web server on port 8081. The **9 development browser tests** cover initial load, reload, manual Light/Dark selection, system appearance changes, empty form/feedback states without React Native text-node console errors, selfie live view/capture/preview/retake/selection, permission denial, vertical card containment, visible profile actions, repeated tab navigation at 320/375/390/430px, and a phone-sized employee preview on desktop. Camera tests use Chromium’s simulated webcam with explicit test permissions, never a physical camera.

The production Playwright suite starts a local static preview on port 4173. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to use an existing compatible Chromium binary. Review screenshots in `artifacts/` (employee overview, clock-in success, HR dashboard, dark profile and mobile viewports).

Physical-device iOS/Android builds, Safari, real GPS, and camera capture on physical devices have not been validated. Permission failure behavior is covered by injected location-provider tests. The host provided Node 25.8; checks passed, but use the supported Node versions above for development and CI.
# forma-attendance
