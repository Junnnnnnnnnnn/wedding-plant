/*
 * 카카오 로그인 후 라우팅 분기 10가지를 목(mock) 응답으로 구동해 확인한다.
 *
 * 실제 카카오 인증 없이 KakaoLoginAlert 의 모든 분기를 돌릴 수 있는 유일한
 * 수단이라, 이 컴포넌트를 건드릴 때는 수정 전후로 한 번씩 돌려 출력이
 * 같은지 비교할 것. (설계상 달라져야 하는 줄만 달라져야 한다)
 *
 * 준비:
 *   npm run dev
 *   npm install --no-save puppeteer-core
 *   chrome.exe --remote-debugging-port=9222 --user-data-dir=<임의 경로>
 *
 * 실행:
 *   node scripts/login-branches.cjs before.txt   # 수정 전
 *   node scripts/login-branches.cjs after.txt    # 수정 후
 *   diff before.txt after.txt
 *
 * 주의:
 * - 목 응답에 CORS 헤더를 주고 OPTIONS 프리플라이트에도 답해야 한다.
 *   안 그러면 전부 CORS 로 막혀 분기까지 가지도 못한다.
 * - 착지 페이지가 자기 로직으로 한 번 더 이동할 수 있다(예: 이름이 없으면
 *   /plan-list 가 /setting 으로 되튕긴다). 분기를 헷갈리지 않으려면
 *   시나리오의 user 응답을 목적에 맞게 채울 것.
 */
const p = require("puppeteer-core");
const wait = ms => new Promise(r => setTimeout(r, ms));
const b64u = o => Buffer.from(JSON.stringify(o)).toString("base64url");
const JWT = `${b64u({alg:"HS256",typ:"JWT"})}.${b64u({planUserId:"u1",sub:"u1",exp:9999999999})}.sig`;
const CORS = {
  "Access-Control-Allow-Origin": "http://localhost:3000",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
};
const ok = d => ({ status: 200, headers: CORS, contentType: "application/json",
                   body: JSON.stringify({ result: true, data: d }) });

const COMPLETE = { name: "야호", budget: 5000, weddingDate: "2027-05-22", roomId: 1, chatRooms: [] };
const EMPTY    = { name: null, budget: null, weddingDate: null, roomId: null, chatRooms: [] };
// 이름만 있고 플랜은 미완성 — /plan-list 가 /setting 으로 되튕기지 않게 한다
const NAMED    = { name: "야호", budget: null, weddingDate: null, roomId: null, chatRooms: [] };

/** 시나리오 정의: 이름, 사전 스토리지, 목 응답 오버라이드, 기대 착지 */
const SCENARIOS = [
  { name: "1.shareCode",        pre: { share: "ABC123" }, user: COMPLETE, roomTotal: 0 },
  { name: "2.returnPath",       pre: { ret: "/budget-detail" }, user: COMPLETE, roomTotal: 0 },
  { name: "3.완성된 플랜",       pre: {}, user: COMPLETE, roomTotal: 0 },
  { name: "4.게스트 설정 이관",  pre: { guestSetting: true }, user: EMPTY, roomTotal: 0 },
  { name: "5.참여 방 보유",      pre: {}, user: NAMED, roomTotal: 2 },
  { name: "6.신규 사용자",       pre: {}, user: EMPTY, roomTotal: 0 },
  { name: "7.로그인 실패(500)",  pre: {}, user: EMPTY, roomTotal: 0, loginFail: true },
  { name: "8.카카오 토큰 없음",  pre: {}, user: EMPTY, roomTotal: 0, noKakaoToken: true },
  { name: "9.설정 이관 실패",    pre: { guestSetting: true }, user: EMPTY, roomTotal: 0, settingFail: true },
  { name: "10.일정 이관 실패",   pre: { guestSetting: true }, user: EMPTY, roomTotal: 0, scheduleFail: true },
];

async function runOne(br, sc) {
  const page = await br.newPage();
  await page.setViewport({ width: 390, height: 844 });
  const calls = [];
  await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.evaluate(pre => {
    localStorage.clear(); sessionStorage.clear();
    if (pre.share) sessionStorage.setItem("plan_share_after_login", pre.share);
    if (pre.ret)   sessionStorage.setItem("plan_return_path_after_login", pre.ret);
    if (pre.guestSetting) {
      sessionStorage.setItem("plan_has_completed_guest_setting", "1");
      sessionStorage.setItem("weddingData", JSON.stringify({
        budget: "3000", name: "게스트", date: { year: 2027, month: 9, day: 9 } }));
      sessionStorage.setItem("guest_schedule_list_v1", JSON.stringify([
        { id: -1, categoryName: "웨딩홀", title: "게스트 플랜", amount: 100,
          startDate: "2027-09-09", status: "NORMAL", payType: "OTHER" }]));
    }
  }, sc.pre);

  await page.setRequestInterception(true);
  page.on("request", req => {
    const u = req.url(), m = req.method();
    if (u.includes("/api/auth/kakao/token")) {
      calls.push("GET /api/auth/kakao/token");
      req.respond({ status: 200, contentType: "application/json",
        body: JSON.stringify(sc.noKakaoToken ? {} : { kakaoToken: "kakao-abc" }) }).catch(()=>{});
      return;
    }
    if (!u.includes("api.seoulmoment.com.tw")) { req.continue().catch(()=>{}); return; }
    if (m === "OPTIONS") { req.respond({ status: 204, headers: CORS, body: "" }).catch(()=>{}); return; }
    const path = u.replace("https://api.seoulmoment.com.tw", "").split("?")[0];
    calls.push(`${m} ${path}`);
    if (path === "/plan/auth/kakao/login") {
      if (sc.loginFail) { req.respond({ status: 500, headers: CORS, contentType: "application/json", body: "{}" }).catch(()=>{}); return; }
      req.respond(ok({ token: JWT })).catch(()=>{}); return;
    }
    if (path === "/plan/setting" && sc.settingFail) {
      req.respond({ status: 400, headers: CORS, contentType: "application/json", body: "{}" }).catch(()=>{}); return;
    }
    if (path === "/plan/schedule" && sc.scheduleFail) {
      req.respond({ status: 500, headers: CORS, contentType: "application/json", body: "{}" }).catch(()=>{}); return;
    }
    if (path === "/plan/user")      { req.respond(ok(sc.user)).catch(()=>{}); return; }
    if (path === "/plan/room/list") { req.respond(ok({ total: sc.roomTotal, list: [] })).catch(()=>{}); return; }
    req.respond(ok({ id: 99 })).catch(()=>{});
  });

  await page.goto("http://localhost:3000/?kakao_login=1", { waitUntil: "domcontentloaded", timeout: 60000 });
  await wait(6000);
  const st = await page.evaluate(() => ({
    url: location.pathname + location.search,
    token: localStorage.getItem("plan_auth_token") ? "있음" : "없음",
    share: sessionStorage.getItem("plan_share_after_login"),
    ret: sessionStorage.getItem("plan_return_path_after_login"),
    guest: sessionStorage.getItem("guest_schedule_list_v1"),
    alert: document.body.innerText.indexOf("다시 시도해") >= 0 || document.body.innerText.indexOf("저장하지 못했") >= 0,
  }));
  // 안내가 떠 있으면 확인을 눌러 밀려 있던 이동이 실행되는지 본다
  let afterDismiss = null;
  if (st.alert) {
    await page.screenshot({ path: "shot-migrate-alert.png" });
    const clicked = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find(x => x.innerText.trim() === "확인");
      if (b) { b.click(); return true; } return false;
    });
    if (clicked) { await wait(2500); afterDismiss = await page.evaluate(() => location.pathname); }
  }
  await page.close();
  return { st, calls, afterDismiss };
}

(async () => {
  const br = await p.connect({ browserURL: "http://localhost:9222", defaultViewport: null });
  const out = [];
  for (const sc of SCENARIOS) {
    const { st, calls, afterDismiss } = await runOne(br, sc);
    const line = `${sc.name.padEnd(18)} 착지=${st.url.padEnd(16)} 토큰=${st.token} share=${st.share ?? "-"} ret=${st.ret ?? "-"} 게스트일정=${st.guest ? "남음" : "-"} 알림=${st.alert ? "표시됨" : "-"}${afterDismiss ? " 확인후=" + afterDismiss : ""}`;
    console.log(line);
    console.log(`   호출: ${calls.join(" > ")}`);
    out.push(line);
  }
  await br.disconnect();
  require("fs").writeFileSync(process.argv[2] || "baseline.txt", out.join("\n"));
})().catch(e => { console.error("ERR", e.message); process.exit(1); });
