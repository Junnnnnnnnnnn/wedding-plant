/* eslint-disable no-console */
/**
 * 세션 슬라이딩 갱신 하네스.
 *
 * 백엔드는 토큰 수명(180일)의 절반이 지나면 아무 플랜 API 응답에나 새 토큰을
 * `X-Renewed-Token` 헤더로 얹어 준다. 프론트가 그걸 받아 저장해야 **쓰는
 * 동안 세션이 계속 밀린다** — 안 받으면 매일 들어오는 사람도 로그인한 지
 * 180일째에 한 번 튕긴다.
 *
 * 확인하는 것
 *  1. 헤더가 오면 저장된 토큰이 새 것으로 바뀌는지 (session·localStorage 양쪽)
 *  2. 헤더가 없으면 건드리지 않는지
 *  3. **`Access-Control-Expose-Headers` 가 없으면 갱신이 죽는지** — 브라우저는
 *     다른 오리진의 응답에서 노출한 헤더만 읽는다. 이게 이 기능에서 가장
 *     조용히 깨지는 자리라 일부러 빠뜨린 경우를 함께 돌린다
 *  4. 비로그인(토큰 없음) 상태에서 헤더가 와도 토큰을 만들지 않는지
 *
 * 백엔드는 목으로 세우므로 `npm run dev` 만 있으면 된다.
 * 실행: node scripts/session-renewal.cjs   (HEADED=1 로 브라우저를 띄운다)
 */
const puppeteer = require("puppeteer-core");

const BASE = process.env.BASE || "http://localhost:3000";
const API = process.env.API || "https://api.seoulmoment.com.tw";
const CHROME =
  process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";

const TOKEN_KEY = "plan_auth_token";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const problems = [];
const bad = (m) => {
  problems.push(m);
  console.log("  x " + m);
};
const ok = (m) => console.log("  · " + m);

/** 서명은 검증하지 않는다. 프론트는 payload 만 디코드해 planUserId 를 읽는다 */
function makeToken(planUserId, marker) {
  const b64 = (o) =>
    Buffer.from(JSON.stringify(o))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  return [
    b64({ alg: "HS256", typ: "JWT" }),
    b64({
      planUserId,
      marker,
      tokenVersion: 0,
      jwtType: "ONE_TIME_TIME",
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 180,
    }),
    "sig",
  ].join(".");
}

const OLD = makeToken("11111111-1111-1111-1111-111111111111", "old");
const NEW = makeToken("11111111-1111-1111-1111-111111111111", "renewed");

const PLAN_USER = {
  result: true,
  data: {
    id: "11111111-1111-1111-1111-111111111111",
    name: "김세션",
    weddingDate: "2026-12-31",
    budget: 4200,
    members: [],
    chatRooms: [],
  },
};

/**
 * 백엔드를 목으로 세운다.
 *
 * `expose` 를 false 로 주면 `Access-Control-Expose-Headers` 를 빼서, CORS 에서
 * 헤더를 노출하지 않았을 때 브라우저가 어떻게 보는지 그대로 재현한다.
 */
async function mockBackend(page, { renewedToken, expose = true }) {
  const seen = { authCalls: 0 };
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const url = req.url();

    if (!url.startsWith(API)) {
      req.continue();
      return;
    }

    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Authorization,Content-Type,Accept",
      "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    };

    // 프리플라이트를 받아 주지 않으면 본 요청이 아예 나가지 않는다
    if (req.method() === "OPTIONS") {
      req.respond({ status: 204, headers: cors, body: "" });
      return;
    }

    if (req.headers().authorization) seen.authCalls += 1;

    const headers = { ...cors, "Content-Type": "application/json" };
    if (renewedToken) {
      headers["X-Renewed-Token"] = renewedToken;
      if (expose) headers["Access-Control-Expose-Headers"] = "X-Renewed-Token";
    }

    req.respond({
      status: 200,
      headers,
      body: JSON.stringify(
        url.includes("/plan/user/total-amount")
          ? { result: true, data: { totalAmount: 0, usedAmount: 0 } }
          : PLAN_USER,
      ),
    });
  });
  return seen;
}

function readStoredToken() {
  return {
    local: localStorage.getItem("plan_auth_token"),
    session: sessionStorage.getItem("plan_auth_token"),
  };
}

async function run(browser, label, { startToken, renewedToken, expose }) {
  console.log("\n[" + label + "]");
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await mockBackend(page, { renewedToken, expose });

  // 토큰은 오리진이 잡힌 뒤에 심어야 한다
  await page.goto(BASE + "/main", { waitUntil: "domcontentloaded" });
  await page.evaluate((t) => {
    if (t) {
      localStorage.setItem("plan_auth_token", t);
      sessionStorage.setItem("plan_auth_token", t);
    } else {
      localStorage.removeItem("plan_auth_token");
      sessionStorage.removeItem("plan_auth_token");
    }
  }, startToken);

  await page.reload({ waitUntil: "networkidle0" });
  await wait(1500);

  const stored = await page.evaluate(readStoredToken);
  await page.close();
  return stored;
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: process.env.HEADED ? false : "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    // 1. 헤더가 오면 갈아 끼운다
    let stored = await run(browser, "갱신 헤더가 오면 저장된 토큰을 바꾼다", {
      startToken: OLD,
      renewedToken: NEW,
    });
    if (stored.local === NEW && stored.session === NEW) {
      ok("localStorage·sessionStorage 둘 다 새 토큰으로 바뀌었다");
    } else {
      bad(
        "새 토큰이 저장되지 않았다 (local=" +
          (stored.local === NEW ? "새것" : stored.local === OLD ? "옛것" : "없음") +
          ", session=" +
          (stored.session === NEW
            ? "새것"
            : stored.session === OLD
              ? "옛것"
              : "없음") +
          ")",
      );
    }

    // 2. 헤더가 없으면 그대로 둔다
    stored = await run(browser, "갱신 헤더가 없으면 건드리지 않는다", {
      startToken: OLD,
      renewedToken: null,
    });
    if (stored.local === OLD) ok("토큰이 그대로다");
    else bad("헤더가 없는데 토큰이 바뀌었다");

    // 3. CORS 노출을 빠뜨리면 브라우저가 헤더를 숨긴다
    stored = await run(
      browser,
      "Access-Control-Expose-Headers 가 없으면 갱신이 죽는다",
      { startToken: OLD, renewedToken: NEW, expose: false },
    );
    if (stored.local === OLD) {
      ok("예상대로 갱신되지 않는다 — 백엔드 exposedHeaders 를 지우면 이렇게 된다");
    } else {
      bad(
        "노출하지 않은 헤더가 읽혔다. 이 하네스의 전제가 틀렸으니 확인이 필요하다",
      );
    }

    // 4. 비로그인 상태에서는 토큰을 만들지 않는다
    stored = await run(browser, "토큰 없이 들어온 사람에게는 심지 않는다", {
      startToken: null,
      renewedToken: NEW,
    });
    if (!stored.local && !stored.session) ok("토큰이 생기지 않았다");
    else bad("비로그인인데 토큰이 저장됐다");
  } finally {
    await browser.close();
  }

  console.log(
    "\n" +
      (problems.length ? "실패 " + problems.length + "건" : "이상 없음"),
  );
  process.exit(problems.length ? 1 : 0);
})();
