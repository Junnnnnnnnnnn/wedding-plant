/* eslint-disable no-console */
/**
 * 로그인 화면에 갇히는 문제를 확인한다.
 *
 *  1. `/login` 에서 로그인을 시작해도 `/login` 이 복귀 경로로 남지 않는다
 *     (남으면 로그인을 마치고 다시 로그인 화면으로 돌아오고, 거기서 또
 *      누르면 같은 값이 다시 저장돼 영영 못 들어간다)
 *  2. 세션이 끊기기 전에 보던 자리가 `/login` 을 거치며 지워지지 않는다
 *  3. 토큰이 살아 있는데 플랜이 덜 찬 사람은 `/login` 에 머물지 않는다
 *  4. 예전 버전이 남긴 `/login` 복귀 경로는 조회할 때 걸러진다
 *
 * 백엔드는 목으로 세운다 — 실제 계정을 건드리지 않는다.
 * 실행: npm run dev 를 띄운 뒤 `node scripts/login-loop.cjs`
 */
const puppeteer = require("puppeteer-core");

const BASE = process.env.BASE || "http://localhost:3000";
const CHROME =
  process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const RETURN_KEY = "plan_return_path_after_login";

const problems = [];
const ok = (m) => console.log("  · " + m);
const bad = (m) => {
  problems.push(m);
  console.log("  ✗ " + m);
};

const PLAN_FULL = { weddingDate: "2026-12-31", budget: 4200, name: "예신" };
const PLAN_EMPTY = { weddingDate: null, budget: null, name: null };

async function open({ token, userStatus = 200, userData = PLAN_FULL, seed }) {
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
  await page.setViewport({ width: 390, height: 760, isMobile: true });
  await page.setRequestInterception(true);

  // 카카오로 실제로 나가지는 않는다. 나간 주소만 붙잡아 둔다.
  const oauthHits = [];
  page.on("request", (req) => {
    const u = req.url();
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Methods": "*",
    };
    if (u.includes("/api/auth/kakao")) {
      oauthHits.push(u);
      return req.respond({
        status: 204,
        headers: { "Content-Type": "text/plain" },
      });
    }
    if (/\/plan\//.test(u)) {
      if (req.method() === "OPTIONS")
        return req.respond({ status: 204, headers: cors });
      if (/\/plan\/user(\?|$)/.test(u))
        return req.respond({
          status: userStatus,
          headers: { ...cors, "Content-Type": "application/json" },
          body: JSON.stringify(
            userStatus === 200
              ? { result: true, data: userData }
              : { result: false },
          ),
        });
      return req.respond({
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
        body: JSON.stringify({ result: true, data: { total: 0, list: [] } }),
      });
    }
    req.continue().catch(() => {});
  });

  await page.evaluateOnNewDocument(
    (t, key, seeded) => {
      if (t) {
        localStorage.setItem("plan_auth_token", t);
        sessionStorage.setItem("plan_auth_token", t);
      }
      if (seeded) sessionStorage.setItem(key, seeded);
    },
    token,
    RETURN_KEY,
    seed || "",
  );

  return { browser, page, oauthHits };
}

/**
 * 카카오 콜백 착지를 목으로 태운다.
 *
 * 콜백이 쿠키에 넣어 둔 카카오 토큰 회수(`/api/auth/kakao/token`)와 백엔드
 * 로그인 POST 를 가짜로 응답해, `KakaoLoginAlert` 가 실제로 목적지를 고르게 한다.
 */
async function landing({ seed }) {
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
  await page.setViewport({ width: 390, height: 760, isMobile: true });
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const u = req.url();
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Methods": "*",
    };
    const json = (b, s = 200) =>
      req.respond({
        status: s,
        headers: { ...cors, "Content-Type": "application/json" },
        body: JSON.stringify(b),
      });
    if (u.includes("/api/auth/kakao/token")) return json({ kakaoToken: "kt" });
    if (u.includes("/plan/")) {
      if (req.method() === "OPTIONS")
        return req.respond({ status: 204, headers: cors });
      if (u.includes("/plan/auth/kakao/login"))
        return json({ result: true, data: { token: "good.jwt" } });
      if (u.includes("/plan/user"))
        return json({ result: true, data: PLAN_FULL });
      return json({ result: true, data: { total: 0, list: [] } });
    }
    req.continue().catch(() => {});
  });
  await page.evaluateOnNewDocument(
    (key, seeded) => {
      if (seeded) sessionStorage.setItem(key, seeded);
    },
    RETURN_KEY,
    seed || "",
  );
  await page.goto(BASE + "/?kakao_login=1", {
    waitUntil: "networkidle0",
    timeout: 120000,
  });
  await new Promise((r) => setTimeout(r, 4000));
  return { browser, page };
}

const read = (page) =>
  page.evaluate(
    (key) => ({
      path: location.pathname + location.search,
      ret: sessionStorage.getItem(key),
    }),
    RETURN_KEY,
  );

const settle = (ms = 2500) => new Promise((r) => setTimeout(r, ms));

/** 화면에 보이는 카카오 로그인 버튼을 누른다 */
async function clickKakao(page) {
  const clicked = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find((b) =>
      (b.textContent || "").includes("카카오"),
    );
    if (!btn) return false;
    btn.click();
    return true;
  });
  return clicked;
}

(async () => {
  // 1. /login 에서 로그인을 시작한다
  console.log(
    "1. /login 에서 로그인 시작 — 복귀 경로에 /login 이 남으면 안 된다",
  );
  {
    const { browser, page, oauthHits } = await open({ token: null });
    await page.goto(BASE + "/login?expired=1", {
      waitUntil: "networkidle0",
      timeout: 120000,
    });
    await settle(1200);
    if (!(await clickKakao(page))) bad("카카오 로그인 버튼을 찾지 못했다");
    await settle(1500);
    const st = await read(page);
    if (st.ret) bad(`복귀 경로에 "${st.ret}" 가 저장됐다`);
    else ok("복귀 경로가 비어 있다 (기본 분기로 간다)");
    if (!oauthHits.length) bad("카카오 OAuth 로 나가지 않았다");
    else ok("카카오 OAuth 로 나갔다");
    await browser.close();
  }

  // 2. 세션이 끊기기 전에 보던 자리를 /login 이 덮어쓰지 않는다
  console.log(
    "2. 끊기기 전에 보던 자리(/plan-list)가 /login 을 거쳐도 남아야 한다",
  );
  {
    const { browser, page } = await open({ token: null, seed: "/plan-list" });
    await page.goto(BASE + "/login?expired=1", {
      waitUntil: "networkidle0",
      timeout: 120000,
    });
    await settle(1200);
    await clickKakao(page);
    await settle(1500);
    const st = await read(page);
    if (st.ret !== "/plan-list") bad(`복귀 경로가 "${st.ret}" 로 바뀌었다`);
    else ok("복귀 경로 /plan-list 가 그대로 남았다");
    await browser.close();
  }

  // 3. 토큰은 살아 있는데 플랜이 덜 찬 사람 — /login 은 막다른 길
  console.log("3. 토큰 살아 있음 + 플랜 미완성 — /login 에 머물면 안 된다");
  {
    const { browser, page } = await open({
      token: "good.jwt",
      userData: PLAN_EMPTY,
    });
    await page.goto(BASE + "/login", {
      waitUntil: "networkidle0",
      timeout: 120000,
    });
    await settle(3000);
    const st = await read(page);
    if (st.path.startsWith("/login"))
      bad(`로그인 화면에 머물렀다 (${st.path})`);
    else ok(`${st.path} 으로 나갔다`);
    await browser.close();
  }

  // 4·5. 로그인 콜백 착지 — 복귀 경로를 실제로 따라가 보는 곳
  console.log(
    "4. 세션에 /login 이 복귀 경로로 남아 있어도 로그인 후 앱으로 들어가야 한다",
  );
  {
    const { browser, page } = await landing({ seed: "/login?expired=1" });
    const st = await read(page);
    if (st.path.startsWith("/login"))
      bad(`로그인 화면으로 돌아왔다 (${st.path})`);
    else ok(`${st.path} 으로 들어갔다`);
    if (st.ret) bad(`문 경로 "${st.ret}" 가 아직 남아 있다`);
    else ok("문 경로가 지워졌다");
    await browser.close();
  }

  console.log(
    "5. 진짜 복귀 경로(/plan-list)는 그대로 따라가야 한다 — 회귀 방지",
  );
  {
    const { browser, page } = await landing({ seed: "/plan-list" });
    const st = await read(page);
    if (!st.path.startsWith("/plan-list"))
      bad(`복귀 경로를 따라가지 않았다 (${st.path})`);
    else ok("/plan-list 로 복귀했다");
    await browser.close();
  }

  console.log("");
  if (problems.length) {
    console.log(`문제 ${problems.length}건:`);
    problems.forEach((p) => console.log(" - " + p));
    process.exitCode = 1;
  } else console.log("로그인 루프 이상 없음");
})();
