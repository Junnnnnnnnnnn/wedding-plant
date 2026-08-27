/* eslint-disable no-console */
/**
 * 게스트(로그인 없이 둘러보기) 흐름 전체 하네스.
 *
 * 확인하는 것
 *  1. 랜딩 → "로그인 없이 둘러보기" → 온보딩 4단계 → /main 도착
 *  2. **어느 화면에서든 홈으로 돌아올 수 있는지** — 게스트가 랜딩으로
 *     튕겨 나가면 안 된다. `/main` 이 `plan_has_completed_guest_setting`
 *     플래그로 직접 진입을 막는데, 그 플래그가 sessionStorage 라
 *     새로고침·새 탭에서 사라지면 홈이 막힌다.
 *  3. 일곱 화면(홈·보드·캘린더·참여 플랜·피드·예산·프로필)이 게스트로 열리는지
 *  4. 일정 추가 → 보드·캘린더·홈에 실제로 반영되는지
 *  5. 게스트인데 백엔드 인증 API 를 부르지 않는지
 *
 * 실행: npm run dev 를 띄운 뒤 `node scripts/guest-flow.cjs`
 *   HEADED=1 을 붙이면 브라우저를 띄운다.
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

/** 화면에 보이는 그 문구의 버튼을 누른다 */
const clickText = (label) => {
  const btn = [...document.querySelectorAll("button, a")].find(
    (b) => b.textContent.trim() === label && b.offsetParent !== null,
  );
  if (!btn) return false;
  btn.click();
  return true;
};

const snapshot = () => ({
  path: location.pathname + location.search,
  flag: sessionStorage.getItem("plan_has_completed_guest_setting"),
  token: !!(
    localStorage.getItem("plan_auth_token") ||
    sessionStorage.getItem("plan_auth_token")
  ),
  text: (document.body.innerText || "").replace(/\s+/g, " ").trim().slice(0, 70),
});

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

  const jsErrors = [];
  page.on("pageerror", (e) => jsErrors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") jsErrors.push("console: " + m.text());
  });
  /** 게스트인데 인증이 필요한 백엔드를 불렀는지 */
  const authCalls = [];
  page.on("request", (r) => {
    const u = r.url();
    if (!/\/plan\//.test(u)) return;
    const p = u.replace(/^https?:\/\/[^/]+/, "");
    // 카테고리 목록은 인증이 필요 없다
    if (/^\/plan\/category\//.test(p)) return;
    authCalls.push(p);
  });

  const shot = (n) => page.screenshot({ path: path.join(OUT, `guest-${n}.png`) });

  // ── 1. 랜딩 → 둘러보기 ─────────────────────────────
  console.log("1. 랜딩 → 로그인 없이 둘러보기");
  await page.goto(BASE + "/", { waitUntil: "networkidle0" });
  await wait(700);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await wait(600);
  const wentSetting = await page.evaluate(clickText, "로그인 없이 둘러보기");
  if (!wentSetting) bad('랜딩에서 "로그인 없이 둘러보기" 를 못 찾았다');
  await page
    .waitForFunction(() => location.pathname === "/setting", { timeout: 15000 })
    .catch(() => bad("/setting 으로 안 갔다"));
  await wait(1200);
  ok("/setting 도착");

  // ── 2. 온보딩 4단계 ───────────────────────────────
  console.log("2. 온보딩 (게스트는 4단계)");
  // 축하 연출 뒤 첫 질문
  await wait(2600);
  for (const [tag, label] of [
    ["날짜", "다음"],
    ["예산", "다음"],
    ["이름", "다음"],
  ]) {
    await wait(tag === "예산" ? 3800 : 1400);
    if (tag === "이름") {
      const typed = await page.evaluate(() => {
        const input = document.querySelector(
          'input[placeholder="이름 또는 닉네임"]',
        );
        if (!input) return false;
        Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value",
        ).set.call(input, "예신");
        input.dispatchEvent(new Event("input", { bubbles: true }));
        return true;
      });
      if (!typed) bad("이름 입력칸을 못 찾았다");
      await wait(400);
    }
    if (!(await page.evaluate(clickText, label)))
      bad(`${tag} 단계의 "${label}" 을 못 눌렀다`);
    ok(`${tag} 단계 넘김`);
  }
  // 환영 → 출입증 → 다음 → 약관
  await wait(6000);
  await page
    .waitForFunction(
      () => {
        const c = document.querySelector(".lanyard-wrapper canvas");
        return !!c && c.getBoundingClientRect().width > 0;
      },
      { timeout: 60000 },
    )
    .catch(() => bad("출입증 캔버스가 끝내 안 떴다"));
  await wait(1200);
  if (!(await page.evaluate(clickText, "다음"))) bad('출입증의 "다음" 실패');
  await wait(1400);

  // 약관 — 게스트 버튼은 "계획 짜러 가기" 여야 한다 (초대 단계가 없다)
  const termsLabel = await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find(
      (x) =>
        ["다음", "계획 짜러 가기"].includes(x.textContent.trim()) &&
        x.offsetParent !== null,
    );
    return b ? b.textContent.trim() : null;
  });
  if (termsLabel !== "계획 짜러 가기")
    bad(`게스트 약관 버튼이 "${termsLabel}" (기대 "계획 짜러 가기")`);
  // 동의 체크는 `input.hidden` + label 이라 input 은 offsetParent 가 null 이다.
  // 라벨(= "전체 동의합니다." 를 감싼 요소)을 눌러야 실제로 켜진다.
  const agreed = await page.evaluate(() => {
    const label = [...document.querySelectorAll("label")].find((l) =>
      l.textContent.includes("전체 동의합니다."),
    );
    if (!label) return "라벨 없음";
    const box = label.querySelector("input[type=checkbox]");
    if (box && box.checked) return "이미 켜짐";
    label.click();
    return box && box.checked ? "켜짐" : "안 켜짐";
  });
  if (!["켜짐", "이미 켜짐"].includes(agreed)) bad(`전체 동의 실패: ${agreed}`);
  await wait(500);
  await shot("2-terms");
  if (!(await page.evaluate(clickText, "계획 짜러 가기")))
    bad('약관의 "계획 짜러 가기" 를 못 눌렀다');
  await page
    .waitForFunction(() => location.pathname === "/main", { timeout: 20000 })
    .catch(() => bad("온보딩을 끝냈는데 /main 으로 안 갔다"));
  await wait(1800);
  let st = await page.evaluate(snapshot);
  if (st.flag !== "1") bad(`온보딩 후에도 게스트 플래그가 ${st.flag}`);
  ok(`/main 도착 (플래그 ${st.flag})`);
  await shot("3-main");

  // ── 3. 일곱 화면을 돌고, 매번 홈으로 돌아온다 ──────────
  console.log("3. 화면 이동 — 갈 때마다 홈으로 되돌아온다");
  const ROUTES = [
    ["/calendar", "플랜 보드"],
    ["/plan-list", "참여 플랜"],
    ["/feed", "피드"],
    ["/budget-detail", "예산 상세"],
    ["/user", "프로필"],
    ["/add-plen", "플랜 추가"],
  ];
  for (const [route, name] of ROUTES) {
    await page.goto(BASE + route, { waitUntil: "networkidle0" });
    await wait(1500);
    st = await page.evaluate(snapshot);
    if (!st.path.startsWith(route)) bad(`${name}: ${route} → ${st.path} 로 튕김`);
    else ok(`${name} 열림`);

    // 홈으로 — 레일/탭바의 "홈" 을 실제로 누른다
    const clickedHome = await page.evaluate(() => {
      const el = [...document.querySelectorAll("button, a")].find(
        (b) => b.textContent.trim() === "홈" && b.offsetParent !== null,
      );
      if (!el) return false;
      el.click();
      return true;
    });
    if (!clickedHome) {
      bad(`${name}: "홈" 버튼을 못 찾았다`);
      continue;
    }
    await wait(2000);
    st = await page.evaluate(snapshot);
    if (st.path === "/" || st.path.startsWith("/?"))
      bad(`${name} → 홈: **랜딩으로 튕겼다** (플래그 ${st.flag})`);
    else if (!st.path.startsWith("/main"))
      bad(`${name} → 홈: ${st.path} 로 갔다`);
    else ok(`${name} → 홈 정상`);
  }
  await shot("4-back-home");

  // ── 4. 새로고침·새 탭에서도 홈이 살아 있는지 ────────────
  console.log("4. 새로고침 / 새 탭");
  await page.goto(BASE + "/main", { waitUntil: "networkidle0" });
  await wait(1500);
  await page.reload({ waitUntil: "networkidle0" });
  await wait(1800);
  st = await page.evaluate(snapshot);
  if (st.path === "/" || st.path.startsWith("/?"))
    bad(`/main 새로고침 → 랜딩으로 튕겼다 (플래그 ${st.flag})`);
  else ok("/main 새로고침 유지");

  const tab2 = await browser.newPage();
  await tab2.setViewport({ width: 1440, height: 900 });
  await tab2.goto(BASE + "/main", { waitUntil: "networkidle0" });
  await wait(1800);
  const st2 = await tab2.evaluate(snapshot);
  if (st2.path === "/" || st2.path.startsWith("/?"))
    bad(`새 탭에서 /main → **랜딩으로 튕겼다** (플래그 ${st2.flag})`);
  else if (st2.path.startsWith("/setting"))
    // sessionStorage 는 탭마다 따로라 새 탭에는 게스트 데이터 자체가 없다.
    // 온보딩으로 보내는 게 맞다 — 랜딩으로 내보내지만 않으면 된다.
    ok("새 탭은 게스트 데이터가 없어 온보딩으로 (앱 안에 남는다)");
  else ok("새 탭 /main 유지");
  await tab2.close();

  // ── 4-b. 온보딩을 건너뛴 게스트 (직접 /calendar 로 들어온 사람) ──────
  //  사용자가 실제로 부딪힌 길이다. /calendar 는 게이트가 없어 열리는데
  //  거기서 "홈" 을 누르면 /main 의 게이트에 걸려 랜딩으로 튕긴다.
  console.log("4-b. 온보딩 없는 게스트는 앱 화면에 못 들어간다");
  /*
    온보딩이 채우는 값(이름·결혼 날짜·예산)에 기대는 화면은 전부 막혀야 한다.
    예전에는 /main 에만 검사가 있어 /calendar 로 주소를 바로 치면 열렸고,
    거기서 "홈" 을 눌러야 그제서야 튕겼다. 지금은 GuestGate 가 한 곳에서 막는다.
  */
  const GUARDED = [
    "/main",
    "/calendar",
    "/plan-list",
    "/feed",
    "/budget-detail",
    "/user",
    "/add-plen",
    "/schedule-detail",
  ];
  const OPEN = ["/", "/setting", "/privacy", "/share/abc123"];
  const cold = await browser.createBrowserContext();
  const p2 = await cold.newPage();
  await p2.setViewport({ width: 1440, height: 900 });

  for (const route of GUARDED) {
    await p2.goto(BASE + route, { waitUntil: "networkidle0" });
    await wait(1600);
    const s1 = await p2.evaluate(snapshot);
    if (s1.path.startsWith("/setting")) ok(`${route} → 온보딩으로 막힘`);
    else if (s1.path === "/" || s1.path.startsWith("/?"))
      bad(`${route} → **랜딩으로 튕겼다** (앱 밖으로 밀려남)`);
    else bad(`${route}: 온보딩 없이 열렸다 (${s1.path})`);
  }
  for (const route of OPEN) {
    await p2.goto(BASE + route, { waitUntil: "networkidle0" });
    await wait(1600);
    const s1 = await p2.evaluate(snapshot);
    if (s1.path.startsWith("/setting") && route !== "/setting")
      bad(`${route}: 막으면 안 되는데 온보딩으로 보냈다`);
    else ok(`${route} 열림`);
  }
  // 공유 코드를 들고 오면 온보딩 전이어도 들어가야 한다 (초대가 끊기면 안 된다)
  await p2.goto(BASE + "/main?share=abc123", { waitUntil: "networkidle0" });
  await wait(1800);
  const sh = await p2.evaluate(snapshot);
  if (sh.path.startsWith("/setting"))
    bad("?share= 를 들고 왔는데 온보딩으로 막혔다 (초대가 끊긴다)");
  else ok("?share= 는 온보딩 전에도 통과");
  await p2.screenshot({ path: path.join(OUT, "guest-4b-gate.png") });
  await cold.close();

  // ── 5. 일정 추가 → 보드·홈에 반영 ──────────────────────
  console.log("5. 게스트 일정 추가 → 반영");
  /*
    등록 폼은 **단계형**이다 — 제목을 채워야 카테고리가, 카테고리를 골라야
    결제 유형이, 결제 유형을 골라야 금액·장소·저장 버튼이 나온다.
    (CLAUDE.md "플랜 등록 pane" 참고) 그래서 한 번에 채울 수 없다.
  */
  await page.goto(BASE + "/add-plen", { waitUntil: "networkidle0" });
  await wait(2000);
  const filled = await page.evaluate(() => {
    const el = document.querySelector('input[placeholder="어떤 지출인가요?"]');
    if (!el) return false;
    Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    ).set.call(el, "하네스 일정");
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  });
  if (!filled) bad("플랜 추가: 제목 입력칸을 못 찾았다");
  await wait(1200);

  const opened = await page.evaluate(clickText, "카테고리 선택");
  if (!opened) bad("플랜 추가: 카테고리 선택 버튼이 안 나타났다");
  await wait(1400);
  const picked = await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find(
      (x) => x.textContent.trim() === "스드메" && x.offsetParent !== null,
    );
    if (!b) return false;
    b.click();
    return true;
  });
  if (!picked) bad("플랜 추가: 카테고리 목록이 안 열렸다");
  await wait(1500);

  const payType = await page.evaluate(clickText, "현금");
  if (!payType) bad("플랜 추가: 결제 유형이 안 나타났다");
  await wait(1400);
  await shot("5-add");

  const saved = await page.evaluate(clickText, "플랜 저장하기");
  if (!saved) bad("플랜 추가: 저장 버튼이 안 나타났다");
  else ok("저장 눌림");
  await wait(2800);

  const stored = await page.evaluate(() => {
    try {
      return JSON.parse(sessionStorage.getItem("guest_schedule_list_v1") || "[]")
        .length;
    } catch (e) {
      return -1;
    }
  });
  if (stored <= 0) bad(`게스트 일정이 저장되지 않았다 (${stored}건)`);
  else ok(`게스트 일정 ${stored}건 저장됨`);

  await page.goto(BASE + "/calendar", { waitUntil: "networkidle0" });
  await wait(2000);
  const onBoard = await page.evaluate(() =>
    (document.body.innerText || "").includes("하네스 일정"),
  );
  if (stored > 0 && !onBoard) bad("보드에 방금 넣은 일정이 안 보인다");
  else if (onBoard) ok("보드에 반영됨");
  await shot("6-board");

  // ── 6. 게스트인데 인증 API 를 불렀는지 ──────────────────
  console.log("6. 백엔드 호출");
  if (authCalls.length) {
    bad(`게스트인데 인증 API 를 불렀다: ${[...new Set(authCalls)].slice(0, 5).join(" ")}`);
  } else ok("인증이 필요한 백엔드 호출 없음");

  await browser.close();
  console.log("");
  if (jsErrors.length)
    console.log("JS 오류:\n" + [...new Set(jsErrors)].slice(0, 6).join("\n"));
  if (problems.length) {
    console.log(`문제 ${problems.length}건:`);
    problems.forEach((p) => console.log(" - " + p));
    process.exitCode = 1;
  } else {
    console.log("게스트 흐름 이상 없음");
  }
})();
