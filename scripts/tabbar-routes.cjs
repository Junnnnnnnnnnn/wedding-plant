/* eslint-disable no-console */
/**
 * 하단 탭바가 **어느 화면에서 눌러도** 제 목적지로 가는지 본다.
 *
 * 화면마다 `onTabClick` 을 따로 적어 두면, 탭이 하나 늘거나 경로가 바뀔 때
 * 그 화면만 옛 목적지에 남는다. 실제로 그랬다 —
 *
 *   · `/main` 은 `feed` 가 마지막 삼항의 `: "/main"` 으로 떨어져
 *     **홈에서 피드를 눌러도 아무 일도 일어나지 않았다**
 *   · `/calendar` 는 `feed` 분기가 아예 없어 클릭이 통째로 먹혔다
 *
 * 둘 다 피드가 "준비중" 모달이던 시절의 잔재다. 목적지는 `tabs.ts` 한 곳에서
 * 와야 한다.
 *
 * 백엔드는 목으로 세운다 — 실제 계정을 건드리지 않는다.
 * 실행: npm run dev 를 띄운 뒤 `node scripts/tabbar-routes.cjs`
 */
const path = require("path");
const puppeteer = require(
  path.join(__dirname, "..", "node_modules", "puppeteer-core"),
);

const BASE = process.env.BASE || "http://localhost:3000";
const CHROME =
  process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";

const problems = [];
const ok = (m) => console.log("  · " + m);
const bad = (m) => {
  problems.push(m);
  console.log("  ✗ " + m);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const b64u = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const ME = "me-1";
const JWT = [
  b64u({ alg: "HS256", typ: "JWT" }),
  b64u({ planUserId: ME, sub: ME, exp: 9999999999 }),
  "sig",
].join(".");

const USER = {
  planUserId: ME,
  name: "미듀",
  weddingDate: "2026-12-26",
  budget: 3000,
  weddingVenue: null,
  roomId: null,
  members: [],
  chatRooms: [],
};

/** 탭 라벨 → 가야 할 경로. `app/components/tabs.ts` 의 TAB_ROUTES 와 같아야 한다 */
const TABS = [
  { label: "홈", to: "/main" },
  { label: "피드", to: "/feed" },
  { label: "참여 플랜", to: "/plan-list" },
  { label: "Settings", to: "/user" },
];

/** 탭바가 뜨는 화면들. 여기서 각각 네 탭을 다 눌러 본다 */
const SCREENS = ["/main", "/calendar", "/feed", "/plan-list", "/user"];

async function boot() {
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
  await page.setViewport({ width: 390, height: 800, isMobile: true });
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
    if (u.includes("dapi.kakao.com")) {
      return req.respond({
        status: 200,
        headers: { "Content-Type": "application/javascript" },
        body: "window.kakao={maps:{load:(c)=>c(),LatLng:function(){},Map:function(){return{}},Marker:function(){return{setMap(){}}}}};",
      });
    }
    if (u.includes("/plan/")) {
      if (req.method() === "OPTIONS")
        return req.respond({ status: 204, headers: cors });
      if (u.includes("/plan/user")) return json({ result: true, data: USER });
      if (u.includes("/amount") || u.includes("total-amount"))
        return json({
          result: true,
          data: {
            initialCapital: 3000,
            totalAmount: 3000,
            remainingAmount: 3000,
            usedAmount: 0,
            totalPlannedAndUsedAmount: 0,
            plannedUseAmount: 0,
          },
        });
      return json({ result: true, data: { total: 0, list: [] } });
    }
    return req.continue().catch(() => {});
  });
  await page.evaluateOnNewDocument((t) => {
    localStorage.setItem("plan_auth_token", t);
    sessionStorage.setItem("plan_auth_token", t);
  }, JWT);
  return { browser, page };
}

/** 하단 탭바에서 그 라벨의 탭을 누른다 (레일이 아니라 탭바여야 한다) */
const clickTab = (label) => {
  const bars = Array.from(document.querySelectorAll("nav"));
  for (const bar of bars) {
    const r = bar.getBoundingClientRect();
    // 화면 아래쪽에 붙어 있는 것이 탭바다
    if (r.bottom < window.innerHeight - 8) continue;
    const hit = Array.from(bar.querySelectorAll("button, a")).find(
      (b) => (b.textContent || "").trim() === label,
    );
    if (hit) {
      hit.click();
      return true;
    }
  }
  return false;
};

(async () => {
  const { browser, page } = await boot();

  for (const from of SCREENS) {
    console.log(`${from} 에서`);
    for (const tab of TABS) {
      await page.goto(BASE + from, {
        waitUntil: "networkidle0",
        timeout: 120000,
      });
      await wait(2200);

      const clicked = await page.evaluate(clickTab, tab.label);
      if (!clicked) {
        bad(`${from}: "${tab.label}" 탭을 못 찾았다`);
        continue;
      }
      await wait(1800);

      const here = await page.evaluate(() => location.pathname);
      /*
        홈은 귀속된 사람이면 방을 달고 가므로 경로만 본다. 같은 화면에서
        자기 탭을 누른 경우(예: /feed 에서 피드)는 제자리가 정답이다.
      */
      if (here !== tab.to) {
        bad(`${from} → "${tab.label}" 이 ${here} 로 갔다 (기대 ${tab.to})`);
      } else {
        ok(`"${tab.label}" → ${here}`);
      }
    }
  }

  await browser.close();

  console.log("");
  if (problems.length) {
    console.log(`문제 ${problems.length}건:`);
    problems.forEach((m) => console.log(" - " + m));
    process.exitCode = 1;
  } else console.log("탭바 라우팅 이상 없음");
})();
