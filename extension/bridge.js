/*
 * Automated Exporter (Demo)
 * Created by Abdullah Dursun
 * https://www.linkedin.com/in/abdullah-dursun41
 */

// Runs in the isolated content-script world on the demo page.
// Its only job: relay progress messages that the exported (MAIN-world)
// script posts via window.postMessage up to the extension popup.
window.addEventListener("message", (e) => {
  if (e.source === window && e.data && e.data.__pdfExport) {
    try {
      chrome.runtime.sendMessage(e.data.__pdfExport);
    } catch (err) {
      // popup closed - safe to ignore
    }
  }
});
