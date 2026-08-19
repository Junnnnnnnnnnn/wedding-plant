/*
 * 방 멤버 권한(WRITE / READ)에 따른 UI 게이트를 확인한다.
 *
 * READ 권한은 현재 제품에서 도달할 수 없다. 공유 코드로 참여하면 백엔드가
 * 항상 WRITE 를 주고(plan-room.service.ts postPlanRoom), 권한을 바꾸는
 * 엔드포인트도 프론트 UI 도 없다. 그래서 실제 계정 두 개로는 READ 화면을
 * 볼 수 없고, /plan/room/{id} 응답만 목으로 바꿔 프론트 분기를 태운다.
 * (공유 백엔드라 DB 를 직접 고치지 않는다)
 *
 * 준비:  npm run dev / npm install --no-save puppeteer-core
 *        chrome.exe --remote-debugging-port=9222 --user-data-dir=<임의 경로>
 * 실행:  node scripts/room-permission-ui.cjs
 * 기대:  WRITE 는 "+" 와 "플랜 추가하기"가 보이고, READ 는 둘 다 숨는다.
 */
const p = require("puppeteer-core");
const wait = ms => new Promise(r => setTimeout(r, ms));
const b64u = o => Buffer.from(JSON.stringify(o)).toString("base64url");
const JWT = `${b64u({alg:"HS256",typ:"JWT"})}.${b64u({planUserId:"member-b",sub:"member-b",exp:9999999999})}.sig`;
const CORS = { "Access-Control-Allow-Origin": "http://localhost:3000", "Access-Control-Allow-Headers": "*",
               "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS" };
const ok = d => ({ status: 200, headers: CORS, contentType: "application/json",
                   body: JSON.stringify({ result: true, data: d }) });

async function run(perm) {
  const br = await p.connect({ browserURL: "http://localhost:9222", defaultViewport: null });
  const page = await br.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await page.goto("http://localhost:3000/main", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.evaluate(t => { localStorage.clear(); sessionStorage.clear();
    localStorage.setItem("plan_auth_token", t); sessionStorage.setItem("plan_auth_token", t); }, JWT);

  await page.setRequestInterception(true);
  page.on("request", req => {
    const u = req.url(), m = req.method();
    if (!u.includes("api.seoulmoment.com.tw")) { req.continue().catch(()=>{}); return; }
    if (m === "OPTIONS") { req.respond({ status: 204, headers: CORS, body: "" }).catch(()=>{}); return; }
    const path = u.replace("https://api.seoulmoment.com.tw", "").split("?")[0];
    if (/^\/plan\/room\/\d+$/.test(path)) {
      // A(소유자) 방에 B 가 참여 중. B 의 권한만 바꿔 가며 확인한다.
      req.respond(ok({ id: 1, name: "우리 결혼 준비", members: [
        { planUserId: "owner-a",  name: "야호",         permission: "OWNER" },
        { planUserId: "member-b", name: "게스트테스터", permission: perm },
      ] })).catch(()=>{}); return;
    }
    if (path === "/plan/schedule/calendar") { req.respond(ok({ list: [] })).catch(()=>{}); return; }
    if (path === "/plan/user") { req.respond(ok({ name: "게스트테스터", budget: 3000,
      weddingDate: "2027-05-22", roomId: null, chatRooms: [] })).catch(()=>{}); return; }
    req.respond(ok({ list: [], total: 0 })).catch(()=>{});
  });

  await page.goto("http://localhost:3000/calendar?roomId=1", { waitUntil: "networkidle2", timeout: 60000 });
  await wait(3000);
  const fab = await page.evaluate(() => !!document.querySelector("button.absolute.bottom-28.right-6"));
  // 날짜 모달을 열어 '플랜 추가하기' 버튼도 본다
  await page.evaluate(() => {
    const c = [...document.querySelectorAll("div")].find(d => d.innerText?.trim() === "19");
    (c?.closest("button") ?? c)?.click();
  });
  await wait(1200);
  const addBtn = await page.evaluate(() =>
    [...document.querySelectorAll("button")].some(b => b.innerText.trim() === "플랜 추가하기"));
  await page.screenshot({ path: `shot-w43-${perm}.png` });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.close(); await br.disconnect();
  console.log(`권한=${perm.padEnd(5)}  우하단 "+"=${fab ? "보임" : "숨김"}   모달 "플랜 추가하기"=${addBtn ? "보임" : "숨김"}`);
}
(async () => { await run("WRITE"); await run("READ"); })()
  .catch(e => { console.error("ERR", e.message); process.exit(1); });
