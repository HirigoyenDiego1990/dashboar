import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged} 
  from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";


  // Your web app's Firebase configuration
  const firebaseConfig = {
    apiKey: "AIzaSyCX7pRLWvnUrK2txyTHk_ZFE_ujmVs4HiM",
    authDomain: "finanzas-app-af367.firebaseapp.com",
    projectId: "finanzas-app-af367",
    storageBucket: "finanzas-app-af367.firebasestorage.app",
    messagingSenderId: "592476181589",
    appId: "1:592476181589:web:fe0180b384abd0a06bf0dc"
  };

  // Initialize Firebase
const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Si el usuario YA está logueado, lo mandamos directo al dashboard (index.html)
onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.href = "index.html";
  }
});

// Evento de clic en el botón de Google
document.getElementById("btnLogin").addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, provider);
    window.location.href = "index.html";
  } catch (error) {
    console.error("Error al iniciar sesión:", error);
    Swal.fire("Error", "No se pudo iniciar sesión. Intentalo de nuevo.", "error");
  }
});