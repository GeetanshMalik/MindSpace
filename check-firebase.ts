import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDkJvHwfNDeDbMrudpZdjyVM36FkiwrReM",
  authDomain: "mindspace-malik.firebaseapp.com",
  projectId: "mindspace-malik",
  storageBucket: "mindspace-malik.firebasestorage.app",
  messagingSenderId: "464572353037",
  appId: "1:464572353037:web:b556f1ebe950c01df56344",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const collectionsToTest = [
  'users',
  'posts',
  'communities',
  'stories',
  'notifications',
  'direct_messages',
];

async function checkFirebase() {
  console.log('Testing Firebase Firestore connections...');
  let hasErrors = false;
  
  for (const col of collectionsToTest) {
    try {
      console.log(`Checking collection: ${col}...`);
      const snap = await getDocs(collection(db, col));
      console.log(`✅ Success for ${col}! Found ${snap.docs.length} docs.`);
    } catch (e: any) {
      hasErrors = true;
      console.error(`❌ Error accessing ${col}: ${e.message}`);
    }
  }
  
  if (hasErrors) {
    console.log('\n--- BUGS FOUND ---');
    console.log('The Firebase Rules are currently denying read access to the database.');
    console.log('To resolve this, we must configure firestore.rules to allow access, or run "firebase deploy".');
  } else {
    console.log('\n✅ No permission errors found in collections');
  }
  process.exit(0);
}

checkFirebase();
