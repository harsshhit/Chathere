# ChatHere

ChatHere is a real-time chat application built with React and Firebase.

## Features

- Email/password and Google authentication
- One-to-one and group chats with live messages
- Message replies, reactions, editing, and deletion
- Emoji and GIF messaging
- User profiles, avatars, and light/dark themes
- Browser notifications and Firebase Cloud Messaging web push
- Responsive installable web app

## Tech Stack

React 18, Create React App, React Router, Tailwind CSS, Framer Motion, Lucide, Firebase Authentication, Cloud Firestore, Firebase Storage, Firebase Cloud Messaging, and Vercel serverless functions.

## Environment Variables

Set these in a local `.env` file for development and in Vercel project settings for deployment. Do not commit secret values.

- `REACT_APP_FIREBASE_API_KEY`
- `REACT_APP_FIREBASE_AUTH_DOMAIN`
- `REACT_APP_FIREBASE_PROJECT_ID`
- `REACT_APP_FIREBASE_STORAGE_BUCKET`
- `REACT_APP_FIREBASE_MESSAGING_SENDER_ID`
- `REACT_APP_FIREBASE_APP_ID`
- `REACT_APP_FIREBASE_MEASUREMENT_ID`
- `REACT_APP_GIF_API_KEY`
- `REACT_APP_FIREBASE_VAPID_KEY`
- `FIREBASE_SERVICE_ACCOUNT_B64` (server-side Vercel function)

## Run Locally

```sh
npm install
npm start
npm run build
```

## Vercel Deployment

Import the repository into Vercel and configure the environment variables above in the project settings. Vercel builds the CRA app and deploys the `/api` serverless function. Keep `FIREBASE_SERVICE_ACCOUNT_B64` server-side and do not expose it as a `REACT_APP_` variable.
