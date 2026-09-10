/* eslint-disable no-console */
/**
 * 앱의 **모든 숫자 칸**을 실제로 눌러 친다.
 *
 * 값이 0 일 때 칸에 "0" 이 박혀 있으면 3 을 치는 순간 "03" 이 되고, 지우려면
 * 0 까지 한 번 더 지워야 했다. 규칙은 `lib/utils.ts` 의 `applyDigitInput`
 * 한 곳에 있고, 이 하네스가 칸마다 그 규칙이 실제로 걸렸는지 본다.
 *
 *   · 3 을 치면 "3" — 앞의 0 이 남지 않는다
 *   · 값 맨 앞에 0 을 끼워 넣어도 선행 0 이 남지 않는다
 *   · 숫자가 아닌 글자는 들어가지 않는다
 *   · 아주 긴 숫자는 12 자리에서 잘린다 (지수 표기 방지)
 *   · 다 지우면 빈 칸 — `/user` 는 그때 서버로 0 을 보낸다
 *
 * 백엔드는 목으로 세운다 — 실제 계정을 건드리지 않는다.
 * 실행: npm run dev 를 띄운 뒤 `node scripts/number-inputs.cjs`
 */
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-core");

const BASE = process.env.BASE || "http://localhost:3000";
const CHROME =
  process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUT = process.env.SHOT_DIR || path.join(__dirname, "..", "shots");

const problems = [];
const ok = (m) => console.log("  · " + m);
const bad = (m) => {
  problems.push(m);
  console.log("  ✗ " + m);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const b64u = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const JWT = [
  b64u({ alg: "HS256", typ: "JWT" }),
  b64u({ planUserId: "me-1", sub: "me-1", exp: 9999999999 }),
  "sig",
].join(".");

const USER = {
  planUserId: "me-1",
  name: "미듀",
  weddingDate: "2026-12-26",
  weddingVenue: null,
  budget: 0,
  profileImageUrl: null,
  roomId: null,
};

/** 등록 폼의 카테고리 목록 — 비어 있으면 다음 단계로 갈 수 없다 */
const CATEGORIES = [
  { id: 1, name: "스드메", color: "#ee2b8c", type: "SYSTEM" },
  { id: 2, name: "예식장", color: "#7b61ff", type: "SYSTEM" },
  { id: 3, name: "신혼여행", color: "#00b8a9", type: "SYSTEM" },
];

/** 저장 요청 바디를 모아 둔다 — 화면 문구가 아니라 서버로 나가는 값을 본다 */
const saved = [];

async function boot({ token, width = 390, height = 800 }) {
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
  await page.setViewport({ width, height, isMobile: width < 768 });
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const u = req.url();
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Methods": "*",
    };
    const json = (b) =>
      req.respond({
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
        body: JSON.stringify(b),
      });
    if (u.includes("/plan/")) {
      if (req.method() === "OPTIONS")
        return req.respond({ status: 204, headers: cors });
      if (u.includes("/plan/setting") && req.method() === "POST") {
        try {
          saved.push(JSON.parse(req.postData() || "{}"));
        } catch {
          saved.push(null);
        }
        return json({ result: true, data: USER });
      }
      if (u.includes("/plan/user")) return json({ result: true, data: USER });
      if (u.includes("/plan/category"))
        return json({
          result: true,
          data: { total: CATEGORIES.length, list: CATEGORIES },
        });
      return json({ result: true, data: { total: 0, list: [] } });
    }
    return req.continue().catch(() => {});
  });
  if (token) {
    await page.evaluateOnNewDocument((t) => {
      localStorage.setItem("plan_auth_token", t);
      sessionStorage.setItem("plan_auth_token", t);
    }, token);
  }
  return { browser, page };
}

const readField = (page, sel) =>
  page.$eval(sel, (el) => ({ value: el.value, placeholder: el.placeholder }));

async function typeInto(page, sel, keys) {
  await page.click(sel);
  // 금액 칸은 text-right 라 클릭 지점이 값 **앞**이 된다. 캐럿을 끝으로
  // 보내지 않으면 하네스가 매번 맨 앞에 끼워 넣는 셈이 된다.
  await page.keyboard.press("End");
  for (const k of keys) {
    await page.keyboard.press(k);
  }
  await wait(150);
}

async function clearField(page, sel, times = 16) {
  await page.click(sel);
  await page.keyboard.press("End");
  for (let i = 0; i < times; i += 1) {
    await page.keyboard.press("Backspace");
  }
  await wait(150);
}

const ONLY_DIGITS_OR_COMMA = /^[0-9,]*$/;
const NON_DIGITS = /[^0-9]/g;

/**
 * 한 칸에 공통 규칙을 모두 태운다.
 *
 * `singleZeroStays` 는 칸의 상태가 문자열인지 숫자인지에 따라 갈린다.
 * `/user` 예산은 상태가 숫자 0 이라 "0" 을 쳐도 곧바로 빈 칸으로 되돌아가고
 * (0 은 placeholder 가 말한다), 온보딩·금액 칸은 문자열이라 "0" 이 남는다.
 */
async function checkField(page, sel, label, { comma, singleZeroStays }) {
  const expect3000 = comma ? "3,000" : "3000";

  await clearField(page, sel);
  {
    const f = await readField(page, sel);
    if (f.value !== "") bad(`${label}: 다 지웠는데 "${f.value}" 가 남았다`);
    else ok("다 지우면 빈 칸");
    if (f.placeholder !== "0")
      bad(`${label}: placeholder 가 "${f.placeholder}" 다 (0 이어야 한다)`);
    else ok("회색 placeholder 0");
  }

  await typeInto(page, sel, ["3"]);
  {
    const f = await readField(page, sel);
    if (f.value !== "3") bad(`${label}: 3 을 쳤더니 "${f.value}"`);
    else ok('3 을 치면 "3"');
  }

  await typeInto(page, sel, ["0", "0", "0"]);
  {
    const f = await readField(page, sel);
    if (f.value !== expect3000) bad(`${label}: "${f.value}" 가 됐다`);
    else ok(`"${expect3000}"`);
  }

  // 맨 앞에 0 을 끼워 넣는다 — 리렌더가 없어 DOM 에 "03000" 이 남던 자리
  await page.click(sel);
  await page.keyboard.press("Home");
  await page.keyboard.press("0");
  await wait(200);
  {
    const f = await readField(page, sel);
    if (f.value !== expect3000)
      bad(`${label}: 앞에 0 을 끼웠더니 "${f.value}"`);
    else ok("앞에 0 을 끼워도 선행 0 이 남지 않는다");
  }

  await clearField(page, sel, 20);
  await typeInto(page, sel, new Array(20).fill("9"));
  {
    const f = await readField(page, sel);
    const digits = f.value.replace(NON_DIGITS, "");
    if (digits.length > 12) bad(`${label}: ${digits.length} 자리까지 들어갔다`);
    else if (!ONLY_DIGITS_OR_COMMA.test(f.value))
      bad(`${label}: "${f.value}" 가 됐다`);
    else ok(`${digits.length} 자리에서 잘렸다`);
  }

  await clearField(page, sel, 20);
  await typeInto(page, sel, ["KeyA", "Minus", "Period", "5"]);
  {
    const f = await readField(page, sel);
    if (!ONLY_DIGITS_OR_COMMA.test(f.value))
      bad(`${label}: "${f.value}" 가 들어갔다`);
    else ok(`숫자만 남는다 ("${f.value}")`);
  }

  await clearField(page, sel, 20);
  await typeInto(page, sel, ["0"]);
  {
    const f = await readField(page, sel);
    if (singleZeroStays && f.value !== "0")
      bad(`${label}: 0 만 쳤는데 "${f.value}" — 0 원도 있을 수 있다`);
    else if (!singleZeroStays && f.value !== "")
      bad(`${label}: 0 은 빈 칸이어야 하는데 "${f.value}"`);
    else
      ok(singleZeroStays ? '혼자 남은 "0" 은 유지된다' : "0 은 빈 칸이 된다");
  }
}

async function shot(page, name) {
  fs.mkdirSync(OUT, { recursive: true });
  await page.evaluate(() => {
    document.querySelectorAll("nextjs-portal").forEach((e) => e.remove());
  });
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
}

/** 화면에 보이는 버튼을 글자로 찾아 누른다 (브라우저 안에서 실행) */
function clickByText(text) {
  const b = Array.from(document.querySelectorAll("button")).find(
    (x) => (x.textContent || "").trim() === text && x.offsetParent !== null,
  );
  if (!b) return false;
  b.click();
  return true;
}

(async () => {
  // ── 1. /user 프로필 예산 ────────────────────────────────
  console.log("1. /user 예산 칸");
  {
    const { browser, page } = await boot({ token: JWT });
    await page.goto(`${BASE}/user`, {
      waitUntil: "networkidle0",
      timeout: 120000,
    });
    await wait(2500);
    const SEL = 'input[inputmode="numeric"], input[type="number"]';
    await checkField(page, SEL, "/user 예산", {
      comma: false,
      singleZeroStays: false,
    });

    // 다 지웠을 때 서버로 나가는 값이 0 인지 — 화면 문구가 아니라 요청 바디로
    await clearField(page, SEL, 20);
    saved.length = 0;
    await page.evaluate(clickByText, "저장");
    await wait(1500);
    const body = saved[0];
    if (!body) bad("/user 예산: 저장 요청이 나가지 않았다");
    else if (Number(body.budget) !== 0)
      bad(`/user 예산: 서버로 ${body.budget} 이 나갔다`);
    else ok("빈 칸으로 저장하면 서버로 0 이 나간다");

    await typeInto(page, SEL, ["3", "0", "0", "0"]);
    await shot(page, "number-user-390");
    await browser.close();
  }

  // ── 2. /setting 온보딩 예산 ─────────────────────────────
  console.log("2. /setting 온보딩 예산 칸");
  {
    const { browser, page } = await boot({ token: null });
    await page.goto(`${BASE}/setting`, {
      waitUntil: "networkidle0",
      timeout: 120000,
    });
    // 축하 연출(3초)과 페이드가 끝나야 날짜 단계의 버튼이 나온다
    await wait(5200);
    const next = await page.evaluate(clickByText, "다음");
    if (!next) bad("온보딩: 날짜 단계의 다음 버튼을 못 찾았다");
    // 예산 단계는 CountUp(3초)이 끝나야 입력 칸이 나온다
    await wait(6000);
    const SEL = 'input[inputmode="numeric"], input[type="number"]';
    const present = await page.$(SEL);
    if (!present) {
      bad("온보딩: 예산 입력 칸이 나타나지 않았다");
    } else {
      await checkField(page, SEL, "온보딩 예산", {
        comma: false,
        singleZeroStays: true,
      });
      await typeInto(page, SEL, ["3", "0", "0", "0"]);
      await shot(page, "number-onboarding-390");
    }
    await browser.close();
  }

  // ── 3. /add-plen 금액 (콤마 포맷) ───────────────────────
  console.log("3. /add-plen 금액 칸");
  {
    const { browser, page } = await boot({ token: null });
    // 게스트 게이트를 통과시킨다 (온보딩을 마친 것으로 표시)
    await page.evaluateOnNewDocument(() => {
      sessionStorage.setItem("plan_has_completed_guest_setting", "1");
    });
    await page.goto(`${BASE}/add-plen`, {
      waitUntil: "networkidle0",
      timeout: 120000,
    });
    await wait(2500);

    /*
      등록 폼은 **단계형**이다 — 제목을 채워야 카테고리가, 카테고리를 골라야
      결제 유형이, 결제 유형을 골라야 금액 칸이 나온다.
    */
    const titled = await page.evaluate(() => {
      const el = document.querySelector(
        'input[placeholder="어떤 지출인가요?"]',
      );
      if (!el) return false;
      Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      ).set.call(el, "하네스 일정");
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    });
    if (!titled) bad("금액: 제목 칸을 못 찾았다");
    await wait(1200);

    await page.evaluate(clickByText, "카테고리 선택");
    await wait(1400);
    const picked = await page.evaluate(clickByText, "스드메");
    if (!picked) bad("금액: 카테고리를 고를 방법이 없다");
    await wait(1500);
    const pay = await page.evaluate(clickByText, "현금");
    if (!pay) bad("금액: 결제 유형이 안 나타났다");
    await wait(1500);

    const SEL = "#plan-amount";
    const present = await page.$(SEL);
    if (!present) {
      bad("금액: 금액 칸이 나타나지 않았다");
    } else {
      await checkField(page, SEL, "일정 금액", {
        comma: true,
        singleZeroStays: true,
      });
      await typeInto(page, SEL, ["3", "0", "0", "0"]);
      await shot(page, "number-addplen-390");
    }
    await browser.close();
  }

  console.log("");
  if (problems.length) {
    console.log(`문제 ${problems.length}건:`);
    problems.forEach((p) => console.log(" - " + p));
    process.exitCode = 1;
  } else console.log("숫자 칸 이상 없음");
})();
