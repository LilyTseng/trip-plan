import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged, Auth, User } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyDEIBk4bsXR_ZWeDpWf1VNFex4UZ-YAawM',
  authDomain: 'tripplan0123.firebaseapp.com',
  projectId: 'tripplan0123',
  storageBucket: 'tripplan0123.firebasestorage.app',
  messagingSenderId: '850565009387',
  appId: '1:850565009387:web:375b648b6f128799db53ae',
};

export const firebaseApp = initializeApp(firebaseConfig);
export const db = getFirestore(firebaseApp);
export const auth: Auth = getAuth(firebaseApp);

/** 自動匿名登入，回傳已登入的 User */
export function ensureAuth(): Promise<User> {
  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      if (user) {
        resolve(user);
      } else {
        signInAnonymously(auth).then(cred => resolve(cred.user)).catch(reject);
      }
    }, reject);
  });
}
