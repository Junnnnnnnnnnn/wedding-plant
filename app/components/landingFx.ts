/* eslint-disable no-var, vars-on-top, func-names, one-var, no-unused-expressions,
   @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-expressions */

/**
 * 랜딩의 두 가지 자바스크립트. `docs/concepts/landing-1a-final.html` 의
 * 스크립트를 **거의 그대로** 옮겼다 — 시안과 나란히 놓고 diff 로 확인할 수
 * 있어야 해서 `var`·`function` 표현식 같은 옛 문법을 고치지 않았고, 그래서
 * 이 파일에만 관련 규칙을 껐다.
 *
 * 둘 다 **없어도 화면은 정상으로 보인다.** 스크롤 안무는 CSS
 * scroll-driven animation 이 하고, 장면 고르기는 라디오 + `:has()` 가 한다.
 * 여기 있는 건 (1) 배경 셰이더와 (2) 스크롤 진행도를 라디오로 옮기는 동기화뿐이다.
 *
 * 각 함수는 정리(cleanup) 함수를 돌려준다 — effect 에서 그대로 반환하면 된다.
 */

export function mountShaders(): () => void {
  const cleanup: Array<() => void> = [];
  /*
    손으로 쓴 WebGL. 라이브러리 없음(CDN 도 안 쓴다 — 이 파일은 file:// 로도 열린다).

    왜 WebGL 인가: 두 섹션이 말하려는 게 "모양이 바뀐다"와 "사이를 오간다"인데,
    둘 다 픽셀 단위 연속 변형이라 DOM 으로는 셀 수백 개를 만들어야 한다.

    안전장치
     - prefers-reduced-motion 이면 캔버스를 지운다 (CSS 만으로 완성돼 있다)
     - getContext 가 null 이거나 컴파일이 실패하면 캔버스를 지우고 조용히 끝낸다
     - 화면 밖이면 rAF 를 멈춘다 (IntersectionObserver)
     - DPR 1.5 상한 — 2327px 모니터에서 픽셀을 4배로 칠하지 않는다
     - webglcontextlost 를 잡아 루프를 세운다
  */

  // 초기화만 건너뛰면 빈 캔버스가 DOM 에 남는다. 실제로 지운다.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    document.querySelectorAll("canvas.gl").forEach(function (c) {
      c.remove();
    });
    return () => {};
  }

  var VERT = "attribute vec2 a;void main(){gl_Position=vec4(a,0.0,1.0);}";

  /* 격자(엑셀) ↔ 카드(앱) 모핑 */
  var FRAG_GRID = [
    "precision mediump float;",
    "uniform vec2 u_res;uniform float u_time;uniform float u_scroll;",
    "uniform float u_mode;uniform float u_focus;",
    "float box(vec2 p,vec2 b,float r){vec2 d=abs(p)-b+r;",
    "return length(max(d,0.0))+min(max(d.x,d.y),0.0)-r;}",
    "void main(){",
    "  vec2 uv=gl_FragCoord.xy/u_res;",
    "  float asp=u_res.x/u_res.y;",
    "  vec2 p=uv; p.y+=u_scroll*0.30;",
    "  float dens=mix(26.0,11.0,u_mode);",
    "  vec2 g=vec2(p.x*asp,p.y)*dens;",
    "  vec2 id=floor(g); vec2 f=fract(g)-0.5;",
    "  float ph=fract(sin(dot(id,vec2(12.9898,78.233)))*43758.5453);",
    "  float br=0.5+0.5*sin(u_time*0.55+ph*6.2831);",
    "  float r=mix(0.02,0.30,u_mode);",
    "  float hw=mix(0.46,0.33,u_mode)*(0.86+0.14*br);",
    "  float wv=1.0-smoothstep(0.0,0.24,abs(uv.y-(1.3-u_scroll*1.6)));",
    "  hw*=1.0+0.38*wv;",
    "  float d=box(f,vec2(hw),r);",
    "  float shape=smoothstep(0.035,0.0,d);",
    "  float dd=distance(uv*vec2(asp,1.0),vec2(u_focus*asp,0.5));",
    "  float fall=smoothstep(0.42,0.02,dd);",
    "  float a=shape*fall*mix(0.13,0.17,u_mode)*(0.72+0.62*wv);",
    "  vec3 cold=vec3(0.32,0.46,0.38);",
    "  vec3 warm=vec3(0.93,0.17,0.55);",
    "  vec3 col=mix(cold,warm,u_mode);",
    "  gl_FragColor=vec4(col*a,a);",
    "}",
  ].join("\n");

  /* 웹 ↔ 폰 흐름 */
  var FRAG_FLOW = [
    "precision mediump float;",
    "uniform vec2 u_res;uniform float u_time;uniform float u_scroll;",
    "uniform float u_a;uniform float u_b;uniform float u_pulse;",
    "void main(){",
    "  vec2 uv=gl_FragCoord.xy/u_res;",
    "  float asp=u_res.x/u_res.y;",
    "  vec2 A=vec2(u_a,0.5),B=vec2(u_b,0.5);",
    "  vec2 pa=uv-A,ba=B-A;",
    "  float den=max(dot(ba,ba),1e-5);",
    "  float h=clamp(dot(pa,ba)/den,0.0,1.0);",
    "  vec2 pr=A+ba*h;",
    "  float dist=length((uv-pr)*vec2(asp,1.0));",
    "  float wob=sin(h*9.0+u_time*0.9)*0.012;",
    "  float band=smoothstep(0.085,0.0,abs(dist+wob));",
    "  float reach=clamp((u_scroll-0.22)*1.9,0.0,1.0);",
    "  band*=smoothstep(reach+0.02,reach-0.20,h);",
    "  float t=u_time*0.26+u_scroll*1.3;",
    "  float acc=0.0;",
    "  for(int i=0;i<3;i++){",
    "    float o=float(i)*0.333;",
    "    float fl=fract(h*1.6-t+o);",
    "    acc+=smoothstep(0.0,0.10,fl)*smoothstep(0.30,0.10,fl);",
    "  }",
    "  float ends=smoothstep(0.34,0.0,length((uv-A)*vec2(asp,1.0)))",
    "            +smoothstep(0.34,0.0,length((uv-B)*vec2(asp,1.0)))*smoothstep(0.86,1.0,reach);",
    "  float a=band*acc*(0.20+0.22*u_pulse)+ends*0.05;",
    "  vec3 col=vec3(0.93,0.17,0.55);",
    "  gl_FragColor=vec4(col*a,a);",
    "}",
  ].join("\n");

  function compile(gl: any, type: any, src: any) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) return null;
    return sh;
  }

  function build(canvas: any, frag: any) {
    var gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
    });
    if (!gl) return null;
    var vs = compile(gl, gl.VERTEX_SHADER, VERT);
    var fs = compile(gl, gl.FRAGMENT_SHADER, frag);
    if (!vs || !fs) return null;
    var pr = gl.createProgram();
    gl.attachShader(pr, vs);
    gl.attachShader(pr, fs);
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
    gl.useProgram(pr);
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    var loc = gl.getAttribLocation(pr, "a");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    return { gl, pr };
  }

  /** 요소 중심의 x 를 섹션 기준 0~1 로 */
  function centerX(sec: any, el: any) {
    if (!el) return 0.5;
    var s = sec.getBoundingClientRect(),
      r = el.getBoundingClientRect();
    if (s.width <= 0) return 0.5;
    return Math.min(1, Math.max(0, (r.left + r.width / 2 - s.left) / s.width));
  }

  document
    .querySelectorAll<HTMLCanvasElement>("canvas.gl")
    .forEach(function (canvas) {
      var kind = canvas.dataset.gl;
      var sec = canvas.closest(".sec") as any;
      var ctx = build(canvas, kind === "grid" ? FRAG_GRID : FRAG_FLOW);
      if (!ctx) {
        canvas.remove();
        return;
      } // 조용히 물러난다
      var { gl } = ctx,
        { pr } = ctx;
      var U: any = {};
      [
        "u_res",
        "u_time",
        "u_scroll",
        "u_mode",
        "u_focus",
        "u_a",
        "u_b",
        "u_pulse",
      ].forEach(function (n) {
        U[n] = gl.getUniformLocation(pr, n);
      });

      var running = false,
        raf: number | null = null,
        t0 = performance.now();
      var mode = 0,
        pulse = 0.35;

      function size() {
        var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        var w = Math.max(1, Math.round(canvas.clientWidth * dpr));
        var h = Math.max(1, Math.round(canvas.clientHeight * dpr));
        if (canvas.width !== w || canvas.height !== h) {
          // 캔버스 백버퍼 크기는 이 속성으로만 잡는다 (CSS 크기와 별개)
          /* eslint-disable no-param-reassign */
          canvas.width = w;
          canvas.height = h;
          /* eslint-enable no-param-reassign */
          gl.viewport(0, 0, w, h);
        }
      }

      var pin = sec.querySelector(".pin2") as HTMLElement | null;

      /*
        **핀이 걸려 있는 동안**의 진행도. 섹션이 화면에 들어오는 것만으로 올라가면
        UI 가 아직 나타나기도 전에 셰이더가 먼저 그려져 어색하다(실제로 그랬다).
        핀이 아닌 폭(좁은 화면)에서는 예전처럼 섹션 통과 기준으로 돌린다.
      */
      function progress() {
        var r = sec.getBoundingClientRect(),
          vh = window.innerHeight || 1;
        if (pin && getComputedStyle(pin).position === "sticky") {
          var travel = sec.offsetHeight - vh;
          if (travel > 0) return Math.min(1, Math.max(0, -r.top / travel));
        }
        return Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height)));
      }

      function frame() {
        raf = null;
        if (!running) return;
        size();
        var t = (performance.now() - t0) / 1000;
        gl.uniform2f(U.u_res, canvas.width, canvas.height);
        gl.uniform1f(U.u_time, t);
        gl.uniform1f(U.u_scroll, progress());

        if (kind === "grid") {
          var want =
            sec.querySelector("#m-app") && sec.querySelector("#m-app").checked
              ? 1
              : 0;
          mode += (want - mode) * 0.08; // 토글을 부드럽게 따라간다
          gl.uniform1f(U.u_mode, mode);
          gl.uniform1f(U.u_focus, centerX(sec, sec.querySelector(".device")));
        } else {
          pulse += (0.35 - pulse) * 0.03; // 고른 뒤 서서히 가라앉는다
          gl.uniform1f(U.u_pulse, pulse);
          gl.uniform1f(U.u_a, centerX(sec, sec.querySelector(".web")));
          gl.uniform1f(U.u_b, centerX(sec, sec.querySelector(".device")));
        }

        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        raf = requestAnimationFrame(frame);
      }

      function start() {
        if (!running) {
          running = true;
          if (!raf) raf = requestAnimationFrame(frame);
        }
      }
      function stop() {
        running = false;
        if (raf) {
          cancelAnimationFrame(raf);
          raf = null;
        }
      }

      // 화면 밖이면 돌리지 않는다
      if ("IntersectionObserver" in window) {
        var io = new IntersectionObserver(
          function (es) {
            es[0].isIntersecting ? start() : stop();
          },
          { rootMargin: "120px" },
        );
        io.observe(sec);
        cleanup.push(function () {
          io.disconnect();
        });
      } else {
        start();
      }

      var onVis = function () {
        document.hidden ? stop() : start();
      };
      var onLost = function (e: Event) {
        e.preventDefault();
        stop();
        canvas.remove();
      };
      // 카드를 고르면 흐름이 한 번 밀려간다
      var onPick = function () {
        pulse = 1.0;
      };
      document.addEventListener("visibilitychange", onVis);
      canvas.addEventListener("webglcontextlost", onLost);
      sec.addEventListener("change", onPick);
      cleanup.push(function () {
        stop();
        document.removeEventListener("visibilitychange", onVis);
        canvas.removeEventListener("webglcontextlost", onLost);
        sec.removeEventListener("change", onPick);
      });
    });
  return () => cleanup.forEach((fn) => fn());
}

export function mountBeatSync(): () => void {
  const cleanup: Array<() => void> = [];
  /*
    핀 무대의 진행도를 라디오로 옮긴다.

    왜 라디오냐 — 화면 상태(엑셀/앱, 어느 항목)를 이미 :has() 규칙이 전부 받고 있다.
    스크롤용 CSS 를 따로 만들면 같은 상태를 두 곳에서 관리하게 되고 반드시 어긋난다.
    상태는 라디오 한 곳에만 두고, 스크롤은 그 라디오를 바꾼다.

    클릭도 그대로 산다 — 사용자가 점/토글을 누르면 그 장면의 스크롤 위치로 데려간다.
    (안 그러면 눌러서 바꿔 놔도 다음 스크롤에 도로 밀린다)
  */

  var STAGES = [
    { sel: ".sec.vs", ids: ["m-xl", "m-app"] },
    { sel: ".sec.sync", ids: ["k-hall", "k-sdm", "k-ring", "k-trip"] },
    { sel: ".sec.cmp:not(.kchat)", ids: ["c-1", "c-2", "c-3", "c-4"] },
    { sel: ".sec.kchat", ids: ["g-1", "g-2", "g-3", "g-4"] },
  ];

  /** 핀이 붙어 있는 동안의 진행도 0~1 */
  function pinProgress(sec: HTMLElement) {
    var r = sec.getBoundingClientRect();
    var travel = sec.offsetHeight - window.innerHeight;
    if (travel <= 0) return 0;
    return Math.min(1, Math.max(0, -r.top / travel));
  }

  STAGES.forEach(function (st) {
    var found = document.querySelector(st.sel) as HTMLElement | null;
    if (!found) return;
    // 닫힌 함수 안에서도 non-null 로 남게 const 로 받는다 (var 는 안 좁혀진다)
    const sec = found;
    var radios = st.ids.map(function (id) {
      return document.getElementById(id) as HTMLInputElement;
    });
    if (
      radios.some(function (r) {
        return !r;
      })
    )
      return;
    var n = radios.length,
      self = false,
      raf: number | null = null;

    var pin = sec.querySelector(".pin2") as HTMLElement | null;

    function apply() {
      raf = null;
      // 좁은 폭에서는 핀이 아니라 그냥 흐른다 — 스크롤이 장면을 밀면 안 된다
      if (!pin || getComputedStyle(pin).position !== "sticky") return;
      // 장면을 n 등분하되 앞뒤 8% 는 여유로 둔다 (막 들어오거나 나가는 구간)
      var p = (pinProgress(sec) - 0.08) / 0.84;
      var i = Math.min(n - 1, Math.max(0, Math.floor(p * n)));
      if (!radios[i].checked) {
        self = true;
        radios[i].checked = true;
        radios[i].dispatchEvent(new Event("change", { bubbles: true }));
        self = false;
      }
    }
    function onScroll() {
      if (!raf) raf = requestAnimationFrame(apply);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    apply();

    // 눌러서 고르면 그 장면으로 데려간다
    var onPick = function (e: Event) {
      if (self) return;
      var i = radios.indexOf(e.target as HTMLInputElement);
      if (i < 0) return;
      if (!pin || getComputedStyle(pin).position !== "sticky") return;
      var travel = sec.offsetHeight - window.innerHeight;
      if (travel <= 0) return;
      var mid = 0.08 + ((i + 0.5) / n) * 0.84;
      window.scrollTo({
        top: sec.offsetTop + travel * mid,
        behavior: "auto",
      });
    };
    sec.addEventListener("change", onPick);
    cleanup.push(function () {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      sec.removeEventListener("change", onPick);
    });
  });
  return () => cleanup.forEach((fn) => fn());
}
