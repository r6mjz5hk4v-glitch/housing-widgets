// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: orange; icon-glyph: home;

// ---- Shared settings (saved on this phone by the Setup script) ----
// Keys and personal settings live in the phone's keychain, not in this file,
// so the file can be shared as is.
function setting(key, fallback) {
  try { if (Keychain.contains(key)) { const v = Keychain.get(key); if (v) return v; } } catch (e) {}
  return fallback;
}


// Payment vs N Years Ago for Scriptable
// How much more (or less) the monthly payment on a typical home costs than
// the same month N years earlier, split into the part due to home prices and
// the part due to the mortgage rate. Principal and interest, 20% down,
// 30-year fixed. Home values: Zillow Home Value Index (typical home, smoothed,
// seasonally adjusted), the free monthly file from Zillow Research. Rate:
// Freddie Mac's 30-year fixed (FRED: MORTGAGE30US), averaged by month.
// Price effect = payment at today's price and the old rate, minus the old
// payment; rate effect = the rest (same split as the Home Economics chart).
// Small widget: the U.S. total and the price / rate split. Look-back is 10
// years; type 1, 2 or 5 in the widget's Parameter box to change it.
// Tap for the full screen: 1Y / 2Y / 5Y / 10Y, the U.S. chart, and a second
// chart for any of the largest metros (opens on Austin). Share as PDF.

// ---- Update check (once a day; one shared request for all the Housing Widgets) ----
// When GitHub has a newer version of this widget: a thin yellow glow around the
// widget face, and an "Update ready" card in the full view with a Run Installer button.
const UPD_REPO = "r6mjz5hk4v-glitch/housing-widgets";
const UPD_CACHE = "housing-widgets-update.json";
function updHash(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(16); }
// the code from the title line down: Scriptable rewrites the icon lines above it, so they don't count
function updBody(src, sig) { const t = src.replace(/\r\n/g, "\n"), i = t.indexOf(sig); return (i >= 0 ? t.slice(i) : t).replace(/\s+$/, ""); }
function updOwnSource() {
  const fms = [FileManager.local()];
  try { fms.push(FileManager.iCloud()); } catch (e) {}
  for (const f of fms) { try { const s = f.readString(module.filename); if (s) return s; } catch (e) {} }
  return "";
}
async function updFetch(fm, p) {
  const r = new Request("https://raw.githubusercontent.com/" + UPD_REPO + "/main/manifest.json?t=" + Date.now());
  r.timeoutInterval = 8;
  const m = await r.loadJSON();
  if (!m || !m.files) throw new Error("no manifest");
  const c = { at: Date.now(), files: m.files.filter((f) => f.sig && f.hash).map((f) => ({ sig: f.sig, hash: f.hash })) };
  fm.writeString(p, JSON.stringify(c));
  return c;
}
async function updCheck(fetchNow) {
  const fm = FileManager.local(), p = fm.joinPath(fm.documentsDirectory(), UPD_CACHE);
  let c = null;
  try { if (fm.fileExists(p)) c = JSON.parse(fm.readString(p)); } catch (e) {}
  if (!c || Date.now() - (c.at || 0) > 864e5) {
    if (fetchNow) {
      try { c = await updFetch(fm, p); }
      catch (e) { if (c) { c.at = Date.now(); try { fm.writeString(p, JSON.stringify(c)); } catch (e2) {} } } // offline: try again tomorrow
    } else updFetch(fm, p).catch(() => {}); // in the app: refresh in the background, use what's saved now
  }
  if (!c || !c.files) return false;
  const src = updOwnSource();
  if (!src) return false;
  const top = src.slice(0, 3000), mine = c.files.find((f) => top.includes(f.sig));
  return !!mine && mine.hash !== updHash(updBody(src, mine.sig));
}
let UPD_READY = false;
try { UPD_READY = await updCheck(config.runsInWidget); } catch (e) {}

// the glow: a hairline at the edge plus fading strokes stepping inward
function updRing(img) {
  if (!UPD_READY) return img;
  try {
    const W = img ? img.size.width : 510, H = img ? img.size.height : 510;
    const dc = new DrawContext();
    dc.size = new Size(W, H);
    dc.opaque = false;
    dc.respectScreenScale = Math.min(W, H) <= 200;
    if (img) dc.drawImageInRect(img, new Rect(0, 0, W, H));
    else for (let y = 0; y < H; y += 3) { const t = y / H; dc.setFillColor(new Color("#" + [44 - 16 * t, 44 - 16 * t, 46 - 16 * t].map((v) => Math.round(v).toString(16).padStart(2, "0")).join(""))); dc.fillRect(new Rect(0, y, W, 3)); }
    const k = Math.min(W, H) / 170, R = 22 * k, core = 0.75 * k, step = 0.8 * k, layers = 10;
    const ring = (i, w, a) => { const p = new Path(), r = Math.max(4 * k, R - i); p.addRoundedRect(new Rect(i + w / 2, i + w / 2, W - 2 * i - w, H - 2 * i - w), r, r); dc.addPath(p); dc.setStrokeColor(new Color("#FFD60A", a)); dc.setLineWidth(w); dc.strokePath(); };
    for (let j = layers; j >= 1; j--) ring(core + (j - 1) * step, Math.max(1, step), (70 / 255) * Math.pow(1 - j / (layers + 1), 1.8));
    ring(0, Math.max(1, core), 0.9);
    return dc.getImage();
  } catch (e) { return img; }
}
// the full view: an "Update ready" card at the top; its button runs the Installer
function updPage(html) {
  // only the main full view (it carries Share as PDF, or is the Reports calendar), never helper pages
  if (!UPD_READY || typeof html !== "string" || (html.indexOf("__takeShare") < 0 && html.indexOf("<title>Reports</title>") < 0)) return html;
  const b = html.indexOf("<body");
  const at = b < 0 ? -1 : html.indexOf(">", b) + 1;
  if (at <= 0) return html;
  const inst = encodeURIComponent(setting("hw_installer", "Installer"));
  // a pill floating at the bottom: it never moves the page's own layout; class "hint" keeps it out of PDFs
  const pill = '<a class="hint" href="scriptable:///run/' + inst + '" style="position:fixed;left:50%;bottom:calc(22px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:9999;margin:0;display:flex;align-items:center;gap:8px;background:#FFD60A;color:#1C1C1E;border-radius:22px;padding:11px 18px;font:700 14.5px -apple-system,system-ui,sans-serif;text-decoration:none;box-shadow:0 6px 20px rgba(0,0,0,.45);white-space:nowrap">Update ready · Run Installer ›</a>';
  return html.slice(0, at) + pill + html.slice(at);
}
function updArgs(html, base) { return base === undefined ? [updPage(html)] : [updPage(html), base]; }
// let the page's Run Installer link open Scriptable
function updWV(wv) {
  try { wv.shouldAllowRequest = (req) => { if (/^scriptable:/i.test(req.url)) { Safari.open(req.url); return false; } return true; }; } catch (e) {}
  return wv;
}

// ---------- Config ----------
const FRED_KEY = setting("fred_api_key", ""); // your own free key, saved by Setup

// No FRED key on this phone yet: say so instead of failing quietly
if (!FRED_KEY) {
  const msg = "Run the Setup script once to add your free FRED API key.";
  if (config.runsInWidget) {
    const w = new ListWidget();
    w.backgroundColor = new Color("#1C1C1E");
    const t = w.addText(msg);
    t.textColor = new Color("#FF9F0A");
    t.font = Font.semiboldSystemFont(12);
    Script.setWidget(w);
  } else {
    const a = new Alert();
    a.title = "FRED key needed";
    a.message = msg;
    a.addAction("OK");
    await a.present();
  }
  Script.complete();
  return;
}

const ZHVI_URL = "https://files.zillowstatic.com/research/public_csvs/zhvi/Metro_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv";
const DEFAULT_YEARS = 10;     // look-back; the widget's Parameter (1, 2, 5, 10) overrides it
const DOWN = 0.2;             // down payment share
const TERM_MONTHS = 360;      // 30-year fixed
const METRO_COUNT = 150;      // largest metros kept for the full screen's picker
const DEFAULT_METRO = setting("home_metro", "Austin, TX").split(",")[0].trim(); // the city, as the metro list names it
const STORE_FILE = "payment-change-v1.json";
const CHECK_HOURS = 12;       // how often to ask Zillow / FRED for newer data
const WIDGET_BUDGET_S = 22;   // a widget only gets seconds; past this it uses the saved copy
const PREVIEW_WIDGET_IN_APP = false;

const BLUE = "#64A8FF";  // due to price
const GOLD = "#FFD60A";  // due to rate
const GRAY = "#98989F";
const AMBER = "#FF9F0A";
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_MS = 24 * 3600 * 1000;
// ---------- Map geometry ----------
// U.S. state outlines, simplified, already projected to Albers USA (Alaska and
// Hawaii as insets) in a 975 x 610 box. Rings split by "|", points "x,y".
const STATES = "642,384 689,380 702,427 710,440 707,443 706,450 709,457 708,465 711,469 694,471 661,474 660,477 665,481 666,486 664,490 659,490 656,488 653,482 652,490 646,489 642,455 644,386 642,384|99,570 103,565 105,569 99,570|93,575 99,571 103,571 105,573 95,580 93,575|44,547 50,547 51,551 48,552 44,547|31,601 34,600 38,596 40,598 37,601 31,601|51,505 59,501 66,500 65,504 71,505 74,504 71,500 73,498 67,496 66,492 59,484 62,481 67,481 70,479 72,475 75,471 78,471 82,468 87,468 89,465 94,466 95,469 101,469 104,472 109,471 114,473 123,474 126,472 133,474 147,547 155,547 162,552 164,555 167,552 167,548 169,546 176,552 181,554 193,565 200,567 203,573 201,578 198,575 193,574 188,565 183,563 182,560 178,557 176,557 171,551 175,558 173,557 168,559 160,554 151,551 141,550 135,552 126,547 124,545 119,547 121,553 114,554 109,560 105,560 107,552 107,549 112,544 106,546 102,553 100,557 96,560 96,562 100,564 96,569 90,572 86,576 86,578 82,579 77,586 71,586 67,589 56,592 53,594 47,595 49,592 57,590 62,585 66,585 75,579 81,573 84,563 80,565 78,563 76,566 71,561 65,564 64,558 66,557 64,551 58,553 53,547 54,545 51,538 54,534 61,526 64,528 67,525 71,525 73,523 72,517 73,514 68,517 59,516 55,514 54,509 56,509 51,505|25,603 29,599 31,600 25,603|34,518 39,518 45,522 41,524 39,521 34,518|185,573 187,570 194,576 196,580 190,578 185,573|180,567 182,565 185,564 189,567 184,569 183,572 180,567|175,556 178,557 181,563 180,566 175,556|174,565 177,563 181,573 176,568 174,565|169,561 172,558 175,559 177,563 174,562 174,565 169,561|145,407 149,407 150,401 147,400 148,392 152,389 154,380 157,377 163,374 160,370 158,363 156,359 157,356 159,353 158,345 160,331 167,331 170,335 173,331 176,313 203,318 239,324 265,328 247,456 208,450 172,429 142,412 145,407|277,237 301,240 333,244 361,247 395,249 394,272 390,341 372,339 349,338 315,334 265,328 268,302 268,299 277,237|794,604 795,602 800,598 805,600 796,604 794,604|711,469 714,475 766,471 767,476 770,476 769,466 770,465 780,466 783,476 787,486 795,500 806,514 805,517 807,522 812,529 820,544 823,554 824,575 822,574 821,580 822,583 822,587 820,586 807,590 805,585 801,578 793,574 792,575 785,563 780,559 781,555 778,557 769,546 766,543 771,533 765,530 767,534 765,537 762,533 762,527 764,517 762,510 759,505 755,505 750,500 746,498 745,495 740,491 732,487 727,487 726,492 723,492 716,497 712,498 714,501 707,500 708,497 706,494 696,488 689,486 681,486 664,490 666,486 665,481 660,477 661,474 694,471 711,469|689,380 713,377 735,374 732,379 732,382 738,385 741,385 744,391 748,396 755,400 756,402 762,406 766,412 771,414 774,423 777,424 781,430 781,433 786,435 787,436 783,442 781,451 781,454 778,460 780,461 780,466 770,465 769,466 770,476 767,476 766,471 714,475 711,469 708,465 709,457 706,450 707,443 710,440 702,427 689,380|640,230 642,231 647,231 652,228 686,224 686,225 688,247 693,284 691,286 694,292 688,295 683,295 684,298 680,304 677,305 676,312 674,313 669,309 666,312 666,314 662,315 661,313 657,316 655,319 651,316 647,315 639,320 638,317 642,309 647,298 646,293 643,288 645,284 640,230|394,272 422,273 465,275 510,275 512,277 516,278 514,286 519,293 522,295 523,344 489,344 459,344 433,343 390,341 394,272|910,150 905,145 891,102 895,103 894,99 897,99 895,96 900,86 898,83 898,76 900,74 899,67 906,48 909,48 910,51 912,52 917,49 923,46 930,50 937,74 939,80 945,80 946,87 949,90 952,88 957,95 955,99 953,99 950,106 947,104 944,110 939,114 937,110 935,111 937,115 936,118 932,114 931,110 929,120 930,123 921,129 920,132 918,131 913,138 910,150|918,188 921,184 925,187 918,188|871,168 884,165 903,161 906,156 909,155 911,159 914,158 909,166 917,171 922,178 929,175 931,177 920,183 918,179 915,185 913,186 911,183 910,182 908,181 905,176 899,178 871,184 871,183 871,168|479,71 511,71 511,62 516,64 518,73 520,77 531,79 532,81 536,80 540,78 551,82 553,87 555,84 563,87 566,91 571,90 577,86 578,89 588,88 592,91 596,91 590,94 582,98 573,106 570,109 559,119 560,121 556,122 556,136 551,139 548,144 548,147 551,150 550,154 550,162 549,166 554,170 557,170 564,175 565,178 572,182 576,187 576,193 549,194 516,195 491,195 491,154 487,152 484,147 489,142 489,140 489,131 486,123 485,102 481,89 481,78 479,71|849,246 850,244 851,241 861,231 854,226 850,221 852,216 850,214 855,204 870,209 869,216 869,217 867,221 871,222 872,225 873,237 870,247 867,251 865,257 863,259 863,254 859,254 852,250 849,246|756,334 780,331 812,326 840,320 859,316 866,328 864,328 860,319 856,317 859,323 857,326 851,330 847,330 847,333 856,330 859,330 860,336 860,330 863,329 866,335 860,344 852,345 843,343 854,347 850,356 855,353 859,354 856,360 862,350 863,350 856,361 851,361 844,365 838,370 834,377 833,384 829,383 823,386 798,368 778,371 777,369 772,365 749,367 746,368 735,374 713,377 713,371 717,369 717,366 721,363 726,362 733,356 735,356 738,350 741,351 747,345 751,346 755,338 756,334|377,66 404,68 445,70 479,71 481,78 481,89 485,102 486,123 489,131 489,140 460,139 412,137 371,134 377,66|372,339 390,341 433,343 459,344 489,344 523,344 523,355 527,381 526,421 520,418 517,416 512,413 511,415 506,414 501,416 499,415 493,418 492,420 485,415 484,417 481,414 476,419 475,414 472,417 467,413 463,416 462,413 454,409 452,411 443,407 439,407 438,404 429,403 424,398 426,354 396,352 372,351 372,339|756,209 768,200 769,206 800,201 841,192 847,197 850,202 855,204 850,214 852,216 850,221 854,226 861,231 851,241 847,242 845,245 816,251 782,257 765,260 761,239 756,209|369,156 371,134 412,137 460,139 489,140 489,142 484,147 487,152 491,154 491,195 488,195 488,200 491,204 488,212 491,218 488,218 487,215 476,210 467,210 466,212 457,207 457,206 434,205 404,204 365,201 369,156|372,351 396,352 426,354 424,398 429,403 438,404 439,407 443,407 452,411 454,409 462,413 463,416 467,413 472,417 475,414 476,419 481,414 484,417 485,415 492,420 493,418 499,415 501,416 506,414 511,415 512,413 517,416 520,418 526,421 529,423 535,423 535,435 535,458 540,463 540,467 542,469 545,476 546,484 542,490 543,502 539,507 541,510 535,511 522,517 527,513 522,514 524,509 518,511 517,514 520,515 520,519 523,519 510,530 492,539 480,548 475,555 470,566 470,574 473,587 470,576 470,569 472,560 480,546 489,541 489,540 484,542 482,540 482,544 477,547 474,553 469,552 473,556 469,564 468,576 469,583 472,588 471,592 474,595 467,597 464,593 452,592 447,589 443,588 440,585 434,584 431,574 428,570 428,559 425,556 420,552 419,548 412,541 410,534 406,526 405,522 398,513 394,511 390,506 378,505 373,503 372,505 366,505 364,510 361,517 357,522 353,521 348,517 337,511 330,504 328,498 328,492 325,487 323,480 316,475 312,470 309,468 306,463 302,460 299,454 296,452 295,447 339,451 363,453 365,430 367,408 371,351 372,351|369,156 365,201 361,247 333,244 301,240 277,237 244,232 247,210 256,154 258,142 263,143 298,148 339,153 369,156|871,184 899,178 902,191 902,193 893,197 885,198 882,203 874,208 872,206 876,203 874,201 871,184|502,262 521,262 545,261 571,260 576,265 576,273 578,280 584,286 590,290 591,297 595,296 601,298 598,309 598,313 606,321 607,320 614,326 615,332 614,333 619,340 621,340 620,349 617,349 617,351 616,351 615,352 615,354 612,358 614,360 612,363 600,364 605,357 604,352 586,353 550,355 523,355 523,344 522,295 519,293 514,286 516,278 512,277 510,275 505,268 502,262|733,295 738,293 740,290 739,285 741,280 744,283 746,281 745,278 746,273 750,269 754,269 758,263 760,256 761,247 759,241 761,239 765,260 782,257 784,269 790,261 792,262 794,257 800,258 805,253 811,256 814,260 813,265 803,259 803,266 797,277 794,275 790,286 784,283 784,287 780,297 776,305 777,309 773,310 767,315 761,318 758,316 755,320 750,319 747,313 741,311 734,302 733,295|576,265 577,259 581,258 584,252 584,248 581,245 582,241 588,239 593,236 596,231 596,224 592,222 587,215 618,214 634,212 634,217 637,222 640,230 645,284 643,288 646,293 647,298 642,309 638,317 639,320 637,323 639,327 632,330 634,335 632,337 624,334 621,338 621,340 619,340 614,333 615,332 614,326 607,320 606,321 598,313 598,309 601,298 595,296 591,297 590,290 584,286 578,280 576,273 576,265|265,328 315,334 349,338 372,339 372,351 371,351 367,408 365,430 363,453 339,451 295,447 296,452 264,448 263,458 247,456 265,328|523,355 550,355 586,353 604,352 605,357 600,364 612,363 613,367 608,369 610,372 605,378 607,383 603,387 604,389 598,393 599,400 595,402 593,409 590,411 592,415 589,415 590,418 588,420 591,430 589,433 569,434 535,435 535,423 529,423 526,421 527,381 523,355|57,355 63,359 57,357 57,355|50,355 54,355 52,358 50,355|33,160 84,175 100,179 83,246 157,356 156,359 158,363 160,370 163,374 157,377 154,380 152,389 148,392 147,400 150,401 149,407 145,407 99,402 98,398 99,388 97,382 92,376 86,370 82,369 82,362 76,362 70,357 69,354 65,349 59,348 55,345 49,344 46,340 49,335 50,328 46,325 47,321 42,313 37,300 35,296 36,289 40,286 38,281 35,281 31,274 33,271 32,267 33,261 35,261 35,266 38,270 39,265 36,257 39,256 38,253 33,260 29,255 26,253 28,250 27,243 24,240 20,229 22,227 21,219 24,216 24,209 22,202 18,197 19,193 27,184 28,179 31,173 32,166 30,164 33,160|845,245 847,242 851,241 850,244 849,249 853,252 855,258 860,263 861,263 864,270 853,273 845,245|826,267 830,267 828,270 826,267|305,584 310,578 310,573 315,576 322,578 326,582 326,584 332,589 329,593 322,595 317,598 314,603 309,600 309,594 305,584|292,558 294,555 296,559 300,557 306,561 305,564 299,566 297,561 292,558|284,558 287,558 289,560 286,562 284,558|279,554 280,551 291,553 288,555 279,554|258,543 261,543 265,540 267,546 271,549 262,549 258,543|226,533 231,528 235,529 236,534 233,536 230,536 226,533|491,195 516,195 549,194 576,193 577,196 579,199 577,202 580,211 586,212 587,215 592,222 596,224 596,231 593,236 588,239 582,241 581,245 584,248 584,252 581,258 577,259 576,265 571,260 545,261 521,262 502,262 500,259 501,255 499,245 499,242 496,240 497,234 494,230 491,218 488,212 491,204 488,200 488,195 491,195|621,340 621,338 624,334 632,337 634,335 632,330 639,327 637,323 639,320 647,315 651,316 655,319 657,316 661,313 662,315 666,314 666,312 669,309 674,313 676,312 677,305 680,304 684,298 683,295 688,295 694,292 691,286 693,284 699,283 704,290 710,290 714,293 716,291 721,292 727,288 728,292 733,295 734,302 741,311 747,313 741,320 735,325 733,330 730,332 729,334 720,339 704,341 692,341 681,343 672,343 645,346 641,345 641,350 617,351 617,349 620,349 621,340|782,257 816,251 845,245 853,273 864,270 863,280 855,284 852,285 851,282 848,276 846,279 841,274 842,271 846,271 839,266 839,259 842,252 839,254 837,254 836,259 838,263 836,269 838,274 841,277 840,279 844,284 838,281 835,282 830,278 827,280 825,278 827,274 828,270 830,267 826,267 818,264 819,262 814,260 811,256 805,253 800,258 794,257 792,262 790,261 784,269 782,257|652,228 655,224 659,216 660,205 659,198 652,184 654,180 652,175 655,168 655,160 657,159 657,155 661,154 664,148 665,151 664,156 666,158 668,153 667,146 674,142 670,138 675,133 681,135 685,135 687,138 697,140 701,147 699,149 702,154 702,162 699,166 699,169 695,171 694,177 699,180 705,171 710,168 715,172 719,186 722,191 721,200 716,199 715,207 712,210 713,213 708,222 686,225 686,224 652,228|601,92 610,86 614,84 610,89 603,93 601,92|585,123 591,120 594,117 601,116 613,106 619,101 624,100 622,102 615,112 616,117 619,112 624,112 628,114 633,121 644,121 652,115 662,114 670,111 670,118 676,118 683,115 684,121 690,126 693,124 694,128 685,127 681,129 676,127 674,131 671,128 663,127 661,130 657,132 653,131 650,135 645,139 648,134 644,135 643,138 638,140 632,153 630,151 631,148 627,147 628,140 622,137 623,135 612,134 607,131 590,128 588,124 585,123|589,433 591,430 588,420 590,418 589,415 592,415 590,411 593,409 595,402 599,400 598,393 604,389 603,387 642,384 644,386 642,455 646,489 644,491 636,490 627,494 625,495 618,485 619,477 583,479 584,478 582,473 585,473 584,467 586,466 587,461 593,453 590,451 595,448 591,445 593,442 590,441 591,436 589,433|198,39 233,46 265,52 303,57 340,62 377,66 371,134 369,156 339,153 298,148 263,143 258,142 256,154 253,148 250,148 250,151 237,148 235,151 228,149 227,152 225,149 224,142 219,139 220,134 219,132 215,118 208,123 205,120 206,115 209,114 208,109 213,96 209,96 205,90 205,88 201,80 195,74 197,69 193,62 198,39|886,111 887,105 891,102 905,145 910,150 909,155 906,156 903,161 884,165 882,163 881,146 883,133 882,128 885,126 888,122 886,117 886,111|768,200 776,192 780,186 777,182 775,176 784,172 796,170 800,172 809,169 813,167 817,162 819,161 817,154 819,152 815,150 815,146 820,141 822,138 829,128 832,124 858,118 859,127 862,134 861,140 864,145 864,149 867,150 871,168 871,183 871,184 874,201 876,203 872,206 874,208 874,211 877,208 891,204 895,200 900,202 896,206 886,213 872,219 869,216 870,209 855,204 850,202 847,197 841,192 800,201 769,206 768,200|686,225 708,222 718,225 719,224 726,227 733,223 738,223 742,218 748,213 756,209 761,239 759,241 761,247 760,256 758,263 754,269 750,269 746,273 745,278 746,281 744,283 741,280 739,285 740,290 738,293 733,295 728,292 727,288 721,292 716,291 714,293 710,290 704,290 699,283 693,284 688,247 686,225|71,70 74,74 77,74 80,80 79,87 86,91 94,90 98,91 103,95 112,94 118,96 123,95 136,96 139,95 171,102 172,107 175,109 176,112 167,124 164,129 162,130 157,137 158,140 162,143 158,150 149,191 122,185 100,179 84,175 33,160 31,157 32,149 34,146 33,140 43,126 45,121 57,92 61,81 62,75 65,71 71,70|612,363 614,360 612,358 615,354 615,352 616,351 617,351 641,350 641,345 645,346 672,343 681,343 692,341 704,341 720,339 756,334 755,338 751,346 747,345 741,351 738,350 735,356 733,356 726,362 721,363 717,366 717,369 713,371 713,377 689,380 642,384 603,387 607,383 605,378 610,372 608,369 613,367 612,363|198,201 200,202 247,210 244,232 277,237 268,299 268,302 265,328 239,324 203,318 176,313 198,201|855,284 863,280 858,288 859,292 857,301 855,304 853,301 853,292 855,284|747,313 750,319 755,320 758,316 761,318 767,315 773,310 777,309 776,305 780,297 784,287 784,283 790,286 794,275 797,277 803,266 803,259 813,265 814,260 819,262 818,264 826,267 828,270 827,274 825,279 826,281 830,279 832,283 838,283 840,285 846,287 846,295 848,300 845,299 846,303 849,305 847,309 840,305 846,310 849,308 855,308 859,316 840,320 812,326 780,331 756,334 720,339 729,334 730,332 733,330 735,325 741,320 747,313|95,31 99,28 99,31 97,33 95,31|91,21 96,20 98,22 96,27 92,24 91,21|184,36 171,92 171,102 139,95 136,96 123,95 118,96 112,94 103,95 98,91 94,90 86,91 79,87 80,80 77,74 74,74 71,70 66,69 64,65 66,60 70,59 66,57 67,55 71,54 67,51 67,43 68,34 66,30 66,23 70,20 77,27 81,28 90,33 95,33 95,38 92,43 97,39 95,46 92,52 96,52 96,47 98,42 102,38 101,31 98,25 101,27 102,21 99,19 100,14 115,19 140,25 184,36|560,121 568,120 576,115 580,116 577,123 580,120 585,123 588,124 590,128 607,131 612,134 623,135 622,137 628,140 627,147 631,148 630,151 632,153 632,156 629,157 626,166 628,166 633,159 636,157 638,151 642,148 641,152 639,155 635,165 635,174 633,176 632,181 633,185 631,195 632,201 634,206 634,212 618,214 587,215 586,212 580,211 577,202 579,199 577,196 576,193 576,187 572,182 565,178 564,175 557,170 554,170 549,166 550,162 550,154 551,150 548,147 548,144 551,139 556,136 556,122 560,121|365,201 404,204 434,205 457,206 457,207 466,212 467,210 476,210 487,215 488,218 491,218 494,230 497,234 496,240 499,242 499,245 501,255 500,259 502,262 505,268 510,275 465,275 422,273 394,272 395,249 361,247 365,201|735,374 746,368 749,367 772,365 777,369 778,371 798,368 823,386 816,392 813,399 814,404 811,408 808,408 807,411 803,415 801,419 792,424 793,427 790,429 786,435 781,433 781,430 777,424 774,423 771,414 766,412 762,406 756,402 755,400 748,396 744,391 741,385 738,385 732,382 732,379 735,374|171,102 171,92 184,36 198,39 193,62 197,69 195,74 201,80 205,88 205,90 209,96 213,96 208,109 209,114 206,115 205,120 208,123 215,118 219,132 220,134 219,139 224,142 225,149 227,152 228,149 235,151 237,148 250,151 250,148 253,148 256,154 247,210 200,202 198,201 160,193 149,191 158,150 162,143 158,140 157,137 162,130 164,129 167,124 176,112 175,109 172,107 171,102|100,179 122,185 149,191 160,193 198,201 176,313 173,331 170,335 167,331 160,331 158,345 159,353 157,356 83,246 100,179|858,118 874,114 886,111 886,117 888,122 885,126 882,128 883,133 881,146 882,163 884,165 871,168 867,150 864,149 864,145 861,140 862,134 859,127 858,118|577,511 580,511 583,512 580,514 577,511|535,435 569,434 589,433 591,436 590,441 593,442 591,445 595,448 590,451 593,453 587,461 586,466 584,467 585,473 582,473 584,478 583,479 619,477 618,485 625,495 619,499 619,501 624,502 626,498 628,501 627,507 623,508 623,510 626,513 632,514 635,518 634,522 624,516 620,515 613,521 608,515 601,523 598,520 590,517 590,513 588,514 584,508 579,509 579,506 574,508 575,511 571,513 565,512 554,508 548,508 541,510 539,507 543,502 542,490 546,484 545,476 542,469 540,467 540,463 535,458 535,435|911,183 913,186 909,188 911,183|902,193 902,191 899,178 905,176 908,181 910,182 907,181 908,191 902,193";
const MAP_W = 975;
const MAP_H = 610;

// Albers USA, the same projection as the outlines above (d3's geoAlbersUsa at
// scale 1300), so metro dots land in the right place: [lon, lat] -> [x, y]
function conicEqualArea(phi0, phi1) {
  const r = Math.PI / 180;
  const sy0 = Math.sin(phi0 * r);
  const n = (sy0 + Math.sin(phi1 * r)) / 2;
  const c = 1 + sy0 * (2 * n - sy0);
  const r0 = Math.sqrt(c) / n;
  return (lam, phi) => {
    const rr = Math.sqrt(c - 2 * n * Math.sin(phi * r)) / n;
    const l = lam * r * n;
    return [rr * Math.sin(l), r0 - rr * Math.cos(l)];
  };
}
function albersPart(rot, center, par, k, tx, ty) {
  const raw = conicEqualArea(par[0], par[1]);
  const c = raw(center[0], center[1]);
  return (lon, lat) => {
    let l = lon + rot;
    while (l > 180) l -= 360;
    while (l < -180) l += 360;
    const p = raw(l, lat);
    return [tx + k * (p[0] - c[0]), ty - k * (p[1] - c[1])];
  };
}
const K_US = 1300;
const LOWER48 = albersPart(96, [-0.6, 38.7], [29.5, 45.5], K_US, 487.5, 305);
const ALASKA = albersPart(154, [-2, 58.5], [55, 65], 0.35 * K_US, 487.5 - 0.307 * K_US, 305 + 0.201 * K_US);
const HAWAII = albersPart(157, [-3, 19.9], [8, 18], K_US, 487.5 - 0.205 * K_US, 305 + 0.212 * K_US);
function projectUS(lon, lat) {
  if (lat > 50 && lon < -129) return ALASKA(lon, lat);
  if (lat < 24 && lon < -150) return HAWAII(lon, lat);
  return LOWER48(lon, lat);
}

// Where each metro goes on the map. Redfin's dashboard carries its own table of
// metro coordinates, which the script reads when it can; this built-in table
// (principal city, [lat, lon]) covers the usual Redfin metros if it can't.
const METRO_COORDS_FALLBACK = {
  "Albany|NY": [42.653, -73.757], "Albuquerque|NM": [35.084, -106.651], "Allentown|PA": [40.608, -75.49],
  "Anaheim|CA": [33.836, -117.914], "Anchorage|AK": [61.218, -149.9], "Arlington|VA": [38.88, -77.1],
  "Atlanta|GA": [33.749, -84.388], "Augusta|GA": [33.473, -82.01], "Austin|TX": [30.267, -97.743],
  "Bakersfield|CA": [35.373, -119.019], "Baltimore|MD": [39.29, -76.612], "Baton Rouge|LA": [30.452, -91.187],
  "Bethesda|MD": [38.985, -77.095], "Birmingham|AL": [33.519, -86.81], "Boise|ID": [43.615, -116.202],
  "Boise City|ID": [43.615, -116.202], "Boston|MA": [42.36, -71.059], "Bridgeport|CT": [41.186, -73.195],
  "Buffalo|NY": [42.886, -78.878], "Cambridge|MA": [42.373, -71.11], "Camden|NJ": [39.926, -75.12],
  "Cape Coral|FL": [26.563, -81.95], "Charleston|SC": [32.776, -79.931], "Charlotte|NC": [35.227, -80.843],
  "Chattanooga|TN": [35.046, -85.309], "Chicago|IL": [41.878, -87.63], "Cincinnati|OH": [39.103, -84.512],
  "Cleveland|OH": [41.499, -81.694], "Colorado Springs|CO": [38.834, -104.821], "Columbia|SC": [34.0, -81.035],
  "Columbus|OH": [39.961, -82.999], "Dallas|TX": [32.777, -96.797], "Dayton|OH": [39.758, -84.192],
  "Deltona|FL": [28.9, -81.264], "Denver|CO": [39.739, -104.99], "Des Moines|IA": [41.587, -93.625],
  "Detroit|MI": [42.331, -83.046], "Durham|NC": [35.994, -78.899], "El Paso|TX": [31.762, -106.485],
  "Elgin|IL": [42.037, -88.281], "Everett|WA": [47.979, -122.202], "Fort Lauderdale|FL": [26.122, -80.137],
  "Fort Worth|TX": [32.755, -97.331], "Frederick|MD": [39.414, -77.411], "Fresno|CA": [36.738, -119.787],
  "Gary|IN": [41.593, -87.346], "Grand Rapids|MI": [42.963, -85.668], "Greensboro|NC": [36.073, -79.792],
  "Greenville|SC": [34.853, -82.394], "Harrisburg|PA": [40.274, -76.884], "Hartford|CT": [41.764, -72.685],
  "Honolulu|HI": [21.307, -157.858], "Urban Honolulu|HI": [21.307, -157.858], "Houston|TX": [29.76, -95.37],
  "Huntsville|AL": [34.73, -86.586], "Indianapolis|IN": [39.768, -86.158], "Jacksonville|FL": [30.332, -81.656],
  "Kansas City|MO": [39.1, -94.579], "Knoxville|TN": [35.961, -83.921], "Lake County|IL": [42.364, -87.845],
  "Lakeland|FL": [28.039, -81.95], "Las Vegas|NV": [36.17, -115.14], "Little Rock|AR": [34.746, -92.29],
  "Los Angeles|CA": [34.052, -118.244], "Louisville|KY": [38.253, -85.759], "Madison|WI": [43.073, -89.401],
  "McAllen|TX": [26.203, -98.23], "Memphis|TN": [35.15, -90.049], "Miami|FL": [25.762, -80.192],
  "Milwaukee|WI": [43.039, -87.906], "Minneapolis|MN": [44.978, -93.265], "Montgomery County|PA": [40.121, -75.34],
  "Montgomery County|MD": [39.084, -77.153], "Nashville|TN": [36.163, -86.781], "Nassau County|NY": [40.733, -73.589],
  "New Brunswick|NJ": [40.486, -74.452], "New Haven|CT": [41.308, -72.928], "New Orleans|LA": [29.951, -90.072],
  "New York|NY": [40.713, -74.006], "Newark|NJ": [40.736, -74.172], "North Port|FL": [27.044, -82.236],
  "Oakland|CA": [37.804, -122.271], "Ogden|UT": [41.223, -111.974], "Oklahoma City|OK": [35.468, -97.516],
  "Omaha|NE": [41.257, -95.995], "Orlando|FL": [28.538, -81.379], "Oxnard|CA": [34.197, -119.177],
  "Palm Bay|FL": [28.035, -80.588], "Philadelphia|PA": [39.953, -75.165], "Phoenix|AZ": [33.448, -112.074],
  "Pittsburgh|PA": [40.441, -79.996], "Port St. Lucie|FL": [27.273, -80.354], "Portland|OR": [45.515, -122.679],
  "Providence|RI": [41.824, -71.413], "Provo|UT": [40.234, -111.659], "Raleigh|NC": [35.78, -78.639],
  "Reno|NV": [39.53, -119.814], "Richmond|VA": [37.541, -77.436], "Riverside|CA": [33.953, -117.396],
  "Rochester|NY": [43.157, -77.616], "Rockville|MD": [39.084, -77.153], "Sacramento|CA": [38.582, -121.494],
  "Salt Lake City|UT": [40.761, -111.891], "San Antonio|TX": [29.424, -98.494], "San Diego|CA": [32.716, -117.161],
  "San Francisco|CA": [37.775, -122.419], "San Jose|CA": [37.338, -121.886], "San Rafael|CA": [37.974, -122.531],
  "Santa Rosa|CA": [38.44, -122.714], "Sarasota|FL": [27.336, -82.531], "Savannah|GA": [32.081, -81.091],
  "Seattle|WA": [47.606, -122.332], "Silver Spring|MD": [38.991, -77.026], "Spokane|WA": [47.659, -117.426],
  "Springfield|MA": [42.101, -72.59], "St. Louis|MO": [38.627, -90.199], "Stockton|CA": [37.958, -121.291],
  "Syracuse|NY": [43.049, -76.147], "Tacoma|WA": [47.253, -122.444], "Tampa|FL": [27.951, -82.457],
  "Toledo|OH": [41.654, -83.537], "Tucson|AZ": [32.222, -110.975], "Tulsa|OK": [36.154, -95.993],
  "Virginia Beach|VA": [36.853, -75.978], "Warren|MI": [42.514, -83.015], "Washington|DC": [38.907, -77.037],
  "West Palm Beach|FL": [26.715, -80.054], "Wichita|KS": [37.688, -97.336], "Wilmington|DE": [39.739, -75.539],
  "Winston-Salem|NC": [36.1, -80.244], "Worcester|MA": [42.263, -71.802], "Akron|OH": [41.081, -81.519],
  "Bellevue|WA": [47.61, -122.201], "Naperville|IL": [41.785, -88.147], "Dutchess County|NY": [41.7, -73.921],
};

// More metros (Zillow's 150 largest reach smaller places than Redfin's list)
Object.assign(METRO_COORDS_FALLBACK, {
  "Spartanburg|SC": [34.95, -81.93], "Myrtle Beach|SC": [33.689, -78.887], "Wilmington|NC": [34.226, -77.945], "Asheville|NC": [35.595, -82.551],
  "Fayetteville|AR": [36.082, -94.171], "Fayetteville|NC": [35.053, -78.878], "Killeen|TX": [31.117, -97.728], "Corpus Christi|TX": [27.8, -97.396],
  "Lubbock|TX": [33.578, -101.855], "Waco|TX": [31.549, -97.147], "Brownsville|TX": [25.901, -97.497], "Beaumont|TX": [30.08, -94.127],
  "Tyler|TX": [32.351, -95.301], "College Station|TX": [30.628, -96.334], "Amarillo|TX": [35.222, -101.831], "Midland|TX": [31.997, -102.078],
  "Odessa|TX": [31.846, -102.368], "Laredo|TX": [27.506, -99.507], "Shreveport|LA": [32.525, -93.75], "Lafayette|LA": [30.224, -92.02],
  "Mobile|AL": [30.695, -88.04], "Montgomery|AL": [32.367, -86.3], "Pensacola|FL": [30.421, -87.217], "Tallahassee|FL": [30.438, -84.281],
  "Gainesville|FL": [29.652, -82.325], "Ocala|FL": [29.187, -82.14], "Naples|FL": [26.142, -81.795], "Crestview|FL": [30.762, -86.571],
  "Panama City|FL": [30.159, -85.66], "Columbus|GA": [32.461, -84.988], "Macon|GA": [32.841, -83.632], "Athens|GA": [33.951, -83.357],
  "Clarksville|TN": [36.53, -87.359], "Kingsport|TN": [36.548, -82.562], "Lexington|KY": [38.04, -84.503], "Evansville|IN": [37.975, -87.556],
  "Fort Wayne|IN": [41.079, -85.139], "South Bend|IN": [41.676, -86.252], "Lansing|MI": [42.733, -84.556], "Ann Arbor|MI": [42.281, -83.743],
  "Kalamazoo|MI": [42.292, -85.587], "Flint|MI": [43.012, -83.687], "Green Bay|WI": [44.519, -88.02], "Appleton|WI": [44.261, -88.415],
  "Rockford|IL": [42.271, -89.094], "Peoria|IL": [40.694, -89.589], "Champaign|IL": [40.116, -88.243], "Springfield|IL": [39.781, -89.65],
  "Davenport|IA": [41.524, -90.578], "Cedar Rapids|IA": [41.978, -91.666], "Sioux Falls|SD": [43.546, -96.731], "Fargo|ND": [46.877, -96.79],
  "Lincoln|NE": [40.814, -96.703], "Topeka|KS": [39.048, -95.678], "Springfield|MO": [37.209, -93.292], "Columbia|MO": [38.952, -92.334],
  "Fort Collins|CO": [40.585, -105.084], "Boulder|CO": [40.015, -105.27], "Greeley|CO": [40.423, -104.709], "Santa Fe|NM": [35.687, -105.938],
  "Prescott Valley|AZ": [34.61, -112.316], "Lake Havasu City|AZ": [34.484, -114.322], "Kennewick|WA": [46.211, -119.137], "Olympia|WA": [47.037, -122.9],
  "Bremerton|WA": [47.567, -122.633], "Bellingham|WA": [48.75, -122.478], "Salem|OR": [44.943, -123.035], "Eugene|OR": [44.052, -123.087],
  "Medford|OR": [42.327, -122.873], "Bend|OR": [44.058, -121.315], "Vallejo|CA": [38.104, -122.256], "Santa Cruz|CA": [36.974, -122.031],
  "Salinas|CA": [36.678, -121.656], "San Luis Obispo|CA": [35.283, -120.66], "Santa Maria|CA": [34.953, -120.436], "Visalia|CA": [36.33, -119.292],
  "Modesto|CA": [37.639, -120.997], "Merced|CA": [37.302, -120.483], "Redding|CA": [40.587, -122.392], "Chico|CA": [39.729, -121.837],
  "Portland|ME": [43.661, -70.255], "Manchester|NH": [42.995, -71.455], "Burlington|VT": [44.476, -73.212], "Barnstable Town|MA": [41.7, -70.3],
  "Norwich|CT": [41.524, -72.076], "Poughkeepsie|NY": [41.7, -73.921], "Scranton|PA": [41.409, -75.662], "Lancaster|PA": [40.038, -76.306],
  "York|PA": [39.963, -76.728], "Reading|PA": [40.336, -75.927], "Trenton|NJ": [40.217, -74.743], "Atlantic City|NJ": [39.364, -74.423],
  "Salisbury|MD": [38.361, -75.6], "Hagerstown|MD": [39.642, -77.72], "Roanoke|VA": [37.271, -79.941], "Lynchburg|VA": [37.414, -79.142],
  "Charlottesville|VA": [38.03, -78.479], "Winchester|VA": [39.186, -78.163], "Hickory|NC": [35.733, -81.341], "Tuscaloosa|AL": [33.21, -87.569],
  "Jackson|MS": [32.299, -90.185], "Gulfport|MS": [30.367, -89.093], "Youngstown|OH": [41.099, -80.65], "Canton|OH": [40.799, -81.378],
  "Erie|PA": [42.129, -80.085], "St. George|UT": [37.096, -113.568], "Daphne|AL": [30.603, -87.904], "Port St. Lucie|FL": [27.273, -80.354],
  "Deltona|FL": [28.9, -81.264], "Palm Bay|FL": [28.035, -80.588], "Sebastian|FL": [27.816, -80.471], "Punta Gorda|FL": [26.93, -82.045],
  "Kingston|NY": [41.927, -73.997], "Utica|NY": [43.1, -75.233], "Binghamton|NY": [42.099, -75.918], "Duluth|MN": [46.787, -92.1],
  "Rochester|MN": [44.022, -92.47], "Savannah|GA": [32.081, -81.091], "Gainesville|GA": [34.298, -83.824], "Warner Robins|GA": [32.62, -83.6],
  "Huntington|WV": [38.419, -82.445], "Charleston|WV": [38.35, -81.633], "Morgantown|WV": [39.629, -79.956], "Las Cruces|NM": [32.312, -106.778],
  "Yuma|AZ": [32.693, -114.628], "Flagstaff|AZ": [35.198, -111.651], "Yakima|WA": [46.602, -120.506], "Coeur d'Alene|ID": [47.678, -116.78],
  "Idaho Falls|ID": [43.492, -112.034], "Missoula|MT": [46.872, -113.994], "Billings|MT": [45.783, -108.501], "Cheyenne|WY": [41.14, -104.82],
  "Rapid City|SD": [44.081, -103.231], "Bismarck|ND": [46.808, -100.784], "Manhattan|KS": [39.184, -96.572], "Lawrence|KS": [38.972, -95.235],
  "Joplin|MO": [37.084, -94.513], "Fort Smith|AR": [35.386, -94.398], "Jonesboro|AR": [35.842, -90.704], "Hot Springs|AR": [34.503, -93.055],
});

// ---------- Saved copy (shared by the widget and the app, newest wins) ----------
function storePath() {
  const fm = FileManager.local();
  return fm.joinPath(fm.documentsDirectory(), STORE_FILE);
}
function readStore() {
  const fm = FileManager.local();
  for (const p of [storePath(), storePath() + ".tmp"]) {
    try {
      if (fm.fileExists(p)) {
        const s = JSON.parse(fm.readString(p));
        if (s && s.months && s.us) return s;
      }
    } catch (e) {}
  }
  return null;
}
function writeStore(s) {
  const fm = FileManager.local();
  const p = storePath();
  const tmp = p + ".tmp";
  try {
    fm.writeString(tmp, JSON.stringify(s));
    if (fm.fileExists(p)) fm.remove(p);
    fm.move(tmp, p);
  } catch (e) {
    try { fm.writeString(p, JSON.stringify(s)); } catch (e2) {}
  }
}
const lastMonth = (s) => (s && s.months && s.months.length ? s.months[s.months.length - 1] : "");

// ---------- Zillow home values ----------
// The file has one row per region (the U.S., then metros by size) and one
// column per month ("2000-01-31", ...). Columns are found by name; a file
// without them is rejected, never guessed.
function splitCsv(line) {
  const out = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q;
    } else if (c === "," && !q) { out.push(cur); cur = ""; } else cur += c;
  }
  out.push(cur);
  return out;
}
function parseZhvi(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.length);
  const head = splitCsv(lines[0]).map((h) => h.trim());
  const col = (name) => head.findIndex((h) => h.toLowerCase() === name.toLowerCase());
  const iName = col("RegionName");
  const iType = col("RegionType");
  const iRank = col("SizeRank");
  const iState = col("StateName");
  const dateCols = [];
  head.forEach((h, i) => { if (/^\d{4}-\d{2}-\d{2}$/.test(h)) dateCols.push(i); });
  if (iName < 0 || dateCols.length < 140) throw new Error("Zillow's file changed format");
  const months = dateCols.map((i) => head[i].slice(0, 7));
  let us = null;
  const metros = [];
  for (let r = 1; r < lines.length; r++) {
    const f = splitCsv(lines[r]);
    const name = (f[iName] || "").trim();
    const type = iType >= 0 ? (f[iType] || "").toLowerCase() : "";
    const vals = dateCols.map((i) => { const v = parseFloat(f[i]); return v > 0 ? Math.round(v) : null; });
    if (type === "country" || name === "United States") { us = vals; continue; }
    if (type && type !== "msa") continue;
    metros.push({ name, st: iState >= 0 ? (f[iState] || "").trim() : "", rank: iRank >= 0 ? +f[iRank] : r, v: vals });
  }
  if (!us) throw new Error("Zillow's file had no U.S. row");
  metros.sort((a, b) => a.rank - b.rank);
  return { months, us, metros: metros.slice(0, METRO_COUNT).map(({ name, st, rank, v }) => ({ name, st, rank, v })) };
}

// ---------- Freddie Mac 30-year rate (FRED), averaged by month ----------
async function freddieMonthly() {
  const url = "https://api.stlouisfed.org/fred/series/observations" +
    `?series_id=MORTGAGE30US&api_key=${FRED_KEY}&file_type=json&observation_start=1999-01-01`;
  const req = new Request(url);
  req.timeoutInterval = 20;
  const json = await req.loadJSON();
  if (!json.observations) throw new Error(json.error_message || "No Freddie Mac rate from FRED");
  const sum = {};
  for (const o of json.observations) {
    if (o.value === ".") continue;
    const m = o.date.slice(0, 7);
    (sum[m] = sum[m] || [0, 0])[0] += parseFloat(o.value);
    sum[m][1]++;
  }
  const out = {};
  for (const m of Object.keys(sum)) out[m] = Math.round((sum[m][0] / sum[m][1]) * 1000) / 1000;
  return out;
}

function headerOf(resp, name) {
  if (!resp || !resp.headers) return null;
  const k = Object.keys(resp.headers).find((h) => h.toLowerCase() === name.toLowerCase());
  return k ? resp.headers[k] : null;
}
async function zillowLastModified() {
  try {
    const req = new Request(ZHVI_URL);
    req.method = "HEAD";
    req.timeoutInterval = 12;
    await req.load();
    if (req.response && req.response.statusCode === 200) return headerOf(req.response, "Last-Modified");
  } catch (e) {}
  return null;
}

// Zillow posts mid-month: the next update is about a month after the file's date
function estimateNext(lastModified) {
  const d = lastModified ? new Date(lastModified) : new Date();
  const n = new Date(d.getFullYear(), d.getMonth() + 1, Math.min(d.getDate(), 28));
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

// Bring the saved copy up to date (each part independently; older never replaces newer)
async function refresh(force) {
  let s = readStore();
  const now = Date.now();
  if (s && !force && s.checkedAt && now - s.checkedAt < CHECK_HOURS * 3600 * 1000) return s;
  const errors = [];
  const lm = await zillowLastModified();
  // a saved copy from an older version of this script (no size ranks) is refetched now
  const outdated = s && s.metros && s.metros.length && s.metros[0].rank == null;
  if (!s || force || outdated || !lm || lm !== s.zillowModified) {
    try {
      const req = new Request(ZHVI_URL);
      req.timeoutInterval = 40;
      const text = await req.loadString();
      const status = req.response ? req.response.statusCode : 0;
      if (status && status !== 200) throw new Error(`Zillow answered ${status}`);
      const z = parseZhvi(text);
      const mod = lm || headerOf(req.response, "Last-Modified");
      if (!s || z.months[z.months.length - 1] >= lastMonth(s)) {
        s = { ...(s || {}), months: z.months, us: z.us, metros: z.metros, zillowModified: mod };
      }
    } catch (e) {
      errors.push("Zillow: " + (e.message || e));
    }
  }
  try {
    const rates = await freddieMonthly();
    if (s) s.rates = { ...(s.rates || {}), ...rates };
    else if (!errors.length) s = { rates };
  } catch (e) {
    errors.push("FRED: " + (e.message || e));
  }
  if (!s || !s.months || !s.rates) throw new Error(errors.join(" · ") || "No data yet");
  // after a failed check, try again in about an hour rather than CHECK_HOURS
  s.checkedAt = errors.length ? now - (CHECK_HOURS - 1) * 3600 * 1000 : now;
  s.error = errors.length ? errors.join(" · ") : null;
  s.next = estimateNext(s.zillowModified);
  writeStore(s);
  return s;
}

async function refreshWithin(seconds, force) {
  let timer;
  const deadline = new Promise((_, rej) => { timer = Timer.schedule(seconds * 1000, false, () => rej(new Error("took too long"))); });
  try {
    return await Promise.race([refresh(force), deadline]);
  } catch (e) {
    const s = readStore();
    if (s) {
      s.error = String(e.message || e);
      return s;
    }
    throw e;
  } finally {
    if (timer) timer.invalidate();
  }
}

// ---------- The payment split ----------
// Monthly principal and interest on the typical home at a rate (in %)
function payment(price, ratePct) {
  const loan = price * (1 - DOWN);
  const i = ratePct / 1200;
  return (loan * i) / (1 - Math.pow(1 + i, -TERM_MONTHS));
}
// For each month with a value N years earlier: [month, total, price effect, rate effect]
function decompose(months, vals, rates, years) {
  const out = [];
  const lag = years * 12;
  for (let k = lag; k < months.length; k++) {
    const m = months[k];
    const m0 = months[k - lag];
    const p1 = vals[k];
    const p0 = vals[k - lag];
    const r1 = rates[m];
    const r0 = rates[m0];
    if (!(p1 > 0 && p0 > 0 && r1 > 0 && r0 > 0)) continue;
    const before = payment(p0, r0);
    const total = payment(p1, r1) - before;
    const price = payment(p1, r0) - before;
    out.push([m, Math.round(total), Math.round(price), Math.round(total - price)]);
  }
  return out;
}

// ---------- Widget ----------
function drawText(ctx, str, rect, font, hex, align) {
  ctx.setFont(font);
  ctx.setTextColor(new Color(hex));
  if (align === "right") ctx.setTextAlignedRight();
  else if (align === "center") ctx.setTextAlignedCenter();
  else ctx.setTextAlignedLeft();
  ctx.drawTextInRect(str, rect);
}
function newCanvas(W, H) {
  const ctx = new DrawContext();
  ctx.size = new Size(W, H);
  ctx.opaque = true;
  ctx.respectScreenScale = true;
  const top = [0x2c, 0x2c, 0x2e];
  const bottom = [0x1c, 0x1c, 0x1e];
  for (let i = 0; i < 34; i++) {
    const f = i / 33;
    const hex = "#" + top.map((c, j) => Math.round(c + (bottom[j] - c) * f).toString(16).padStart(2, "0")).join("");
    ctx.setFillColor(new Color(hex));
    ctx.fillRect(new Rect(0, (H * i) / 34, W, H / 34 + 1));
  }
  return ctx;
}
function roundRect(ctx, x, y, w, h, r, hex) {
  if (w <= 0) return;
  const p = new Path();
  p.addRoundedRect(new Rect(x, y, w, h), Math.min(r, w / 2), Math.min(r, h / 2));
  ctx.addPath(p);
  ctx.setFillColor(new Color(hex));
  ctx.fillPath();
}
function clockIcon(ctx, x, y, hex) {
  ctx.setStrokeColor(new Color(hex));
  ctx.setLineWidth(1.2);
  const c = new Path();
  c.addEllipse(new Rect(x - 4.5, y - 4.5, 9, 9));
  ctx.addPath(c);
  ctx.strokePath();
  const h = new Path();
  h.move(new Point(x, y - 2.6));
  h.addLine(new Point(x, y));
  h.addLine(new Point(x + 2, y + 1.1));
  ctx.addPath(h);
  ctx.strokePath();
}
const money = (v) => (v < 0 ? "−" : "+") + "$" + Math.abs(Math.round(v)).toLocaleString("en-US");
const shortMonth = (m) => `${MON[+m.slice(5, 7) - 1]} ’${m.slice(2, 4)}`;
function isoDay(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function nextLabel(s) {
  if (!s.next) return null;
  const [, mo, d] = s.next.split("-").map(Number);
  if (s.next < isoDay(new Date())) return { text: "due", hex: AMBER };
  return { text: `~${MON[mo - 1]} ${d}`, hex: GRAY };
}

function widgetYears() {
  const p = parseInt(String(args.widgetParameter || "").replace(/[^0-9]/g, ""), 10);
  return [1, 2, 5, 10].includes(p) ? p : DEFAULT_YEARS;
}

// The face: the chart only. Payment change vs N years earlier for the U.S.
// typical home, last 5 years: blue = due to price, gold = due to rate
// (stacked), white = the total; the latest total at the right edge.
const FACE_MONTHS = 60;
function smallImage(s, years) {
  const W = 170;
  const ctx = newCanvas(W, W);
  const rows = decompose(s.months, s.us, s.rates, years).slice(-FACE_MONTHS);
  drawText(ctx, `Payment vs ${years}Y ago`, new Rect(14, 11, 112, 16), Font.boldSystemFont(12.5), "#FFFFFF", "left");
  const last = rows[rows.length - 1];
  if (s.error) drawText(ctx, "cached", new Rect(W - 60, 12, 46, 14), Font.semiboldSystemFont(10), AMBER, "right");
  if (rows.length < 2) {
    drawText(ctx, "Not enough history yet", new Rect(14, 70, 142, 30), Font.mediumSystemFont(11), GRAY, "left");
    return ctx.getImage();
  }
  const L = 14, R = 112, T = 36, B = 146;
  let hi = 0, lo = 0;
  rows.forEach(([, t, p, r]) => {
    const pt = Math.max(p, 0), pb = Math.min(p, 0);
    hi = Math.max(hi, t, pt + Math.max(r, 0)); lo = Math.min(lo, t, pb + Math.min(r, 0));
  });
  const pad = (hi - lo) * 0.06 || 1; hi += pad; lo -= pad;
  const X = (i) => L + (i / (rows.length - 1)) * (R - L), Y = (v) => T + ((hi - v) / (hi - lo)) * (B - T);
  // stacked areas: price from zero, rate on top of price when it has the same sign, else from zero the other way
  const band = (top, bot, hex, alpha) => {
    const path = new Path();
    path.addLines(rows.map((q, i) => new Point(X(i), Y(top(q)))).concat(rows.map((q, i) => new Point(X(i), Y(bot(q)))).reverse()));
    path.closeSubpath(); ctx.addPath(path); ctx.setFillColor(new Color(hex, alpha)); ctx.fillPath();
  };
  const pt = (q) => Math.max(q[2], 0), pb = (q) => Math.min(q[2], 0);
  band(pt, pb, BLUE, 0.75);
  band((q) => (q[3] >= 0 ? pt(q) + q[3] : pb(q)), (q) => (q[3] >= 0 ? pt(q) : pb(q) + q[3]), GOLD, 0.75);
  // zero line
  ctx.setFillColor(new Color("#8E8E93", 0.8)); ctx.fillRect(new Rect(L, Y(0) - 0.5, R - L, 1));
  // total
  const line = new Path(); line.addLines(rows.map((q, i) => new Point(X(i), Y(q[1])))); ctx.addPath(line);
  ctx.setStrokeColor(new Color("#FFFFFF")); ctx.setLineWidth(2.2); ctx.strokePath();
  // year ticks
  rows.forEach((q, i) => { if (q[0].slice(5, 7) === "01") drawText(ctx, `’${q[0].slice(2, 4)}`, new Rect(X(i) - 12, B + 3, 24, 11), Font.mediumSystemFont(8.5), GRAY, "center"); });
  // latest total at the right edge
  const yy = Math.max(T - 4, Math.min(B - 22, Y(last[1]) - 8));
  drawText(ctx, money(last[1]), new Rect(R + 4, yy, 54, 14), Font.boldSystemFont(11.5), "#FFFFFF", "left");
  drawText(ctx, `/mo · ${shortMonth(last[0])}`, new Rect(R + 4, yy + 13, 54, 11), Font.mediumSystemFont(8), GRAY, "left");
  return ctx.getImage();
}

function finishWidget(img, s) {
  const w = new ListWidget();
  w.backgroundImage = updRing(img);
  w.addSpacer();
  w.url = URLScheme.forRunningScript();
  w.refreshAfterDate = new Date(Date.now() + (s && s.error ? 1 : CHECK_HOURS) * 3600 * 1000);
  return w;
}
function errorWidget(msg) {
  const w = new ListWidget();
  const g = new LinearGradient();
  g.colors = [new Color("#2C2C2E"), new Color("#1C1C1E")];
  g.locations = [0, 1];
  w.backgroundGradient = g;
  const t = w.addText("Payment vs 10Y ago");
  t.font = Font.semiboldSystemFont(12);
  t.textColor = new Color("#FFFFFF");
  w.addSpacer(4);
  const m = w.addText(String(msg));
  m.font = Font.systemFont(10);
  m.textColor = new Color(GRAY);
  w.addSpacer();
  w.url = URLScheme.forRunningScript();
  w.refreshAfterDate = new Date(Date.now() + 3600 * 1000);
  return w;
}
// ---------- Sharing the full-screen view as a light, printable PDF ----------
// The page itself builds the PDF: tapping Share downloads two open-source
// tools from cdnjs (html2canvas and jsPDF, falling back to jsDelivr), redraws
// the view in light colors off-screen with smaller headers and shorter charts,
// widened as needed so it fills the full width of one portrait letter page,
// and captures it at up to 3x. This script then saves the PDF and offers
// Email, Preview & share, or Save to Files.
// Note: the page code below avoids backticks, backslashes and dollar-brace
// on purpose, because it lives inside a template literal.
const SHARE_PAGE_JS = `
(function () {
  var LIB_H2C = ["https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
                 "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"];
  var LIB_PDF = ["https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
                 "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js"];
  // Dark-screen colors and their print versions. Lines that are white or pale
  // on the phone turn dark; the current year in overlays becomes the darkest.
  var MAP = {
    "#FFFFFF": "#111111", "#3A3A3C": "#DDDDDD", "#48484A": "#C8C8C8", "#636366": "#999999",
    "#98989F": "#666666", "#8E8E93": "#777777", "#1C1C1E": "#FFFFFF", "#232325": "#FFFFFF",
    "#2C2C2E": "#F2F2F2", "#E5E5EA": "#333333",
    "#A9CCFF": "#0B3D91", "#CFE2FF": "#0B3D91", "#6A9CE6": "#2F5A93", "#5A8FDB": "#5A86C4",
    "#4377C2": "#7EA2D6", "#2F5A93": "#A3BEE6", "#22406A": "#C6D6EF",
    "#64A8FF": "#0A62D0", "#64D2FF": "#0077C8", "#FFD60A": "#B38600", "#30D5C8": "#12968C",
    "#30D158": "#1E9E45", "#FF453A": "#D70015", "#FF9F0A": "#C26A00", "#BF5AF2": "#8E3BB8",
    "#AC8E68": "#8A6D45"
  };

  var css = "body{position:relative}" +
    "#shareBtn{position:absolute;top:18px;right:16px;display:flex;align-items:center;border:0;border-radius:16px;" +
    "padding:7px 12px;background:#2C2C2E;color:#FFFFFF;font:inherit;font-size:14px;font-weight:600;z-index:5}" +
    "#shareBtn svg{margin-right:6px}" +
    ".ticker,.name{padding-right:104px}" +
    ".print{--bg:#FFFFFF;--fg:#111111;--gray:#666666;--rule:#DDDDDD;background:#FFFFFF;color:#111111}" +
    ".print .ticker,.print .name{padding-right:150px}" +
    ".printHead{position:relative;min-height:40px}" +
    ".printStamp{position:absolute;top:2px;right:0;text-align:right;font-size:9.5px;line-height:1.5;color:#666666}" +
    ".print .ticker{font-size:20px}.print .name{font-size:12px;margin-top:1px}" +
    ".print .valrow{margin-top:8px}.print .value{font-size:32px}.print .change{font-size:14px}" +
    ".print .h2{font-size:15px;margin:16px 0 8px}" +
    ".print .panel,.print .block{margin-top:12px}" +
    ".print .ptitle b{font-size:13px}.print .ptitle .val{font-size:15px}" +
    ".print .head .title{font-size:14px}.print .head .value{font-size:22px}" +
    ".print .month,.print .week{font-size:12px;margin-top:6px}" +
    ".print .note{font-size:10px}" +
    "body.printing svg.chart{height:120px !important}" +
    "body.printing #chart{height:230px !important}" +
    ".printCols{display:flex;align-items:flex-start}" +
    ".printCol{flex:none}" +
    ".printCol + .printCol{margin-left:24px}" +
    ".printFoot .note{margin-top:10px}";
  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  var btn = document.createElement("button");
  btn.id = "shareBtn";
  btn.type = "button";
  btn.innerHTML = '<svg width="13" height="15" viewBox="0 0 13 15" aria-hidden="true">' +
    '<path d="M6.5 1v8.5M3 4.3 6.5 1 10 4.3" fill="none" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M3.5 7H2v7h9V7H9.5" fill="none" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
    '<span id="shareLabel">Share</span>';
  document.body.appendChild(btn);
  function label(t) { var s = document.getElementById("shareLabel"); if (s) s.textContent = t; }

  function loadScript(urls) {
    return new Promise(function (resolve, reject) {
      var i = 0;
      function next() {
        if (i >= urls.length) { reject(new Error("Couldn't download the PDF tools. Check the connection and try again.")); return; }
        var s = document.createElement("script"), done = false;
        var timer = setTimeout(function () { if (!done) { done = true; next(); } }, 15000);
        s.src = urls[i++];
        s.onload = function () { if (!done) { done = true; clearTimeout(timer); resolve(); } };
        s.onerror = function () { if (!done) { done = true; clearTimeout(timer); next(); } };
        document.head.appendChild(s);
      }
      next();
    });
  }
  // The narrow font for custom layouts, downloaded at share time. If it can't be
  // fetched, the layout falls back to a built-in sans instead of failing.
  var FONT_REG = ["https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/ibmplexsanscondensed/IBMPlexSansCondensed-Regular.ttf",
                  "https://raw.githubusercontent.com/google/fonts/main/ofl/ibmplexsanscondensed/IBMPlexSansCondensed-Regular.ttf"];
  var FONT_BOLD = ["https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/ibmplexsanscondensed/IBMPlexSansCondensed-SemiBold.ttf",
                   "https://raw.githubusercontent.com/google/fonts/main/ofl/ibmplexsanscondensed/IBMPlexSansCondensed-SemiBold.ttf"];
  var fontCache = null;
  function fetchB64(urls) {
    var i = 0;
    function next() {
      if (i >= urls.length || !window.fetch) return Promise.resolve(null);
      return window.fetch(urls[i++])
        .then(function (r) { return r.ok ? r.arrayBuffer() : Promise.reject(new Error("bad response")); })
        .then(function (buf) {
          var bytes = new Uint8Array(buf), bin = "";
          for (var k = 0; k < bytes.length; k += 32768) bin += String.fromCharCode.apply(null, bytes.subarray(k, k + 32768));
          return window.btoa(bin);
        })
        .catch(next);
    }
    return next();
  }
  function loadFonts() {
    if (fontCache) return Promise.resolve(fontCache);
    return Promise.all([fetchB64(FONT_REG), fetchB64(FONT_BOLD)]).then(function (r) {
      fontCache = r[0] && r[1] ? { regular: r[0], bold: r[1] } : null;
      return fontCache;
    });
  }
  function readyPdf() {
    return window.jspdf && window.jspdf.jsPDF ? Promise.resolve() : loadScript(LIB_PDF);
  }
  function ready() {
    var p = Promise.resolve();
    if (!window.html2canvas) p = p.then(function () { return loadScript(LIB_H2C); });
    if (!(window.jspdf && window.jspdf.jsPDF)) p = p.then(function () { return loadScript(LIB_PDF); });
    return p;
  }

  function hexOf(c) {
    if (!c) return null;
    c = String(c).trim();
    if (c.charAt(0) === "#") {
      if (c.length === 4) c = "#" + c.charAt(1) + c.charAt(1) + c.charAt(2) + c.charAt(2) + c.charAt(3) + c.charAt(3);
      return c.length === 7 ? c.toUpperCase() : null;
    }
    if (c.indexOf("rgb") === 0) {
      var parts = c.slice(c.indexOf("(") + 1, c.indexOf(")")).split(",");
      var h = "#";
      for (var i = 0; i < 3; i++) {
        var n = Math.max(0, Math.min(255, parseInt(parts[i], 10) || 0)).toString(16).toUpperCase();
        h += n.length < 2 ? "0" + n : n;
      }
      return h;
    }
    return null;
  }
  function recolor(root) {
    var all = root.querySelectorAll("*");
    for (var i = 0; i < all.length; i++) {
      var e = all[i], attrs = ["fill", "stroke", "stop-color"];
      for (var a = 0; a < attrs.length; a++) {
        var h = hexOf(e.getAttribute(attrs[a]));
        if (h && MAP[h]) e.setAttribute(attrs[a], MAP[h]);
      }
      if (e.style) {
        var c1 = hexOf(e.style.color); if (c1 && MAP[c1]) e.style.color = MAP[c1];
        var c2 = hexOf(e.style.backgroundColor); if (c2 && MAP[c2]) e.style.backgroundColor = MAP[c2];
      }
    }
  }
  // Copies must not reuse the live page's ids. Inside charts the ids are
  // renamed (gradients and clipping refer to them); elsewhere they're removed.
  function uniquify(root) {
    var all = root.querySelectorAll("[id]");
    for (var i = 0; i < all.length; i++) {
      var e = all[i];
      if (e.closest && e.closest("svg")) e.setAttribute("id", "p_" + e.getAttribute("id"));
      else e.removeAttribute("id");
    }
    var refs = root.querySelectorAll("[fill], [stroke], [clip-path]");
    for (var j = 0; j < refs.length; j++) {
      ["fill", "stroke", "clip-path"].forEach(function (a) {
        var v = refs[j].getAttribute(a);
        if (v && v.indexOf("url(#") === 0) refs[j].setAttribute(a, "url(#p_" + v.slice(5));
      });
    }
  }
  function visible(el) {
    var cs = window.getComputedStyle ? window.getComputedStyle(el) : null;
    return !(cs && cs.display === "none");
  }
  // Copy a block without its touch layers and cursors. Charts keep the exact
  // size they were just drawn at.
  function cleanCopy(el) {
    var c = el.cloneNode(true);
    var live = el.querySelectorAll("svg"), copies = c.querySelectorAll("svg");
    for (var n = 0; n < copies.length && n < live.length; n++) {
      copies[n].style.height = live[n].getBoundingClientRect().height + "px";
      copies[n].style.width = "100%";
    }
    var drop = c.querySelectorAll(".touch, #touch, [id^='cur'], .seg, .hint, button");
    for (var d = 0; d < drop.length; d++) if (drop[d].parentNode) drop[d].parentNode.removeChild(drop[d]);
    return c;
  }
  // The page's title, its content blocks, and its notes, copied from the live view
  function collect() {
    var head = document.createElement("div"), foot = document.createElement("div"), blocks = [];
    head.className = "printHead";
    foot.className = "printFoot";
    var kids = document.body.children;
    for (var i = 0; i < kids.length; i++) {
      var k = kids[i], cl = k.classList;
      if (k.tagName === "SCRIPT" || k.tagName === "STYLE" || k.id === "shareBtn" || !visible(k)) continue;
      if (cl && (cl.contains("hint") || cl.contains("seg") || cl.contains("print"))) continue;
      if (cl && (cl.contains("ticker") || cl.contains("name"))) { head.appendChild(cleanCopy(k)); continue; }
      if (cl && cl.contains("note")) { foot.appendChild(cleanCopy(k)); continue; }
      if (k.id === "panels" || k.id === "blocks") {
        for (var j = 0; j < k.children.length; j++) if (visible(k.children[j])) blocks.push(cleanCopy(k.children[j]));
        continue;
      }
      blocks.push(cleanCopy(k));
    }
    return { head: head, foot: foot, blocks: blocks };
  }
  function sheetFrom(parts, width, info) {
    var sheet = document.createElement("div");
    sheet.className = "print";
    sheet.setAttribute("style", "position:absolute;left:-10000px;top:0;padding:18px 18px 20px;box-sizing:border-box;width:" + width + "px");
    var stamp = document.createElement("div");
    stamp.className = "printStamp";
    stamp.innerHTML = "Data through " + info.asOf + "<br>Snapshot " + new Date().toLocaleString();
    parts.head.appendChild(stamp);
    var col = document.createElement("div");
    col.className = "printCol";
    for (var i = 0; i < parts.blocks.length; i++) col.appendChild(parts.blocks[i]);
    sheet.appendChild(parts.head);
    sheet.appendChild(col);
    sheet.appendChild(parts.foot);
    document.body.appendChild(sheet);
    return sheet;
  }
  // Redraw the live charts with the PDF's chart heights at a given page width
  // (0 = the phone's own width), or put them back.
  function redrawAt(width) {
    document.body.classList.add("printing");
    document.body.style.width = width ? width + "px" : "";
    window.dispatchEvent(new Event("resize"));
  }
  function restore() {
    document.body.classList.remove("printing");
    document.body.style.width = "";
    window.dispatchEvent(new Event("resize"));
  }
  // One portrait page that always fills the page width: measure the view at
  // the phone's width, then widen it just enough that its height fits the page
  // at full width, redraw the charts at that width, and capture.
  var PAGE_W = 540, PAGE_H = 720, MIN_W = 460; // points; letter minus half-inch margins
  function makePdf(info) {
    var phoneW = document.body.clientWidth || 390, sheet = null, W = MIN_W;
    try {
      redrawAt(0);
      var probe = sheetFrom(collect(), phoneW, info);
      var tall = probe.scrollHeight || 800;
      probe.parentNode.removeChild(probe);
      W = Math.max(MIN_W, phoneW, Math.ceil((tall * PAGE_W) / PAGE_H));
      redrawAt(W);
      sheet = sheetFrom(collect(), W, info);
    } finally {
      restore();
    }
    recolor(sheet);
    uniquify(sheet);
    var w = sheet.offsetWidth || W, h = sheet.scrollHeight || 800;
    var scale = Math.max(1.5, Math.min(3, Math.sqrt(16000000 / (w * h)))); // stay under iOS canvas limits
    return window.html2canvas(sheet, { scale: scale, backgroundColor: "#FFFFFF", logging: false, useCORS: true })
      .then(function (canvas) {
        var fit = Math.min(PAGE_W / w, PAGE_H / h);
        var pdf = new window.jspdf.jsPDF({ unit: "pt", format: "letter", orientation: "portrait" });
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", (612 - w * fit) / 2, 36, w * fit, h * fit);
        if (sheet.parentNode) sheet.parentNode.removeChild(sheet);
        return pdf.output("datauristring").split(",")[1];
      }, function (err) {
        if (sheet.parentNode) sheet.parentNode.removeChild(sheet);
        throw err;
      });
  }

  var busy = false;
  window.__shareReq = null;
  btn.addEventListener("click", function () {
    if (busy) return;
    busy = true;
    label("Making PDF…");
    var info = window.shareInfo ? window.shareInfo() : { title: document.title || "Chart", name: "", asOf: "" };
    var custom = typeof window.printPdf === "function";
    (custom
      ? readyPdf().then(loadFonts).then(function (fonts) {
          return window.printPdf(window.jspdf.jsPDF, fonts).output("datauristring").split(",")[1];
        })
      : ready().then(function () { return makePdf(info); }))
      .then(function (b64) {
        window.__shareReq = { title: info.title, name: info.name, asOf: info.asOf, pdf: b64 };
        label("Opening…");
      }, function (e) {
        window.__shareReq = { error: (e && e.message) || "Unknown problem" };
        label("Share");
      })
      .then(function () {
        busy = false;
        setTimeout(function () { label("Share"); }, 5000);
      });
  });
  window.__takeShare = function () {
    var r = window.__shareReq;
    window.__shareReq = null;
    return r ? JSON.stringify(r) : null;
  };
  window.__shareDone = function () { label("Share"); };
})();
`;

const sleep = (ms) => new Promise((r) => Timer.schedule(ms, false, r));

async function handleShare(req) {
  if (req.error) {
    const a = new Alert();
    a.title = "Couldn't make the PDF";
    a.message = req.error;
    a.addAction("OK");
    await a.present();
    return;
  }
  const fm = FileManager.local();
  const name = `${req.title} - ${req.asOf}`.replace(/[\\/:*?"<>|]/g, "-").slice(0, 80);
  const path = fm.joinPath(fm.temporaryDirectory(), `${name}.pdf`);
  fm.write(path, Data.fromBase64String(req.pdf));

  const a = new Alert();
  a.title = "Share as PDF";
  a.message = `${name}.pdf`;
  a.addAction("Email");
  a.addAction("Preview & share…");
  a.addAction("Save to Files");
  a.addCancelAction("Cancel");
  const choice = await a.presentSheet();
  try {
    if (choice === 0) {
      const m = new Mail();
      m.subject = `${req.title}${req.name ? ` (${req.name})` : ""} \u2013 ${req.asOf}`;
      m.body = `${req.title}, data through ${req.asOf}. The PDF is attached; sources are listed at the bottom of the page.`;
      m.addFileAttachment(path);
      await m.send();
    } else if (choice === 1) {
      await QuickLook.present(path, true);
    } else if (choice === 2) {
      await DocumentPicker.exportFile(path);
    }
  } catch (e) {
    // Mail isn't set up, or the preview couldn't open here: save to Files instead
    const b = new Alert();
    b.title = "Couldn't open that here";
    b.message = "Saving the PDF to Files instead, so you can share it from there.";
    b.addAction("OK");
    await b.present();
    try {
      await DocumentPicker.exportFile(path);
    } catch (e2) {}
  }
}

// While the full-screen view is open, pick up Share taps from the page.
// Anything that can't be shown over the open view is shared once it closes.
async function sharePoller(wv, isOpen) {
  const later = [];
  while (isOpen()) {
    await sleep(600);
    if (!isOpen()) break;
    let raw = null;
    try {
      raw = await wv.evaluateJavaScript("window.__takeShare ? window.__takeShare() : null");
    } catch (e) {}
    if (!raw) continue;
    const req = JSON.parse(raw);
    try {
      await handleShare(req);
    } catch (e) {
      later.push(req);
    }
    try {
      await wv.evaluateJavaScript("window.__shareDone && window.__shareDone()");
    } catch (e) {}
  }
  return later;
}

// Present a loaded page with sharing, running `background` alongside
async function presentWithSharing(wv, background) {
  let open = true;
  const closed = wv.present(true).then(() => {
    open = false;
  });
  const sharing = sharePoller(wv, () => open);
  try {
    await background(() => open);
  } catch (e) {}
  const later = await sharing;
  await closed;
  for (const req of later) {
    try {
      await handleShare(req);
    } catch (e) {}
  }
}

// ---------- Full screen ----------
// Note: the page script below avoids backticks, backslashes and dollar-brace
// on purpose, because the whole page lives inside a template literal.
const PAGE_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  :root { --bg:#1C1C1E; --fg:#FFFFFF; --gray:#98989F; --rule:#3A3A3C; }
  * { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  body { margin:0; padding:20px 18px 36px; background:var(--bg); color:var(--fg);
         font-family:-apple-system,system-ui,sans-serif; -webkit-user-select:none; user-select:none; }
  .ticker { font-size:26px; font-weight:800; letter-spacing:-0.3px; }
  .name { color:var(--gray); font-size:13.5px; font-weight:600; margin-top:3px; line-height:1.35; }
  .hint { color:var(--gray); font-size:12px; margin-top:6px; }
  .loading { font-size:15px; margin-top:40px; text-align:center; }
  .err { color:#FF9F0A; font-size:13px; margin-top:24px; line-height:1.4; }
  .err button { display:block; margin-top:10px; border:0; border-radius:10px; padding:9px 16px; background:#2C2C2E; color:#FFFFFF; font:inherit; font-weight:600; }
  .seg { display:flex; gap:6px; margin-top:14px; }
  .seg button { flex:1; border:0; border-radius:10px; padding:7px 0; background:#2C2C2E; color:#FFFFFF; font:inherit; font-size:13.5px; font-weight:600; }
  .seg button.on { background:#FFFFFF; color:#000000; }
  .legend { display:flex; gap:14px; flex-wrap:wrap; font-size:12.5px; font-weight:600; margin-top:12px; align-items:center; }
  .legend i { display:inline-block; width:11px; height:11px; border-radius:2px; margin-right:6px; vertical-align:-1px; }
  .legend i.line { width:14px; height:3px; border-radius:2px; vertical-align:middle; }
  .h2 { font-size:12px; font-weight:700; color:var(--gray); letter-spacing:0.4px; margin:22px 0 4px; text-transform:uppercase; }
  .ro { font-size:13.5px; font-weight:600; min-height:20px; margin-bottom:4px; }
  svg.chart { display:block; width:100%; height:240px; }
  .wrap { position:relative; }
  .touch { position:absolute; left:0; top:0; right:0; bottom:0; touch-action:pan-y; }
  select.pick { width:100%; border:0; border-radius:10px; padding:9px 10px; background:#2C2C2E; color:#FFFFFF;
                font:inherit; font-size:14px; font-weight:600; -webkit-appearance:none; appearance:none; margin:4px 0 8px; }
  .note { color:var(--gray); font-size:10.5px; line-height:1.45; margin-top:22px; }
  .regions { display:flex; gap:6px; overflow-x:auto; margin:6px 0 8px; scrollbar-width:none; }
  .regions::-webkit-scrollbar { display:none; }
  .regions button { flex:none; border:0; border-radius:14px; padding:6px 12px; background:#2C2C2E; color:#FFFFFF; font:inherit; font-size:13px; font-weight:600; }
  .regions button.on { background:#FFFFFF; color:#000000; }
  svg.map { display:block; width:100%; height:auto; }
  .scale { display:flex; align-items:center; gap:8px; font-size:11px; color:var(--gray); margin:6px 0 2px; }
  .scale .bar { flex:1; height:8px; border-radius:4px; }
</style>
</head>
<body>
<div class="ticker" id="ttl">Payment vs 10Y ago</div>
<div class="name" id="sub"></div>
<div class="hint" id="progress"></div>
<div class="hint loading" id="loading">Loading Zillow and Freddie Mac data…</div>
<div class="hint err" id="err" style="display:none"></div>
<div id="blocks" style="display:none">
  <div>
    <div class="seg" id="spans"></div>
    <div class="legend"><span><i class="line" style="background:#FFFFFF"></i>Total change</span><span><i style="background:#64A8FF"></i>Due to price</span><span><i style="background:#FFD60A"></i>Due to rate</span></div>
    <div class="hint">Hold to read · pinch to zoom · double-tap to reset</div>
  </div>
  <div>
    <div class="h2">U.S.</div>
    <div class="ro" id="ro1"></div>
    <div class="wrap"><svg class="chart" id="c1"></svg><div class="touch" id="t1"></div></div>
  </div>
  <div>
    <div class="h2" id="mh">Metro</div>
    <div class="regions seg" id="regions"></div>
    <svg class="map" id="map"></svg>
    <div class="scale"><span id="scLo"></span><div class="bar" id="scBar"></div><span id="scHi"></span></div>
    <div class="hint">Tap a dot to chart that metro · color = monthly change · size = market size</div>
    <div class="seg"><select class="pick" id="pick"></select></div>
    <div class="ro" id="ro2"></div>
    <div class="wrap"><svg class="chart" id="c2"></svg><div class="touch" id="t2"></div></div>
  </div>
</div>
<div class="note" id="note"></div>
<script>
var D = __DATA__;
var MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
var BLUE = "#64A8FF", GOLD = "#FFD60A";
var state = { years: 10, metro: -1, cursor: null };
var WINDOW = 144; // months on screen at first: the last 12 years
// The timeline: every month the U.S. series has for this span. view.a..view.b
// index into it; both charts always show the same months.
var TL = [], view = { a: 0, b: 0 }, MIN_SPAN = 12, touched = false;
function setView(a, b) {
  var I = TL.length - 1;
  var span = Math.round(Math.max(Math.min(MIN_SPAN, I), Math.min(I, b - a)));
  a = Math.round(a);
  if (a < 0) a = 0;
  if (a + span > I) a = I - span;
  view.a = Math.max(0, a); view.b = view.a + span;
  renderCharts();
}
function resetView() { var I = TL.length - 1; view.b = Math.max(0, I); view.a = Math.max(0, I - (WINDOW - 1)); }
function el(id) { return document.getElementById(id); }
function esc(s) { return String(s).split("&").join("&amp;").split("<").join("&lt;").split(">").join("&gt;").split('"').join("&quot;"); }
function mLong(m) { return MONTHS[+m.slice(5, 7) - 1] + " " + m.slice(0, 4); }
function money(v) { return (v < 0 ? "−" : "+") + "$" + Math.abs(Math.round(v)).toLocaleString("en-US"); }
function axisMoney(v) { return (v < 0 ? "−$" : "$") + Math.abs(v).toLocaleString("en-US"); }
function payment(price, rate) { var loan = price * (1 - D.down), i = rate / 1200; return loan * i / (1 - Math.pow(1 + i, -D.term)); }
function decompose(vals, years) {
  var out = [], lag = years * 12;
  for (var k = lag; k < D.months.length; k++) {
    var m = D.months[k], m0 = D.months[k - lag], p1 = vals[k], p0 = vals[k - lag], r1 = D.rates[m], r0 = D.rates[m0];
    if (!(p1 > 0 && p0 > 0 && r1 > 0 && r0 > 0)) continue;
    var before = payment(p0, r0), total = payment(p1, r1) - before, price = payment(p1, r0) - before;
    out.push({ m: m, t: total, p: price, r: total - price });
  }
  return out;
}
function niceStep(range) { var raw = range / 5, p = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)), f = raw / p; return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p; }
function readout(id, rows, label) {
  if (!rows.length || !TL.length) { el(id).textContent = "Not enough history for this span"; return; }
  var k = state.cursor != null ? state.cursor : view.b, m = TL[Math.max(0, Math.min(TL.length - 1, k))], q = null;
  for (var j = rows.length - 1; j >= 0; j--) if (rows[j].m === m) { q = rows[j]; break; }
  if (!q) { el(id).textContent = mLong(m) + " · no data"; return; }
  el(id).innerHTML = mLong(q.m) + ' <span style="color:#98989F;font-weight:500">vs ' + MONTHS[+q.m.slice(5, 7) - 1] + " " + (+q.m.slice(0, 4) - state.years) + "</span>";
}
// Stacked areas: price (blue) and rate (gold) stack up from zero when
// positive and down from zero when negative; the white line is the total.
// Each month sits at the center of its slot so scrubbing lines up as before.
// The right gutter labels total / price / rate for the month being read.
var RPAD = 92;
var LAYERS = [
  { k: "p", top: function (q) { return Math.max(q.p, 0); }, bot: function () { return 0; } },
  { k: "p", top: function () { return 0; }, bot: function (q) { return Math.min(q.p, 0); } },
  { k: "r", top: function (q) { return Math.max(q.p, 0) + Math.max(q.r, 0); }, bot: function (q) { return Math.max(q.p, 0); } },
  { k: "r", top: function (q) { return Math.min(q.p, 0); }, bot: function (q) { return Math.min(q.p, 0) + Math.min(q.r, 0); } }
];
function stackOf(q) {
  var pt = Math.max(q.p, 0), pb = Math.min(q.p, 0);
  return { pTop: pt, pBot: pb, rTop: q.r >= 0 ? pt + q.r : pb, rBot: q.r >= 0 ? pt : pb + q.r };
}
function draw(svg, rows) {
  var r = svg.getBoundingClientRect(), w = Math.max(240, r.width), h = Math.max(120, r.height);
  var L = 50, R = w - RPAD, T = 10, B = h - 22;
  var s = "", byM = {};
  rows.forEach(function (q) { byM[q.m] = q; });
  var vis = [];
  for (var k = view.a; k <= view.b && k < TL.length; k++) vis.push(byM[TL[k]] || { m: TL[k], gap: true });
  var n = vis.length;
  svg.__geo = { L: L, w: R - L };
  if (!n || !rows.length) { svg.innerHTML = ""; return; }
  rows = vis;
  var lo = 0, hi = 0;
  rows.forEach(function (q) { if (q.gap) return; var k2 = stackOf(q); lo = Math.min(lo, k2.pBot, k2.rBot, q.t); hi = Math.max(hi, k2.pTop, k2.rTop, q.t); });
  var st = niceStep((hi - lo) || 100); lo = Math.floor(lo / st) * st; hi = Math.ceil(hi / st) * st;
  if (hi === lo) hi = lo + st;
  var bw = (R - L) / n;
  function X(i) { return L + i * bw + bw / 2; }
  function Y(v) { return B - (v - lo) / (hi - lo) * (B - T); }
  for (var v = lo; v <= hi + st / 2; v += st) {
    var zero = Math.abs(v) < st / 1000;
    s += '<line x1="' + L + '" x2="' + R + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '" stroke="' + (zero ? "#8E8E93" : "#2F2F33") + '" stroke-width="' + (zero ? 1.2 : 0.7) + '"/>';
    s += '<text x="' + (L - 6) + '" y="' + (Y(v) + 3.5).toFixed(1) + '" fill="#98989F" font-size="10" text-anchor="end">' + axisMoney(Math.round(v)) + '</text>';
  }
  // runs of months with data, each drawn as two filled bands
  var runs = [], cur = [];
  rows.forEach(function (q, i) { if (q.gap) { if (cur.length) runs.push(cur); cur = []; } else cur.push(i); });
  if (cur.length) runs.push(cur);
  function band(run, top, bot, color, op) {
    var d = "";
    run.forEach(function (i, j) { d += (j ? "L" : "M") + X(i).toFixed(1) + "," + Y(top(rows[i])).toFixed(1); });
    for (var j = run.length - 1; j >= 0; j--) d += "L" + X(run[j]).toFixed(1) + "," + Y(bot(rows[run[j]])).toFixed(1);
    return '<path d="' + d + 'Z" fill="' + color + '" fill-opacity="' + op + '"/>';
  }
  // four layers that each stay continuous when price or rate changes sign
  runs.forEach(function (run) {
    if (run.length === 1) run = [run[0], run[0]];
    LAYERS.forEach(function (ly) { s += band(run, ly.top, ly.bot, ly.k === "p" ? BLUE : GOLD, ly.k === "p" ? 0.78 : 0.82); });
  });
  var d = "", pen = false;
  rows.forEach(function (q, i) { if (q.gap) { pen = false; return; } d += (pen ? "L" : "M") + X(i).toFixed(1) + "," + Y(q.t).toFixed(1); pen = true; });
  s += '<path d="' + d + '" fill="none" stroke="#1C1C1E" stroke-width="4.5" stroke-linejoin="round" stroke-opacity="0.55"/>';
  s += '<path d="' + d + '" fill="none" stroke="#FFFFFF" stroke-width="2.4" stroke-linejoin="round"/>';
  // x labels: years, or quarters when zoomed in close
  var years = n / 12, step = years <= 6 ? 1 : years <= 14 ? 2 : 3, lastX = -99;
  rows.forEach(function (q, i) {
    var mo = q.m.slice(5, 7), lab = null;
    if (years <= 2.5) { if (mo === "01") lab = "’" + q.m.slice(2, 4); else if (mo === "04" || mo === "07" || mo === "10") lab = MONTHS[+mo - 1]; }
    else if (mo === "01" && (+q.m.slice(0, 4)) % step === 0) lab = q.m.slice(0, 4);
    var x = X(i);
    if (lab && x - lastX > 26 && x < R - 8) { s += '<text x="' + x.toFixed(1) + '" y="' + (h - 6) + '" fill="#98989F" font-size="10" text-anchor="middle">' + lab + '</text>'; lastX = x; }
  });
  // the month being read: under the finger, or the latest in view
  var ci = state.cursor != null ? state.cursor - view.a : n - 1;
  while (ci > 0 && rows[ci] && rows[ci].gap && state.cursor == null) ci--;
  if (state.cursor != null && ci >= 0 && ci < n) {
    var cx = X(ci);
    s += '<line id="cur" x1="' + cx + '" x2="' + cx + '" y1="' + T + '" y2="' + B + '" stroke="#FFFFFF" stroke-width="1" stroke-dasharray="3 2"/>';
  }
  var q0 = rows[ci];
  if (q0 && !q0.gap) {
    var k0 = stackOf(q0);
    s += '<circle cx="' + X(ci).toFixed(1) + '" cy="' + Y(q0.t).toFixed(1) + '" r="4" fill="#FFFFFF" stroke="#1C1C1E" stroke-width="1.5"/>';
    var items = [
      { y: Y(q0.t), v: money(q0.t), t: "total", c: "#FFFFFF" },
      { y: Y((k0.pTop + k0.pBot) / 2), v: money(q0.p), t: "price", c: BLUE },
      { y: Y((k0.rTop + k0.rBot) / 2), v: money(q0.r), t: "rate", c: GOLD }
    ];
    items.sort(function (p, q) { return p.y - q.y; });
    for (var a = 1; a < items.length; a++) if (items[a].y - items[a - 1].y < 15) items[a].y = items[a - 1].y + 15;
    var over = items[items.length - 1].y - (B - 2);
    if (over > 0) items.forEach(function (it) { it.y -= over; });
    for (var b2 = items.length - 2; b2 >= 0; b2--) if (items[b2 + 1].y - items[b2].y < 15) items[b2].y = items[b2 + 1].y - 15;
    items.forEach(function (it) {
      s += '<text x="' + (R + 8) + '" y="' + (it.y + 4).toFixed(1) + '" font-size="12" fill="' + it.c + '"><tspan font-weight="700">' + it.v + '</tspan><tspan dx="4" font-size="10.5" fill-opacity="0.85">' + it.t + '</tspan></text>';
    });
  }
  svg.innerHTML = s;
}
function renderCharts() { draw(el("c1"), usRows); draw(el("c2"), mRows); readout("ro1", usRows); readout("ro2", mRows); }
var usRows = [], mRows = [];
function renderSpans() {
  el("spans").innerHTML = [1, 2, 5, 10].map(function (y) { return '<button data-y="' + y + '" class="' + (y === state.years ? "on" : "") + '">' + y + "Y</button>"; }).join("");
  var bs = el("spans").querySelectorAll("button");
  for (var i = 0; i < bs.length; i++) bs[i].onclick = function () { state.years = +this.getAttribute("data-y"); state.cursor = null; touched = false; renderAll(); };
}
function renderPicker() {
  var order = D.metros.map(function (m, i) { return i; }).sort(function (a, b) { return D.metros[a].name < D.metros[b].name ? -1 : 1; });
  el("pick").innerHTML = order.map(function (i) { return '<option value="' + i + '"' + (i === state.metro ? " selected" : "") + ">" + esc(D.metros[i].name) + "</option>"; }).join("");
}
// ---------- Metro map ----------
var REGIONS = [
  { k: "U.S." },
  { k: "West", vb: [20, 20, 460, 460] },
  { k: "Texas", vb: [380, 390, 200, 170] },
  { k: "Midwest", vb: [465, 110, 350, 240] },
  { k: "Southeast", vb: [575, 315, 310, 290] },
  { k: "Northeast", vb: [715, 75, 260, 245] }
];
var mapRegion = 0, STATE_PATH = "";
function mix(a, b, t) {
  var pa = [1, 3, 5].map(function (i) { return parseInt(a.slice(i, i + 2), 16); }), pb = [1, 3, 5].map(function (i) { return parseInt(b.slice(i, i + 2), 16); });
  return "#" + pa.map(function (v, i) { var x = Math.round(v + (pb[i] - v) * t).toString(16); return x.length < 2 ? "0" + x : x; }).join("");
}
// Gray at no change; amber then red as payments rise; green where they fell
function colorFor(v, vmax) {
  var t = Math.min(1, Math.abs(v) / vmax);
  if (v < 0) return mix("#98989F", "#30D158", t);
  return t < 0.5 ? mix("#98989F", "#FF9F0A", t * 2) : mix("#FF9F0A", "#FF453A", (t - 0.5) * 2);
}
function latestTotals() {
  var out = [];
  D.metros.forEach(function (m, i) {
    if (m.x == null) return;
    var r = decompose(m.v, state.years);
    if (r.length) out.push({ i: i, m: m, t: r[r.length - 1].t });
  });
  return out;
}
function renderMap() {
  var svg = el("map"), vb = REGIONS[mapRegion].vb || [0, 0, D.mapW, D.mapH], z = D.mapW / vb[2];
  svg.setAttribute("viewBox", vb.join(" "));
  var pts = latestTotals(), abs = pts.map(function (p) { return Math.abs(p.t); }).sort(function (a, b) { return a - b; });
  var vmax = Math.max(50, abs.length ? abs[Math.floor(0.9 * (abs.length - 1))] : 100);
  pts.sort(function (a, b) { return (a.m.rank || 999) - (b.m.rank || 999); }); // biggest first, small ones drawn on top
  var s = '<path d="' + STATE_PATH + '" fill="#2C2C2E" stroke="#48484A" stroke-width="1" vector-effect="non-scaling-stroke"/>', labels = "", boxes = [], sel = null;
  pts.forEach(function (p) {
    p.r = Math.max(6, 30 * Math.pow(1 / Math.max(1, p.m.rank || 150), 0.375)) / Math.sqrt(z);
    if (p.i === state.metro) sel = p;
    s += '<circle cx="' + p.m.x + '" cy="' + p.m.y + '" r="' + p.r.toFixed(2) + '" fill="' + colorFor(p.t, vmax) + '" fill-opacity="0.9" stroke="#000000" stroke-width="' + (1.4 / z).toFixed(2) + '"/>';
  });
  if (z >= 1.9) {
    var fs = 26 / z;
    pts.forEach(function (p) {
      var name = p.m.name.split(",")[0].split("-")[0], w = name.length * fs * 0.56, h = fs * 1.1, gap = 4 / z;
      var tries = [p.m.x + p.r + gap, p.m.x - p.r - gap - w];
      for (var t = 0; t < 2; t++) {
        var bx = tries[t], by = p.m.y - h / 2, ok = true;
        for (var j = 0; j < boxes.length && ok; j++) { var o = boxes[j]; if (bx < o.x + o.w && bx + w > o.x && by < o.y + o.h && by + h > o.y) ok = false; }
        if (ok) {
          boxes.push({ x: bx, y: by, w: w, h: h });
          labels += '<text x="' + bx.toFixed(1) + '" y="' + (p.m.y + fs * 0.35).toFixed(1) + '" font-size="' + fs.toFixed(1) + '" font-weight="600" fill="#E5E5EA" stroke="#000000" stroke-width="' + (5 / z).toFixed(2) + '" paint-order="stroke">' + esc(name) + '</text>';
          break;
        }
      }
    });
  }
  if (sel) s += '<circle cx="' + sel.m.x + '" cy="' + sel.m.y + '" r="' + (sel.r + 5 / z).toFixed(2) + '" fill="none" stroke="#FFFFFF" stroke-width="' + (4 / z).toFixed(2) + '"/>';
  svg.innerHTML = s + labels;
  svg.__pts = pts;
  el("scLo").textContent = "−$" + Math.round(vmax).toLocaleString("en-US");
  el("scHi").textContent = "+$" + Math.round(vmax).toLocaleString("en-US");
  el("scBar").style.background = "linear-gradient(90deg, #30D158, #98989F 50%, #FF9F0A 75%, #FF453A)";
  el("regions").innerHTML = REGIONS.map(function (r, i) { return '<button data-i="' + i + '" class="' + (i === mapRegion ? "on" : "") + '">' + r.k + "</button>"; }).join("");
  var bs = el("regions").querySelectorAll("button");
  for (var i = 0; i < bs.length; i++) bs[i].onclick = function () { mapRegion = +this.getAttribute("data-i"); renderMap(); };
}
// Tap a dot to chart it: inside overlapping dots the smallest wins, else the nearest within 22 points
el("map").addEventListener("click", function (e) {
  var svg = el("map"), r = svg.getBoundingClientRect(), vb = REGIONS[mapRegion].vb || [0, 0, D.mapW, D.mapH];
  var k = vb[2] / r.width, qx = vb[0] + (e.clientX - r.left) * k, qy = vb[1] + (e.clientY - r.top) * k, inside = null, best = null, bd = Infinity;
  (svg.__pts || []).forEach(function (p) {
    var d = Math.sqrt((p.m.x - qx) * (p.m.x - qx) + (p.m.y - qy) * (p.m.y - qy)) - p.r;
    if (d <= 0 && (!inside || p.r < inside.r)) inside = p;
    if (d < bd) { bd = d; best = p; }
  });
  var hit = inside || (best && bd / k < 22 ? best : null);
  if (hit) { state.metro = hit.i; state.cursor = null; renderPicker(); renderAll(); }
});

function renderAll() {
  var ny = D.next ? D.next.split("-") : null;
  el("ttl").textContent = "Payment vs " + state.years + "Y ago";
  usRows = decompose(D.us, state.years);
  var oldEnd = TL.length ? TL[view.b] : null;
  TL = usRows.map(function (q) { return q.m; });
  if (!touched) resetView();
  else { var span = view.b - view.a, e = oldEnd ? TL.indexOf(oldEnd) : -1; setViewQuiet(e >= 0 ? e - span : TL.length - 1 - span, e >= 0 ? e : TL.length - 1); }
  var last = usRows.length ? usRows[usRows.length - 1].m : D.months[D.months.length - 1];
  el("sub").textContent = "Typical home, 20% down, 30Y fixed · data " + mLong(last) + (ny ? " · next ~" + MONTHS[+ny[1] - 1] + " " + (+ny[2]) : "");
  renderSpans();
  var mt = D.metros[state.metro];
  el("mh").textContent = "Metro · " + (mt ? mt.name : "");
  renderMap();
  mRows = mt ? decompose(mt.v, state.years) : [];
  renderCharts();
  el("note").textContent = "Monthly principal and interest on the typical home with 20% down and a 30-year fixed, vs the same month " + state.years + " year" + (state.years > 1 ? "s" : "") +
    " earlier. Price effect = payment at today’s price and the old rate, minus the old payment; rate effect = the rest (so the part from prices and rates moving together counts as rate). Excludes taxes and insurance. " +
    "Home values: Zillow Home Value Index, typical home (middle third), smoothed and seasonally adjusted, for the U.S. and " + D.metros.length + " big metros (the Redfin widget’s list; Redfin’s sub-areas such as Fort Worth or Nassau County count as their whole metro). Rate: Freddie Mac 30-year fixed (FRED: MORTGAGE30US), monthly average. " +
    "Map: each of those metros at its main city; color = its total monthly change for the span shown (green = cheaper, gray = little change, amber to red = more expensive, scaled to the 90th percentile); size = Zillow’s size rank. " +
    "Zillow posts monthly, around mid-month; the next date is an estimate." + (D.zillowModified ? " Zillow file dated " + D.zillowModified + "." : "");
  el("progress").textContent = D.progress || "";
  el("progress").style.color = (D.progress || "").indexOf("unreachable") >= 0 ? "#FF9F0A" : "";
}
function setViewQuiet(a, b) {
  var I = TL.length - 1, span = Math.max(Math.min(MIN_SPAN, I), Math.min(I, b - a));
  a = Math.max(0, Math.min(I - span, Math.round(a)));
  view.a = Math.max(0, a); view.b = view.a + span;
}
// One finger reads a month on both charts. Two fingers pinch to zoom and drag
// to pan; double-tap resets to the last 12 years. A vertical swipe still scrolls.
var fingers = {}, pinch = null, pinchLock = false, rafId = 0, pendingView = null, lastTap = null, activeSvg = "c1";
function fingerIds() { return Object.keys(fingers); }
function posAt(clientX) {
  var svg = el(activeSvg), g = svg.__geo || { L: 50, w: 300 }, r = svg.getBoundingClientRect();
  var f = Math.max(0, Math.min(1, (clientX - r.left - g.L) / g.w));
  return { f: f, pos: view.a + f * (view.b - view.a + 1) };
}
function idxAt(clientX) { return Math.max(view.a, Math.min(view.b, Math.floor(posAt(clientX).pos))); }
function pinchNow() {
  var ks = fingerIds(), p = fingers[ks[0]], q = fingers[ks[1]];
  var dx = p.x - q.x, dy = p.y - q.y;
  return { dist: Math.max(Math.sqrt(dx * dx + dy * dy), 10), mid: (p.x + q.x) / 2 };
}
function scheduleView(a, b) {
  pendingView = [a, b];
  if (rafId) return;
  rafId = requestAnimationFrame(function () { rafId = 0; var v = pendingView; pendingView = null; setView(v[0], v[1]); });
}
function scrub(i) { state.cursor = i; renderCharts(); }
function onDown(svgId, e) {
  fingers[e.pointerId] = { x: e.clientX, y: e.clientY };
  var n = fingerIds().length;
  if (n === 1) activeSvg = svgId;
  if (n === 2) {
    var st = pinchNow();
    pinch = { dist: st.dist, n: view.b - view.a, anchor: posAt(st.mid).pos };
    pinchLock = true; touched = true;
    lastTap = null; // a pinch's first finger isn't half of a double-tap
    state.cursor = null;
  } else if (n === 1 && !pinchLock) {
    var now = Date.now();
    if (lastTap && now - lastTap.t < 320 && Math.abs(e.clientX - lastTap.x) < 30) {
      lastTap = null; touched = false; state.cursor = null; resetView(); renderCharts(); return;
    }
    lastTap = { t: now, x: e.clientX };
    scrub(idxAt(e.clientX));
  }
}
function onMove(svgId, e) {
  if (!fingers[e.pointerId]) return;
  fingers[e.pointerId] = { x: e.clientX, y: e.clientY };
  if (pinch && fingerIds().length >= 2) {
    var st = pinchNow(), I = TL.length - 1;
    var n = Math.max(MIN_SPAN, Math.min(I, pinch.n * pinch.dist / st.dist));
    var a = pinch.anchor - posAt(st.mid).f * (n + 1);
    scheduleView(a, a + n);
  } else if (!pinchLock) {
    scrub(idxAt(e.clientX));
  }
}
function onUp(svgId, e) {
  delete fingers[e.pointerId];
  var n = fingerIds().length;
  if (n < 2) pinch = null;
  if (n === 0) { if (!pinchLock) scrub(null); pinchLock = false; }
}
["1", "2"].forEach(function (k) {
  var layer = el("t" + k), id = "c" + k;
  layer.addEventListener("pointerdown", function (e) { onDown(id, e); });
  layer.addEventListener("pointermove", function (e) { onMove(id, e); });
  layer.addEventListener("pointerup", function (e) { onUp(id, e); });
  layer.addEventListener("pointercancel", function (e) { onUp(id, e); });
  layer.addEventListener("pointerleave", function (e) { onUp(id, e); });
});
document.addEventListener("gesturestart", function (e) { e.preventDefault(); });
el("pick").addEventListener("change", function () { state.metro = +this.value; state.cursor = null; renderAll(); });

// Draw safely: never a silent black screen
var rendered = false, tries = 0;
function showError(msg) {
  el("loading").style.display = "none";
  var e = el("err"); e.style.display = "";
  e.innerHTML = "Couldn’t draw the charts: " + esc(msg) + '<button id="retry">Retry</button>';
  el("retry").onclick = function () { e.style.display = "none"; tries = 0; if (D) safeRender(); else { el("loading").style.display = ""; window.__wantData = true; } };
}
function safeRender() {
  if (!D) { window.__wantData = true; return; }
  if (document.body.clientWidth < 50 && tries++ < 25) { setTimeout(safeRender, 120); return; }
  try {
    el("blocks").style.display = "";
    renderAll();
    el("loading").style.display = "none"; el("err").style.display = "none";
    rendered = true; window.__rendered = true;
  } catch (e) { el("blocks").style.display = "none"; showError((e && e.message) || String(e)); }
}
window.onerror = function (msg) { if (!rendered) showError(String(msg)); };
window.update = function (n) {
  D = n; window.__wantData = false;
  STATE_PATH = D.states.split("|").map(function (r) { return "M" + r.split(" ").join("L") + "Z"; }).join("");
  if (state.metro < 0 || state.metro >= D.metros.length) {
    state.years = D.years || 10;
    var idx = -1;
    for (var i = 0; i < D.metros.length; i++) if (D.metros[i].name.indexOf(D.defaultMetro) === 0) { idx = i; break; }
    state.metro = idx >= 0 ? idx : 0;
    renderPicker();
  }
  safeRender();
  return "ok";
};
window.addEventListener("resize", function () { if (rendered) { try { renderAll(); } catch (e) {} } });
// Share as PDF: two 16:9 slides for the months and look-back on screen.
// 1) the U.S. chart, large; 2) the metro map (as zoomed on screen) beside the
// picked metro's chart. Headlines state the result; labels at the right edge
// give total / price / rate; a dark banner credits the sources. Vector.
window.printPdf = function (jsPDF, fonts) {
  var W = 792, H = 445.5;
  var doc = new jsPDF({ unit: "pt", format: [W, H], orientation: "landscape" });
  var FACE = "helvetica";
  if (fonts && fonts.regular && fonts.bold) {
    doc.addFileToVFS("Narrow-Regular.ttf", fonts.regular); doc.addFont("Narrow-Regular.ttf", "Narrow", "normal");
    doc.addFileToVFS("Narrow-Bold.ttf", fonts.bold); doc.addFont("Narrow-Bold.ttf", "Narrow", "bold");
    FACE = "Narrow";
  }
  var INK = [28, 28, 30], GRY = [110, 110, 115], RULE = [222, 222, 226];
  var PB = [56, 128, 214], PG = [222, 168, 0], PBL = [190, 214, 244], PGL = [248, 226, 150];
  function font(bold, size, c) { doc.setFont(FACE, bold ? "bold" : "normal"); doc.setFontSize(size); doc.setTextColor(c[0], c[1], c[2]); }
  function clean(t) { return String(t).split("−").join("-").split("’").join("'").split("–").join("-"); }
  function usd(v) { return "$" + Math.abs(Math.round(v)).toLocaleString("en-US"); }
  function sgnUsd(v) { return (v < 0 ? "-" : "+") + usd(v); }
  var Y0 = state.years, pages = 2;
  var a = view.a, b = view.b, months = TL.slice(a, b + 1), n = months.length;
  var span = mLong(months[0]) + " to " + mLong(months[n - 1]);
  var endsNow = b === TL.length - 1;
  function rowsIn(rows) { var by = {}; rows.forEach(function (q) { by[q.m] = q; }); return months.map(function (m) { return by[m] || null; }); }
  function lastRow(R) { for (var i = R.length - 1; i >= 0; i--) if (R[i]) return { q: R[i], i: i }; return null; }
  function headlineFor(place, q) {
    var dir = q.t >= 0 ? "Higher" : "Lower";
    var when = endsNow ? "Than " + Y0 + " Year" + (Y0 > 1 ? "s" : "") + " Ago" : "in " + mLong(q.m) + " Than " + Y0 + " Year" + (Y0 > 1 ? "s" : "") + " Earlier";
    var part = function (nm, v) { return nm + (v >= 0 ? " Added " : " Saved ") + usd(v); };
    return place + " Payment Is " + usd(q.t) + " a Month " + dir + " " + when + ": " + part("Prices", q.p) + ", " + part("Rates", q.r);
  }
  function headline(text) {
    var size = 21, lines;
    do { font(true, size, INK); lines = doc.splitTextToSize(clean(text), W - 72); size -= 1; } while (lines.length > 1 && size > 15);
    doc.text(lines, 36, 42);
    return 42 + (lines.length - 1) * (size + 4);
  }
  function titles(top, title, sub, cx, align) {
    font(true, 11.5, INK); doc.text(clean(title), cx, top + 30, { align: align || "center" });
    font(false, 9, GRY); doc.text(clean(sub), cx, top + 43, { align: align || "center" });
  }
  function banner(page) {
    var bh = 44, by = H - bh;
    doc.setFillColor(28, 28, 30); doc.rect(0, by, W, bh, "F");
    doc.setFillColor(201, 162, 39); doc.rect(W - 176, by + 6, 2, bh - 12, "F");
    font(false, 7.2, [235, 235, 240]);
    var src = "Sources: Zillow Home Value Index (typical home, smoothed, seasonally adjusted); Freddie Mac 30-year fixed rate (FRED: MORTGAGE30US), monthly average. " +
      "Principal and interest with 20% down on a 30-year fixed, vs the same month " + Y0 + " year" + (Y0 > 1 ? "s" : "") + " earlier. Price effect = payment at today's price and the old rate minus the old payment; rate effect = the rest. Excludes taxes and insurance.";
    doc.text(doc.splitTextToSize(src, W - 176 - 40 - 110), 28, by + 13);
    font(false, 7.5, [200, 200, 205]);
    doc.text("Data through " + mLong(months[n - 1]), W - 188, by + 20, { align: "right" });
    doc.text(page + " of " + pages, W - 188, by + 31, { align: "right" });
    font(true, 12.5, [255, 255, 255]);
    doc.text("Payment", W - 162, by + 20);
    doc.text("Change", W - 162, by + 34);
  }
  function poly(pts, c) {
    if (pts.length < 3) return;
    var rel = [];
    for (var k = 1; k < pts.length; k++) rel.push([pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]]);
    doc.setFillColor(c[0], c[1], c[2]);
    doc.lines(rel, pts[0][0], pts[0][1], [1, 1], "F", true);
  }
  // the stacked chart in a box; returns nothing, draws everything
  function chartP(R, L, Rt, T, B) {
    var lo = 0, hi = 0;
    R.forEach(function (q) { if (!q) return; var k = stackOf(q); lo = Math.min(lo, k.pBot, k.rBot, q.t); hi = Math.max(hi, k.pTop, k.rTop, q.t); });
    var st = niceStep((hi - lo) || 100); lo = Math.floor(lo / st) * st; hi = Math.ceil(hi / st) * st; if (hi === lo) hi = lo + st;
    var X = function (i) { return L + (n === 1 ? 0.5 : i / (n - 1)) * (Rt - L); }, Y = function (v) { return B - (v - lo) / (hi - lo) * (B - T); };
    for (var v = lo; v <= hi + st / 2; v += st) {
      var z = Math.abs(v) < st / 1000;
      if (z) { doc.setDrawColor(120, 120, 125); doc.setLineWidth(1); } else { doc.setDrawColor(RULE[0], RULE[1], RULE[2]); doc.setLineWidth(0.5); }
      doc.line(L, Y(v), Rt, Y(v));
      font(false, 8.5, GRY); doc.text((v < 0 ? "-$" : "$") + Math.abs(Math.round(v)).toLocaleString("en-US"), L - 6, Y(v) + 3, { align: "right" });
    }
    // bands, run by run
    var run = [];
    function flush() {
      if (run.length >= 2) {
        LAYERS.forEach(function (ly) {
          var pts = [];
          run.forEach(function (i) { pts.push([X(i), Y(ly.top(R[i]))]); });
          for (var j = run.length - 1; j >= 0; j--) pts.push([X(run[j]), Y(ly.bot(R[run[j]]))]);
          poly(pts, ly.k === "p" ? PB : PG);
        });
      }
      run = [];
    }
    for (var i = 0; i < n; i++) { if (R[i]) run.push(i); else flush(); }
    flush();
    doc.setDrawColor(INK[0], INK[1], INK[2]); doc.setLineWidth(2.2); if (doc.setLineJoin) doc.setLineJoin("round");
    var px = null, py = null;
    for (var i2 = 0; i2 < n; i2++) { if (!R[i2]) { px = null; continue; } var x = X(i2), y = Y(R[i2].t); if (px !== null) doc.line(px, py, x, y); px = x; py = y; }
    // dates
    var yrs = n / 12, stepY = yrs <= 6 ? 1 : yrs <= 14 ? 2 : 3, lastX = -99;
    doc.setLineWidth(0.5); doc.setDrawColor(150, 150, 155);
    months.forEach(function (m, i3) {
      var mo = m.slice(5, 7), lab = null;
      if (yrs <= 2.5) { if (mo === "01") lab = m.slice(0, 4); else if (mo === "04" || mo === "07" || mo === "10") lab = MONTHS[+mo - 1]; }
      else if (mo === "01" && (+m.slice(0, 4)) % stepY === 0) lab = m.slice(0, 4);
      var x3 = X(i3);
      if (!lab || x3 - lastX < 32 || x3 > Rt - 8) return;
      doc.line(x3, B, x3, B + 3); font(false, 8.5, GRY); doc.text(lab, x3, B + 13, { align: "center" }); lastX = x3;
    });
    // labels at the right edge for the last month
    var lr = lastRow(R);
    if (lr) {
      var q = lr.q, k3 = stackOf(q);
      doc.setFillColor(INK[0], INK[1], INK[2]); doc.circle(X(lr.i), Y(q.t), 2.6, "F");
      var items = [
        { y: Y(q.t), v: sgnUsd(q.t), t: "total", c: INK },
        { y: Y((k3.pTop + k3.pBot) / 2), v: sgnUsd(q.p), t: "from prices", c: PB },
        { y: Y((k3.rTop + k3.rBot) / 2), v: sgnUsd(q.r), t: "from rates", c: [176, 130, 0] }
      ];
      items.sort(function (p, q2) { return p.y - q2.y; });
      for (var a2 = 1; a2 < items.length; a2++) if (items[a2].y - items[a2 - 1].y < 14) items[a2].y = items[a2 - 1].y + 14;
      var ov = items[items.length - 1].y - B;
      if (ov > 0) items.forEach(function (it) { it.y -= ov; });
      items.forEach(function (it) {
        font(true, 10.5, it.c); doc.text(it.v, Rt + 8, it.y + 3.5);
        var tw = doc.getTextWidth(it.v); font(false, 9, it.c); doc.text(it.t, Rt + 12 + tw, it.y + 3.5);
      });
    }
  }
  function legendP(cx, y) {
    var items = [{ t: "Due to home prices", c: PB, box: true }, { t: "Due to the mortgage rate", c: PG, box: true }, { t: "Total change", c: INK }], total = 0;
    font(false, 9, INK);
    items.forEach(function (it) { it.w = doc.getTextWidth(it.t); total += (it.box ? 14 : 22) + it.w + 22; });
    var x = cx - (total - 22) / 2;
    items.forEach(function (it) {
      if (it.box) { doc.setFillColor(it.c[0], it.c[1], it.c[2]); doc.rect(x, y - 7.5, 9, 9, "F"); x += 14; }
      else { doc.setDrawColor(it.c[0], it.c[1], it.c[2]); doc.setLineWidth(2.2); doc.line(x, y - 3, x + 16, y - 3); x += 22; }
      font(false, 9, INK); doc.text(it.t, x, y); x += it.w + 22;
    });
  }
  var sub = "Typical home, 20% down, 30-year fixed, principal and interest · " + span;

  // ---- 1. U.S. ----
  var US = rowsIn(usRows), ul = lastRow(US);
  var top = headline(ul ? headlineFor("Typical U.S.", ul.q) : "Monthly Payment Change, U.S.");
  titles(top, "Change in the Monthly Payment vs the Same Month " + Y0 + " Year" + (Y0 > 1 ? "s" : "") + " Earlier", sub, W / 2);
  chartP(US, 78, W - 150, top + 58, H - 92);
  legendP(W / 2, H - 92 + 30);
  banner(1);

  // ---- 2. Metro: the map, then the metro's chart ----
  doc.addPage([W, H], "landscape");
  var mt = D.metros[state.metro], MR = rowsIn(mRows), ml = lastRow(MR), mName = mt ? mt.name.split(",")[0].split("-")[0] : "Metro";
  top = headline(ml ? headlineFor(mName, ml.q) : mName + " Payment Change");
  var region = REGIONS[mapRegion], vb = region.vb || [0, 0, D.mapW, D.mapH];
  var pL = 30, pR = 360, cxL = (pL + pR) / 2;
  titles(top, "Monthly Change by Metro, Latest Month", (region.vb ? region.k + " · " : "") + "vs " + Y0 + " year" + (Y0 > 1 ? "s" : "") + " earlier; dot size = market size", cxL);
  var mT = top + 56, mB = H - 104, sc = Math.min((pR - pL) / vb[2], (mB - mT) / vb[3]);
  var ox = cxL - vb[2] * sc / 2, oy = mT + ((mB - mT) - vb[3] * sc) / 2;
  var MX = function (x) { return ox + (x - vb[0]) * sc; }, MY = function (y) { return oy + (y - vb[1]) * sc; };
  doc.saveGraphicsState();
  doc.rect(ox, oy, vb[2] * sc, vb[3] * sc, null); doc.clip(); doc.discardPath();
  doc.setFillColor(237, 237, 240); doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.6);
  (D.states || "").split("|").forEach(function (ring) {
    var pts = ring.split(" ").map(function (q) { var c = q.split(","); return [MX(+c[0]), MY(+c[1])]; });
    if (pts.length < 3) return;
    var rel = [];
    for (var k2 = 1; k2 < pts.length; k2++) rel.push([pts[k2][0] - pts[k2 - 1][0], pts[k2][1] - pts[k2 - 1][1]]);
    doc.lines(rel, pts[0][0], pts[0][1], [1, 1], "FD", true);
  });
  var z = D.mapW / vb[2], dots = latestTotals();
  var absT = dots.map(function (p) { return Math.abs(p.t); }).sort(function (x, y) { return x - y; });
  var vmax = Math.max(50, absT.length ? absT[Math.floor(0.9 * (absT.length - 1))] : 100);
  var rgb = function (hex) { return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]; };
  dots.sort(function (x, y) { return (x.m.rank || 999) - (y.m.rank || 999); });
  var selDot = null;
  dots.forEach(function (p) {
    p.rr = Math.max(6, 30 * Math.pow(1 / Math.max(1, p.m.rank || 150), 0.375)) / Math.sqrt(z) * sc;
    var c = rgb(colorFor(p.t, vmax));
    doc.setFillColor(c[0], c[1], c[2]); doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.5);
    doc.circle(MX(p.m.x), MY(p.m.y), p.rr, "FD");
    if (p.i === state.metro) selDot = p;
  });
  if (selDot) {
    doc.setDrawColor(28, 28, 30); doc.setLineWidth(1.3);
    doc.circle(MX(selDot.m.x), MY(selDot.m.y), selDot.rr + 2.5, "S");
    font(true, 9.5, INK);
    doc.text(clean(mName + " " + sgnUsd(selDot.t)), MX(selDot.m.x) + selDot.rr + 5, MY(selDot.m.y) + 3.5);
  }
  doc.restoreGraphicsState();
  var sy = H - 96, sx0 = pL + 44, sx1 = pR - 44, steps = 48;
  for (var q2 = 0; q2 < steps; q2++) {
    var vv = -vmax + (2 * vmax) * (q2 + 0.5) / steps, c2 = rgb(colorFor(vv, vmax));
    doc.setFillColor(c2[0], c2[1], c2[2]); doc.rect(sx0 + (sx1 - sx0) * q2 / steps, sy, (sx1 - sx0) / steps + 0.3, 5, "F");
  }
  font(false, 8, GRY);
  doc.text("-" + usd(vmax), sx0 - 4, sy + 4.5, { align: "right" });
  doc.text("+" + usd(vmax), sx1 + 4, sy + 4.5);
  font(false, 7.5, GRY); doc.text("cheaper", sx0, sy + 14); doc.text("more expensive", sx1, sy + 14, { align: "right" });
  // right: the metro's chart
  var cR = W - 150, cL = 420;
  titles(top, mName + ": Change vs " + Y0 + " Year" + (Y0 > 1 ? "s" : "") + " Earlier", "Price and rate split · " + span, (cL + cR + 50) / 2);
  if (ml) chartP(MR, cL, cR, top + 58, H - 104);
  legendP((cL + cR + 50) / 2, H - 104 + 30);
  banner(2);
  return doc;
};
window.shareInfo = function () { var r = usRows[usRows.length - 1]; return { title: "Payment vs " + state.years + "Y ago", name: "Typical home", asOf: r ? mLong(r.m) : "" }; };
if (D) window.update(D); else window.__wantData = true;
</script>
__SHARE__
</body>
</html>`;

// Map position for each metro (its main city), from the built-in coordinates
function placeMetro(m) {
  const city = m.name.split(",")[0].split("-")[0].split("/")[0].trim();
  const st = (m.st || (m.name.split(",")[1] || "").trim().slice(0, 2)).toUpperCase();
  const c = METRO_COORDS_FALLBACK[`${city}|${st}`] || METRO_COORDS_FALLBACK[`Urban ${city}|${st}`];
  if (!c) return { ...m };
  const p = projectUS(c[1], c[0]);
  return { ...m, x: Math.round(p[0] * 10) / 10, y: Math.round(p[1] * 10) / 10 };
}
// The map and list use the same big metros as the Redfin Buyers vs Sellers
// widget, read from its saved copy. Redfin splits some big metros into
// divisions (Nassau County, Fort Worth, Anaheim…); those count as their parent
// metro, which is how Zillow reports them. Without the Redfin widget's data,
// Zillow's 50 largest metros are used.
const REDFIN_DIVISION_PARENT = {
  "Nassau County|NY": "New York|NY", "Newark|NJ": "New York|NY", "New Brunswick|NJ": "New York|NY",
  "Fort Worth|TX": "Dallas|TX", "Anaheim|CA": "Los Angeles|CA", "Oakland|CA": "San Francisco|CA",
  "San Rafael|CA": "San Francisco|CA", "Warren|MI": "Detroit|MI", "Montgomery County|PA": "Philadelphia|PA",
  "Camden|NJ": "Philadelphia|PA", "Wilmington|DE": "Philadelphia|PA", "Fort Lauderdale|FL": "Miami|FL",
  "West Palm Beach|FL": "Miami|FL", "Tacoma|WA": "Seattle|WA", "Elgin|IL": "Chicago|IL",
  "Lake County|IL": "Chicago|IL", "Gary|IN": "Chicago|IL", "Frederick|MD": "Washington|DC",
  "Arlington|VA": "Washington|DC", "Bethesda|MD": "Washington|DC", "Rockville|MD": "Washington|DC",
  "Silver Spring|MD": "Washington|DC", "Cambridge|MA": "Boston|MA", "Everett|WA": "Seattle|WA",
  "Bellevue|WA": "Seattle|WA", "Naperville|IL": "Chicago|IL",
};
const cityKey = (name, st) => `${name.split(",")[0].split("-")[0].split("/")[0].trim()}|${(st || (name.split(",")[1] || "").trim().slice(0, 2)).toUpperCase()}`;
function redfinMetroKeys() {
  try {
    const fm = FileManager.local();
    const p = fm.joinPath(fm.documentsDirectory(), "redfin-buyers-sellers-v1.json");
    if (!fm.fileExists(p)) return null;
    const r = JSON.parse(fm.readString(p));
    if (!r || !r.metros || !r.metros.length) return null;
    const keys = new Set();
    for (const m of r.metros) {
      const k = cityKey(m.city || m.name, m.st);
      keys.add(REDFIN_DIVISION_PARENT[k] || k);
    }
    return keys;
  } catch (e) {
    return null;
  }
}
function bigMetros(s) {
  // size rank from the file, or else from the saved order (largest first)
  const all = (s.metros || []).map((m, i) => ({ ...m, rank: m.rank || i + 1 }));
  const keys = redfinMetroKeys();
  const picked = keys ? all.filter((m) => keys.has(cityKey(m.name, m.st)) || keys.has(cityKey(m.name.replace(/^Urban /, ""), m.st))) : [];
  return picked.length >= 10 ? picked : all.slice(0, 50);
}
function pagePayload(s, years, progress) {
  return {
    months: s.months, us: s.us, metros: bigMetros(s).map(placeMetro), rates: s.rates,
    states: STATES, mapW: MAP_W, mapH: MAP_H,
    years, down: DOWN, term: TERM_MONTHS, defaultMetro: DEFAULT_METRO,
    next: s.next || null,
    zillowModified: s.zillowModified ? isoDay(new Date(s.zillowModified)) : null,
    progress: progress || "",
  };
}

async function openFullScreen(s, years, loading) {
  const wv = updWV(new WebView());
  await wv.loadHTML(...updArgs(PAGE_HTML.replace("__DATA__", () => "null").replace("__SHARE__", () => "<script>" + SHARE_PAGE_JS + "</script>")));
  const progressOf = (x, checking) => (checking ? "Checking Zillow and Freddie Mac for newer data…" : x.error ? "Data unreachable · showing the saved copy (" + x.error + ")" : "");
  let json = JSON.stringify(pagePayload(s, years, progressOf(s, loading)));
  const push = async () => { try { await wv.evaluateJavaScript(`window.update(${json})`); } catch (e) {} };
  const ask = async (expr) => { try { return await wv.evaluateJavaScript(expr); } catch (e) { return null; } };
  await presentWithSharing(wv, async (isOpen) => {
    await sleep(250);
    for (let i = 0; i < 8 && isOpen(); i++) {
      await push();
      await sleep(400);
      if ((await ask("window.__rendered === true")) === true) break;
    }
    let checked = !loading;
    const t0 = Date.now();
    while (isOpen()) {
      await sleep(700);
      if (!isOpen()) break;
      if ((await ask("window.__wantData === true")) === true) await push();
      if (!checked && Date.now() - t0 > 1200) {
        checked = true;
        let fresh;
        try { fresh = await refreshWithin(60, false); } catch (e) { fresh = { ...s, error: String(e.message || e) }; }
        json = JSON.stringify(pagePayload(fresh, years, progressOf(fresh, false)));
        if (isOpen()) await push();
      }
    }
  });
}

// ---------- Run ----------
if (config.runsInWidget || PREVIEW_WIDGET_IN_APP) {
  let widget;
  try {
    const s = await refreshWithin(WIDGET_BUDGET_S, false);
    widget = finishWidget(smallImage(s, widgetYears()), s);
  } catch (e) {
    widget = errorWidget(`Couldn't load the data yet. Open the script once in Scriptable. (${e.message || e})`);
  }
  if (config.runsInWidget) Script.setWidget(widget);
  else await widget.presentSmall();
} else {
  try {
    const years = widgetYears();
    const saved = readStore();
    if (saved && saved.rates) await openFullScreen(saved, years, true);
    else await openFullScreen(await refreshWithin(90, true), years, false);
  } catch (e) {
    const a = new Alert();
    a.title = "Couldn't load the data";
    a.message = String(e.message || e) + "\n\nCheck the connection and run it again.";
    a.addAction("OK");
    await a.present();
  }
}
Script.complete();
