# MindSpace Setup Instructions

## Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Expo CLI
- Firebase account
- Supabase account
- Cloudinary account
- Gemini API key (Google AI)
- Groq API key

## Installation Steps

### 1. Clone the Repository
```bash
git clone https://github.com/GeetanshMalik/MindSpace.git
cd MindSpace
npm install
```

### 2. Configure API Keys

#### Firebase Configuration
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or use existing one
3. Enable Authentication (Email/Password)
4. Enable Firestore Database
5. Copy `src/services/firebase/config.example.ts` to `src/services/firebase/config.ts`
6. Replace placeholder values with your Firebase credentials

#### Supabase Configuration
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Create a new project
3. Create a storage bucket named `mindspace-files`
4. Set up storage policies (public read, authenticated write/delete)
5. Copy `src/services/supabase/config.example.ts` to `src/services/supabase/config.ts`
6. Replace with your Supabase URL and anon key

#### Cloudinary Configuration
1. Go to [Cloudinary Console](https://cloudinary.com/console)
2. Create an upload preset named `mindspace` (unsigned mode)
3. Copy `src/services/cloudinary/config.example.ts` to `src/services/cloudinary/config.ts`
4. Replace with your cloud name

#### AI Configuration (Gemini & Groq)
1. Get Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Get Groq API key from [Groq Console](https://console.groq.com/)
3. Copy `src/services/ai/aiConfig.example.ts` to `src/services/ai/aiConfig.ts`
4. Replace placeholder API keys with your actual keys

### 3. Run the App

```bash
# Start Expo development server
npx expo start

# Run on Android
npx expo start --android

# Run on iOS
npx expo start --ios

# Run on Web
npx expo start --web
```

## Important Security Notes

⚠️ **NEVER commit the following files to version control:**
- `src/services/ai/aiConfig.ts` (contains private API keys)
- `src/services/firebase/config.ts` (contains Firebase credentials)
- `src/services/supabase/config.ts` (contains Supabase credentials)
- `src/services/cloudinary/config.ts` (contains Cloudinary credentials)
- `google-services.json` (Android Firebase config)
- `GoogleService-Info.plist` (iOS Firebase config)

These files are already in `.gitignore` to prevent accidental commits.

## Project Structure

```
mindspace-project/
├── src/
│   ├── components/       # Reusable UI components
│   ├── screens/          # App screens
│   ├── services/         # API and service integrations
│   ├── navigation/       # Navigation configuration
│   ├── store/            # State management (Zustand)
│   ├── theme/            # Theme and styling
│   ├── i18n/             # Internationalization
│   └── utils/            # Utility functions
├── assets/               # Images, fonts, sounds
└── App.tsx               # Root component
```

## Features

- 🔐 **Authentication**: Email/Password with Firebase
- 📝 **Mood Journal**: Private diary with mood tracking
- 🧘 **Calm Room**: Guided breathing exercises and ambient sounds
- 💬 **AI Chat**: Sage - Your mindful AI companion
- 👥 **Community**: Anonymous peer support
- 📊 **Self Assessment**: Mental wellness check-ins
- 🌍 **Multi-language**: Support for 9 languages
- 🎨 **Themes**: Light and Dark mode

## Support

For issues or questions, please open an issue on GitHub or contact support.

## License

This project is private and proprietary.
