// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDg6gNxZDLeK9g6eQ8VQQN_csQr941J0eo",
  authDomain: "gen-lang-client-0517043121.firebaseapp.com",
  projectId: "gen-lang-client-0517043121",
  storageBucket: "gen-lang-client-0517043121.appspot.com",
  messagingSenderId: "182474599952",
  appId: "1:182474599952:web:1e77ac66133f4589326495"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);
