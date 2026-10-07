# ChatHere — Full Project Context

> **Purpose of this document:** A complete, self-contained snapshot of the ChatHere codebase (tech stack, architecture, data model, design system, features, and known issues). Paste it into an AI assistant to get improvement / feature suggestions that can then be implemented with **Google Antigravity** (an agentic AI coding IDE that can read/edit files and run commands in this repo).

---

## 1. Overview

| Item | Value |
|---|---|
| Name | **ChatHere** (package name: `chatapp`, v0.1.0) |
| Type | Real-time 1:1 and group chat web app (SPA) |
| Repo | https://github.com/harsshhit/Chathere |
| Live | https://chat-here-eta.vercel.app (hosted on **Vercel**) |
| Dev OS | Windows, PowerShell |
| Node | `20.x` (set in `package.json` `engines`) |
| Run | `npm start` (dev, port 3000) · `npm run build` (prod) |

---

## 2. Tech Stack

### Frontend
| Tech | Version | Usage |
|---|---|---|
| React | ^18.2.0 | UI library (function components + hooks only) |
| Create React App (`react-scripts`) | 5.0.1 | Build tooling (Webpack). **No Vite.** |
| React Router DOM | ^6.8.0 | Routing (`BrowserRouter`, v7 future flags enabled) |
| Tailwind CSS | ^3.4.15 (dev) | Utility styling (CRA picks up `tailwind.config.js` natively; no `postcss.config.js`) |
| Framer Motion | ^11.11.17 | All animations (`motion.*`, `AnimatePresence`) |
| lucide-react | ^0.461.0 | Primary icon set |
| react-icons | ^4.10.1 | Installed, barely/not used |
| emoji-picker-react | ^4.12.0 | Emoji picker in message input (dark theme) |
| uuid | ^9.0.0 | Message IDs and group IDs |
| sass | ^1.58.0 | Installed; `src/style.scss` is essentially empty (legacy) |
| web-vitals | ^2.1.4 | CRA default |
| Testing Library (jest-dom, react, user-event) | CRA defaults | **No tests written** |

- **Language:** Plain JavaScript (`.js` / `.jsx`), **no TypeScript**.
- **State management:** React Context API + `useReducer` (no Redux/Zustand).
- **Code splitting:** All pages are `React.lazy` + `Suspense`.

### Backend / Services (Firebase v9 modular SDK, ^9.16.0)
- **Firebase Authentication** — Email/Password + Google (popup).
- **Cloud Firestore** — all data, realtime via `onSnapshot`.
- **Firebase Storage** — avatar uploads.
- No Cloud Functions, no custom server, no security rules file in repo.

### External APIs
- **Tenor GIF API v1** (`g.tenor.com/v1/search` and `/v1/trending`) — key is **hard-coded** in `GifPicker.jsx`.
- **ui-avatars.com** — fallback avatar images (`https://ui-avatars.com/api/?name=...&background=random`).
- **Browser Notification API** + **Web Audio API** (synthesized "ding" sound).

### Environment variables (`.env`, gitignored; template in `.env.example`)
```
REACT_APP_FIREBASE_API_KEY
REACT_APP_FIREBASE_AUTH_DOMAIN
REACT_APP_FIREBASE_PROJECT_ID
REACT_APP_FIREBASE_STORAGE_BUCKET
REACT_APP_FIREBASE_MESSAGING_SENDER_ID
REACT_APP_FIREBASE_APP_ID
REACT_APP_FIREBASE_MEASUREMENT_ID
```

---

## 3. Folder Structure

```
Chathere/
├── public/index.html          # CRA shell (also loads "Open Sans" font – legacy/conflicting)
├── src/
│   ├── index.js               # Root: AuthContextProvider > ChatContextProvider > StrictMode > App
│   ├── App.js                 # Routes + ProtectedRoute + UIProvider + lazy pages
│   ├── firebase.js            # initializeApp; exports app, auth, storage, db, googleProvider
│   ├── index.css              # Tailwind layers + CSS variables + component classes (design system)
│   ├── style.scss             # legacy, ~empty
│   ├── reportWebVitals.js
│   ├── context/
│   │   ├── AuthContext.js     # currentUser via onAuthStateChanged
│   │   ├── ChatContext.js     # selected chat {chatId, user} via useReducer
│   │   ├── UIContext.jsx      # isMobileView toggle (sidebar vs chat on mobile)
│   │   └── ThemeContext.jsx   # EMPTY file (placeholder)
│   ├── pages/
│   │   ├── Home.jsx           # Sidebar + Chat split layout (responsive)
│   │   ├── Login.jsx          # Email/password + Google login
│   │   ├── Register.jsx       # Sign-up with optional avatar, password strength meter
│   │   ├── Profile.jsx        # Edit avatar/name/bio, notifications toggle, logout
│   │   └── NotFound.jsx       # 404
│   ├── components/
│   │   ├── Sidebar.jsx        # Navbar + Search + Chats
│   │   ├── Navbar.jsx         # Brand, "New Group" button, profile button
│   │   ├── Search.jsx         # User search (debounced 300ms)
│   │   ├── Chats.jsx          # Conversation list, unread badges, archive, notifications
│   │   ├── Chat.jsx           # Chat header, Messages, Input, user/group info modal
│   │   ├── Messages.jsx       # Realtime message list, typing indicator, read receipts
│   │   ├── Message.jsx        # Single bubble: text/GIF/image, edit, delete, download, ticks
│   │   ├── Input.jsx          # Text input, emoji picker, GIF picker, send, typing status
│   │   ├── GifPicker.jsx      # Tenor search/trending grid
│   │   ├── CreateGroup.jsx    # Modal: name + member multi-select
│   │   ├── Avatar.jsx         # <img> with ui-avatars fallback on error
│   │   └── logo.png
│   ├── theme/colors.js        # LIGHT theme palette – currently UNUSED
│   ├── utils/notifications.js # permission, sound, showNotification, tab-title unread count
│   └── img/                   # Legacy PNG icons/wallpapers (mostly unused now)
├── tailwind.config.js
├── .env / .env.example
├── index.html, script.js, styles.css   # 1-byte EMPTY files at root (junk)
└── package.json
```

---

## 4. Routing

| Path | Component | Protected |
|---|---|---|
| `/` (index) | `Home` | ✅ |
| `/login` | `Login` | ❌ |
| `/register` | `Register` | ❌ |
| `/profile` | `Profile` | ✅ |
| `*` | `NotFound` | ❌ |

`ProtectedRoute` redirects to `/login` when `currentUser` is falsy. Suspense fallback = centered spinning `Loader2`.

---

## 5. State / Contexts

- **AuthContext** → `{ currentUser, error }`. Renders plain `<div>Loading...</div>` (unstyled) until Firebase auth resolves.
- **ChatContext** → `{ data: { chatId, user }, dispatch }`. Only action: `CHANGE_USER`.
  - 1:1 chatId = concatenation of both UIDs, larger UID first: `uidA > uidB ? uidA+uidB : uidB+uidA`.
  - Group chatId = `group_<uuid>` (stored as `user.uid` with `user.isGroup = true`).
  - ⚠️ Initial `chatId` is the **string `"null"`** (truthy).
- **UIContext** → `{ isMobileView, setIsMobileView }`. `true` = show sidebar on mobile; `false` = show chat.

---

## 6. Firestore Data Model

### `users/{uid}`
```js
{ uid, displayName, email, photoURL, bio? }
```

### `userChats/{uid}` — one doc per user; a map keyed by chatId
```js
{
  [chatId]: {
    userInfo: {                      // 1:1 → other user's snapshot
      uid, displayName, photoURL,
      // group → full group object:
      isGroup?: true, members?: [{uid, displayName, photoURL}], admin?: uid
    },
    lastMessage: { text, senderId, date /* ms number */ },
    date: serverTimestamp,
    unread: number,                  // incremented for recipients
    isArchived?: boolean
  }
}
```

### `chats/{chatId}` — ALL messages in a single document array
```js
{
  messages: [
    { id /*uuid*/, text, senderId, senderName, senderPhoto,
      date /*Timestamp*/, img? /*GIF/image URL*/, editedAt? /*ms*/ }
  ],
  typing:   { [uid]: boolean },
  lastRead: { [uid]: ms number }
}
```

### Storage paths
- Registration avatar: `/{displayName}-{timestamp}`
- Profile avatar update: `/profile_pictures/{uid}`

---

## 7. Features (current behaviour)

### Auth
- Email/password signup (validation: name required, email regex, password ≥ 6) with optional avatar (≤ 5 MB) and a password-strength bar (length-based only).
- Google sign-in/up via popup; creates `users` + `userChats` docs if missing.
- Firebase error codes mapped to friendly messages.

### Messaging
- Realtime 1:1 and group chats via `onSnapshot` on `chats/{chatId}`.
- Send text (Enter to send), emoji picker, GIFs (Tenor).
- Edit and delete own messages (reads full array, rewrites it).
- "(edited)" label, time display (HH:MM).
- **Read receipts**: single ✓ / double ✓✓ (blue) based on `lastRead` vs message time. Marks read when window focused.
- **Typing indicator**: `typing.{uid}=true` on keystroke, auto-false after 2 s; 3 bouncing dots.
- Images/GIFs: click to expand inline, download button when expanded.
- Auto-scroll to bottom on new messages.

### Chat list (sidebar)
- Sorted by latest activity, last message preview ("You: …"), smart timestamps (time / "Yesterday" / "Mon DD").
- Unread count badge (pulsing), bold styling, unread dot on avatar.
- Archive / unarchive (hover button), "Archived (n)" folder view.
- Total unread shown in browser tab title: `(3) ChatHere`.

### Search & Groups
- Search users by display name (substring, case-insensitive) — **fetches the entire `users` collection client-side**.
- Create group: name + multi-select members; creator becomes `admin`; group avatar from ui-avatars.
- Group info modal lists members with an "Admin" badge. No add/remove/leave/rename.

### Profile
- Change avatar (upload progress %, then `window.location.reload()`), edit display name (≥ 2 chars), edit bio, enable browser notifications, logout with confirm, "Member since" date.

### Notifications
- Browser notifications + synthesized sound for incoming messages (from both `Chats.jsx` and `Messages.jsx`).

### Responsive layout
- Mobile: either sidebar or chat full-screen, back arrow in chat header.
- Desktop (`md+`): sidebar fixed width 320 / 360 / 380 px (md / lg / xl) + flexible chat pane.

---

## 8. Design System / Style Scheme

**Theme:** Dark-only, premium "indigo-violet glow" aesthetic with glassmorphism, gradients and soft glows.

### Colour tokens (`:root` in `src/index.css`, mirrored in `tailwind.config.js`)
| Token | Value | Use |
|---|---|---|
| `--primary` | `#6366f1` (indigo-500) | Buttons, sent bubbles, focus rings |
| `--primary-dark` | `#4f46e5` (indigo-600) | Gradient end |
| `--primary-light` | `#818cf8` (indigo-400) | Links, active icons, accents |
| `--accent` | `#a78bfa` (violet-400) | Secondary glow |
| `--surface` | `#0f0f17` | App background |
| `--surface-2` | `#16161f` | Sidebar, header, input bar |
| `--surface-3` | `#1e1e2e` | Inputs, cards |
| `--surface-4` | `#262636` | Received bubbles |
| `--border` | `rgba(255,255,255,0.07)` | Dividers |
| `--border-light` | `rgba(255,255,255,0.12)` | Input borders |
| `--text-primary` | `#f1f1f7` | Main text |
| `--text-secondary` | `#a3a3b8` | Secondary text |
| `--text-muted` | `#6b6b82` | Placeholders, timestamps |
| `--glow` | `rgba(99,102,241,0.3)` | Shadows |
| Success / online | `#22c55e` | Online dot, strong password |
| Error | `#ef4444` / `text-red-400` | Errors |

Text gradient: `linear-gradient(135deg, #818cf8, #a78bfa, #c084fc)`.

### Typography
- **Inter** (300–800) — body/UI (applied globally).
- **Plus Jakarta Sans** (400–800) — brand logo `.brand-logo` (700, letter-spacing −0.03em).
- (Legacy: `public/index.html` also loads **Open Sans** — conflicting, should be removed.)

### Shape & spacing
- Heavy rounding: `rounded-xl` (inputs/buttons), `rounded-2xl` (avatars/cards), `1.5rem` glass cards, `rounded-full` chat input.
- Message bubbles: `1.25rem` radius with a 0.25rem "tail" corner (bottom-right for sent, bottom-left for received).
- Thin 4px indigo scrollbars.

### Reusable CSS component classes (`@layer components`)
`.auth-input`, `.auth-btn-primary` (indigo gradient + glow, lifts on hover), `.auth-btn-google`, `.glass-card` (blur 20px, translucent surface), `.msg-bubble-sent` (gradient), `.msg-bubble-received`, `.chat-item`, `.search-input`, `.status-online`, `.brand-logo`, `.chat-input`, `.icon-btn`, `.send-btn`, `.auth-divider`.

Utilities: `.text-gradient`, `.surface-glow`, `.hover-lift`, `.auth-bg` (animated floating radial orbs), `.shimmer`.

### Tailwind extensions
- Colours: `primary.{DEFAULT,dark,light}`, `accent`, `surface.{DEFAULT,2,3,4}`.
- Fonts: `font-inter`, `font-jakarta`.
- Animations: `float`, `pulse-slow`, `spin-slow`, `fade-in`, `slide-up`.
- Shadows: `shadow-glow`, `shadow-glow-lg`. `backdropBlur.xs`.

### Motion conventions (Framer Motion)
- Entry: `opacity 0→1`, `y 10→0`, ~0.2–0.3 s.
- Lists: staggered `delay: index * 0.03`.
- Modals: spring (`stiffness 300, damping 28`), scale 0.92→1, blurred black backdrop.
- Buttons: `whileHover scale 1.03–1.05`, `whileTap 0.95–0.97`.
- Auth pages: `fadeUp` variant with custom index stagger, ease `[0.22, 1, 0.36, 1]`.

### Styling approach (mixed)
Tailwind utility classes **+** CSS variables via inline `style={{ ... }}` **+** custom component classes. Many colours are inline styles rather than Tailwind tokens.

---

## 9. Known Issues, Bugs & Tech Debt (observed in code)

### Architecture / scalability
1. **All messages in one Firestore doc array** (`chats/{chatId}.messages`) → hits the **1 MB document limit**, downloads the whole history on every change, no pagination, and edit/delete rewrite the whole array (race conditions / lost updates).
2. **User search downloads the entire `users` collection** and filters client-side (cost + privacy issue).
3. Heavy **denormalisation**: user/group info copied into every `userChats` entry; profile name/photo changes and group changes are **not propagated** (stale names/avatars).
4. Group membership has no add/remove/leave/rename/delete; `admin` field is unused beyond the badge.
5. No Firestore / Storage **security rules** checked into the repo.
6. **Create React App is deprecated** — migration to Vite is recommended.

### Bugs
7. `ChatContext` initial `chatId` is the string `"null"` (truthy) → checks like `data.chatId ? ...` behave incorrectly before a chat is selected.
8. **Duplicate notifications/sounds**: both `Chats.jsx` and `Messages.jsx` fire `showNotification` for the same incoming message.
9. `AuthContext` initial `currentUser` is `{}` and the loading screen is an unstyled `Loading...` div.
10. `ProtectedRoute` is defined inside `App` render (re-created every render).
11. Profile avatar change uses `window.location.reload()` instead of updating state.
12. Registration avatar stored at root with a `displayName`-based filename (collisions, not tied to uid).
13. Tenor **API v1** with a **hard-coded public key** (v1 is legacy; should move to Tenor v2 / GIPHY with key in env).
14. Group `unread` increments run sequentially in a `for` loop with `updateDoc().catch(setDoc)` fallback (slow, non-atomic). Should use `writeBatch`.
15. `typing` writes to Firestore on **every keystroke** (no throttle) → many writes.
16. `Messages` sets `lastRead` using `Date.now()` client time (clock skew issues).

### Missing vs README claims
17. README mentions **image upload** & **online/presence status**, but `Input.jsx` currently only supports text/emoji/GIF (no attachment button), and there is **no presence system** (the `.status-online` CSS class exists but is unused).

### Cleanup
18. Unused/empty files: root `index.html`, `script.js`, `styles.css` (1 byte each), `src/context/ThemeContext.jsx` (empty), `src/style.scss`, `src/theme/colors.js` (light palette unused), most of `src/img/*`, `react-icons`, `sass` deps, Open Sans font in `public/index.html`.
19. No tests, no TypeScript, no ESLint/Prettier config beyond CRA default, no CI.
20. SEO/PWA: minimal meta tags, `theme-color` is `#000000`, no manifest customization, no Open Graph tags.
21. Accessibility: many icon-only buttons lack `aria-label`; `window.confirm` / `alert` used for UX.

---

## 10. Ideas / Possible Next Features (for discussion)

- Move messages to a **subcollection** `chats/{chatId}/messages/{msgId}` with `orderBy(date).limitToLast(N)` pagination (infinite scroll up).
- **Image/file attachments** with Storage upload + progress + client-side compression.
- **Online presence / last seen** (Firebase Realtime Database `onDisconnect` or Firestore heartbeat).
- Message **reactions**, **replies/quotes**, **forward**, **pin**, **search within chat**, **delete for everyone vs me**.
- **Voice notes**, link previews, markdown/code formatting.
- Group management: add/remove members, rename, change avatar, leave, multiple admins.
- **Light/Dark theme toggle** (ThemeContext + `theme/colors.js` already stubbed).
- **PWA** + **Firebase Cloud Messaging** push notifications (works when tab closed).
- Server-side search (Algolia/Typesense, or a `displayNameLower` + prefix query).
- Firestore & Storage **security rules**; Cloud Functions for fan-out of lastMessage/unread.
- Migrate **CRA → Vite**, add **TypeScript**, ESLint/Prettier, Vitest + React Testing Library, GitHub Actions CI.
- Skeleton loaders (`.shimmer` exists), toast system to replace `alert/confirm`.
- Block/report users, end-to-end encryption (stretch).

---

## 11. Constraints & Preferences for Suggestions

- Keep **Firebase** as the backend (Auth + Firestore + Storage) unless a strong reason is given.
- Keep the **existing dark indigo/violet design language**, Framer Motion animations and lucide icons.
- Deployment target: **Vercel** (static SPA; env vars prefixed `REACT_APP_`, or `VITE_` if migrated).
- Changes will be implemented by **Google Antigravity** (an agentic coding assistant working directly in this repo on Windows/PowerShell). Suggestions are most useful when broken into **small, ordered, independently testable steps**, each naming the files to change and the acceptance criteria.

---

## 12. Suggested Prompt to Use With This Doc

```
Above is the full context of my React + Firebase chat app "ChatHere".
1. Review the architecture and the "Known Issues" list. Rank the top 10
   improvements by impact vs effort.
2. Propose a phased roadmap (Phase 1: critical fixes, Phase 2: scalability,
   Phase 3: new features, Phase 4: polish/DX).
3. For each item, give: goal, files affected, Firestore schema changes,
   step-by-step implementation plan, and acceptance criteria.
4. Write each step as a ready-to-paste prompt I can give to Google
   Antigravity (an agentic AI IDE that edits my repo directly).
Keep the existing dark indigo design system and Firebase backend.
```
