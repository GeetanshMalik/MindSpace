# Netlify Backend Setup

Use the `main` branch for the Netlify backend. The `website` branch is only for the static GitHub Pages website.

## Build Settings

Fill Netlify's build settings like this:

```text
Branch to deploy: main
Base directory: leave empty
Build command: npx expo export -p web
Publish directory: dist
Functions directory: netlify/functions
```

These values are also stored in `netlify.toml`.

## Required Environment Variables

Set these in Netlify: Site settings -> Environment variables.

```text
FIREBASE_PROJECT_ID=mindspace33756
FIREBASE_CLIENT_EMAIL=<Firebase service account client_email>
FIREBASE_PRIVATE_KEY=<Firebase service account private_key>
EXPO_PUBLIC_PUSH_RELAY_URL=https://your-netlify-site.netlify.app
```

For `FIREBASE_PRIVATE_KEY`, keep the full private key value. If Netlify stores it on one line, use `\n` where the key has line breaks.

Instead of the three Firebase service account fields, you can set one of these:

```text
FIREBASE_SERVICE_ACCOUNT_JSON=<full service account JSON>
FIREBASE_SERVICE_ACCOUNT_BASE64=<base64 encoded service account JSON>
```

Do not commit service account keys to GitHub.

## Mobile App Configuration

The app reads `EXPO_PUBLIC_PUSH_RELAY_URL` at build time.

For EAS/development builds, set the same value in your EAS environment or local `.env.local`:

```text
EXPO_PUBLIC_PUSH_RELAY_URL=https://your-netlify-site.netlify.app
```

Expo Go cannot test Android remote push notifications on SDK 53+. Use a development build for push notification testing.

## Functions Deployed

The app expects these exact endpoints:

```text
/.netlify/functions/register-push-token
/.netlify/functions/unregister-push-token
/.netlify/functions/send-notification
```

Each endpoint requires a Firebase Auth ID token in:

```text
Authorization: Bearer <idToken>
```

## Firebase Rules

Deploy Firestore rules and indexes after pushing:

```text
npm run deploy:rules
npm run deploy:indexes
```

The Netlify functions use Firebase Admin, so they can write private push-token documents even when client rules are strict.
