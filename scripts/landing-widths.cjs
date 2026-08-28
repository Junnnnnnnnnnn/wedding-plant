/* eslint-disable no-console */
/**
 * 랜딩을 폭·높이별로 훑으며 검사한다.
 *
 * 보는 것
 *  - 핀이 걸려야 할 곳에 걸렸는지 (폰은 걸리고, 701~1019 와 낮은 폰은 안 걸린다)
 *  - 핀 내용이 한 화면을 넘치는지 — `.pin2` 의 overflow:hidden 이 잘라 먹는다
 *  - 화면 한가운데를 지나는데 안 보이는 덩어리가 있는지
 *  - 가로 스크롤 · 히어로 끝 타일 완성 · D-day 오도미터가 가운데인지
 *
 * 실행: npm run dev 를 띄운 뒤 `node scripts/landing-widths.cjs`
 */
const puppeteer = require("puppeteer-core");

const BASE = process.env.BASE || "http://localhost:3000";
const CHROME =
  process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";

const VP = [
  [2327, 1249], [1440, 900], [1280, 900], [1240, 900], [1100, 900],
  [1019, 900], [900, 800], [768, 700],
  [430, 932], [414, 896], [393, 852], [390, 844], [375, 667], [360, 640], [320, 568],
];
const SECS = [".stage", ".sec.vs", ".sec.sync", ".sec.cmp:not(.kchat)", ".sec.kchat"];
const NAME = ["히어로", "엑셀", "연동", "노션", "카톡"];

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: process.env.HEADED ? false : "new",
    args: [
      "--use-gl=angle", "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader", "--hide-scrollbars",
    ],
  });
  const page = await browser.newPage();
  /*
    **헤드리스 크롬은 prefers-reduced-motion 이 기본으로 reduce 다.**
    그대로 두면 랜딩의 감속 폴백(핀 해제 + 모든 요소 opacity:1)만 보게 되고
    스크롤 안무는 한 번도 돌지 않는다 — 이걸 모르고 "이상 없음" 을 여러 번
    보고했다. 반드시 실제 사용자 환경으로 맞춘 뒤 검사한다.
  */
  await page.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: "no-preference" },
  ]);
  const errs = [];
  const problems = [];
  page.on("pageerror", (e) => errs.push(String(e)));

  for (const [w, h] of VP) {
    const mob = w <= 430;
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: mob, hasTouch: mob });
    await page.goto(BASE + "/", { waitUntil: "networkidle0", timeout: 120000 });
    await new Promise((r) => setTimeout(r, 900));

    for (let i = 0; i < SECS.length; i++) {
      const box = await page.evaluate((s) => {
        const e = document.querySelector(s);
        return e ? { top: e.offsetTop, h: e.offsetHeight } : null;
      }, SECS[i]);
      if (!box) { problems.push(`${w}x${h}: ${NAME[i]} 없음`); continue; }

      for (const m of [0.1, 0.3, 0.5, 0.7, 0.92]) {
        await page.evaluate((s, mm) =>
          window.scrollTo(0, s.top + Math.max(0, s.h - window.innerHeight) * mm), box, m);
        await new Promise((r) => setTimeout(r, 300));
        const r = await page.evaluate((sel) => {
          const s = document.querySelector(sel);
          const pin = s.querySelector(".pin,.pin2");
          const on = pin && getComputedStyle(pin).position === "sticky";
          let ov = 0;
          if (on) {
            const wr = pin.querySelector(".wrap").getBoundingClientRect();
            const pr = pin.getBoundingClientRect();
            ov = Math.round(Math.max(0, wr.bottom - pr.bottom) + Math.max(0, pr.top + 56 - wr.top));
          }
          const hid = [];
          s.querySelectorAll("h2,.lead,.toggle,.win2,.dev2,.device,.web,.cmpcap,.tiles,.money-strip")
            .forEach((e) => {
              const b = e.getBoundingClientRect(), cs = getComputedStyle(e);
              if (cs.display === "none" || b.height === 0) return;
              if (b.top < innerHeight * 0.55 && b.bottom > innerHeight * 0.45 &&
                  parseFloat(cs.opacity) < 0.5)
                hid.push((e.className || e.tagName).toString().split(" ")[0]);
            });
          const de = document.documentElement;
          return { ov, on, hid: [...new Set(hid)], sw: de.scrollWidth, cw: de.clientWidth };
        }, SECS[i]);

        const t = `${w}x${h} ${NAME[i]}/${m}`;
        // 핀이 없는 게 정상인 구간: 701~1019, 그리고 폰인데 화면이 낮은 것(<780)
        const noPin = (w > 700 && w < 1020) || (w <= 700 && h < 780);
        if (!r.on && !noPin) problems.push(`${t}: 핀이 안 걸린다`);
        if (r.ov > 2) problems.push(`${t}: 핀 넘침 ${r.ov}px`);
        if (r.hid.length && m >= 0.3) problems.push(`${t}: 가운데인데 투명 ${r.hid.join(",")}`);
        if (r.sw > r.cw + 1) problems.push(`${w}x${h}: 가로 스크롤 ${r.sw}>${r.cw}`);
      }
    }

    // 히어로: 끝에서 타일 넷이 다 차고, D-day 가 가운데인지
    const hb = await page.evaluate(() => {
      const s = document.querySelector("#lp .stage");
      return { top: s.offsetTop, h: s.offsetHeight };
    });
    await page.evaluate((s) => window.scrollTo(0, s.top + (s.h - window.innerHeight) * 0.95), hb);
    await new Promise((r) => setTimeout(r, 350));
    const hero = await page.evaluate(() => {
      const tiles = [...document.querySelectorAll("#lp .tile.fill .s")]
        .map((e) => +parseFloat(getComputedStyle(e).opacity).toFixed(2));
      const o = document.querySelector("#lp .odo");
      const wrap = o.closest(".odo-wrap");
      const ob = o.getBoundingClientRect(), wb = wrap.getBoundingClientRect();
      const centered = getComputedStyle(o).justifyContent === "center";
      return { tiles, off: Math.round(Math.abs((ob.left + ob.width / 2) - (wb.left + wb.width / 2))), centered };
    });
    if (hero.tiles.some((v) => v < 0.95))
      problems.push(`${w}x${h}: 히어로 끝 타일 미완 ${hero.tiles.join(" ")}`);
    if (hero.centered && hero.off > 4)
      problems.push(`${w}x${h}: D-day 가 가운데에서 ${hero.off}px 치우침`);
  }

  // ── 히어로 안무 자체 ────────────────────────────────
  //  두 번 되살아난 회귀라 매번 본다:
  //   (1) 예산 막대는 분홍이 다 찬 뒤에 회색이 이어 차야 한다 (같이 자라면 안 된다)
  //   (2) D-day 숫자는 ExtraBold 여야 한다 — --font-tmoney 는 400=Regular 라
  //       400 을 쓰면 얇아진다. 굵기는 선언값이 아니라 **그려진 글자 폭**으로 본다.
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(BASE + "/", { waitUntil: "networkidle0", timeout: 120000 });
  await new Promise((r) => setTimeout(r, 900));
  {
    const box = await page.evaluate(() => {
      const s = document.querySelector("#lp .stage");
      return { top: s.offsetTop, h: s.offsetHeight };
    });
    const seq = [];
    for (let m = 0.02; m <= 0.99; m += 0.03) {
      await page.evaluate((s, mm) =>
        window.scrollTo(0, s.top + (s.h - window.innerHeight) * mm), box, m);
      await new Promise((r) => setTimeout(r, 110));
      seq.push(await page.evaluate(() => {
        const bar = ["used", "plan"].map((k) => {
          const e = document.querySelector("#lp .mbar ." + k);
          const t = getComputedStyle(e).transform;
          return t === "none" ? 1 : +(+t.split("(")[1].split(",")[0]).toFixed(3);
        });
        const nb = document.querySelector("#lp .odo-track b");
        const cs = getComputedStyle(nb);
        const cv = document.createElement("canvas").getContext("2d");
        const at = (w) => { cv.font = w + " 60px " + cs.fontFamily; return cv.measureText("312").width; };
        return { bar, fw: cs.fontWeight, cur: at(cs.fontWeight), w700: at(700), w400: at(400) };
      }));
    }
    const both = [];
    for (let i = 1; i < seq.length; i++) {
      if (seq[i].bar[0] - seq[i - 1].bar[0] > 0.02 &&
          seq[i].bar[1] - seq[i - 1].bar[1] > 0.02) both.push(seq[i].m);
    }
    if (both.length) problems.push("예산 막대 두 구간이 같이 자란다");
    const firstPlan = seq.find((x) => x.bar[1] > 0.03);
    if (!firstPlan) problems.push("예산 막대 회색 구간이 자라지 않는다");
    else if (firstPlan.bar[0] < 0.98) problems.push("회색이 자라기 시작할 때 분홍이 아직 " + firstPlan.bar[0]);
    const last = seq[seq.length - 1];
    if (last.bar[0] < 0.98 || last.bar[1] < 0.98) problems.push("히어로 끝에 예산 막대 미완 " + last.bar.join(" "));
    const f = seq[0];
    if (Math.abs(f.cur - f.w700) > 0.5)
      problems.push(`D-day 숫자가 ExtraBold 가 아니다 (현재 ${f.cur} / 700 ${f.w700} / 400 ${f.w400})`);
  }

  // ── 감속 모드도 한 번 본다 ──────────────────────────
  //  안무를 끄면 시작 상태(opacity:0)에 갇히는 요소가 없어야 한다.
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    await page.setViewport({ width: w, height: h, isMobile: w <= 430, hasTouch: w <= 430 });
    await page.goto(BASE + "/", { waitUntil: "networkidle0", timeout: 120000 });
    await new Promise((r) => setTimeout(r, 900));
    const hid = await page.evaluate(() => {
      const o = [];
      document.querySelectorAll("#lp h2,#lp .lead,#lp .toggle,#lp .win2,#lp .dev2," +
        "#lp .device,#lp .web,#lp .cmpcap,#lp .tiles,#lp .money-strip,#lp .tile .s")
        .forEach((e) => {
          const cs = getComputedStyle(e);
          if (cs.display === "none") return;
          if (parseFloat(cs.opacity) < 0.5)
            o.push((e.className || e.tagName).toString().split(" ")[0]);
        });
      return [...new Set(o)];
    });
    if (hid.length) problems.push(`${w}x${h} 감속 모드: 투명하게 갇힘 ${hid.join(",")}`);
  }

  await browser.close();
  if (errs.length) console.log("JS 오류:\n" + [...new Set(errs)].slice(0, 5).join("\n"));
  console.log(problems.length
    ? "문제:\n" + [...new Set(problems)].slice(0, 20).join("\n")
    : `이상 없음 (${VP.length}뷰포트 × ${SECS.length}섹션)`);
  if (problems.length) process.exitCode = 1;
})();
