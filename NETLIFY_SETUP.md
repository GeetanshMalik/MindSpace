# Netlify Backend Setup

Use the `main` branch for the Netlify backend. The `website` branch is only for the static GitHub Pages website.

## Build Settings

Fill Netlify's build settings like this:

```text
Branch to deploy: main
Base directory: leave empty
Build command: node netlify/scripts/backend-build.js
Publish directory: netlify/site
Functions directory: netlify/functions
```

These values are also stored in `netlify.toml`.

This deploy is intentionally backend-only. Netlify publishes a tiny status page from `netlify/site`; it does not export or host the mobile app UI.

## Required Environment Variables

Set these in Netlify: Site settings -> Environment variables.

Required for the Netlify functions:

```text
FIREBASE_PROJECT_ID=mindspace33756
FIREBASE_CLIENT_EMAIL=<Firebase service account client_email>
FIREBASE_PRIVATE_KEY=<Firebase service account private_key>
GEMINI_API_KEY=<Gemini API key>
GROQ_API_KEY=<Groq API key>
```

For `FIREBASE_PRIVATE_KEY`, keep the full private key value. If Netlify stores it on one line, use `\n` where the key has line breaks.

Instead of the three Firebase service account fields, you can set one of these:

```text
FIREBASE_SERVICE_ACCOUNT_JSON=<full service account JSON>
FIREBASE_SERVICE_ACCOUNT_BASE64=<base64 encoded service account JSON>
```

Do not commit service account keys to GitHub.

Required in the mobile app build environment after the Netlify site URL exists:

```text
EXPO_PUBLIC_PUSH_RELAY_URL=https://your-netlify-site.netlify.app
```

You do not need `EXPO_PUBLIC_PUSH_RELAY_URL` in Netlify for the backend-only deploy. You need it wherever the mobile app is bundled, such as EAS environment variables or a local `.env.local`.

Optional web app overrides. These are only needed if you later choose to host the Expo web app on Netlify again:

```text
EXPO_PUBLIC_FIREBASE_API_KEY=<Firebase web API key>
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=mindspace33756.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=mindspace33756
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=mindspace33756.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=60731519244
EXPO_PUBLIC_FIREBASE_APP_ID=<Firebase web app ID>
EXPO_PUBLIC_SUPABASE_URL=<Supabase project URL>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<Supabase anon/publishable key>
EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=<Cloudinary cloud name>
EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET=<Cloudinary unsigned upload preset>
```

## Mobile App Configuration

The app reads `EXPO_PUBLIC_PUSH_RELAY_URL` at build time.

For EAS/development builds, set the same value in your EAS environment or local `.env.local`:

```text
EXPO_PUBLIC_PUSH_RELAY_URL=https://your-netlify-site.netlify.app
```

The mobile app also expects these Expo/EAS environment variables:

```text
EXPO_PUBLIC_FIREBASE_API_KEY=<Firebase web API key>
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=mindspace33756.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=mindspace33756
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=mindspace33756.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=60731519244
EXPO_PUBLIC_FIREBASE_APP_ID=<Firebase web app ID>
EXPO_PUBLIC_SUPABASE_URL=<Supabase project URL>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<Supabase anon/publishable key>
EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=<Cloudinary cloud name>
EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET=<Cloudinary unsigned upload preset>
```

`GOOGLE_SERVICES_JSON` should be added as an EAS file variable for every environment you build (`development`, `preview`, and `production`). Use one latest `google-services.json` if all builds use the same Firebase Android app/package.

Do not add Gemini or Groq keys to Expo as `EXPO_PUBLIC_` variables. Sage calls the Netlify `sage-chat` function, and the real AI keys should stay in Netlify only.

Expo Go cannot test Android remote push notifications on SDK 53+. Use a development build for push notification testing.

## Functions Deployed

The app expects these exact endpoints:

```text
/.netlify/functions/register-push-token
/.netlify/functions/unregister-push-token
/.netlify/functions/send-notification
/.netlify/functions/sage-chat
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
