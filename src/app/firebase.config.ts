const firebaseConfig = {
  apiKey: 'AIzaSyDEIBk4bsXR_ZWeDpWf1VNFex4UZ-YAawM',
  authDomain: 'tripplan0123.firebaseapp.com',
  projectId: 'tripplan0123',
  storageBucket: 'tripplan0123.firebasestorage.app',
  messagingSenderId: '850565009387',
  appId: '1:850565009387:web:375b648b6f128799db53ae',
};

/** 動態載入 Firebase，避免初始 bundle 包含 ~1.4 MB 的 Firebase SDK */
export async function loadFirebase() {
  const [{ initializeApp }, { getFirestore }, { getAuth, signInAnonymously, onAuthStateChanged }] =
    await Promise.all([
      import('firebase/app'),
      import('firebase/firestore'),
      import('firebase/auth'),
    ]);

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const auth = getAuth(app);

  // 匿名登入
  const user = await new Promise<import('firebase/auth').User>((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, (u) => {
      unsub();
      if (u) { resolve(u); }
      else { signInAnonymously(auth).then(c => resolve(c.user)).catch(reject); }
    }, reject);
  });

  return { db, auth, user };
}

export type FirebaseInstance = Awaited<ReturnType<typeof loadFirebase>>;
