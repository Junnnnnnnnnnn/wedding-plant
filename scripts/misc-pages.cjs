/*
 * Phase 4 화면들(/, /user, /add-plen, /setting)의 폭별 레이아웃을 확인한다.
 *
 * 준비:  npm run dev / npm install --no-save puppeteer-core
 * 실행:  node scripts/misc-pages.cjs
 */
const path = require("path");
const p = require(path.join(__dirname, "..", "node_modules", "puppeteer-core"));

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const API = "https://api.seoulmoment.com.tw";
const ORIGIN = "http://localhost:3000";
const OUT = process.env.SHOT_DIR || __dirname;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const JWT = `${b64u({ alg: "HS256", typ: "JWT" })}.${b64u({
  planUserId: "me-1",
  sub: "me-1",
  exp: 9999999999,
})}.sig`;

const CORS = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
};
const ok = (d) => ({
  status: 200,
  headers: CORS,
  contentType: "application/json",
  body: JSON.stringify({ result: true, data: d }),
});

function installMocks(page) {
  page.on("request", (req) => {
    const url = req.url();
    if (!url.startsWith(API)) {
      req.continue().catch(() => {});
      return;
    }
    if (req.method() === "OPTIONS") {
      req.respond({ status: 204, headers: CORS, body: "" }).catch(() => {});
      return;
    }
    const p0 = url.slice(API.length).split("?")[0];
    if (p0.startsWith("/socket.io")) {
      req.respond({ status: 404, headers: CORS, body: "" }).catch(() => {});
      return;
    }
    if (/^\/plan\/notification\/chat\/\d+$/.test(p0)) {
      req
        .respond({
          status: 200,
          headers: { ...CORS, "Cache-Control": "no-cache" },
          contentType: "text/event-stream",
          body: `data: ${JSON.stringify({ type: "keep-alive" })}\n\n`,
        })
        .catch(() => {});
      return;
    }
    if (p0 === "/plan/user") {
      req
        .respond(
          ok({
            id: "me-1",
            name: "김지수",
            weddingDate: "2026-11-14",
            budget: 4200,
            roomId: null,
            chatRooms: [],
          }),
        )
        .catch(() => {});
      return;
    }
    if (p0 === "/plan/category/user/list" || p0 === "/plan/category/list") {
      req
        .respond(
          ok({
            list: ["스드메", "예식장", "예물", "신혼여행"].map((name, i) => ({
              id: i + 1,
              name,
              color: "#ee2b8c",
              type: "SYSTEM",
            })),
            total: 4,
          }),
        )
        .catch(() => {});
      return;
    }
    req.respond(ok({ list: [], total: 0 })).catch(() => {});
  });
}

const PAGES = [
  ["landing", "/", false],
  ["user", "/user", true],
  ["addplen", "/add-plen", true],
  ["setting", "/setting", true],
];

(async () => {
  const browser = await p.launch({
    executablePath: CHROME,
    headless: process.env.HEADED ? false : "new",
    args: ["--font-render-hinting=none"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1.5 });

  await page.goto(`${ORIGIN}/`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.evaluateOnNewDocument((host) => {
    const Native = window.WebSocket;
    function Blocked(url, protocols) {
      if (String(url).includes(host)) throw new Error("harness: ws blocked");
      return new Native(url, protocols);
    }
    Blocked.prototype = Native.prototype;
    window.WebSocket = Blocked;
  }, "api.seoulmoment.com.tw");
  await page.setRequestInterception(true);
  installMocks(page);

  for (const [tag, route, needsAuth] of PAGES) {
    for (const w of [375, 768, 1280]) {
      await page.setViewport({ width: w, height: 900, deviceScaleFactor: 1.5 });
      await page.goto(`${ORIGIN}${route}`, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await page.evaluate(
        (t, auth) => {
          localStorage.clear();
          sessionStorage.clear();
          if (auth) {
            localStorage.setItem("plan_auth_token", t);
            sessionStorage.setItem("plan_auth_token", t);
          }
        },
        JWT,
        needsAuth,
      );
      await page.goto(`${ORIGIN}${route}`, {
        waitUntil: "networkidle2",
        timeout: 60000,
      });
      await wait(2200);
      await page.screenshot({ path: path.join(OUT, `misc-${tag}-${w}.png`) });
      console.log(`캡처 misc-${tag}-${w}.png`);

      // 일정 폼은 단계식이라 제목·카테고리를 채워야 일자·시간 카드가 나온다
      if (tag === "addplen") {
        const filled = await page.evaluate(() => {
          const input = document.querySelector(
            'input[placeholder="어떤 지출인가요?"]',
          );
          if (!input) return "제목 입력칸 없음";
          const setter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            "value",
          ).set;
          setter.call(input, "드레스 투어");
          input.dispatchEvent(new Event("input", { bubbles: true }));
          return "ok";
        });
        await wait(1200);
        // "카테고리 선택" 을 눌러 모달을 열고 첫 항목을 고른다.
        // 제목 추천 칩은 문구가 데이터에 따라 달라져 하네스가 흔들린다.
        await page.evaluate(() => {
          const btn = [...document.querySelectorAll("button")].find(
            (b) => b.innerText.trim() === "카테고리 선택",
          );
          if (btn) btn.click();
        });
        await wait(900);
        await page.evaluate(() => {
          const btn = [...document.querySelectorAll("button")].find((b) =>
            ["스드메", "예식장", "예물", "기타", "웨딩홀"].includes(
              b.innerText.trim(),
            ),
          );
          if (btn) btn.click();
        });
        await wait(1200);
        // 결제 유형 → 금액까지 채워야 일자·시간 카드가 열린다
        await page.evaluate(() => {
          const btn = [...document.querySelectorAll("button")].find(
            (b) => b.innerText.trim() === "카드",
          );
          if (btn) btn.click();
        });
        await wait(900);
        await page.evaluate(() => {
          const input = [...document.querySelectorAll("input")].find(
            (i) => i.placeholder && i.placeholder.includes("0"),
          );
          if (!input) return;
          const setter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            "value",
          ).set;
          setter.call(input, "185");
          input.dispatchEvent(new Event("input", { bubbles: true }));
        });
        await wait(1500);
        await page.evaluate(() => {
          document
            .querySelector('input[type="time"]')
            ?.scrollIntoView({ block: "center" });
        });
        await wait(500);
        await page.screenshot({
          path: path.join(OUT, `misc-addplen-form-${w}.png`),
        });
        const hasTime = await page.evaluate(
          () => !!document.querySelector('input[type="time"]'),
        );
        console.log(
          `캡처 misc-addplen-form-${w}.png   제목=${filled} 시간칸=${hasTime ? "있음" : "없음"}`,
        );
      }
    }
  }

  await browser.close();
})().catch((e) => {
  console.error("ERR", e);
  process.exit(1);
});
