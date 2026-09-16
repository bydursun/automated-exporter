/*
 * Automated Exporter (Demo)
 * Created by Abdullah Dursun
 * https://www.linkedin.com/in/abdullah-dursun41
 *
 * Demo build: targets the fictional "Records Portal" page in demo-site/,
 * not any real product. Shows the same pagination-walk + PDF-export
 * technique as the private tool, without touching real data.
 */

const startBtn = document.getElementById("startBtn");
const clientName = document.getElementById("clientName");
const combineChk = document.getElementById("combineChk");
const progressWrap = document.getElementById("progressWrap");
const barFill = document.getElementById("barFill");
const count = document.getElementById("count");
const log = document.getElementById("log");

let total = 0;

function addLog(msg, cls) {
  log.style.display = "block";
  const d = document.createElement("div");
  if (cls) d.className = cls;
  d.textContent = msg;
  log.appendChild(d);
  log.scrollTop = log.scrollHeight;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function detectPage() {
  let total = 1;
  let subject = "Subject";
  try {
    const sel = document.getElementById("pageJumpSelect");
    const opts = sel ? sel.querySelectorAll("option") : [];
    total = opts.length ? parseInt(opts[opts.length - 1].value, 10) : 1;
  } catch (e) {}
  try {
    const span = document.getElementById("subjectName");
    subject = (span ? span.textContent : "Subject").replace(/\s+/g, " ").trim();
  } catch (e) {}
  return { subject, total };
}

function runExport(combined, html2canvasUrl, jspdfUrl) {
  (async () => {
    const send = (obj) => { try { window.postMessage({ __pdfExport: obj }, "*"); } catch (e) {} };
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));

    const sel0 = document.getElementById("pageJumpSelect");
    const opts = sel0 ? sel0.querySelectorAll("option") : [];
    const TOTAL = opts.length ? parseInt(opts[opts.length - 1].value, 10) : 1;
    const pad = String(TOTAL).length;

    const SUBJECT = (document.getElementById("subjectName")?.textContent || "Subject")
      .replace(/\s+/g, " ").trim().replace(/[\\/:*?"<>|,]/g, "").trim();

    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;

    function loadScript(win, url) {
      return new Promise((res, rej) => {
        const s = win.document.createElement("script");
        s.src = url;
        s.onload = () => res(true);
        s.onerror = () => rej(new Error("fail " + url));
        win.document.head.appendChild(s);
      });
    }
    async function ensureImgLibs(win) {
      if (!win.html2canvas) { try { await loadScript(win, html2canvasUrl); } catch (e) {} }
      if (!win.jspdf) { try { await loadScript(win, jspdfUrl); } catch (e) {} }
      for (let i = 0; i < 25 && (!win.html2canvas || !win.jspdf); i++) await wait(150);
      if (!win.html2canvas || !win.jspdf) throw new Error("image libraries failed to load");
    }

    async function waitForContent(pw, prev) {
      for (let i = 0; i < 20; i++) {
        try {
          const t = pw.document.body ? pw.document.body.innerText.trim() : "";
          if (pw.document.readyState === "complete" && t.length > 0 && t !== prev) return t;
        } catch (e) {}
        await wait(200);
      }
      try { return pw.document.body.innerText.trim(); } catch (e) { return prev; }
    }

    // ============ MODE A: one combined, selectable PDF via browser print ============
    if (combined) {
      send({ type: "LOG", text: `Scanning ${SUBJECT} (${TOTAL} pages)` });
      const bodyParts = [];
      let prevTextA = "";
      for (let page = 1; page <= TOTAL; page++) {
        goToPage(String(page));
        await wait(400);
        document.getElementById("printAllBtn").click();
        await wait(300);

        const pw = window.open("", "recordsPrintWindow");
        if (!pw) { send({ type: "ERROR", text: "Could not get print window" }); return; }
        prevTextA = await waitForContent(pw, prevTextA);

        const b = pw.document.body.cloneNode(true);
        b.querySelectorAll("script,button,input,iframe,noscript").forEach((e) => e.remove());
        bodyParts.push(b.innerHTML);
        send({ type: "PROGRESS", page, total: TOTAL });
      }

      const pw = window.open("", "recordsPrintWindow");
      if (!pw) { send({ type: "ERROR", text: "Print window unavailable" }); return; }

      let headHTML = "";
      try {
        pw.document.querySelectorAll('head link[rel="stylesheet"], head style').forEach((el) => { headHTML += el.outerHTML; });
      } catch (e) {}

      let bodyHTML = "";
      bodyParts.forEach((b, i) => {
        bodyHTML += `<div${i > 0 ? ' style="page-break-before:always;"' : ""}>${b}</div>`;
      });

      const docHTML =
        `<!DOCTYPE html><html><head><title>${SUBJECT} - ${ymd}</title>${headHTML}` +
        `<style>@media print{body{margin:0;}}</style></head><body>${bodyHTML}</body></html>`;

      try {
        pw.document.open();
        pw.document.write(docHTML);
        pw.document.close();
      } catch (e) { send({ type: "ERROR", text: "Could not assemble pages: " + e.message }); return; }

      await wait(500);
      send({ type: "LOG", text: "Opening print dialog — choose “Save as PDF”" });
      try {
        pw.focus();
        pw.print();
      } catch (e) { send({ type: "ERROR", text: "Print failed: " + e.message }); return; }
      send({ type: "DONE" });
      return;
    }

    // ============ MODE B: separate files, fully automatic (image) ============
    send({ type: "LOG", text: `Exporting ${SUBJECT} (${TOTAL} pages)` });
    let prevText = "";

    for (let page = 1; page <= TOTAL; page++) {
      goToPage(String(page));
      await wait(400);
      document.getElementById("printAllBtn").click();
      await wait(300);

      const pw = window.open("", "recordsPrintWindow");
      if (!pw) { send({ type: "ERROR", text: "Could not get print window" }); return; }
      prevText = await waitForContent(pw, prevText);

      try {
        await ensureImgLibs(pw);
        const canvas = await pw.html2canvas(pw.document.body, {
          scale: 2, backgroundColor: "#ffffff",
          useCORS: true, allowTaint: true, imageTimeout: 0, logging: false,
        });
        const { jsPDF } = pw.jspdf;
        const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        const Wmm = 210, Hmm = 297;
        const pxPerMM = canvas.width / Wmm;
        const pageHpx = Math.floor(Hmm * pxPerMM);
        let y = 0, first = true;
        while (y < canvas.height) {
          const sliceH = Math.min(pageHpx, canvas.height - y);
          const c = pw.document.createElement("canvas");
          c.width = canvas.width; c.height = sliceH;
          const ctx = c.getContext("2d");
          ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, sliceH);
          ctx.drawImage(canvas, 0, y, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
          if (!first) doc.addPage();
          doc.addImage(c.toDataURL("image/jpeg", 0.85), "JPEG", 0, 0, Wmm, sliceH / pxPerMM);
          y += sliceH; first = false;
        }
        doc.save(`${SUBJECT} - ${ymd} - Page ${String(page).padStart(pad, "0")}.pdf`);
        send({ type: "PROGRESS", page, total: TOTAL });
      } catch (e) {
        send({ type: "ERROR", text: `Page ${page}: ${e.message}` });
      }
      await wait(500);
    }
    send({ type: "DONE" });
  })();
}

async function init() {
  const tab = await getActiveTab();
  try {
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: detectPage });
    if (result) {
      clientName.textContent = `${result.subject}  (${result.total} page${result.total > 1 ? "s" : ""})`;
      total = result.total;
      startBtn.disabled = false;
    } else {
      clientName.textContent = "Open the demo page first";
    }
  } catch (e) {
    clientName.textContent = "Open the demo page first";
  }
}

startBtn.addEventListener("click", async () => {
  const tab = await getActiveTab();
  const combined = combineChk.checked;
  startBtn.disabled = true;
  startBtn.textContent = "Exporting…";
  progressWrap.style.display = "block";
  count.textContent = `0 / ${total}`;
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: "MAIN",
    func: runExport,
    args: [combined, chrome.runtime.getURL("lib/html2canvas.min.js"), chrome.runtime.getURL("lib/jspdf.umd.min.js")],
  });
});

chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || !msg.type) return;
  if (msg.type === "PROGRESS") {
    barFill.style.width = `${(msg.page / msg.total) * 100}%`;
    count.textContent = `${msg.page} / ${msg.total}`;
    addLog(`Page ${msg.page} done`, "ok");
  } else if (msg.type === "LOG") {
    addLog(msg.text);
  } else if (msg.type === "ERROR") {
    addLog(msg.text, "err");
  } else if (msg.type === "DONE") {
    barFill.style.width = "100%";
    addLog("Done", "ok");
    startBtn.textContent = "Done";
  }
});

init();
