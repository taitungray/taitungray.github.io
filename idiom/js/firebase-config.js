// measurementId：Firebase Console → 專案設定 → Web 應用 → measurementId（G-xxxxxxxx）
// 未填時 Analytics 安全略過，Auth／雲端存檔不受影響。
export const firebaseCloudSaveConfig = {
  enabled: true,
  autoAnonymousSignIn: false,
  firebaseConfig: {
    apiKey: "AIzaSyBy9k7XlHl15gz56v4q4QoZo9l76cWQXe0",
    authDomain: "rayon-819bc.firebaseapp.com",
    projectId: "rayon-819bc",
    appId: "1:1051857657382:web:7d4cf72b0d9b9abeb750e7",
    storageBucket: "rayon-819bc.firebasestorage.app",
    messagingSenderId: "1051857657382",
    measurementId: "G-ZW9R89GMWS"
  }
};
