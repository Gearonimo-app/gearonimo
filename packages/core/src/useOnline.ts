import { ref } from "vue";

// Module-niveau, zelfde patroon als useAuth.ts: één gedeelde online/offline-
// status voor de hele app, de listener wordt één keer geregistreerd.
const isOnline = ref(typeof navigator !== "undefined" ? navigator.onLine : true);

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    isOnline.value = true;
  });
  window.addEventListener("offline", () => {
    isOnline.value = false;
  });
}

export function useOnline() {
  return { isOnline };
}
