// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-green; icon-glyph: balance-scale;

// ---- Shared settings (saved on this phone by the Setup script) ----
// Keys and personal settings live in the phone's keychain, not in this file,
// so the file can be shared as is.
function setting(key, fallback) {
  try { if (Keychain.contains(key)) { const v = Keychain.get(key); if (v) return v; } } catch (e) {}
  return fallback;
}


// Redfin Balance of Power (homebuyers vs home sellers) for Scriptable
// Redfin's estimate of how many homebuyers and home sellers are active in the
// U.S. market each month, seasonally adjusted, back to January 2013. It comes
// from the same data file Redfin's own Balance of Power dashboard loads
// (redfin.com/news/data-center/buyers-sellers), so there's no reading of
// articles and no key.
// Small widget: Redfin's market call as the title (green buyer's market, red
// seller's market, gray balanced), sellers (green line) and buyers (red line)
// over the last 5 years with the gap shaded by who outnumbers whom, the month
// the data covers and Redfin's next update in the top-right corner.
// Medium widget: the same plus a mini map of every metro, colored by market.
// Tap for the full screen: zoom 1Y / 3Y / 5Y / All (from 2013), the gap over
// time against Redfin's balanced zone, a U.S. map of metros (green = buyer's
// market, red = seller's, gray = balanced; dot size = buyers + sellers). Tap a
// metro, or pick one from the list, and everything switches to that metro;
// tap the ✕ to go back to the U.S. Share as PDF exports what's on screen.

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
const CSV_URL = "https://redfin-public-data.s3.us-west-2.amazonaws.com/redfin_html_public_dashboards/buyers_and_sellers.csv.gz";
const DASH_URL = "https://www.redfin.com/news/data-center/buyers-sellers/";
const WIDGET_MONTHS = 60;     // the home-screen chart: last 5 years
const DEFAULT_SPAN = 60;      // the full screen opens on 5 years
const STORE_FILE = "redfin-buyers-sellers-v1.json";
const CHECK_HOURS = 6;        // how often to ask Redfin whether the file changed
const WIDGET_BUDGET_S = 22;   // a widget only gets seconds; past this it uses the saved copy
const PREVIEW_WIDGET_IN_APP = false; // true = show the widget when run in the app

// Colors (Apple's dark-mode system colors)
const GREEN = "#30D158";  // buyer's market (sellers outnumber buyers)
const RED = "#FF453A";    // seller's market, and the buyers line
const SELLERS_LINE = GREEN; // sellers line: green, like a buyer's market
const BUYERS_LINE = RED;    // buyers line: red, like a seller's market
const GRAY = "#98989F";
const AMBER = "#FF9F0A";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
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

// ---------- Storage ----------
function storePath() {
  const fm = FileManager.local();
  return fm.joinPath(fm.documentsDirectory(), STORE_FILE);
}
// Saved copy. Written to a temporary file first and then swapped in, so a
// widget refresh and the app opening at the same moment can't catch a
// half-written file; if the main copy is unreadable, the spare is used.
function readStore() {
  const fm = FileManager.local();
  for (const p of [storePath(), storePath() + ".tmp"]) {
    try {
      if (fm.fileExists(p)) {
        const s = JSON.parse(fm.readString(p));
        if (s && s.national && s.national.length) return s;
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

// ---------- Reading Redfin's file ----------
// Runs inside a hidden web page (it has the gzip unpacker). Turns the CSV into
// national and metro monthly series. Columns are found by name, so a reordered
// file still reads; a file missing a needed column is rejected, never guessed.
// Each point: [month "YYYY-MM", buyers, sellers, market] where market is
// Redfin's own call: "B" buyer's, "S" seller's, "N" balanced, "" unknown.
function parseRedfin(text) {
  var lines = text.split(/\r?\n/);
  function split(line) {
    var out = [], cur = "", q = false;
    for (var i = 0; i < line.length; i++) {
      var c = line.charAt(i);
      if (c === '"') {
        if (q && line.charAt(i + 1) === '"') { cur += '"'; i++; } else q = !q;
      } else if (c === "," && !q) { out.push(cur); cur = ""; } else cur += c;
    }
    out.push(cur);
    return out;
  }
  var head = split(lines[0] || "").map(function (h) { return h.trim().toUpperCase(); });
  var col = {};
  head.forEach(function (h, i) { col[h] = i; });
  var need = ["PERIOD_BEGIN", "REGION_TYPE", "REGION_TYPE_ID", "REGION_ID", "REGION_NAME", "PROPERTY_TYPE_ID", "BUYERS", "SELLERS"];
  var missing = need.filter(function (k) { return !(k in col); });
  if (missing.length) throw new Error("Redfin's file changed format (missing " + missing.join(", ") + ")");
  function g(f, k) { return k in col ? (f[col[k]] || "").trim() : ""; }

  var rows = [], snap = "";
  for (var i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    var f = split(lines[i]);
    if (g(f, "PROPERTY_TYPE_ID") !== "-1") continue;          // all property types
    var sa = g(f, "IS_SEASONALLY_ADJUSTED").toLowerCase();
    if (sa && sa !== "true") continue;                          // seasonally adjusted
    var b = parseFloat(g(f, "BUYERS")), s = parseFloat(g(f, "SELLERS"));
    if (!(b > 0) || !(s > 0)) continue;
    var sd = g(f, "SNAPSHOT_DATE");
    if (sd > snap) snap = sd;
    rows.push(f);
  }
  var nat = [], metros = {};
  rows.forEach(function (f) {
    var sd = g(f, "SNAPSHOT_DATE");
    if (snap && sd && sd !== snap) return;                     // newest snapshot only
    var m = g(f, "PERIOD_BEGIN").slice(0, 7);
    var bop = g(f, "BALANCE_OF_POWER").toLowerCase();
    var mk = bop.indexOf("buyer") >= 0 ? "B" : bop.indexOf("seller") >= 0 ? "S" : bop.indexOf("balanced") >= 0 ? "N" : "";
    var pt = [m, Math.round(parseFloat(g(f, "BUYERS"))), Math.round(parseFloat(g(f, "SELLERS"))), mk];
    var type = g(f, "REGION_TYPE"), tid = g(f, "REGION_TYPE_ID"), rid = g(f, "REGION_ID");
    if (type === "National" || (rid === "-1" && g(f, "REGION_NAME") === "National")) { nat.push(pt); return; }
    if (tid === "-2" && rid !== "-1") {
      var key = rid;
      if (!metros[key]) {
        metros[key] = {
          id: rid,
          name: g(f, "REGION_NAME").replace(/\s+metro area$/i, ""),
          city: g(f, "METRO_CITY"),
          st: g(f, "METRO_STATE"),
          pts: [],
        };
      }
      metros[key].pts.push(pt);
    }
  });
  var byMonth = function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0; };
  nat.sort(byMonth);
  var list = Object.keys(metros).map(function (k) { metros[k].pts.sort(byMonth); return metros[k]; })
    .filter(function (x) { return x.pts.length >= 2; })
    .sort(function (a, b) { return a.name < b.name ? -1 : 1; });
  if (nat.length < 24) throw new Error("Redfin's file had no national series (format may have changed)");
  return { snapshot: snap, national: nat, metros: list };
}


// Polls a page until its script has written window.__out, or time runs out
async function pollOut(wv, seconds) {
  for (let i = 0; i < seconds * 4; i++) {
    await sleep(250);
    const out = await wv.evaluateJavaScript("window.__out || ''", false);
    if (out) return JSON.parse(out);
  }
  throw new Error("Timed out unpacking Redfin's file");
}

// Download the file in Scriptable, hand it to a hidden page to unzip and read
async function downloadAndParse(url, seconds) {
  const req = new Request(url + (url.indexOf("?") < 0 ? "?t=" : "&t=") + Date.now());
  req.timeoutInterval = 30;
  const data = await req.load();
  const status = req.response ? req.response.statusCode : 0;
  if (status !== 200) throw new Error(`Redfin's file answered ${status || "nothing"}`);
  const lastModified = headerOf(req.response, "Last-Modified");
  const wv = updWV(new WebView());
  await wv.loadHTML(...updArgs("<!DOCTYPE html><html><body></body></html>"));
  const js =
    "window.__out='';(function(){var b64=" + JSON.stringify(data.toBase64String()) + ";" +
    "try{var bin=atob(b64),buf=new Uint8Array(bin.length);for(var i=0;i<bin.length;i++)buf[i]=bin.charCodeAt(i);b64=null;bin=null;" +
    "var go=(buf[0]===31&&buf[1]===139)?new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).text():Promise.resolve(new TextDecoder().decode(buf));" +
    "go.then(function(t){window.__out=JSON.stringify({ok:true,data:(" + parseRedfin.toString() + ")(t)});})" +
    ".catch(function(e){window.__out=JSON.stringify({ok:false,error:String(e&&e.message||e)});});" +
    "}catch(e){window.__out=JSON.stringify({ok:false,error:String(e&&e.message||e)});}})();0;";
  await wv.evaluateJavaScript(js, false);
  const out = await pollOut(wv, seconds);
  if (!out.ok) throw new Error(out.error);
  return { ...out.data, lastModified };
}

function headerOf(resp, name) {
  if (!resp || !resp.headers) return null;
  const k = Object.keys(resp.headers).find((h) => h.toLowerCase() === name.toLowerCase());
  return k ? resp.headers[k] : null;
}

// A quick "has the file changed?" check: asks for the headers only
async function remoteLastModified(url) {
  try {
    const req = new Request(url);
    req.method = "HEAD";
    req.timeoutInterval = 12;
    await req.load();
    if (req.response && req.response.statusCode === 200) return headerOf(req.response, "Last-Modified");
  } catch (e) {}
  return null;
}

// Redfin's dashboard page: the next update date, its metro coordinates, and
// the data file's address (in case Redfin ever moves it)
async function readDashboard() {
  const req = new Request(DASH_URL);
  req.timeoutInterval = 15;
  req.headers = { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148" };
  const html = await req.loadString();
  const out = {};
  const nx = html.match(/update\s+on:?\s*(?:<[^>]*>\s*)*(?:[A-Za-z]{3,9},?\s+)?([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})/i);
  if (nx) {
    const mi = MON.findIndex((m) => m.toLowerCase() === nx[1].slice(0, 3).toLowerCase());
    if (mi >= 0) out.next = `${nx[3]}-${String(mi + 1).padStart(2, "0")}-${String(+nx[2]).padStart(2, "0")}`;
  }
  const csv = html.match(/https:\/\/redfin-public-data[^'"\s<>]+?\.csv\.gz/);
  if (csv) out.csvUrl = csv[0];
  const block = html.match(/METRO_COORDS\s*=\s*\{([\s\S]*?)\}\s*;/);
  if (block) {
    const coords = {};
    const re = /['"]?([A-Za-z][A-Za-z .'\-]*?)['"]?\s*:\s*\[\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\]/g;
    let m;
    while ((m = re.exec(block[1]))) coords[m[1].trim()] = [parseFloat(m[2]), parseFloat(m[3])];
    if (Object.keys(coords).length >= 10) out.coords = coords;
  }
  return out;
}

// Map position for each metro: Redfin's own coordinates first, then ours
function placeMetros(metros, coords) {
  metros.forEach((m) => {
    const city = (m.city || m.name.split(",")[0]).split("-")[0].trim();
    const st = (m.st || (m.name.split(",")[1] || "").trim().slice(0, 2)).toUpperCase();
    const c = (coords && coords[city]) || METRO_COORDS_FALLBACK[`${city}|${st}`] ||
      Object.entries(METRO_COORDS_FALLBACK).find(([k]) => k.split("|")[0] === city)?.[1];
    if (c) {
      const p = projectUS(c[1], c[0]);
      m.x = Math.round(p[0] * 10) / 10;
      m.y = Math.round(p[1] * 10) / 10;
    } else {
      delete m.x;
      delete m.y;
    }
  });
}

// When Redfin should post next. Its page says; if that can't be read, the
// 13th of the month after the newest file (Redfin posts mid-month).
function estimateNext(s) {
  const lm = s.lastModified ? new Date(s.lastModified) : new Date();
  const d = new Date(lm.getFullYear(), lm.getMonth() + 1, 13);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-13`;
}

// Bring the saved copy up to date. Returns the store (possibly unchanged).
// force: download even if the headers say nothing changed.
async function refresh(force, seconds) {
  let s = readStore();
  const now = Date.now();
  if (s && !force && s.checkedAt && now - s.checkedAt < CHECK_HOURS * 3600 * 1000) return s;
  const url = (s && s.csvUrl) || CSV_URL;
  const lm = await remoteLastModified(url);
  // Changed if the file's date moved; if the date can't be read, re-download at most daily
  const changed = !s || force || (lm ? lm !== s.lastModified : now - (s.fetchedAt || 0) > DAY_MS);
  let dash = null;
  const dashDue = !s || changed || !s.next || s.next < isoDay(new Date()) || !s.coords;
  if (dashDue) {
    try { dash = await readDashboard(); } catch (e) {}
  }
  if (changed) {
    let fresh;
    try {
      fresh = await downloadAndParse(url, seconds);
    } catch (e) {
      // The file may have moved: try the address on Redfin's dashboard
      if (dash && dash.csvUrl && dash.csvUrl !== url) fresh = await downloadAndParse(dash.csvUrl, seconds);
      else throw e;
      fresh.csvUrl = dash.csvUrl;
    }
    s = {
      ...(s || {}),
      national: fresh.national,
      metros: fresh.metros,
      snapshot: fresh.snapshot,
      lastModified: fresh.lastModified || lm,
      csvUrl: fresh.csvUrl || (s && s.csvUrl) || null,
      fetchedAt: now,
    };
  }
  if (dash && dash.coords) s.coords = dash.coords;
  if (dash && dash.next) {
    s.next = dash.next;
    s.nextEstimated = false;
  } else if (!s.next || (changed && s.lastModified && new Date(s.lastModified) >= new Date(s.next + "T00:00:00"))) {
    // No date from Redfin's page: estimate, but only move on once the data has updated
    s.next = estimateNext(s);
    s.nextEstimated = true;
  }
  placeMetros(s.metros, s.coords);
  s.checkedAt = now;
  s.error = null;
  writeStore(s);
  return s;
}

function isoDay(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Refresh with a deadline, falling back to the saved copy
async function refreshWithin(seconds, force) {
  let timer;
  const deadline = new Promise((_, rej) => { timer = Timer.schedule(seconds * 1000, false, () => rej(new Error("Redfin took too long"))); });
  try {
    return await Promise.race([refresh(force, Math.max(6, seconds - 4)), deadline]);
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

// ---------- Shared number helpers ----------
const gapOf = (p) => p[2] / p[1] - 1; // sellers vs buyers: +0.626 = 62.6% more sellers
// Redfin's own call for the month; if missing, Redfin's thresholds
// (buyers per seller under 0.9 = buyer's market, over 1.1 = seller's)
function marketOf(p) {
  if (p[3]) return p[3];
  const r = p[1] / p[2];
  return r < 0.9 ? "B" : r > 1.1 ? "S" : "N";
}
const MARKET_COLOR = { B: GREEN, S: RED, N: GRAY };
const MARKET_NAME = { B: "Buyer’s market", S: "Seller’s market", N: "Balanced" };
function fmtCount(v) {
  return v >= 1e6 ? (v / 1e6).toFixed(2) + "M" : v >= 1e4 ? Math.round(v / 1000) + "K" : (v / 1000).toFixed(1) + "K";
}
function fmtGap(g) {
  const s = Math.abs(g * 100).toFixed(1);
  return (parseFloat(s) === 0 ? "" : g > 0 ? "+" : "−") + s + "%";
}
function shortMonth(m) {
  return `${MON[+m.slice(5, 7) - 1]} ’${m.slice(2, 4)}`;
}
function nextLabel(s) {
  if (!s.next) return null;
  const [y, mo, d] = s.next.split("-").map(Number);
  const today = isoDay(new Date());
  if (s.next < today) return { text: "due", hex: AMBER };
  return { text: `${s.nextEstimated ? "~" : ""}${MON[mo - 1]} ${d}`, hex: GRAY };
}

// ---------- Drawing helpers ----------
function drawText(ctx, str, rect, font, hex, align) {
  ctx.setFont(font);
  ctx.setTextColor(new Color(hex));
  if (align === "right") ctx.setTextAlignedRight();
  else if (align === "center") ctx.setTextAlignedCenter();
  else ctx.setTextAlignedLeft();
  ctx.drawTextInRect(str, rect);
}
function paintBackground(ctx, W, H) {
  const top = [0x2c, 0x2c, 0x2e];
  const bottom = [0x1c, 0x1c, 0x1e];
  const BANDS = 34;
  for (let i = 0; i < BANDS; i++) {
    const f = i / (BANDS - 1);
    const hex = "#" + top.map((c, j) => Math.round(c + (bottom[j] - c) * f).toString(16).padStart(2, "0")).join("");
    ctx.setFillColor(new Color(hex));
    ctx.fillRect(new Rect(0, (H * i) / BANDS, W, H / BANDS + 1));
  }
}
function newCanvas(W, H) {
  const ctx = new DrawContext();
  ctx.size = new Size(W, H);
  ctx.opaque = true;
  ctx.respectScreenScale = true;
  paintBackground(ctx, W, H);
  return ctx;
}
function strokeSeg(ctx, x1, y1, x2, y2) {
  const p = new Path();
  p.move(new Point(x1, y1));
  p.addLine(new Point(x2, y2));
  ctx.addPath(p);
  ctx.strokePath();
}
function dot(ctx, x, y, r, hex, alpha) {
  ctx.setFillColor(new Color(hex, alpha == null ? 1 : alpha));
  ctx.fillEllipse(new Rect(x - r, y - r, 2 * r, 2 * r));
}
function clockIcon(ctx, x, y, hex) {
  ctx.setStrokeColor(new Color(hex));
  ctx.setLineWidth(1.3);
  const c = new Path();
  c.addEllipse(new Rect(x - 5, y - 5, 10, 10));
  ctx.addPath(c);
  ctx.strokePath();
  strokeSeg(ctx, x, y, x, y - 3);
  strokeSeg(ctx, x, y, x + 2.2, y + 1.2);
}

// Sellers and buyers lines, the gap between them shaded by who outnumbers whom
function drawPair(ctx, pts, box) {
  const vals = pts.flatMap((p) => [p[1], p[2]]);
  const lo = Math.min(...vals) * 0.95;
  const hi = Math.max(...vals) * 1.02;
  const X = (i) => box.x + (i / (pts.length - 1)) * box.w;
  const Y = (v) => box.y + box.h - ((v - lo) / (hi - lo)) * box.h;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const sellersLead = a[2] + b[2] >= a[1] + b[1];
    const q = new Path();
    q.move(new Point(X(i - 1), Y(a[2])));
    q.addLine(new Point(X(i), Y(b[2])));
    q.addLine(new Point(X(i), Y(b[1])));
    q.addLine(new Point(X(i - 1), Y(a[1])));
    q.closeSubpath();
    ctx.addPath(q);
    ctx.setFillColor(new Color(sellersLead ? GREEN : RED, 0.2));
    ctx.fillPath();
  }
  for (const [k, hex] of [[2, SELLERS_LINE], [1, BUYERS_LINE]]) {
    const line = new Path();
    pts.forEach((p, i) => (i ? line.addLine(new Point(X(i), Y(p[k]))) : line.move(new Point(X(i), Y(p[k])))));
    ctx.addPath(line);
    ctx.setStrokeColor(new Color(hex));
    ctx.setLineWidth(1.5);
    ctx.strokePath();
    const e = pts[pts.length - 1];
    dot(ctx, X(pts.length - 1), Y(e[k]), 2.4, hex);
  }
}

// Latest month for every metro that has it
function latestMetros(s) {
  const lastM = s.national[s.national.length - 1][0];
  return (s.metros || [])
    .map((m) => ({ m, p: m.pts[m.pts.length - 1] }))
    .filter((x) => x.p && x.p[0] === lastM);
}

// The state outlines, scaled into a box
function drawMap(ctx, s, box, opts) {
  const k = Math.min(box.w / MAP_W, box.h / MAP_H);
  const ox = box.x + (box.w - MAP_W * k) / 2;
  const oy = box.y + (box.h - MAP_H * k) / 2;
  const path = new Path();
  for (const ring of STATES.split("|")) {
    const pts = ring.split(" ").map((p) => {
      const [x, y] = p.split(",");
      return new Point(ox + x * k, oy + y * k);
    });
    path.addLines(pts);
    path.closeSubpath();
  }
  ctx.addPath(path);
  ctx.setFillColor(new Color("#3A3A3C"));
  ctx.fillPath();
  ctx.addPath(path);
  ctx.setStrokeColor(new Color("#232325"));
  ctx.setLineWidth(0.4);
  ctx.strokePath();
  const ms = latestMetros(s).filter((x) => x.m.x != null);
  const max = Math.max(1, ...ms.map((x) => x.p[1] + x.p[2]));
  ms.sort((a, b) => b.p[1] + b.p[2] - (a.p[1] + a.p[2]));
  for (const { m, p } of ms) {
    const r = Math.max(opts.minR, opts.maxR * Math.sqrt((p[1] + p[2]) / max));
    const cx = ox + m.x * k;
    const cy = oy + m.y * k;
    dot(ctx, cx, cy, r + 0.5, "#1C1C1E");
    dot(ctx, cx, cy, r, MARKET_COLOR[marketOf(p)], 0.9);
  }
  return ms;
}

// ---------- Widget images ----------
// Title: Redfin's market call for the U.S., in its color. It doubles as the
// legend: green is the sellers line, red the buyers line.
// Title and legend
function title(ctx, s) {
  drawText(ctx, "Balance of Power", new Rect(14, 9, 142, 22), Font.boldSystemFont(15), "#FFFFFF", "left");
  dot(ctx, 17, 38.5, 2.8, SELLERS_LINE);
  drawText(ctx, "Sellers", new Rect(22, 32.5, 38, 13), Font.semiboldSystemFont(9.5), GRAY, "left");
  dot(ctx, 63, 38.5, 2.8, BUYERS_LINE);
  drawText(ctx, "Buyers", new Rect(68, 32.5, 36, 13), Font.semiboldSystemFont(9.5), GRAY, "left");
}
// Top-right corner: the month the data covers, and Redfin's next update
function cornerDates(ctx, s, xRight) {
  const last = s.national[s.national.length - 1];
  // beside the market call and the legend, so the title row has the full width
  drawText(ctx, shortMonth(last[0]), new Rect(xRight - 60, 32, 60, 14), Font.mediumSystemFont(10), GRAY, "right");
  if (s.error && Date.now() - (s.checkedAt || 0) > DAY_MS) {
    drawText(ctx, "cached", new Rect(xRight - 60, 46, 60, 14), Font.mediumSystemFont(10), AMBER, "right");
    return;
  }
  const nl = nextLabel(s);
  if (!nl) return;
  drawText(ctx, nl.text, new Rect(xRight - 60, 46, 60, 14), Font.mediumSystemFont(10), nl.hex, "right");
  // the clock sits just left of the date; date width estimated from its length
  const w = nl.text.length * 5.6;
  clockIcon(ctx, xRight - w - 8, 52.5, nl.hex);
}
// A thin axis with a tick and the year at each January
function yearAxis(ctx, pts, box) {
  const X = (i) => box.x + (i / (pts.length - 1)) * box.w;
  const base = box.y + box.h + 0.5;
  ctx.setStrokeColor(new Color("#48484A"));
  ctx.setLineWidth(0.6);
  strokeSeg(ctx, box.x, base, box.x + box.w, base);
  ctx.setStrokeColor(new Color("#636366"));
  ctx.setLineWidth(0.8);
  pts.forEach((p, i) => {
    if (p[0].slice(5, 7) !== "01") return;
    strokeSeg(ctx, X(i), base, X(i), base + 3);
    drawText(ctx, "’" + p[0].slice(2, 4), new Rect(X(i) - 14, base + 3, 28, 12), Font.mediumSystemFont(9), GRAY, "center");
  });
}
function chart(ctx, s, box) {
  const pts = s.national.slice(-WIDGET_MONTHS);
  drawPair(ctx, pts, box);
  yearAxis(ctx, pts, box);
}

function smallImage(s) {
  const W = 170;
  const ctx = newCanvas(W, W);
  title(ctx, s);
  cornerDates(ctx, s, W - 14);
  chart(ctx, s, { x: 14, y: 62, w: 142, h: 78 });
  return ctx.getImage();
}

function mediumImage(s) {
  const W = 360;
  const H = 170;
  const ctx = newCanvas(W, H);
  title(ctx, s);
  cornerDates(ctx, s, W - 14);
  chart(ctx, s, { x: 14, y: 62, w: 160, h: 78 });
  drawMap(ctx, s, { x: 192, y: 62, w: W - 204, h: 78 }, { minR: 1.6, maxR: 5.8 });
  // metros by market, every metro counted (including any without a map spot)
  const cnt = { B: 0, N: 0, S: 0 };
  latestMetros(s).forEach(({ p }) => cnt[marketOf(p)]++);
  let x = 212;
  for (const k of ["B", "N", "S"]) {
    dot(ctx, x + 3, 152, 3, MARKET_COLOR[k]);
    const t = String(cnt[k]);
    drawText(ctx, t, new Rect(x + 9, 145.5, 30, 13), Font.semiboldSystemFont(10), "#C7C7CC", "left");
    x += 9 + t.length * 6.4 + 10;
  }
  drawText(ctx, "metros", new Rect(x - 4, 145.5, 50, 13), Font.mediumSystemFont(10), GRAY, "left");
  return ctx.getImage();
}

function finishWidget(img, s) {
  const w = new ListWidget();
  w.backgroundImage = updRing(img);
  w.addSpacer();
  w.url = URLScheme.forRunningScript(); // tap opens the full-screen view
  let at = Date.now() + CHECK_HOURS * 3600 * 1000;
  if (s && s.next) {
    const t = new Date(s.next + "T10:00:00").getTime(); // Redfin posts in the morning
    if (t > Date.now()) at = Math.min(at, t);
  }
  w.refreshAfterDate = new Date(at);
  return w;
}

function errorWidget(msg) {
  const w = new ListWidget();
  const g = new LinearGradient();
  g.colors = [new Color("#2C2C2E"), new Color("#1C1C1E")];
  g.locations = [0, 1];
  w.backgroundGradient = g;
  const t = w.addText("Balance of Power");
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

// ---------- Full-screen view ----------
// Note: the page script below avoids backticks, backslashes and dollar-brace
// on purpose, because the whole page lives inside a template literal.
const PAGE_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  :root { --bg:#000000; --fg:#FFFFFF; --gray:#98989F; --rule:#2C2C2E; --card:#1C1C1E; }
  * { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  body { margin:0; padding:20px 18px 36px; background:var(--bg); color:var(--fg);
         font-family:-apple-system,system-ui,sans-serif; -webkit-user-select:none; user-select:none; }
  .ticker { font-size:28px; font-weight:800; letter-spacing:-0.3px; }
  .name { color:var(--gray); font-size:14px; font-weight:600; margin-top:3px; }
  .scopebar { display:flex; align-items:center; gap:8px; margin-top:12px; }
  .scopebar .chip { flex:none; border:0; border-radius:16px; padding:7px 12px; background:#FFFFFF; color:#000000;
          font:inherit; font-size:14px; font-weight:700; }
  .scopebar .chip.back { background:#2C2C2E; color:#FFFFFF; font-weight:600; }
  .hint { color:var(--gray); font-size:12px; margin-top:6px; }
  .cards { display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; margin-top:14px; }
  .card { background:var(--card); border-radius:14px; padding:11px 10px 10px; min-width:0; }
  .card .k { font-size:10.5px; font-weight:700; color:var(--gray); letter-spacing:0.3px; }
  .card .v { font-size:22px; font-weight:700; margin-top:4px; white-space:nowrap; }
  .card .s { font-size:11px; color:var(--gray); margin-top:1px; }
  .card .y { font-size:11.5px; font-weight:600; margin-top:6px; color:#E5E5EA; white-space:nowrap; }
  .banner { margin-top:10px; border-radius:14px; padding:9px 12px; font-size:12.5px; font-weight:700;
            text-align:center; background:var(--card); border:1px solid; }
  .h2 { font-size:12px; font-weight:700; color:var(--gray); letter-spacing:0.4px; margin:22px 0 6px; }
  .sub { font-size:12px; color:var(--gray); margin:-4px 0 8px; }
  .seg { display:flex; gap:6px; margin-bottom:6px; }
  .seg button { flex:1; border:0; border-radius:10px; padding:7px 0; background:#1C1C1E; color:#FFFFFF;
                font:inherit; font-size:13.5px; font-weight:600; }
  .seg button.on { background:#FFFFFF; color:#000000; }
  .legend { display:flex; gap:16px; font-size:12px; font-weight:600; align-items:center; flex-wrap:wrap; margin:4px 0; }
  .sw { display:inline-block; width:16px; height:3px; border-radius:2px; margin-right:6px; vertical-align:middle; }
  .dt { display:inline-block; width:11px; height:11px; border-radius:6px; margin-right:6px; vertical-align:-1px; }
  .readout { font-size:13px; font-weight:600; margin:14px 0 2px; min-height:18px; line-height:18px; }
  svg.chart { display:block; width:100%; height:250px; overflow:visible; }
  .wrap { position:relative; }
  .touch { position:absolute; left:0; top:0; right:0; bottom:0; touch-action:pan-y; }
  svg#c2 { height:180px; }
  svg.map { display:block; width:100%; height:auto; }
  .regions { display:flex; gap:6px; overflow-x:auto; margin:4px 0 8px; -webkit-overflow-scrolling:touch; scrollbar-width:none; }
  .regions::-webkit-scrollbar { display:none; }
  .regions button { flex:none; padding:6px 12px; font-size:13px; border-radius:14px; }
  .pickwrap { margin-top:8px; }
  select.pick { width:100%; border:0; border-radius:10px; padding:9px 10px; background:#1C1C1E; color:#FFFFFF;
                font:inherit; font-size:14px; font-weight:600; -webkit-appearance:none; appearance:none; }
  .counts { display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; margin-top:12px; }
  .lists { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-top:4px; }
  .lh { font-size:10.5px; font-weight:700; color:var(--gray); letter-spacing:0.3px; margin:14px 0 4px; }
  .row { display:flex; justify-content:space-between; gap:6px; padding:7px 0; border-top:1px solid var(--rule); font-size:13.5px; }
  .row .n { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .row.sel .n { font-weight:800; }
  .row b { white-space:nowrap; }
  table { width:100%; border-collapse:collapse; font-size:13.5px; font-variant-numeric:tabular-nums; }
  th { text-align:right; color:var(--gray); font-size:11.5px; font-weight:600; padding:0 0 6px; }
  th:first-child, td:first-child { text-align:left; }
  td { text-align:right; padding:7px 0; border-top:1px solid var(--rule); }
  .nextbox { display:flex; justify-content:space-between; align-items:center; background:var(--card);
             border-radius:12px; padding:12px 14px; margin-top:22px; font-size:14px; font-weight:600; }
  .nextbox span { color:var(--gray); }
  .note { color:var(--gray); font-size:10.5px; line-height:1.45; margin-top:22px; }
  .tl { display:flex; align-items:center; gap:10px; margin:2px 0 6px; }
  .tl input { flex:1; -webkit-appearance:none; appearance:none; height:28px; background:transparent; margin:0; }
  .tl input::-webkit-slider-runnable-track { height:4px; border-radius:2px; background:#3A3A3C; }
  .tl input::-webkit-slider-thumb { -webkit-appearance:none; width:24px; height:24px; border-radius:12px; background:#FFFFFF; margin-top:-10px; box-shadow:0 1px 4px rgba(0,0,0,0.5); }
  .tlends { display:flex; justify-content:space-between; color:var(--gray); font-size:10.5px; margin:-4px 0 6px; }
  .tl .tlnow { flex:none; border:0; background:#2C2C2E; color:#FFFFFF; border-radius:10px; padding:5px 9px; font:inherit; font-size:12px; font-weight:600; }
  .status { font-size:15px; font-weight:700; margin-top:8px; }
  .loading { font-size:15px; margin-top:40px; text-align:center; }
  .err { color:#FF9F0A; font-size:13px; margin-top:24px; line-height:1.4; }
  .err button { display:block; margin-top:10px; border:0; border-radius:10px; padding:9px 16px; background:#2C2C2E; color:#FFFFFF; font:inherit; font-weight:600; }
  .print .card, .print .nextbox, .print .banner { background:#F2F2F2; }
  .print .card .y { color:#333333; }
  body.printing svg#c2 { height:110px !important; }
</style>
</head>
<body>
<div class="ticker" id="ttl">Balance of Power</div>
<div class="name" id="scopeName">Redfin</div>
<div class="scopebar seg" id="scopebar" style="display:none"></div>
<div class="hint" id="progress"></div>
<div class="hint loading" id="loading">Loading Redfin data…</div>
<div class="hint err" id="err" style="display:none"></div>
<div id="blocks" style="display:none">
  <div>
    <div class="legend" style="margin-top:14px"><span><i class="sw" style="background:#30D158"></i>Sellers</span><span><i class="sw" style="background:#FF453A"></i>Buyers</span></div>
    <div class="readout" id="readout"></div>
    <div class="wrap"><svg class="chart" id="c1"></svg><div class="touch" id="t1"></div></div>
  </div>
  <div>
    <div class="h2">GAP</div>
    <div class="wrap"><svg class="chart" id="c2"></svg><div class="touch" id="t2"></div></div>
  </div>
  <div>
    <div class="h2" id="maph">METROS</div>
    <div class="tl seg"><input type="range" id="tl" min="0" max="0" step="1" value="0"><button class="tlnow" id="tlnow">Latest</button></div>
    <div class="tlends seg"><span id="tlfrom"></span><span id="tlto"></span></div>
    <div class="seg regions" id="regions"></div>
    <svg class="map" id="map"></svg>
    <div class="pickwrap seg"><select class="pick" id="pick"></select></div>
  </div>
</div>
<div class="note" id="note"></div>
<script>
var D = __DATA__;
var MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
var MONTHS_LONG = ["January","February","March","April","May","June","July","August","September","October","November","December"];
var GREEN = "#30D158", RED = "#FF453A", GRAY = "#98989F";
var BLUE = GREEN; // the sellers line and card: green, like a buyer's market
var MC = { B: GREEN, S: RED, N: GRAY };
var MN = { B: "Buyer’s market", S: "Seller’s market", N: "Balanced market" };
var BAND_HI = 1 / 0.9 - 1, BAND_LO = 1 / 1.1 - 1; // Redfin: 0.9 to 1.1 buyers per seller is balanced
var state = { scope: null, cursor: null };

function el(id) { return document.getElementById(id); }
function esc(s) { return String(s).split("&").join("&amp;").split("<").join("&lt;").split(">").join("&gt;").split('"').join("&quot;"); }
function gapOf(p) { return p[2] / p[1] - 1; }
function mk(p) { if (p[3]) return p[3]; var r = p[1] / p[2]; return r < 0.9 ? "B" : r > 1.1 ? "S" : "N"; }
function fmtCount(v) { return v >= 1e6 ? (v / 1e6).toFixed(2) + "M" : v >= 1e4 ? Math.round(v / 1000) + "K" : (v / 1000).toFixed(1) + "K"; }
function fmtGap(g) { var s = Math.abs(g * 100).toFixed(1); return (parseFloat(s) === 0 ? "" : g > 0 ? "+" : "−") + s + "%"; }
function fmtPct(g) { var s = Math.abs(g * 100).toFixed(1); return (parseFloat(s) === 0 ? "" : g > 0 ? "▲ " : "▼ ") + s + "%"; }
function fmtPpt(g) { var s = Math.abs(g * 100).toFixed(1); return (parseFloat(s) === 0 ? "" : g > 0 ? "▲ " : "▼ ") + s + " ppt"; }
function mShort(m) { return MONTHS[+m.slice(5, 7) - 1] + " ’" + m.slice(2, 4); }
function mLong(m) { return MONTHS[+m.slice(5, 7) - 1] + " " + m.slice(0, 4); }
function mAdd(m, n) { var y = +m.slice(0, 4), mo = +m.slice(5, 7) - 1 + n; y += Math.floor(mo / 12); mo = ((mo % 12) + 12) % 12; return y + "-" + (mo < 9 ? "0" : "") + (mo + 1); }
function metroById(id) { for (var i = 0; i < D.metros.length; i++) if (D.metros[i].id === id) return D.metros[i]; return null; }
function scopeSeries() { var m = state.scope ? metroById(state.scope) : null; return m ? m.pts : D.national; }
function scopeLabel() { var m = state.scope ? metroById(state.scope) : null; return m ? m.name + " metro" : "U.S."; }
function latestMonth() { return D.national[D.national.length - 1][0]; }
function latestMetros() {
  var lm = latestMonth(), out = [];
  D.metros.forEach(function (m) { var p = m.pts[m.pts.length - 1]; if (p && p[0] === lm) out.push({ m: m, p: p }); });
  return out;
}
function niceStep(range, n) {
  var raw = range / n, p = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)), f = raw / p;
  return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p;
}
function svgSize(svg) { var r = svg.getBoundingClientRect(); return { w: Math.max(200, r.width), h: Math.max(80, r.height) }; }
// The months in view: indices view.a..view.b into the current series
var view = { a: 0, b: 0 }, MIN_SPAN = 6, touched = false;
function visible() { return scopeSeries().slice(view.a, view.b + 1); }
function setView(a, b) {
  var I = scopeSeries().length - 1;
  var span = Math.round(Math.max(Math.min(MIN_SPAN, I), Math.min(I, b - a)));
  a = Math.round(a);
  if (a < 0) a = 0;
  if (a + span > I) a = I - span;
  view.a = a;
  view.b = a + span;
  renderCharts();
}
function resetView() {
  var I = scopeSeries().length - 1;
  var span = Math.min(I, ((D && D.defaultSpan) || 60) - 1);
  view.b = I;
  view.a = I - span;
}

// ---------- Header ----------
function nextText() {
  if (!D.next) return "";
  var parts = D.next.split("-"), d = new Date(+parts[0], +parts[1] - 1, +parts[2]);
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var label = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()] + " " + MONTHS[d.getMonth()] + " " + d.getDate();
  label = MONTHS[d.getMonth()] + " " + d.getDate();
  return d < today ? "update due" : "next " + (D.nextEstimated ? "~" : "") + label;
}
function renderTop() {
  var pts = scopeSeries(), last = pts[pts.length - 1], g = gapOf(last), k = mk(last);
  var nx = nextText();
  el("ttl").textContent = "Balance of Power";
  el("scopeName").textContent = (state.scope ? metroById(state.scope).name : "U.S.") + " · " + mShort(last[0]) + (nx ? " · " + nx : "");
  var bar = el("scopebar");
  if (state.scope) {
    bar.style.display = "";
    bar.innerHTML = '<button class="chip" id="chipX">' + esc(metroById(state.scope).name) + '  ✕</button>' +
      '<button class="chip back" id="chipUS">Back to U.S.</button>';
    el("chipX").onclick = el("chipUS").onclick = function () { select(null); };
  } else { bar.style.display = "none"; bar.innerHTML = ""; }
}

// ---------- Charts ----------
function xTicks(pts) {
  var n = pts.length, out = [];
  if (n <= 15) { for (var i = 0; i < n; i++) if (+pts[i][0].slice(5, 7) % 3 === 1) out.push([i, mShort(pts[i][0])]); return out; }
  var years = n / 12, step = years <= 4 ? 1 : years <= 8 ? 2 : 3;
  for (var j = 0; j < n; j++) {
    var m = pts[j][0];
    if (m.slice(5, 7) === "01" && (+m.slice(0, 4)) % step === 0) out.push([j, m.slice(0, 4)]);
  }
  return out;
}
function drawC1() {
  var svg = el("c1"), sz = svgSize(svg), pts = visible(), n = pts.length;
  var L = 44, R = 50, T = 8, B = 22, w = sz.w - L - R, h = sz.h - T - B;
  var lo = Infinity, hi = -Infinity;
  pts.forEach(function (p) { lo = Math.min(lo, p[1], p[2]); hi = Math.max(hi, p[1], p[2]); });
  var pad = (hi - lo) * 0.08 || hi * 0.05; lo = Math.max(0, lo - pad); hi += pad;
  var st = niceStep(hi - lo, 5); lo = Math.floor(lo / st) * st; hi = Math.ceil(hi / st) * st;
  function X(i) { return L + (n === 1 ? w / 2 : (i / (n - 1)) * w); }
  function Y(v) { return T + h - ((v - lo) / (hi - lo)) * h; }
  var s = "";
  for (var v = lo; v <= hi + st / 2; v += st) {
    s += '<line x1="' + L + '" x2="' + (L + w) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="#3A3A3C" stroke-width="0.6"/>';
    s += '<text x="' + (L - 6) + '" y="' + (Y(v) + 3.5) + '" fill="#98989F" font-size="10" text-anchor="end">' + fmtCount(v) + '</text>';
  }
  xTicks(pts).forEach(function (t) { s += '<text x="' + X(t[0]) + '" y="' + (T + h + 15) + '" fill="#98989F" font-size="10" text-anchor="middle">' + t[1] + '</text>'; });
  for (var i = 1; i < n; i++) {
    var a = pts[i - 1], b = pts[i], lead = a[2] + b[2] >= a[1] + b[1];
    s += '<polygon points="' + X(i - 1) + ',' + Y(a[2]) + ' ' + X(i) + ',' + Y(b[2]) + ' ' + X(i) + ',' + Y(b[1]) + ' ' + X(i - 1) + ',' + Y(a[1]) +
      '" fill="' + (lead ? GREEN : RED) + '" fill-opacity="0.22"/>';
  }
  [[2, BLUE], [1, RED]].forEach(function (k) {
    var d = pts.map(function (p, i) { return (i ? "L" : "M") + X(i).toFixed(1) + "," + Y(p[k[0]]).toFixed(1); }).join("");
    s += '<path d="' + d + '" fill="none" stroke="' + k[1] + '" stroke-width="1.9" stroke-linejoin="round"/>';
  });
  var e = pts[n - 1], ys = Y(e[2]), yb = Y(e[1]);
  if (Math.abs(ys - yb) < 13) { var mid = (ys + yb) / 2, up = ys < yb ? -1 : 1; ys = mid + up * 6.5; yb = mid - up * 6.5; }
  s += '<circle cx="' + X(n - 1) + '" cy="' + Y(e[2]) + '" r="3" fill="' + BLUE + '"/><circle cx="' + X(n - 1) + '" cy="' + Y(e[1]) + '" r="3" fill="' + RED + '"/>';
  s += '<text x="' + (L + w + 6) + '" y="' + (ys + 4) + '" fill="' + BLUE + '" font-size="11" font-weight="700">' + fmtCount(e[2]) + '</text>';
  s += '<text x="' + (L + w + 6) + '" y="' + (yb + 4) + '" fill="' + RED + '" font-size="11" font-weight="700">' + fmtCount(e[1]) + '</text>';
  if (state.cursor != null && state.cursor < n) {
    var c = pts[state.cursor], cx = X(state.cursor);
    s += '<g id="cur1"><line x1="' + cx + '" x2="' + cx + '" y1="' + T + '" y2="' + (T + h) + '" stroke="#FFFFFF" stroke-width="1"/>' +
      '<circle cx="' + cx + '" cy="' + Y(c[2]) + '" r="4" fill="' + BLUE + '" stroke="#000000"/><circle cx="' + cx + '" cy="' + Y(c[1]) + '" r="4" fill="' + RED + '" stroke="#000000"/></g>';
  }
  svg.innerHTML = s;
  svg.__geo = { L: L, w: w, n: n };
}
function drawC2() {
  var svg = el("c2"), sz = svgSize(svg), pts = visible(), n = pts.length;
  var L = 44, R = 50, T = 8, B = 22, w = sz.w - L - R, h = sz.h - T - B;
  var gs = pts.map(gapOf), lo = Math.min(BAND_LO, Math.min.apply(null, gs)), hi = Math.max(BAND_HI, Math.max.apply(null, gs));
  var pad = (hi - lo) * 0.06; lo -= pad; hi += pad;
  var st = niceStep(hi - lo, 5); lo = Math.floor(lo / st) * st; hi = Math.ceil(hi / st) * st;
  function X(i) { return L + (n === 1 ? w / 2 : (i / (n - 1)) * w); }
  function Y(v) { return T + h - ((v - lo) / (hi - lo)) * h; }
  var s = '<rect x="' + L + '" y="' + Y(BAND_HI) + '" width="' + w + '" height="' + (Y(BAND_LO) - Y(BAND_HI)) + '" fill="#FFFFFF" fill-opacity="0.08"/>';
  s += '<text x="' + (L + w + 6) + '" y="' + (Y((BAND_HI + BAND_LO) / 2) + 3.5) + '" fill="#98989F" font-size="9.5" font-weight="600">Balanced</text>';
  for (var v = lo; v <= hi + st / 2; v += st) {
    var zero = Math.abs(v) < st / 1000;
    s += '<line x1="' + L + '" x2="' + (L + w) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="' + (zero ? "#636366" : "#3A3A3C") + '" stroke-width="' + (zero ? 1 : 0.6) + '"/>';
    s += '<text x="' + (L - 6) + '" y="' + (Y(v) + 3.5) + '" fill="#98989F" font-size="10" text-anchor="end">' + (v > st / 1000 ? "+" : "") + Math.round(v * 100) + '%</text>';
  }
  xTicks(pts).forEach(function (t) { s += '<text x="' + X(t[0]) + '" y="' + (T + h + 15) + '" fill="#98989F" font-size="10" text-anchor="middle">' + t[1] + '</text>'; });
  for (var i = 1; i < n; i++) {
    s += '<line x1="' + X(i - 1) + '" y1="' + Y(gs[i - 1]) + '" x2="' + X(i) + '" y2="' + Y(gs[i]) + '" stroke="' + MC[mk(pts[i])] + '" stroke-width="2" stroke-linecap="round"/>';
  }
  var e = n - 1;
  s += '<circle cx="' + X(e) + '" cy="' + Y(gs[e]) + '" r="3.5" fill="#FFFFFF"/>';
  s += '<text x="' + (L + w + 6) + '" y="' + (Y(gs[e]) + 4) + '" fill="#FFFFFF" font-size="11" font-weight="700">' + fmtGap(gs[e]) + '</text>';
  if (state.cursor != null && state.cursor < n) {
    var cx = X(state.cursor);
    s += '<g id="cur2"><line x1="' + cx + '" x2="' + cx + '" y1="' + T + '" y2="' + (T + h) + '" stroke="#FFFFFF" stroke-width="1"/>' +
      '<circle cx="' + cx + '" cy="' + Y(gs[state.cursor]) + '" r="4" fill="' + MC[mk(pts[state.cursor])] + '" stroke="#000000"/></g>';
  }
  svg.innerHTML = s;
  svg.__geo = { L: L, w: w, n: n };
}
// Shown only while a finger is on a chart: that month's numbers, one line
function readout() {
  var pts = visible();
  if (state.cursor == null || state.cursor >= pts.length) { el("readout").innerHTML = "&nbsp;"; return; }
  var p = pts[state.cursor];
  el("readout").innerHTML = mShort(p[0]) + ' · <span style="color:' + BLUE + '">' + fmtCount(p[2]) + ' sellers</span> · <span style="color:' + RED + '">' +
    fmtCount(p[1]) + ' buyers</span> · <span style="color:' + MC[mk(p)] + '">' + fmtGap(gapOf(p)) + '</span>';
}
function renderCharts() { drawC1(); drawC2(); readout(); }
// One finger scrubs both charts. Two fingers pinch to zoom and drag to pan;
// double-tap resets to the last 5 years. A vertical swipe still scrolls.
var fingers = {}, pinch = null, pinchLock = false, rafId = 0, pendingView = null, lastTap = null, activeSvg = "c1";
function fingerIds() { return Object.keys(fingers); }
function posAt(clientX) {
  var svg = el(activeSvg), g = svg.__geo, r = svg.getBoundingClientRect();
  var f = Math.max(0, Math.min(1, (clientX - r.left - g.L) / g.w));
  return { f: f, pos: view.a + f * (view.b - view.a) };
}
function idxAt(clientX) { return Math.max(0, Math.min(view.b - view.a, Math.round(posAt(clientX).pos - view.a))); }
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
function scrub(i) { state.cursor = i; drawC1(); drawC2(); readout(); }
function onDown(svgId, e) {
  fingers[e.pointerId] = { x: e.clientX, y: e.clientY };
  var n = fingerIds().length;
  if (n === 1) activeSvg = svgId;
  if (n === 2) {
    var st = pinchNow();
    pinch = { dist: st.dist, n: view.b - view.a, anchor: posAt(st.mid).pos };
    pinchLock = true;
    touched = true;
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
    var st = pinchNow(), I = scopeSeries().length - 1;
    var n = Math.max(MIN_SPAN, Math.min(I, pinch.n * pinch.dist / st.dist));
    var a = pinch.anchor - posAt(st.mid).f * n;
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

// ---------- Map ----------
var STATE_PATH = "";
// The map has its own timeline: every month any metro has data. Dot area is on
// one scale for all months, so sizes compare across time.
var mapIdx = null; // index into D.mapMonths; null = latest
function prepMap() {
  var seen = {}, max = 1;
  D.metros.forEach(function (m) {
    m.byM = {};
    m.pts.forEach(function (p) { m.byM[p[0]] = p; seen[p[0]] = 1; max = Math.max(max, p[1] + p[2]); });
  });
  D.mapMonths = Object.keys(seen).sort();
  D.mapMax = max;
  var tl = el("tl"), n = D.mapMonths.length;
  tl.max = String(Math.max(0, n - 1));
  if (mapIdx != null && mapIdx > n - 1) mapIdx = null;
  tl.value = String(mapIdx == null ? n - 1 : mapIdx);
  el("tlfrom").textContent = n ? mLong(D.mapMonths[0]) : "";
  el("tlto").textContent = n ? mLong(D.mapMonths[n - 1]) : "";
}
function mapMonth() { var n = D.mapMonths.length; return D.mapMonths[mapIdx == null ? n - 1 : mapIdx]; }
function renderMap() {
  var svg = el("map"), month = mapMonth(), ms = [];
  D.metros.forEach(function (m) { var p = m.byM[month]; if (p) ms.push({ m: m, p: p }); });
  var placed = ms.filter(function (x) { return x.m.x != null; });
  var vb = REGIONS[mapRegion].vb || [0, 0, D.mapW, D.mapH];
  var z = D.mapW / vb[2]; // zoom level; dots grow slower than the map so clusters separate
  svg.setAttribute("viewBox", vb.join(" "));
  placed.sort(function (a, b) { return (b.p[1] + b.p[2]) - (a.p[1] + a.p[2]); });
  var s = '<path d="' + STATE_PATH + '" fill="#2C2C2E" stroke="#48484A" stroke-width="1" vector-effect="non-scaling-stroke"/>';
  var sel = null, labels = "", boxes = [];
  placed.forEach(function (x) {
    x.r = Math.max(6, 36 * Math.sqrt((x.p[1] + x.p[2]) / D.mapMax)) / Math.sqrt(z);
    if (x.m.id === state.scope) sel = x;
    s += '<circle cx="' + x.m.x + '" cy="' + x.m.y + '" r="' + x.r.toFixed(2) + '" fill="' + MC[mk(x.p)] + '" fill-opacity="0.85" stroke="#000000" stroke-width="' + (1.5 / z).toFixed(2) + '"/>';
  });
  // Names when zoomed in: biggest metros first; a name goes right of its dot,
  // or left if that's taken, or is skipped rather than overlap another name.
  if (z >= 1.9) {
    var fs = 26 / z;
    placed.forEach(function (x) {
      var name = x.m.name.split(",")[0], w = name.length * fs * 0.56, h = fs * 1.1, gap = 4 / z;
      var tries = [[x.m.x + x.r + gap, "start"], [x.m.x - x.r - gap - w, "start"]];
      for (var t = 0; t < tries.length; t++) {
        var bx = tries[t][0], by = x.m.y - h / 2, ok = true;
        for (var j = 0; j < boxes.length && ok; j++) {
          var o = boxes[j];
          if (bx < o.x + o.w && bx + w > o.x && by < o.y + o.h && by + h > o.y) ok = false;
        }
        if (ok) {
          boxes.push({ x: bx, y: by, w: w, h: h });
          labels += '<text x="' + bx.toFixed(1) + '" y="' + (x.m.y + fs * 0.35).toFixed(1) + '" font-size="' + fs.toFixed(1) +
            '" font-weight="600" fill="#E5E5EA" stroke="#000000" stroke-width="' + (5 / z).toFixed(2) + '" paint-order="stroke">' + esc(name) + '</text>';
          break;
        }
      }
    });
  }
  if (sel) s += '<circle cx="' + sel.m.x + '" cy="' + sel.m.y + '" r="' + (sel.r + 5 / z).toFixed(2) + '" fill="none" stroke="#FFFFFF" stroke-width="' + (4 / z).toFixed(2) + '"/>';
  s += labels;
  svg.innerHTML = s;
  renderRegions();
  svg.__placed = placed;
  var cnt = { B: 0, N: 0, S: 0 };
  ms.forEach(function (x) { cnt[mk(x.p)]++; });
  el("maph").innerHTML = "METROS · " + mLong(month).toUpperCase() +
    ' <span style="color:' + GREEN + '">' + cnt.B + '</span> <span style="color:' + GRAY + '">' + cnt.N + '</span> <span style="color:' + RED + '">' + cnt.S + '</span>';
  el("tlnow").style.display = mapIdx == null ? "none" : "";
}
function renderPicker() {
  var opts = '<option value="">' + (state.scope ? "U.S. (all metros)" : "Pick a metro…") + '</option>';
  D.metros.forEach(function (m) {
    var p = m.pts[m.pts.length - 1];
    opts += '<option value="' + esc(m.id) + '"' + (m.id === state.scope ? " selected" : "") + '>' + esc(m.name) + "  " + fmtGap(gapOf(p)) + '</option>';
  });
  el("pick").innerHTML = opts;
}
var tlRaf = 0;
el("tl").addEventListener("input", function () {
  var v = +this.value, n = D.mapMonths.length;
  mapIdx = v >= n - 1 ? null : v;
  if (tlRaf) return;
  tlRaf = requestAnimationFrame(function () { tlRaf = 0; renderMap(); });
});
el("tlnow").addEventListener("click", function () { mapIdx = null; el("tl").value = el("tl").max; renderMap(); });
// Map zoom: fixed regions, one tap each (in the map's 975 x 610 Albers box)
var REGIONS = [
  { k: "U.S." },
  { k: "West", vb: [20, 20, 460, 460] },
  { k: "Texas", vb: [380, 390, 200, 170] },
  { k: "Midwest", vb: [465, 110, 350, 240] },
  { k: "Southeast", vb: [575, 315, 310, 290] },
  { k: "Northeast", vb: [715, 75, 260, 245] }
];
var mapRegion = 0;
function renderRegions() {
  el("regions").innerHTML = REGIONS.map(function (r, i) {
    return '<button data-i="' + i + '" class="' + (i === mapRegion ? "on" : "") + '">' + r.k + '</button>';
  }).join("");
  var bs = el("regions").querySelectorAll("button");
  for (var i = 0; i < bs.length; i++) bs[i].onclick = function () { mapRegion = +this.getAttribute("data-i"); renderMap(); };
}
// Tap a dot to switch the charts to it. Inside overlapping dots, the smallest
// one under the finger wins (it's drawn on top); otherwise the nearest dot
// within 22 screen points.
function mapTap(e) {
  var svg = el("map"), r = svg.getBoundingClientRect(), vb = REGIONS[mapRegion].vb || [0, 0, D.mapW, D.mapH];
  var k = vb[2] / r.width, qx = vb[0] + (e.clientX - r.left) * k, qy = vb[1] + (e.clientY - r.top) * k;
  var inside = null, best = null, bd = Infinity;
  (svg.__placed || []).forEach(function (p) {
    var c = Math.sqrt((p.m.x - qx) * (p.m.x - qx) + (p.m.y - qy) * (p.m.y - qy)), d = c - p.r;
    if (d <= 0 && (!inside || p.r < inside.r)) inside = p;
    if (d < bd) { bd = d; best = p; }
  });
  var hit = inside || (best && bd / k < 22 ? best : null);
  if (hit) select(hit.m.id === state.scope ? null : hit.m.id);
}
el("map").addEventListener("click", mapTap);

// ---------- Note ----------
function renderNote() {
  var nx = "";
  if (D.next) { var q = D.next.split("-"), d = new Date(+q[0], +q[1] - 1, +q[2]); nx = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()] + " " + MONTHS[d.getMonth()] + " " + d.getDate() + ", " + q[0]; }
  el("note").textContent =
    "Source: Redfin Balance of Power data (redfin.com/news/data-center/buyers-sellers), the same file Redfin’s own dashboard loads. " +
    "Estimated homebuyers and home sellers actively in the market each month, seasonally adjusted, all property types. " +
    "Gap = sellers ÷ buyers − 1. Market calls are Redfin’s: under 0.9 buyers per seller is a buyer’s market, over 1.1 a seller’s market, " +
    "in between balanced (the gray band). Map: one dot per metro at its main city; dot area = buyers + sellers, on one scale for every month " +
    "so sizes compare across time; color = Redfin’s call for the month on the timeline. U.S. data from " + mLong(D.national[0][0]) +
    (D.metroStart ? ", metros from " + mLong(D.metroStart) : "") + ". Redfin revised its method in April 2026, lowering both counts but not the gap; " +
    "estimates are subject to revision." + (D.lastModified ? " File dated " + D.lastModified + "." : "") +
    (nx ? " Next update " + nx + (D.nextEstimated ? " (estimated; Redfin’s page couldn’t be read)." : " (per Redfin).") : "");
}

function setViewQuiet() { var I = scopeSeries().length - 1; if (view.b > I || view.a < 0) resetView(); }
function select(id) {
  state.scope = id || null;
  state.cursor = null;
  touched = false;
  resetView();
  renderAll();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function renderAll() { renderTop(); renderCharts(); renderMap(); renderPicker(); renderNote(); el("progress").textContent = D.progress || ""; }

// Draw safely: never a silent black screen. Waits until the view has a real
// size (it can arrive before the screen is laid out), and shows any error
// with a Retry button instead.
var tries = 0;
function showError(msg) {
  el("loading").style.display = "none";
  var e = el("err");
  e.style.display = "";
  e.innerHTML = "Couldn’t draw the charts: " + esc(msg) + '<button id="retry">Retry</button>';
  el("retry").onclick = function () { e.style.display = "none"; tries = 0; if (D) safeRender(); else { el("loading").style.display = ""; window.__wantData = true; } };
}
function safeRender() {
  if (!D) { window.__wantData = true; return; }
  if (document.body.clientWidth < 50 && tries++ < 25) { setTimeout(safeRender, 120); return; }
  try {
    el("blocks").style.display = "";
    renderAll();
    el("loading").style.display = "none";
    el("err").style.display = "none";
    window.__rendered = true;
  } catch (e) {
    el("blocks").style.display = "none";
    showError((e && e.message) || String(e));
  }
}
window.onerror = function (msg) { if (!window.__rendered) showError(String(msg)); };

window.update = function (n) {
  D = n;
  window.__wantData = false;
  STATE_PATH = D.states.split("|").map(function (r) { return "M" + r.split(" ").join("L") + "Z"; }).join("");
  prepMap();
  if (state.scope && !metroById(state.scope)) state.scope = null;
  if (!touched) resetView(); else setViewQuiet();
  safeRender();
  return "ok";
};
// Share as PDF: 16:9 slides. 1) sellers vs buyers for the area and dates on
// screen; 2) the metro map (for the timeline's month and the zoomed region)
// beside the gap chart. Each has a headline that states the point, value
// labels at the ends, and a dark banner crediting the source. Vector.
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
  var GRN = [36, 150, 72], RD = [214, 48, 39], NEU = [142, 142, 147];
  var KC = { B: GRN, S: RD, N: NEU };
  function font(bold, size, c) { doc.setFont(FACE, bold ? "bold" : "normal"); doc.setFontSize(size); doc.setTextColor(c[0], c[1], c[2]); }
  function cnt(v) { return v >= 1e6 ? (v / 1e6).toFixed(2) + "M" : v >= 1e4 ? Math.round(v / 1000) + "K" : (v / 1000).toFixed(1) + "K"; }
  function gp(g) { return (g >= 0 ? "+" : "-") + Math.round(Math.abs(g) * 100) + "%"; }
  var all = scopeSeries(), P = visible(), n = P.length, last = P[n - 1], first = P[0];
  var m0 = state.scope ? metroById(state.scope) : null;
  var place = m0 ? m0.name.split(",")[0].split("-")[0].trim() : "the U.S.";
  var Place = m0 ? place : "The U.S.";
  var pages = D.metros && D.metros.length ? 2 : 1;

  function headline(text) {
    var size = 21, lines;
    do { font(true, size, INK); lines = doc.splitTextToSize(text, W - 72); size -= 1; } while (lines.length > 1 && size > 15);
    doc.text(lines, 36, 42);
    return 42 + (lines.length - 1) * (size + 4);
  }
  function titles(top, title, sub, cx) {
    cx = cx || W / 2;
    font(true, 11.5, INK); doc.text(title, cx, top + 30, { align: "center" });
    font(false, 9.5, GRY); doc.text(sub, cx, top + 43, { align: "center" });
  }
  function nice(range, target) {
    var raw = range / (target || 5), p = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)), f = raw / p;
    return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p;
  }
  function scale(vals, target) {
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals), pad = (hi - lo) * 0.06 || Math.abs(hi) * 0.05 || 1;
    lo -= pad; hi += pad;
    var st = nice(hi - lo, target || 5); lo = Math.floor(lo / st) * st; hi = Math.ceil(hi / st) * st; if (hi === lo) hi = lo + st;
    return { lo: lo, hi: hi, st: st };
  }
  // month labels along the bottom, thinned to fit
  function xLabels(F, X) {
    var years = n / 12, step = years <= 4 ? 1 : years <= 8 ? 2 : 3, lastX = -99;
    for (var i = 0; i < n; i++) {
      var m = P[i][0], mo = m.slice(5, 7), lab = null;
      if (n <= 15) { if (+mo % 3 === 1) lab = MONTHS[+mo - 1] + " '" + m.slice(2, 4); }
      else if (mo === "01" && (+m.slice(0, 4)) % step === 0) lab = m.slice(0, 4);
      if (lab && X(i) - lastX > 34) {
        doc.setDrawColor(150, 150, 155); doc.setLineWidth(0.5); doc.line(X(i), F.B, X(i), F.B + 3);
        font(false, 8.5, GRY); doc.text(lab, X(i), F.B + 13, { align: "center" }); lastX = X(i);
      }
    }
  }
  function poly(points, c) {
    if (points.length < 3) return;
    var rel = [];
    for (var k = 1; k < points.length; k++) rel.push([points[k][0] - points[k - 1][0], points[k][1] - points[k - 1][1]]);
    doc.setFillColor(c[0], c[1], c[2]); doc.lines(rel, points[0][0], points[0][1], [1, 1], "F", true);
  }
  function legend(y, cx, items) {
    var total = 0;
    font(false, 9, INK);
    items.forEach(function (it) { it.w = doc.getTextWidth(it.t); total += (it.dot ? 14 : 22) + it.w + 18; });
    var x = cx - (total - 18) / 2;
    items.forEach(function (it) {
      if (it.dot) { doc.setFillColor(it.c[0], it.c[1], it.c[2]); doc.circle(x + 4, y - 3, 4, "F"); }
      else { doc.setLineWidth(it.lw || 2); doc.setDrawColor(it.c[0], it.c[1], it.c[2]); doc.line(x, y - 3, x + 16, y - 3); }
      font(false, 9, INK); doc.text(it.t, x + (it.dot ? 14 : 22), y); x += (it.dot ? 14 : 22) + it.w + 18;
    });
  }
  function banner(page) {
    var bh = 44, by = H - bh;
    doc.setFillColor(28, 28, 30); doc.rect(0, by, W, bh, "F");
    doc.setFillColor(201, 162, 39); doc.rect(W - 176, by + 6, 2, bh - 12, "F");
    font(false, 7.2, [235, 235, 240]);
    var src = "Source: Redfin Balance of Power data (Redfin Data Center): estimated homebuyers and home sellers active in the market each month, seasonally adjusted, all property types. " +
      "Balanced = 0.9 to 1.1 buyers per seller; buyer's market = more sellers than that, seller's market = more buyers.";
    doc.text(doc.splitTextToSize(src, W - 176 - 40 - 110), 28, by + 15);
    font(false, 7.5, [200, 200, 205]);
    doc.text("Data through " + mLong(latestMonth()), W - 188, by + 20, { align: "right" });
    doc.text(page + " of " + pages, W - 188, by + 31, { align: "right" });
    font(true, 12.5, [255, 255, 255]);
    doc.text("Balance of", W - 162, by + 20);
    doc.text("Power", W - 162, by + 34);
  }

  // ---- 1. Sellers vs buyers ----
  var k = mk(last), g = gapOf(last), start = last[0], j;
  for (j = all.length - 1; j >= 0 && mk(all[j]) === k; j--) start = all[j][0];
  var since = j < 0 ? "Throughout the Data" : "Since " + mLong(start);
  var head = k === "B" ? "Sellers Outnumber Buyers by " + Math.round(g * 100) + "%: " + Place + " Has Been a Buyer's Market " + since
    : k === "S" ? "Buyers Outnumber Sellers by " + Math.round((last[1] / last[2] - 1) * 100) + "%: " + Place + " Has Been a Seller's Market " + since
    : Place + " Is Balanced: Buyers and Sellers Within 10% of Each Other " + since;
  var top = headline(head);
  titles(top, "Homebuyers vs Home Sellers in the Market", "Redfin estimates, monthly, seasonally adjusted · " + (m0 ? m0.name : "U.S.") + " · " + mLong(first[0]) + " to " + mLong(last[0]));
  var vals = []; P.forEach(function (p) { vals.push(p[1], p[2]); });
  var sc = scale(vals, 5);
  var F = { L: 70, R: W - 130, T: top + 58, B: H - 92 };
  var X = function (i) { return F.L + (n === 1 ? 0 : i / (n - 1) * (F.R - F.L)); };
  var Y = function (v) { return F.B - (v - sc.lo) / (sc.hi - sc.lo) * (F.B - F.T); };
  doc.setLineWidth(0.5);
  for (var v = sc.lo; v <= sc.hi + sc.st / 2; v += sc.st) {
    doc.setDrawColor(RULE[0], RULE[1], RULE[2]); doc.line(F.L, Y(v), F.R, Y(v));
    font(false, 8.5, GRY); doc.text(cnt(v), F.L - 6, Y(v) + 3, { align: "right" });
  }
  doc.setDrawColor(150, 150, 155); doc.line(F.L, F.B, F.R, F.B);
  xLabels(F, X);
  // shading by who leads: one shape per stretch
  var runStart = 0;
  function flush(a, b) {
    if (b <= a) return;
    var pts = [], i;
    for (i = a; i <= b; i++) pts.push([X(i), Y(P[i][2])]);
    for (i = b; i >= a; i--) pts.push([X(i), Y(P[i][1])]);
    var lead = P[a][2] + P[b][2] >= P[a][1] + P[b][1];
    poly(pts, lead ? [214, 238, 221] : [248, 222, 220]);
  }
  for (var i2 = 1; i2 < n; i2++) {
    if ((P[i2][2] >= P[i2][1]) !== (P[runStart][2] >= P[runStart][1])) { flush(runStart, i2); runStart = i2; }
  }
  flush(runStart, n - 1);
  [[2, GRN], [1, RD]].forEach(function (s) {
    doc.setDrawColor(s[1][0], s[1][1], s[1][2]); doc.setLineWidth(2.2); if (doc.setLineJoin) doc.setLineJoin("round");
    for (var i = 1; i < n; i++) doc.line(X(i - 1), Y(P[i - 1][s[0]]), X(i), Y(P[i][s[0]]));
  });
  var ys = Y(last[2]), yb = Y(last[1]);
  if (Math.abs(ys - yb) < 13) { var mid = (ys + yb) / 2, up = ys < yb ? -1 : 1; ys = mid + up * 6.5; yb = mid - up * 6.5; }
  font(true, 10, GRN); doc.text(cnt(last[2]) + " sellers", F.R + 7, ys + 3.5);
  font(true, 10, RD); doc.text(cnt(last[1]) + " buyers", F.R + 7, yb + 3.5);
  legend(F.B + 30, W / 2, [{ t: "Home sellers", c: GRN, lw: 2.2 }, { t: "Homebuyers", c: RD, lw: 2.2 }]);
  banner(1);

  // ---- 2. Map and gap side by side ----
  if (pages === 2) {
    doc.addPage([W, H], "landscape");
    var month = mapMonth(), here = [], c = { B: 0, N: 0, S: 0 };
    D.metros.forEach(function (m) { var p = m.byM && m.byM[month]; if (p) { here.push({ m: m, p: p }); c[mk(p)]++; } });
    var tot = here.length;
    var head2 = c.S > c.B
      ? c.S + " of " + tot + " Big Metros Are Seller's Markets; " + c.B + " Are Buyer's Markets"
      : c.B + " of " + tot + " Big Metros Are Buyer's Markets; " + c.S + " Are Seller's Markets";
    top = headline(head2 + (month !== latestMonth() ? " (" + mLong(month) + ")" : ""));
    // left: the map
    var region = REGIONS[mapRegion], vb = region.vb || [0, 0, D.mapW, D.mapH];
    var pL = 30, pR = 382, cxL = (pL + pR) / 2;
    titles(top, "Market by Metro", mLong(month) + (region.vb ? " · " + region.k : "") + " · dot size = buyers + sellers", cxL);
    var mT = top + 58, mB = H - 104, sc2 = Math.min((pR - pL) / vb[2], (mB - mT) / vb[3]);
    var ox = cxL - vb[2] * sc2 / 2, oy = mT + ((mB - mT) - vb[3] * sc2) / 2;
    var MX = function (x) { return ox + (x - vb[0]) * sc2; }, MY = function (y) { return oy + (y - vb[1]) * sc2; };
    doc.saveGraphicsState();
    doc.rect(ox, oy, vb[2] * sc2, vb[3] * sc2, null); doc.clip(); doc.discardPath();
    doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.6);
    D.states.split("|").forEach(function (ring) {
      var pts = ring.split(" ").map(function (q) { var a = q.split(","); return [MX(+a[0]), MY(+a[1])]; });
      if (pts.length < 3) return;
      var rel = [];
      for (var q2 = 1; q2 < pts.length; q2++) rel.push([pts[q2][0] - pts[q2 - 1][0], pts[q2][1] - pts[q2 - 1][1]]);
      doc.setFillColor(237, 237, 240); doc.lines(rel, pts[0][0], pts[0][1], [1, 1], "FD", true);
    });
    var z = D.mapW / vb[2], placed = here.filter(function (x) { return x.m.x != null; }), sel = null;
    placed.sort(function (a, b) { return (b.p[1] + b.p[2]) - (a.p[1] + a.p[2]); });
    placed.forEach(function (x) {
      x.r = Math.max(6, 36 * Math.sqrt((x.p[1] + x.p[2]) / D.mapMax)) / Math.sqrt(z) * sc2;
      var col = KC[mk(x.p)];
      doc.setFillColor(col[0], col[1], col[2]); doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.5);
      doc.circle(MX(x.m.x), MY(x.m.y), x.r, "FD");
      if (x.m.id === state.scope) sel = x;
    });
    if (z >= 1.9) {
      var boxes = [];
      placed.forEach(function (x) {
        if (x === sel) return;
        font(true, 7, [80, 80, 86]);
        var nm = x.m.name.split(",")[0], tw = doc.getTextWidth(nm), bx = MX(x.m.x) + x.r + 2, by2 = MY(x.m.y) - 4;
        var clash = boxes.some(function (o) { return bx < o.x + o.w && bx + tw > o.x && by2 < o.y + o.h && by2 + 8 > o.y; });
        if (!clash) { boxes.push({ x: bx, y: by2, w: tw, h: 8 }); doc.text(nm, bx, MY(x.m.y) + 2.5); }
      });
    }
    if (sel) {
      doc.setDrawColor(28, 28, 30); doc.setLineWidth(1.3); doc.circle(MX(sel.m.x), MY(sel.m.y), sel.r + 2.5, "S");
      font(true, 9.5, INK); doc.text(place + " " + gp(gapOf(sel.p)), MX(sel.m.x) + sel.r + 5, MY(sel.m.y) + 3.5);
    }
    doc.restoreGraphicsState();
    legend(H - 84, cxL, [{ t: "Buyer's " + c.B, c: GRN, dot: true }, { t: "Balanced " + c.N, c: NEU, dot: true }, { t: "Seller's " + c.S, c: RD, dot: true }]);
    // right: the gap for the area and dates on screen
    var gL = 452, gR = W - 96, cxR = (gL + gR) / 2;
    titles(top, "Gap: Sellers vs Buyers", (m0 ? m0.name : "U.S.") + " · sellers / buyers - 1 · " + mLong(first[0]) + " to " + mLong(last[0]), cxR);
    var gs = P.map(gapOf), gv = gs.slice(); gv.push(BAND_HI, BAND_LO);
    var gsc = scale(gv, 5);
    var GT = top + 58, GB = H - 92;
    var GX = function (i) { return gL + (n === 1 ? 0 : i / (n - 1) * (gR - gL)); };
    var GY = function (v) { return GB - (v - gsc.lo) / (gsc.hi - gsc.lo) * (GB - GT); };
    doc.setFillColor(238, 238, 241); doc.rect(gL, GY(BAND_HI), gR - gL, GY(BAND_LO) - GY(BAND_HI), "F");
    font(true, 7.5, GRY); doc.text("Balanced", gR - 4, GY(BAND_LO) - 3, { align: "right" });
    doc.setLineWidth(0.5);
    for (var v2 = gsc.lo; v2 <= gsc.hi + gsc.st / 2; v2 += gsc.st) {
      var zero = Math.abs(v2) < gsc.st / 1000;
      doc.setDrawColor(zero ? 140 : RULE[0], zero ? 140 : RULE[1], zero ? 145 : RULE[2]); doc.setLineWidth(zero ? 0.9 : 0.5);
      doc.line(gL, GY(v2), gR, GY(v2));
      font(false, 8.5, GRY); doc.text((v2 > gsc.st / 1000 ? "+" : v2 < -gsc.st / 1000 ? "-" : "") + Math.round(Math.abs(v2) * 100) + "%", gL - 6, GY(v2) + 3, { align: "right" });
    }
    var years = n / 12, step = years <= 2 ? 1 : years <= 6 ? 2 : 3, lx = -99;
    for (var i3 = 0; i3 < n; i3++) {
      var mm = P[i3][0];
      if (mm.slice(5, 7) === "01" && (+mm.slice(0, 4)) % step === 0 && GX(i3) - lx > 34) { font(false, 8.5, GRY); doc.text(mm.slice(0, 4), GX(i3), GB + 13, { align: "center" }); lx = GX(i3); }
    }
    doc.setLineWidth(2.2);
    for (var i4 = 1; i4 < n; i4++) {
      var col2 = KC[mk(P[i4])];
      doc.setDrawColor(col2[0], col2[1], col2[2]); doc.line(GX(i4 - 1), GY(gs[i4 - 1]), GX(i4), GY(gs[i4]));
    }
    var lc = KC[mk(last)];
    font(true, 10, lc); doc.text(gp(gs[n - 1]), gR + 6, GY(gs[n - 1]) + 3.5);
    legend(GB + 30, cxR, [{ t: "Buyer's market", c: GRN, lw: 2.2 }, { t: "Balanced", c: NEU, lw: 2.2 }, { t: "Seller's market", c: RD, lw: 2.2 }]);
    banner(2);
  }
  return doc;
};
window.shareInfo = function () { var pts = scopeSeries(); return { title: "Balance of Power", name: scopeLabel(), asOf: mLong(pts[pts.length - 1][0]) }; };

el("pick").addEventListener("change", function () { select(this.value || null); });
window.addEventListener("resize", function () { if (window.__rendered) { try { renderCharts(); } catch (e) {} } else safeRender(); });
if (D) window.update(D); else window.__wantData = true;
</script>
__SHARE__
</body>
</html>`;

function pagePayload(s, progress) {
  let metroStart = null;
  (s.metros || []).forEach((m) => {
    if (m.pts.length && (!metroStart || m.pts[0][0] < metroStart)) metroStart = m.pts[0][0];
  });
  return {
    national: s.national,
    metros: (s.metros || []).map((m) => ({ id: m.id, name: m.name, x: m.x, y: m.y, pts: m.pts })),
    next: s.next || null,
    nextEstimated: !!s.nextEstimated,
    lastModified: s.lastModified ? isoDay(new Date(s.lastModified)) : null,
    metroStart,
    states: STATES,
    mapW: MAP_W,
    mapH: MAP_H,
    defaultSpan: DEFAULT_SPAN,
    progress: progress || "",
  };
}

// Opens with a light "Loading…" page first, so the screen is never black,
// then hands the data over once the view is up. Re-sends if the page asks
// (its Retry button), and checks Redfin for newer data only after the charts
// are showing.
async function openFullScreen(s, loading) {
  const wv = updWV(new WebView());
  await wv.loadHTML(...updArgs(
    PAGE_HTML.replace("__DATA__", () => "null").replace("__SHARE__", () => "<script>" + SHARE_PAGE_JS + "</script>")
  ));
  const progressOf = (x, checking) => (checking ? "Checking Redfin for newer data…" : x.error ? "Showing saved data: " + x.error : "");
  let json = JSON.stringify(pagePayload(s, progressOf(s, loading)));
  const push = async () => {
    try {
      await wv.evaluateJavaScript(`window.update(${json})`);
    } catch (e) {}
  };
  const ask = async (expr) => {
    try {
      return await wv.evaluateJavaScript(expr);
    } catch (e) {
      return null;
    }
  };
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
        try {
          fresh = await refreshWithin(60, false);
        } catch (e) {
          fresh = { ...s, error: String(e.message || e) };
        }
        json = JSON.stringify(pagePayload(fresh, progressOf(fresh, false)));
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
    const family = config.widgetFamily || "small";
    widget = finishWidget(family === "medium" || family === "large" ? mediumImage(s) : smallImage(s), s);
  } catch (e) {
    widget = errorWidget(`Couldn't load Redfin's data yet. Open the script once in Scriptable. (${e.message || e})`);
  }
  if (config.runsInWidget) Script.setWidget(widget);
  else await widget.presentMedium();
} else {
  try {
    const saved = readStore();
    if (saved && saved.national && saved.national.length) {
      // Open straight away with the saved copy, then check Redfin behind it
      await openFullScreen(saved, true);
    } else {
      const first = await refreshWithin(90, true);
      await openFullScreen(first, false);
    }
  } catch (e) {
    const a = new Alert();
    a.title = "Couldn't load Redfin's data";
    a.message = String(e.message || e) + "\n\nCheck the connection and run it again.";
    a.addAction("OK");
    await a.present();
  }
}
Script.complete();
