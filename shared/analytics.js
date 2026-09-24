/**
 * AISharedResponsibility.com — GoatCounter pageview beacon
 *
 * Aggregate, cookieless counts only. No assessment or wizard state is sent.
 * Site code: aisharedresponsibility
 * Apache-2.0
 */
(function () {
  if (window.__srfGoatCounterLoaded) return;
  window.__srfGoatCounterLoaded = true;

  var s = document.createElement("script");
  s.async = true;
  s.dataset.goatcounter =
    "https://aisharedresponsibility.goatcounter.com/count";
  s.src = "https://gc.zgo.at/count.js";
  document.head.appendChild(s);
})();
