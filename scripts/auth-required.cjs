/* eslint-disable no-console */
/**
 * 로그인 필수 하네스 (예전 `guest-flow.cjs` 자리).
 *
 * 이 앱에는 **게스트 모드가 없다.** 들어오는 길은 카카오 로그인 하나뿐이고,
 * 판단은 `app/components/GuestGate.tsx` 한 곳에서 한다. 화면마다 같은 검사를
 * 복사하면 새 화면을 만들 때 빠뜨린다 — 예전에 `/main` 에만 검사가 있어서
 * `/calendar` 로 주소를 바로 치면 그대로 열렸다.
 *
 * 확인하는 것
 *  1. 토큰 없이 앱 화면 주소를 치면 **`/login`** 으로 간다 (아홉 화면 전부)
 *  2. 토큰 없이 온보딩(`/setting`)에 가면 **랜딩(`/`)** 으로 간다 —
 *     앱을 아직 모르는 사람에게 "다시 오셨네요" 는 말이 안 되고, 로그인 전에는
 *     온보딩에서 받은 답을 저장할 곳도 없다
 *  3. **게이트가 복귀 경로를 저장하지 않는다.** 저장하면 처음 온 사람이
 *     로그인을 마치고 온보딩을 건너뛴 빈 앱에 떨어진다
 *  4. 예전 게스트 플래그(`plan_has_completed_guest_setting`)가 세션에 남아
 *     있어도 통과시키지 않는다
 *  5. 문·문서·초대는 막지 않는다 — `/`·`/login`·`/privacy`·`/share/…`·`?share=`
 *  6. 둘러보기 입구가 화면에 다시 생기지 않았는지 (랜딩·로그인)
 *
 * 실행: npm run dev 를 띄운 뒤 `node scripts/auth-required.cjs`
 *   HEADED=1 로 브라우저를 띄울 수 있고, BASE 로 주소를 바꿀 수 있다.
 */
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-core");

const BASE = process.env.BASE || "http://localhost:3000";
const OUT = process.env.SHOT_DIR || path.join(__dirname, "..", "__shots");
const CHROME =
  process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const problems = [];
const bad = (m) => {
  problems.push(m);
  console.log("  ✗ " + m);
};
const ok = (m) => console.log("  · " + m);

/** 게이트가 돌 때까지 기다린 뒤 지금 주소와 세션 상태를 본다 */
const settle = async (page) => {
  await wait(1200);
  return page.evaluate(() => ({
    path: location.pathname,
    returnPath: sessionStorage.getItem("plan_return_path_after_login"),
    text: (document.body.innerText || "").replace(/\s+/g, " ").trim(),
  }));
};

const GUARDED = [
  "/main",
  "/calendar",
  "/plan-list",
  "/feed",
  "/brag",
  "/budget-detail",
  "/user",
  "/add-plen",
  "/schedule-detail",
  "/chat/1",
];

/** 막지 않아야 하는 곳. 초대는 여기서 끊기면 안 된다 */
const OPEN = [
  "/",
  "/login",
  "/privacy",
  "/share/TESTCODE",
  "/main?share=TESTCODE",
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: process.env.HEADED ? false : "new",
    args: [
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--hide-scrollbars",
    ],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  // 랜딩의 스크롤 안무는 헤드리스 기본값(reduce)에서 돌지 않는다
  await page.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: "no-preference" },
  ]);

  const jsErrors = [];
  page.on("pageerror", (e) => jsErrors.push(String(e)));

  const clearSession = () =>
    page.evaluate(() => {
      sessionStorage.clear();
      localStorage.clear();
    });

  // ── 1. 앱 화면은 토큰 없이 못 연다 ───────────────────
  console.log("1. 토큰 없이 앱 화면 → /login");
  for (const route of GUARDED) {
    await page.goto(BASE + route, { waitUntil: "networkidle0" });
    await clearSession();
    await page.reload({ waitUntil: "networkidle0" });
    const s = await settle(page);
    if (s.path !== "/login") bad(`${route} 가 ${s.path} 에 머물렀다`);
    else if (s.returnPath)
      bad(
        `${route}: 게이트가 복귀 경로를 저장했다(${s.returnPath}) — 신규 사용자가 온보딩을 건너뛴다`,
      );
    else ok(`${route} → /login`);
  }

  // ── 2. 온보딩은 랜딩으로 ────────────────────────────
  console.log("2. 토큰 없이 /setting → 랜딩");
  await page.goto(BASE + "/setting", { waitUntil: "networkidle0" });
  await clearSession();
  await page.reload({ waitUntil: "networkidle0" });
  {
    const s = await settle(page);
    if (s.path !== "/") bad(`/setting 이 ${s.path} 로 갔다 (랜딩이어야 한다)`);
    else ok("/setting → /");
  }

  // ── 3. 예전 게스트 플래그가 남아 있어도 막는다 ────────
  console.log("3. 예전 게스트 플래그가 남아 있는 세션");
  await page.goto(BASE + "/main", { waitUntil: "networkidle0" });
  await page.evaluate(() => {
    sessionStorage.clear();
    localStorage.clear();
    sessionStorage.setItem("plan_has_completed_guest_setting", "1");
  });
  await page.reload({ waitUntil: "networkidle0" });
  {
    const s = await settle(page);
    if (s.path !== "/login")
      bad(`게스트 플래그가 남은 세션이 ${s.path} 로 통과했다`);
    else ok("옛 플래그로는 못 들어온다");
  }

  // ── 4. 문·문서·초대는 막지 않는다 ────────────────────
  console.log("4. 안 막는 곳");
  for (const route of OPEN) {
    await page.goto(BASE + route, { waitUntil: "networkidle0" });
    await clearSession();
    await page.reload({ waitUntil: "networkidle0" });
    const s = await settle(page);
    const stayed = s.path === route.split("?")[0];
    if (!stayed) bad(`${route} 가 ${s.path} 로 밀려났다`);
    else ok(`${route} 그대로`);
  }

  // ── 5. 둘러보기 입구가 다시 생기지 않았는지 ───────────
  console.log("5. 둘러보기 입구");
  for (const route of ["/", "/login"]) {
    await page.goto(BASE + route, { waitUntil: "networkidle0" });
    await wait(900);
    const found = await page.evaluate(() =>
      (document.body.innerText || "").includes("로그인 없이"),
    );
    if (found) bad(`${route} 에 "로그인 없이 둘러보기" 가 다시 생겼다`);
    else ok(`${route} 에 게스트 입구 없음`);
    await page.screenshot({
      path: path.join(OUT, `auth-${route === "/" ? "landing" : "login"}.png`),
    });
  }

  if (jsErrors.length) {
    console.log("\n자바스크립트 오류");
    jsErrors.slice(0, 5).forEach((e) => console.log("  ! " + e));
  }

  console.log(problems.length ? `\n문제 ${problems.length}건` : "\n이상 없음");
  problems.forEach((p) => console.log("  - " + p));
  await browser.close();
  process.exit(problems.length ? 1 : 0);
})();
