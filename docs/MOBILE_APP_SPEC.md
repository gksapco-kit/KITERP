# ArT (Ask r Task) – Mobile App Technical Specification

## 1. Overview

This document defines the technical specification for native Android and iOS mobile apps for ArT, aligning with the core Architecture and Technical Spec.

---

## 2. Key Decisions

| Decision | Options | Recommendation |
|----------|---------|----------------|
| **Development approach** | Native (Kotlin + Swift), Cross-platform (Flutter, React Native, KMP) | **Flutter** or **React Native** for faster time-to-market with single codebase; go native if you need max performance or platform-specific features. |
| **App structure** | Single app (role switcher) vs separate apps (Asker, Tasker, Store Admin) | **Single app with role switcher** for v1 (simpler distribution); split later if UX diverges significantly. |
| **Backend communication** | REST, GraphQL | **REST** (simpler, matches your API spec); GraphQL if you expect complex nested queries. |
| **State management** | Redux/Zustand (RN), Riverpod/Bloc (Flutter) | Depends on framework; use something with good offline/cache support. |

---

## 3. Mobile Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Mobile App (Android + iOS)                                     │
├─────────────────────────────────────────────────────────────────┤
│  Presentation Layer                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ Asker    │ │ Tasker   │ │ Store    │ │ Cab      │           │
│  │ Screens  │ │ Screens  │ │ Admin    │ │ Screens  │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
├─────────────────────────────────────────────────────────────────┤
│  Feature Modules (maps to backend behavioral modules)           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ Ask/Quote│ │ Orders   │ │ Store    │ │ Tracking │           │
│  │ Negotiate│ │ Escrow   │ │ Catalog  │ │ (Cab)    │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
├─────────────────────────────────────────────────────────────────┤
│  Core Services                                                  │
│  Auth │ API Client │ Push │ Local DB/Cache │ Location │ Media  │
├─────────────────────────────────────────────────────────────────┤
│  Platform Layer                                                 │
│  Android (Kotlin) │ iOS (Swift) │ or shared (Flutter/RN)       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Key Screens by Role

### 4.1 Asker Flow

| Screen | Purpose |
|--------|---------|
| Home / Discovery | Browse categories, search Taskers/services |
| Create Ask | Title, description, category, location, attachments, materials |
| My Asks | List of asks with status |
| Ask Detail | View quotes, negotiate, accept/reject |
| Order Detail | Status, escrow, tracking (if cab), mark complete |
| Feedback | Mandatory rating/review after completion |
| Profile | Edit profile, payment methods, order history |

### 4.2 Tasker Flow

| Screen | Purpose |
|--------|---------|
| Dashboard | Incoming asks (matching skills), active orders |
| Ask Detail | View ask, submit quote |
| My Quotes | List with status (submitted, negotiating, accepted, rejected) |
| Negotiation | Revision requests, counter-offers |
| Order Execution | Update status, milestones, materials |
| Earnings | Completed orders, escrow releases, payouts |
| Profile | Skills, verification docs, linked stores |

### 4.3 Store Admin Flow

| Screen | Purpose |
|--------|---------|
| Store Dashboard | Sales, orders, analytics summary |
| Catalog | Add/edit products or services |
| Inventory | Stock levels, low-stock alerts |
| Orders | Store orders list, fulfill/ship |
| Employees | Add/remove, assign roles |
| Storefront Settings | Theme, logo, share link, publish to app stores |
| Finance | Payouts, invoices, escrow |

### 4.4 Cab / Tracking Flow

| Screen | Purpose |
|--------|---------|
| Trip List | Assigned trips, status |
| Trip Detail | Pickup/drop, navigation, status updates |
| Live Tracking (Asker view) | Map with real-time location |

---

## 5. Core Mobile Services

| Service | Responsibility |
|---------|----------------|
| **Auth** | Login, signup, token refresh, role switching, biometric unlock |
| **API Client** | REST calls, error handling, retry, offline queue |
| **Push Notifications** | FCM (Android) + APNs (iOS); quote received, order updates, feedback due |
| **Local DB / Cache** | SQLite or Hive/Realm; offline draft asks, cached orders |
| **Location** | For cab tracking, ask location, store discovery |
| **Media** | Image/video picker, upload to blob storage, attachments |
| **Deep Links** | Store share links, order links, app-to-app navigation |

---

## 6. Offline and Sync Strategy

- **Optimistic UI**: Show pending state immediately; sync when online.
- **Offline drafts**: Asker can draft asks offline; upload on reconnect.
- **Cached lists**: Orders, quotes, catalog cached locally; refresh on pull.
- **Conflict resolution**: Server wins for order state; local drafts prompt user.

---

## 7. Push Notification Types

| Event | Recipient | Payload |
|-------|-----------|---------|
| New quote on Ask | Asker | `{ askId, quoteId, taskerName }` |
| Revision requested | Tasker | `{ quoteId, askId }` |
| Quote accepted | Tasker | `{ quoteId, orderId }` |
| Order status update | Asker | `{ orderId, status }` |
| Feedback due | Asker | `{ orderId }` |
| Payout released | Tasker | `{ orderId, amount }` |
| Tracking update (Cab) | Asker | `{ orderId, location }` |

---

## 8. Folder Structure (Flutter Example)

```
lib/
├── main.dart
├── app/
│   ├── routes.dart
│   └── theme.dart
├── core/
│   ├── api/              # API client, endpoints
│   ├── auth/             # Auth service, token storage
│   ├── push/             # FCM/APNs setup
│   ├── storage/          # Local DB, cache
│   └── location/         # GPS service
├── features/
│   ├── ask/              # Create ask, ask list, ask detail
│   ├── quote/            # Quote list, negotiation
│   ├── order/            # Order detail, status, escrow
│   ├── feedback/         # Feedback form
│   ├── store/            # Store admin screens, catalog, inventory
│   ├── tracking/         # Cab/parcel tracking, map
│   └── profile/          # Asker/Tasker profile, verification
├── shared/
│   ├── widgets/          # Reusable UI components
│   ├── models/           # DTOs, domain models
│   └── utils/            # Helpers, formatters
└── l10n/                 # Localization
```

---

## 9. Folder Structure (React Native Example)

```
src/
├── App.tsx
├── app/
│   ├── navigation/       # React Navigation setup, routes
│   └── theme/            # Colors, typography, spacing
├── core/
│   ├── api/              # Axios/fetch client, endpoints
│   ├── auth/             # Auth context, token storage
│   ├── push/             # FCM setup, notification handlers
│   ├── storage/          # MMKV, AsyncStorage, WatermelonDB
│   └── location/         # Geolocation service
├── features/
│   ├── ask/              # Create ask, ask list, ask detail
│   ├── quote/            # Quote list, negotiation
│   ├── order/            # Order detail, status, escrow
│   ├── feedback/         # Feedback form
│   ├── store/            # Store admin screens, catalog, inventory
│   ├── tracking/         # Cab/parcel tracking, map
│   └── profile/          # Asker/Tasker profile, verification
├── shared/
│   ├── components/       # Reusable UI components
│   ├── hooks/            # Custom hooks
│   ├── models/           # TypeScript types, interfaces
│   └── utils/            # Helpers, formatters
└── i18n/                 # Localization (i18next)
```

---

## 10. Security Considerations (Mobile)

- **Secure token storage**: Keychain (iOS), EncryptedSharedPreferences (Android).
- **Certificate pinning**: For API calls (optional but recommended).
- **Biometric auth**: Optional unlock for sensitive actions (payments, verification).
- **No secrets in app**: API keys for payments/blob storage stay on backend.
- **Code obfuscation**: Enable ProGuard (Android) and bitcode (iOS) for release builds.
- **Jailbreak/root detection**: Optional; warn or restrict sensitive features.

---

## 11. Suggested Tech Stack (Cross-Platform)

### 11.1 Flutter Stack

| Layer | Technology |
|-------|------------|
| Framework | Flutter (Dart) |
| State Management | Riverpod or Bloc |
| Local DB | Hive, Drift (SQLite), or Isar |
| Push Notifications | firebase_messaging |
| Location | geolocator |
| Maps | google_maps_flutter or flutter_map |
| Media | image_picker, file_picker |
| Deep Links | uni_links or go_router deep linking |
| HTTP Client | dio or http |
| Secure Storage | flutter_secure_storage |

### 11.2 React Native Stack

| Layer | Technology |
|-------|------------|
| Framework | React Native (TypeScript) |
| State Management | Zustand, Redux Toolkit, or Jotai |
| Local DB | WatermelonDB, MMKV, or AsyncStorage |
| Push Notifications | @react-native-firebase/messaging |
| Location | react-native-geolocation-service |
| Maps | react-native-maps |
| Media | react-native-image-picker |
| Deep Links | React Navigation deep linking |
| HTTP Client | axios or fetch |
| Secure Storage | react-native-keychain |

---

## 12. Platform-Specific Considerations

### 12.1 Android

- **Min SDK**: 21 (Android 5.0) or 23 (Android 6.0) for broader API support.
- **Permissions**: Location (fine/coarse), Camera, Storage, Notifications.
- **Background services**: For location tracking (Cab module); use WorkManager or foreground service.
- **Play Store**: App signing, release tracks (internal, beta, production).

### 12.2 iOS

- **Min iOS**: 12.0 or 13.0 (for SwiftUI compatibility if using native).
- **Permissions**: Location (when in use / always), Camera, Photo Library, Notifications.
- **Background modes**: Location updates (Cab module), remote notifications.
- **App Store**: App Store Connect, TestFlight for beta, review guidelines compliance.

---

## 13. Testing Strategy

| Type | Tools |
|------|-------|
| Unit tests | Flutter: `flutter_test`; RN: Jest |
| Widget/Component tests | Flutter: `flutter_test`; RN: React Native Testing Library |
| Integration tests | Flutter: `integration_test`; RN: Detox or Appium |
| E2E tests | Appium, Maestro |
| API mocking | Mockito (Flutter), MSW (RN) |

---

## 14. CI/CD Pipeline

- **Build**: Trigger on PR and merge to main.
- **Test**: Run unit and integration tests.
- **Lint**: Enforce code style (Dart analyzer, ESLint).
- **Build artifacts**: APK/AAB (Android), IPA (iOS).
- **Distribution**: Firebase App Distribution, TestFlight, Play Console internal track.
- **Release**: Tag-based release to Play Store and App Store.

---

## 15. Analytics and Monitoring

| Purpose | Tools |
|---------|-------|
| Crash reporting | Firebase Crashlytics, Sentry |
| Analytics | Firebase Analytics, Mixpanel, Amplitude |
| Performance | Firebase Performance Monitoring |
| Logging | Datadog, Logz.io (backend); local logs for debug |

---

## 16. Localization

- Support multiple languages from day one (structure in place).
- Use ARB files (Flutter) or i18next (React Native).
- Right-to-left (RTL) support if targeting Arabic, Hebrew, etc.

---

## 17. Accessibility

- Semantic labels for screen readers (TalkBack, VoiceOver).
- Sufficient color contrast.
- Touch target sizes (min 48x48 dp).
- Test with accessibility scanner tools.

---

## 18. App Size Optimization

- Tree-shaking unused code.
- Compress images and assets.
- Use deferred/lazy loading for features.
- Split APKs by ABI (Android).

---

## 19. Out of Scope for This Spec

- Detailed UI/UX wireframes and design system.
- Backend API implementation (covered in Architecture spec).
- App Store / Play Store submission process (release checklist).
- Marketing and ASO (App Store Optimization).
