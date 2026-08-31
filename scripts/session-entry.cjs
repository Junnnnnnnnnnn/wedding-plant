/* eslint-disable no-console */
/**
 * 랜딩·로그인 진입 규칙을 확인한다.
 *
 *  토큰 없음        → 랜딩(/) 그대로, 세션 모달 없음
 *  토큰 만료(401)   → /login?expired=1 (랜딩을 보여 주지 않는다)
 *  토큰 살아 있음   → /main (플랜이 다 찼을 때)
 *
 * 백엔드는 목으로 세운다 — 실제 계정을 건드리지 않는다.
 * 실행: npm run dev 를 띄운 뒤 `node scripts/session-entry.cjs`
 */
const puppeteer = require("puppeteer-core");

const BASE = process.env.BASE || "http://localhost:3000";
const CHROME =
  process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const problems = [];
const ok = (m) => console.log("  · " + m);
const bad = (m) => { problems.push(m); console.log("  ✗ " + m); };

/** /plan/user 응답을 상황별로 흉내 낸다 */
async function run(name, { token, status, body }) {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: process.env.HEADED ? false : "new",
    args: ["--use-gl=angle", "--use-angle=swiftshader",
           "--enable-unsafe-swiftshader", "--hide-scrollbars"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const u = req.url();
    if (/\/plan\//.test(u)) {
      const cors = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "*",
      };
      if (req.method() === "OPTIONS")
        return req.respond({ status: 204, headers: cors });
      if (/\/plan\/user(\?|$)/.test(u))
        return req.respond({
          status, headers: { ...cors, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      return req.respond({
        status: 200, headers: { ...cors, "Content-Type": "application/json" },
        body: JSON.stringify({ result: true, data: [] }),
      });
    }
    req.continue();
  });

  if (token) {
    await page.evaluateOnNewDocument((t) => {
      localStorage.setItem("plan_auth_token", t);
      sessionStorage.setItem("plan_auth_token", t);
    }, token);
  }
  await page.goto(BASE + "/", { waitUntil: "networkidle0", timeout: 120000 });
  await new Promise((r) => setTimeout(r, 3000));
  const st = await page.evaluate(() => ({
    path: location.pathname + location.search,
    modal: !!Array.from(document.querySelectorAll("body *"))
      .find((e) => (e.textContent || "").includes("세션이 만료되었습니다") &&
                   e.children.length === 0),
    tok: !!(localStorage.getItem("plan_auth_token") ||
            sessionStorage.getItem("plan_auth_token")),
  }));
  await browser.close();
  return { name, ...st };
}

(async () => {
  const PLAN = { result: true, data: { weddingDate: "2026-12-31", budget: 4200, name: "예신" } };

  console.log("1. 토큰 없음 — 처음 온 사람");
  let r = await run("no-token", { token: null, status: 200, body: PLAN });
  if (r.path !== "/") bad(`랜딩에 머물러야 하는데 ${r.path}`); else ok("랜딩 유지");
  if (r.modal) bad("세션 만료 모달이 떴다"); else ok("모달 없음");

  console.log("2. 토큰 만료 (401) — 이미 로그인했던 사람");
  r = await run("expired", { token: "stale.jwt.token", status: 401, body: { result: false } });
  if (r.path !== "/login?expired=1") bad(`로그인 페이지로 가야 하는데 ${r.path}`);
  else ok("/login?expired=1 로 이동");
  if (r.modal) bad("세션 만료 모달이 떴다"); else ok("모달 없음");
  if (r.tok) bad("만료된 토큰이 남아 있다"); else ok("만료 토큰 정리됨");

  console.log("3. 토큰 살아 있음 — 플랜 완성");
  r = await run("alive", { token: "good.jwt.token", status: 200, body: PLAN });
  if (!r.path.startsWith("/main")) bad(`대시보드로 가야 하는데 ${r.path}`);
  else ok("/main 으로 이동");
  if (r.modal) bad("세션 만료 모달이 떴다"); else ok("모달 없음");

  console.log("");
  if (problems.length) {
    console.log(`문제 ${problems.length}건:`);
    problems.forEach((p) => console.log(" - " + p));
    process.exitCode = 1;
  } else console.log("진입 규칙 이상 없음");
})();
