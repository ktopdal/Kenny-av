export { initializeApp } from 'firebase/app';
export { getAuth, onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, signOut } from 'firebase/auth';
export { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore/lite';
