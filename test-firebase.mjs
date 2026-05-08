import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCRdkickD1rgmydDCQ0a_VCofOxjPDbswE",
  authDomain: "nayeon-ee3af.firebaseapp.com",
  projectId: "nayeon-ee3af",
  storageBucket: "nayeon-ee3af.firebasestorage.app",
  messagingSenderId: "47355302626",
  appId: "1:47355302626:web:4fe8c749196715d24444bb"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function test() {
  try {
    const docSnap = await getDoc(doc(db, "users", "admin_user_v1"));
    if (docSnap.exists()) {
      const data = docSnap.data();
      console.log('Firebase Dictation Lessons:', data.dictationLessons?.length);
      console.log('Firebase SRS:', data.dictationSrs?.length);
    } else {
      console.log('Document does not exist in Firebase');
    }
  } catch (e) {
    console.error('Firebase error:', e);
  }
}

test();
