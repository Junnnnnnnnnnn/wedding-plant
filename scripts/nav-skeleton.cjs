/* eslint-disable no-console */
/**
 * 메뉴를 누르면 **바로** 넘어가는지.
 *
 * 예전에는 탭·레일을 누르면 1~2초 동안 아무 일도 없다가 갑자기 넘어가서
 * 앱이 고장 난 것처럼 보였다. 다음 화면의 코드(개발 서버에서는 컴파일까지)를
 * 다 받을 때까지 이전 화면이 그대로 멈춰 있었기 때문이다.
 *
 * 지금 규칙: 누른 순간 목적지의 뼈대(스켈레톤)가 뜨고, 코드와 데이터는 그
 * 뒤에 채운다. 이 하네스는 누른 뒤 짧은 간격으로 화면을 훑어
 *   1. 누르고 나서 **무언가 바뀌기까지** 걸린 시간 (스켈레톤이든 새 화면이든)
 *   2. 그 사이 이전 화면이 멈춰 있던 시간
 *   3. 전역 스피너(`잠시만 기다려주세요`)가 화면을 덮었는지
 * 를 잰다. 목 백엔드는 일부러 느리게 답한다(`DELAY`, 기본 1500ms).
 *
 * 실행: dev 서버를 띄운 뒤 `BASE=http://localhost:3011 node scripts/nav-skeleton.cjs`
 *   DELAY=1500   목 응답 지연(ms)
 *   WIDTHS=390,1440
 *   SHOT_DIR     캡처 위치 (기본 `__shots/nav`)
 *   LIMIT=200    "바로" 의 기준(ms). 이보다 늦으면 실패
 */
const fs = require("fs");
const path = require("path");
const p = require("puppeteer-core");
const { installMocks, JWT, API } = require("./mobile-viewports.cjs");

const ORIGIN = process.env.BASE || "http://localhost:3000";
const OUT =
  process.env.SHOT_DIR || path.join(__dirname, "..", "__shots", "nav");
const CHROME =
  process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const DELAY = Number(process.env.DELAY || 1500);
const LIMIT = Number(process.env.LIMIT || 200);
const WIDTHS = (process.env.WIDTHS || "390,1440").split(",").map(Number);

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** 폭마다 누를 메뉴. 폰은 하단 탭바, 넓은 화면은 레일 */
const MOBILE_STEPS = [
  { label: "피드", path: "/feed" },
  { label: "참여 플랜", path: "/plan-list" },
  { label: "Settings", path: "/user" },
  { label: "홈", path: "/main" },
];
const DESKTOP_STEPS = [
  { label: "플랜 보드", path: "/calendar" },
  { label: "참여 플랜 · 대화", path: "/plan-list" },
  { label: "피드", path: "/feed" },
  { label: "자랑하기", path: "/brag" },
  { label: "Settings", path: "/user" },
  { label: "홈", path: "/main" },
];

/** 페이지 안에서 한 번 훑는다 */
function sample(fromPath) {
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    if (r.bottom < 0 || r.top > window.innerHeight) return false;
    const st = getComputedStyle(el);
    return st.visibility !== "hidden" && st.display !== "none";
  };
  const skeleton = [...document.querySelectorAll(".skeleton-shimmer")].some(
    visible,
  );
  const spinner = [...document.querySelectorAll("span")].some(
    (s) => s.textContent === "잠시만 기다려주세요" && visible(s),
  );
  return {
    path: location.pathname,
    moved: location.pathname !== fromPath,
    skeleton,
    // 누르기 전 화면에 찍어 둔 표식이 아직 보이면 이전 화면이 그대로다
    stale: !!document.querySelector("[data-nav-probe]"),
    navSkeleton: !!document.querySelector("[data-nav-pending]"),
    spinner,
  };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await p.launch({
    executablePath: CHROME,
    headless: process.env.HEADED ? false : "new",
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage();

  await page.evaluateOnNewDocument((host) => {
    const Native = window.WebSocket;
    function Blocked(url, protocols) {
      if (String(url).includes(host)) throw new Error("harness: blocked");
      return new Native(url, protocols);
    }
    Blocked.prototype = Native.prototype;
    window.WebSocket = Blocked;
    const css = document.createElement("style");
    css.textContent =
      "nextjs-portal,#nextjs-dev-overlay,[data-nextjs-toast],[data-next-badge-root]{display:none!important}";
    const put = () => document.head && document.head.appendChild(css);
    if (document.head) put();
    else document.addEventListener("DOMContentLoaded", put);
  }, new URL(API).host);

  await page.goto(`${ORIGIN}/login`, { waitUntil: "domcontentloaded" });
  await page.evaluate((t) => {
    localStorage.setItem("plan_auth_token", t);
    sessionStorage.setItem("plan_auth_token", t);
    sessionStorage.setItem("plan_has_completed_guest_setting", "1");
  }, JWT);

  await page.setRequestInterception(true);
  // 느린 백엔드 흉내 — installMocks 가 붙인 응답을 DELAY 만큼 늦춘다
  const origOn = page.on.bind(page);
  page.on = (ev, fn) =>
    ev === "request"
      ? origOn(ev, (req) => {
          if (req.url().startsWith(API) && req.method() !== "OPTIONS")
            setTimeout(() => fn(req), DELAY);
          else fn(req);
        })
      : origOn(ev, fn);
  installMocks(page);

  const problems = [];
  const bad = (m) => {
    problems.push(m);
    console.log(`   ✗ ${m}`);
  };

  for (const w of WIDTHS) {
    const desktop = w >= 768;
    await page.setViewport({ width: w, height: desktop ? 900 : 760 });
    console.log(`\n== ${w}px (${desktop ? "레일" : "탭바"})`);

    // **차가운 상태**에서 잰다: 개발 서버는 한 번 컴파일한 라우트를 기억하므로,
    // 같은 폭을 두 번째 돌면 이미 빠르다. 첫 폭의 결과가 사용자 체감에 가깝다.
    await page.goto(`${ORIGIN}/main`, {
      waitUntil: "networkidle2",
      timeout: 90000,
    });
    await wait(DELAY + 1500);

    const steps = desktop ? DESKTOP_STEPS : MOBILE_STEPS;
    for (const step of steps) {
      const from = await page.evaluate(() => location.pathname);
      // 이전 화면에 표식을 심는다. 새 화면(또는 뼈대)이 그려지면 사라진다
      await page.evaluate(() => {
        const probe = document.createElement("i");
        probe.setAttribute("data-nav-probe", "");
        const host =
          document.querySelector("main") ||
          document.querySelector(".h-\\[100dvh\\] > div:last-child") ||
          document.body;
        host.appendChild(probe);
      });

      const clicked = await page.evaluate(
        (label, isDesktop) => {
          const root = document.querySelector(
            isDesktop ? "#main-side-nav" : "#main-bottom-nav",
          );
          if (!root) return false;
          const btn = [...root.querySelectorAll("button")].find((b) =>
            b.textContent.trim().startsWith(label),
          );
          if (!btn) return false;
          btn.click();
          return true;
        },
        step.label,
        desktop,
      );
      if (!clicked) {
        bad(`${w} ${from} → ${step.label}: 메뉴 버튼을 못 찾았다`);
        continue;
      }
      const t0 = Date.now();

      let firstChange = null;
      let sawSpinner = false;
      let shotEarly = false;
      let last = null;
      while (Date.now() - t0 < 12000) {
        last = await page.evaluate(sample, from);
        const dt = Date.now() - t0;
        if (last.spinner) sawSpinner = true;
        if (firstChange === null && (!last.stale || last.navSkeleton)) {
          firstChange = dt;
        }
        if (firstChange !== null && !shotEarly) {
          shotEarly = true;
          await page.screenshot({
            path: path.join(OUT, `${w}-${step.path.slice(1)}-0-first.png`),
          });
        }
        if (last.moved && !last.navSkeleton && dt > DELAY + 1200) break;
        await wait(25);
      }
      await page.screenshot({
        path: path.join(OUT, `${w}-${step.path.slice(1)}-1-done.png`),
      });

      const tag = `${w} ${from} → ${step.path}`;
      console.log(
        `  ${tag.padEnd(34)} 첫 반응=${firstChange ?? "없음"}ms  도착=${last.path}  스피너=${sawSpinner ? "O" : "-"}`,
      );
      if (firstChange === null || firstChange > LIMIT)
        bad(`${tag}: 누르고 ${firstChange ?? "12000+"}ms 동안 화면이 그대로다`);
      if (sawSpinner) bad(`${tag}: 전역 스피너가 화면을 덮었다`);
      if (last.path !== step.path) bad(`${tag}: ${last.path} 에 도착했다`);
    }
  }

  /*
    홈 카드. 카드 전체가 `<Link>` 라 탭바와 다른 길(`NavigationSkeleton` 의
    문서 클릭)로 덮는다. **카드 안 완료 체크는 이동이 아니다** — 거기서
    뼈대가 뜨면 체크할 때마다 화면이 번쩍인다.
  */
  console.log("\n== 390px 홈 카드");
  await page.setViewport({ width: 390, height: 760 });
  await page.goto(`${ORIGIN}/main`, {
    waitUntil: "networkidle2",
    timeout: 90000,
  });
  await wait(DELAY + 1500);
  const cardSel = 'a[aria-label^="플랜 상세 보기"]';
  if (!(await page.$(cardSel))) {
    bad("홈 카드를 못 찾았다");
  } else {
    await page.evaluate((sel) => {
      document.querySelector(`${sel} button`).click();
    }, cardSel);
    let flashed = false;
    const tc = Date.now();
    while (Date.now() - tc < 600) {
      if (await page.$("[data-nav-pending]")) flashed = true;
      await wait(20);
    }
    const here = await page.evaluate(() => location.pathname);
    console.log(
      `  완료 체크           뼈대=${flashed ? "떴다" : "-"}  위치=${here}`,
    );
    if (flashed) bad("홈 카드의 완료 체크를 눌렀는데 이동 뼈대가 떴다");
    if (here !== "/main") bad(`완료 체크를 눌렀는데 ${here} 로 갔다`);

    await page.evaluate((sel) => {
      const a = document.querySelector(sel);
      // 체크 버튼이 아닌 제목 쪽을 누른다
      (a.querySelector("span, p, div:not(:has(button))") || a).click();
    }, cardSel);
    const t0 = Date.now();
    let first = null;
    let arrived = null;
    while (Date.now() - t0 < 12000) {
      const s = await page.evaluate(sample, "/main");
      if (first === null && (s.navSkeleton || s.moved)) first = Date.now() - t0;
      if (s.path === "/schedule-detail") {
        arrived = s.path;
        break;
      }
      await wait(25);
    }
    console.log(
      `  카드 → 상세         첫 반응=${first ?? "없음"}ms  도착=${arrived ?? "-"}`,
    );
    if (first === null || first > LIMIT)
      bad(`홈 카드를 누르고 ${first ?? "12000+"}ms 동안 화면이 그대로다`);
    if (!arrived) bad("홈 카드를 눌렀는데 상세로 가지 않았다");
  }

  /*
    주소를 직접 열었을 때. 데이터를 받는 동안 **전역 스피너가 화면을 덮으면
    안 된다** — 각 화면이 자기 뼈대를 낸다.
  */
  console.log("\n== 직접 열기 (전역 스피너)");
  for (const w of WIDTHS) {
    await page.setViewport({ width: w, height: w >= 768 ? 900 : 760 });
    for (const url of [
      "/main",
      "/calendar",
      "/plan-list",
      "/feed",
      "/brag",
      "/user",
      "/budget-detail",
      "/schedule-detail?id=4",
      "/add-plen",
    ]) {
      await page.goto(`${ORIGIN}${url}`, {
        waitUntil: "domcontentloaded",
        timeout: 90000,
      });
      let spinner = false;
      let skeleton = false;
      const t0 = Date.now();
      while (Date.now() - t0 < DELAY + 800) {
        const s = await page.evaluate(sample, "");
        if (s.spinner) spinner = true;
        if (s.skeleton) skeleton = true;
        await wait(40);
      }
      console.log(
        `  ${String(w).padEnd(5)}${url.padEnd(24)} 뼈대=${skeleton ? "O" : "-"}  스피너=${spinner ? "O" : "-"}`,
      );
      if (spinner) bad(`${w} ${url}: 직접 열었을 때 전역 스피너가 덮었다`);
    }
  }

  await browser.close();
  console.log(
    problems.length
      ? `\n문제 ${problems.length}건:\n - ${problems.join("\n - ")}`
      : "\n모든 전환이 바로 반응한다",
  );
  process.exit(problems.length ? 1 : 0);
})();
