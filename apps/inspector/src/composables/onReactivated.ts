// Bijhorend bij de werk-tabbladen (useTabs.ts): pagina's blijven via
// <keep-alive> in leven, dus onMounted draait nog maar één keer per tabblad.
// Voor lijsten is dat te weinig -- voeg je in tabblad B een klant toe, dan
// staat de lijst in tabblad A anders eeuwig verouderd.
//
// onActivated vuurt in Vue óók bij de eerste weergave; deze wrapper slaat die
// eerste over zodat hij naast een bestaande onMounted(load) gezet kan worden
// zonder dat de pagina bij het openen twee keer laadt.
import { onActivated } from "vue";

export function onReactivated(fn: () => void) {
  let first = true;
  onActivated(() => {
    if (first) {
      first = false;
      return;
    }
    fn();
  });
}
