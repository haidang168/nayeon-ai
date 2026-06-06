import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, onSnapshot, collection, addDoc, getDocs, query, orderBy } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCRdkickD1rgmydDCQ0a_VCofOxjPDbswE",
  authDomain: "nayeon-ee3af.firebaseapp.com",
  projectId: "nayeon-ee3af",
  storageBucket: "nayeon-ee3af.firebasestorage.app",
  messagingSenderId: "47355302626",
  appId: "1:47355302626:web:4fe8c749196715d24444bb"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

const USER_ID = "admin_user_v1";

// Helpers to save and load data
export const syncDataToCloud = async (data: any) => {
  try {
    const userRef = doc(db, "users", USER_ID);
    await setDoc(userRef, data, { merge: true });
  } catch (error: any) {
    console.error("Lỗi đồng bộ dữ liệu lên Firebase:", error);
    if (error?.message?.includes("Missing or insufficient permissions")) {
      // Show alert only once to prevent spam
      if (!(window as any).hasAlertedFirebase) {
        (window as any).hasAlertedFirebase = true;
        alert("LỖI ĐỒNG BỘ: Firebase của bạn đã hết hạn Test Mode (30 ngày) nên chặn toàn bộ quyền ghi/đọc.\n\nVui lòng vào Firebase Console -> Firestore Database -> Rules (Quy tắc) và đổi thành:\nallow read, write: if true;");
      }
    }
  }
};

export const loadDataFromCloud = async () => {
  try {
    const userRef = doc(db, "users", USER_ID);
    const docSnap = await getDoc(userRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
  } catch (error) {
    console.error("Lỗi tải dữ liệu từ Firebase:", error);
  }
  return null;
};

export const subscribeToCloudData = (callback: (data: any) => void) => {
  const userRef = doc(db, "users", USER_ID);
  return onSnapshot(userRef, (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data());
    }
  }, (error) => {
    console.error("Lỗi realtime Firebase:", error);
  });
};

// Exam Helpers
export const addExamToCloud = async (type: 'reading' | 'writing' | 'listening', examData: any) => {
  try {
    const colRef = collection(db, `${type}_exams`);
    await addDoc(colRef, {
      ...examData,
      createdAt: new Date().toISOString()
    });
    return true;
  } catch (error) {
    console.error("Lỗi thêm đề thi:", error);
    return false;
  }
};

export const loadExamsFromCloud = async (type: 'reading' | 'writing' | 'listening') => {
  try {
    const colRef = collection(db, `${type}_exams`);
    const q = query(colRef, orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    const exams: any[] = [];
    querySnapshot.forEach((doc) => {
      exams.push({ id: doc.id, ...doc.data() });
    });
    return exams;
  } catch (error) {
    console.error("Lỗi tải đề thi:", error);
    return [];
  }
};
