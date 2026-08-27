"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef } from "react";
import { mountBeatSync, mountShaders } from "./landingFx";
import { useKakaoAuth } from "../hooks/useKakaoAuth";
import "../landing.css";

/**
 * 로그인 전 랜딩.
 *
 * 마크업·스타일은 `docs/concepts/landing-1a-final.html` 에서 옮겨 왔다.
 * 스타일은 `app/landing.css` 에 있고 **전부 `#lp` 아래로 스코프**되어 있다 —
 * 클래스 이름(`.wrap`·`.sec`·`.tile` …)이 흔한 데다, `--color-*` 를 `:root` 에
 * 두면 Tailwind v4 가 테마 색으로 등록해 앱 전체에 샌다.
 *
 * 스크롤 안무는 CSS scroll-driven animation 이라 JS 가 없어도 돈다.
 * 여기 있는 두 effect 는 (1) 손으로 쓴 WebGL 배경, (2) 핀 진행도를 라디오로
 * 옮기는 동기화뿐이고, 둘 다 없어도 화면은 정상으로 보인다.
 */
export default function Landing() {
  const { handleKakaoAuth, loading } = useKakaoAuth();
  const rootRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<HTMLElement>(null);

  const goStart = useCallback(() => {
    startRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // 셰이더와 비트 동기화. 둘 다 없어도 화면은 정상이다 (landingFx.ts 참고)
  useEffect(mountShaders, []);
  useEffect(mountBeatSync, []);

  return (
    <div id="lp" ref={rootRef}>
      <svg
        width="0"
        height="0"
        style={{ position: "absolute" }}
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <symbol id="i-doc" viewBox="0 0 24 24">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
            <path d="M14 2v6h6" />
          </symbol>
          <symbol id="i-sheet" viewBox="0 0 24 24">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18M3 15h18M9 9v12M15 9v12" />
          </symbol>
          <symbol id="i-chat" viewBox="0 0 24 24">
            <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
          </symbol>
          <symbol id="i-note" viewBox="0 0 24 24">
            <path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11l5-5V5a2 2 0 0 0-2-2Z" />
            <path d="M15 21v-4a2 2 0 0 1 2-2h4" />
          </symbol>
          <symbol id="i-cal" viewBox="0 0 24 24">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18M7 14h.01M11 14h6M7 18h.01M11 18h4" />
          </symbol>
          <symbol id="i-coin" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" />
            <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
            <path d="M12 6v2m0 8v2" />
          </symbol>
          <symbol id="i-msgs" viewBox="0 0 24 24">
            <path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4c0-1.1.9-2 2-2h8a2 2 0 0 1 2 2Z" />
            <path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1" />
          </symbol>
          <symbol id="i-trend" viewBox="0 0 24 24">
            <path d="M22 7 13.5 15.5 8.5 10.5 2 17" />
            <path d="M16 7h6v6" />
          </symbol>
          <symbol id="i-check" viewBox="0 0 24 24">
            <path d="M20 6 9 17l-5-5" />
          </symbol>
          <symbol id="i-home" viewBox="0 0 24 24">
            <path d="M3 10.5 12 3l9 7.5" />
            <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
          </symbol>
          <symbol id="i-search" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </symbol>
          <symbol id="i-grid" viewBox="0 0 24 24">
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" />
          </symbol>
          <symbol id="i-gear" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" />
          </symbol>
          <symbol id="i-hall" viewBox="0 0 24 24">
            <path d="M3 21h18" />
            <path d="M5 21V8l7-5 7 5v13" />
            <path d="M10 21v-6h4v6" />
          </symbol>
          <symbol id="i-cam" viewBox="0 0 24 24">
            <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3Z" />
            <circle cx="12" cy="13" r="3.2" />
          </symbol>
          <symbol id="i-ring" viewBox="0 0 24 24">
            <circle cx="12" cy="14.5" r="6" />
            <path d="m9 5 3-3 3 3-3 3.5Z" />
          </symbol>
          <symbol id="i-plane" viewBox="0 0 24 24">
            <path d="M17.8 19.2 16 11l3.5-3.5a2.5 2.5 0 0 0-3.5-3.5L12.5 7.5 4.3 5.7a1 1 0 0 0-1 1.6L8 11l-3 3H3l-.7 2.1 3.6 1.5L7.4 21l2.1-.7v-2l3-3 3.7 4.7a1 1 0 0 0 1.6-.8Z" />
          </symbol>
          <symbol id="i-bell" viewBox="0 0 24 24">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8" />
            <path d="M10.3 21a2 2 0 0 0 3.4 0" />
          </symbol>
          <symbol id="i-globe" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" />
            <path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20" />
          </symbol>
          <symbol id="i-phone" viewBox="0 0 24 24">
            <rect x="6" y="2" width="12" height="20" rx="2.5" />
            <path d="M11 19h2" />
          </symbol>
          <symbol id="i-tap" viewBox="0 0 24 24">
            <path d="M12 11V6.5a1.5 1.5 0 0 1 3 0V13" />
            <path d="M15 11.5a1.5 1.5 0 0 1 3 0V14" />
            <path d="M18 12.5a1.5 1.5 0 0 1 3 0V17a5 5 0 0 1-5 5h-2.2a5 5 0 0 1-3.9-1.9L7 16.5s-1-1.4 0-2.2c1-.7 2 .3 2 .3l1 1.2V9.5a1.5 1.5 0 0 1 3 0" />
          </symbol>
          <symbol id="i-zoom" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3M8 11h6M11 8v6" />
          </symbol>
        </defs>
      </svg>

      <nav className="nav">
        <b>웨딩 플랜트</b>
        <button type="button" className="go" onClick={goStart}>
          시작하기
        </button>
        <span className="progress" aria-hidden="true" />
      </nav>

      <main>
        {/* ══════════ 첫 화면 — 시안 A 원본 (변경 금지) ══════════ */}
        <section className="stage" aria-label="준비 과정">
          <div className="pin">
            <div className="wrap pin-grid">
              <div className="odo-wrap">
                <p className="odo-label">결혼식까지</p>
                <p
                  className="odo"
                  aria-label="결혼식까지 남은 날이 스크롤에 따라 줄어듭니다"
                >
                  <span className="d">D-</span>
                  <span className="odo-mask">
                    <span className="odo-track">
                      <b>312</b>
                      <b>274</b>
                      <b>186</b>
                      <b>92</b>
                      <b>0</b>
                    </span>
                  </span>
                </p>
                <p className="odo-cap">
                  뭐부터 해야 할지
                  <br />
                  몰라도 괜찮아요
                </p>
                <p className="odo-sub">예식장부터 신혼여행까지, 순서대로</p>
              </div>

              <div>
                <div className="tiles">
                  <span className="tile fill">
                    <span className="t">예식장</span>
                    <span className="s">6월 12일 확정</span>
                  </span>
                  <span className="tile fill">
                    <span className="t">스드메</span>
                    <span className="s">642만원</span>
                  </span>
                  <span className="tile fill">
                    <span className="t">예물</span>
                    <span className="s">9월 27일</span>
                  </span>
                  <span className="tile fill">
                    <span className="t">신혼여행</span>
                    <span className="s">발리 6박</span>
                  </span>
                </div>
                <div className="money-strip">
                  <span className="lbl">전체 예산 4,200만원</span>
                  <div className="val">
                    1,400<small>만원 남음</small>
                  </div>
                  <div className="mbar" aria-hidden="true">
                    <i
                      className="used"
                      style={{
                        width: "38.1%",
                        background: "var(--color-accent)",
                      }}
                    />
                    <i
                      className="plan"
                      style={{
                        width: "28.6%",
                        background: "var(--color-plan)",
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
            <p className="hintdown" aria-hidden="true">
              스크롤
            </p>
          </div>
        </section>

        {/* ══ 폰에서 엑셀 vs 폰에서 앱 ══ */}
        <section className="sec stage2 vs">
          <div className="pin2">
            <canvas className="gl" data-gl="grid" aria-hidden="true" />
            <p className="beats" aria-hidden="true">
              <i />
              <i />
            </p>
            <div className="wrap">
              <input
                className="pick"
                type="radio"
                name="m"
                id="m-xl"
                defaultChecked
              />
              <input className="pick" type="radio" name="m" id="m-app" />

              <h2>
                같은 결혼 준비를
                <br />
                같은 폰에서 열면
              </h2>
              <p className="lead">
                엑셀이 나쁜 게 아닙니다. 큰 화면에서 만든 표를 작은 화면에서
                읽는 게 문제입니다.
              </p>

              <div className="vsgrid">
                <div>
                  <div
                    className="toggle"
                    role="radiogroup"
                    aria-label="폰에서 열 것"
                  >
                    <label htmlFor="m-xl">
                      <svg className="ic">
                        <use href="#i-sheet" />
                      </svg>
                      엑셀
                    </label>
                    <label htmlFor="m-app">
                      <svg className="ic">
                        <use href="#i-phone" />
                      </svg>
                      웨딩 플랜트
                    </label>
                  </div>

                  <div className="say" data-f="xl">
                    <p className="li">
                      <span className="dot">
                        <svg className="ic">
                          <use href="#i-zoom" />
                        </svg>
                      </span>
                      <span className="w">
                        글자가 7px입니다. 확대하면 옆 칸이 사라지고, 줄이면 못
                        읽습니다.
                      </span>
                    </p>
                    <p className="li">
                      <span className="dot">
                        <svg className="ic">
                          <use href="#i-sheet" />
                        </svg>
                      </span>
                      <span className="w">
                        합계는 맞는데 <b>얼마 남았는지</b>는 어느 셀에도
                        없습니다. 수식을 또 짜야 합니다.
                      </span>
                    </p>
                    <p className="li">
                      <span className="dot">
                        <svg className="ic">
                          <use href="#i-chat" />
                        </svg>
                      </span>
                      <span className="w">
                        상대가 고친 걸 알 방법이 없습니다. 파일을 다시 받아야
                        압니다.
                      </span>
                    </p>
                  </div>
                  <div className="say" data-f="app">
                    <p className="li">
                      <span className="dot">
                        <svg className="ic">
                          <use href="#i-coin" />
                        </svg>
                      </span>
                      <span className="w">
                        <b>남은 예산이 맨 위에 한 줄로</b> 나옵니다. 확대할 일이
                        없습니다.
                      </span>
                    </p>
                    <p className="li">
                      <span className="dot">
                        <svg className="ic">
                          <use href="#i-cal" />
                        </svg>
                      </span>
                      <span className="w">
                        일정 하나가 카드 하나입니다. 눌러서 완료하면 예산이 그
                        자리에서 따라옵니다.
                      </span>
                    </p>
                    <p className="li">
                      <span className="dot">
                        <svg className="ic">
                          <use href="#i-msgs" />
                        </svg>
                      </span>
                      <span className="w">
                        상대가 바꾸면 알림이 옵니다. 파일을 주고받지 않습니다.
                      </span>
                    </p>
                  </div>
                </div>

                <div className="device">
                  <div className="screen">
                    {/* 엑셀 */}
                    <div className="face" data-f="xl">
                      <div className="xl">
                        <p className="rib">
                          <svg className="ic" style={{ fontSize: "12px" }}>
                            <use href="#i-sheet" />
                          </svg>
                          <b>결혼준비_최종_v7.xlsx</b>
                        </p>
                        <div className="grid">
                          <div className="r head">
                            <span className="rn" />
                            <span className="c1">A</span>
                            <span className="c2">B</span>
                            <span className="c3">C</span>
                            <span className="c4">D</span>
                            <span className="c5">E</span>
                          </div>
                          <div className="r">
                            <span className="rn">1</span>
                            <span className="c1">항목</span>
                            <span className="c2">예산</span>
                            <span className="c3">업체</span>
                            <span className="c4">날짜</span>
                            <span className="c5">비고</span>
                          </div>
                          <div className="r">
                            <span className="rn">2</span>
                            <span className="c1">예식장</span>
                            <span className="c2">12,000,000</span>
                            <span className="c3">아모르하우스</span>
                            <span className="c4">6/12</span>
                            <span className="c5">계약금 완료</span>
                          </div>
                          <div className="r">
                            <span className="rn">3</span>
                            <span className="c1">스드메</span>
                            <span className="c2">5,800,000</span>
                            <span className="c3">아모레스튜디오</span>
                            <span className="c4">9/12</span>
                            <span className="c5">2차 미팅</span>
                          </div>
                          <div className="r">
                            <span className="rn">4</span>
                            <span className="c1">예물</span>
                            <span className="c2">3,400,000</span>
                            <span className="c3">종로귀금속</span>
                            <span className="c4">9/27</span>
                            <span className="c5">상담예정</span>
                          </div>
                          <div className="r">
                            <span className="rn">5</span>
                            <span className="c1">신혼여행</span>
                            <span className="c2">4,800,000</span>
                            <span className="c3">발리6박</span>
                            <span className="c4">11/3</span>
                            <span className="c5">항공별도</span>
                          </div>
                          <div className="r">
                            <span className="rn">6</span>
                            <span className="c1">청첩장</span>
                            <span className="c2">620,000</span>
                            <span className="c3">-</span>
                            <span className="c4">10/10</span>
                            <span className="c5" />
                          </div>
                          <div className="r">
                            <span className="rn">7</span>
                            <span className="c1">한복</span>
                            <span className="c2">-</span>
                            <span className="c3">-</span>
                            <span className="c4">-</span>
                            <span className="c5">미정</span>
                          </div>
                          <div className="r">
                            <span className="rn">8</span>
                            <span className="c1">합계</span>
                            <span className="c2">=SUM(B2:B7)</span>
                            <span className="c3" />
                            <span className="c4" />
                            <span className="c5" />
                          </div>
                          <div className="r">
                            <span className="rn">9</span>
                            <span className="c1" />
                            <span className="c2" />
                            <span className="c3" />
                            <span className="c4" />
                            <span className="c5" />
                          </div>
                          <div className="r">
                            <span className="rn">10</span>
                            <span className="c1" />
                            <span className="c2" />
                            <span className="c3" />
                            <span className="c4" />
                            <span className="c5" />
                          </div>
                          <div className="r">
                            <span className="rn">11</span>
                            <span className="c1" />
                            <span className="c2" />
                            <span className="c3" />
                            <span className="c4" />
                            <span className="c5" />
                          </div>
                          <div className="r">
                            <span className="rn">12</span>
                            <span className="c1" />
                            <span className="c2" />
                            <span className="c3" />
                            <span className="c4" />
                            <span className="c5" />
                          </div>
                          <div className="r">
                            <span className="rn">13</span>
                            <span className="c1" />
                            <span className="c2" />
                            <span className="c3" />
                            <span className="c4" />
                            <span className="c5" />
                          </div>
                          <div className="r">
                            <span className="rn">14</span>
                            <span className="c1" />
                            <span className="c2" />
                            <span className="c3" />
                            <span className="c4" />
                            <span className="c5" />
                          </div>
                          <div className="r">
                            <span className="rn">15</span>
                            <span className="c1" />
                            <span className="c2" />
                            <span className="c3" />
                            <span className="c4" />
                            <span className="c5" />
                          </div>
                          <div className="r">
                            <span className="rn">16</span>
                            <span className="c1" />
                            <span className="c2" />
                            <span className="c3" />
                            <span className="c4" />
                            <span className="c5" />
                          </div>
                          <div className="r">
                            <span className="rn">17</span>
                            <span className="c1" />
                            <span className="c2" />
                            <span className="c3" />
                            <span className="c4" />
                            <span className="c5" />
                          </div>
                          <div className="r">
                            <span className="rn">18</span>
                            <span className="c1" />
                            <span className="c2" />
                            <span className="c3" />
                            <span className="c4" />
                            <span className="c5" />
                          </div>
                          <div className="r">
                            <span className="rn">19</span>
                            <span className="c1" />
                            <span className="c2" />
                            <span className="c3" />
                            <span className="c4" />
                            <span className="c5" />
                          </div>
                          <div className="r">
                            <span className="rn">20</span>
                            <span className="c1" />
                            <span className="c2" />
                            <span className="c3" />
                            <span className="c4" />
                            <span className="c5" />
                          </div>
                          <div className="r">
                            <span className="rn">21</span>
                            <span className="c1" />
                            <span className="c2" />
                            <span className="c3" />
                            <span className="c4" />
                            <span className="c5" />
                          </div>
                          <div className="r">
                            <span className="rn">22</span>
                            <span className="c1" />
                            <span className="c2" />
                            <span className="c3" />
                            <span className="c4" />
                            <span className="c5" />
                          </div>
                          <div className="r">
                            <span className="rn">23</span>
                            <span className="c1" />
                            <span className="c2" />
                            <span className="c3" />
                            <span className="c4" />
                            <span className="c5" />
                          </div>
                          <div className="r">
                            <span className="rn">24</span>
                            <span className="c1" />
                            <span className="c2" />
                            <span className="c3" />
                            <span className="c4" />
                            <span className="c5" />
                          </div>
                        </div>
                        <p className="hscroll" aria-hidden="true">
                          <i />
                        </p>
                        <p className="foot">
                          <span className="sheet">Sheet1</span>
                          <span>Sheet2</span>
                          <span>+</span>
                        </p>
                        <p className="pinch">
                          <svg className="ic">
                            <use href="#i-zoom" />
                          </svg>
                          확대해야 읽힙니다
                        </p>
                      </div>
                    </div>

                    {/* 앱 (실제 화면) */}
                    <div className="face" data-f="app">
                      <p className="sbar">
                        <span>9:41</span>
                        <i aria-hidden="true" />
                      </p>
                      <div className="sbody">
                        <p className="apphead">
                          <span className="nm">지현 · 민수</span>
                          <span className="av">지</span>
                          <span className="av" style={{ marginLeft: "-6px" }}>
                            민
                          </span>
                          <span className="dday">D-129</span>
                        </p>
                        <p className="appdate">결혼식: 2026년 12월 31일 (목)</p>

                        <div className="appbudget">
                          <span className="top">
                            <span className="coin">
                              <svg className="ic">
                                <use href="#i-coin" />
                              </svg>
                            </span>
                            <span>
                              <span className="k">남은 예산</span>
                              <span className="v" style={{ display: "block" }}>
                                1,400만 원
                              </span>
                            </span>
                          </span>
                          <span className="u" style={{ display: "block" }}>
                            2,800만 원 지출/예정
                          </span>
                          <span className="track">
                            <span className="t">
                              <i style={{ width: "67%" }} />
                            </span>
                            <span className="p">67%</span>
                          </span>
                        </div>

                        <p className="apptabs">
                          <span className="on">
                            계획 중 <em>5</em>
                          </span>
                          <span>
                            완료 <em>1</em>
                          </span>
                        </p>

                        <span className="appcard">
                          <span
                            className="tile2"
                            style={{ background: "var(--cat-1)" }}
                          >
                            <span className="ck" />
                          </span>
                          <span className="mid">
                            <span className="t" style={{ display: "block" }}>
                              청첩장 발송
                            </span>
                            <span className="c" style={{ display: "block" }}>
                              청첩장
                            </span>
                            <span className="d">2026년 10월 10일 (토)</span>
                          </span>
                          <span className="right">
                            <span className="m" style={{ display: "block" }}>
                              미정
                            </span>
                            <span className="st">예정</span>
                          </span>
                        </span>

                        <span className="appcard">
                          <span
                            className="tile2"
                            style={{ background: "var(--cat-2)" }}
                          >
                            <span className="ck" />
                          </span>
                          <span className="mid">
                            <span className="t" style={{ display: "block" }}>
                              예물 상담
                            </span>
                            <span className="c" style={{ display: "block" }}>
                              예물
                            </span>
                            <span className="d">2026년 9월 27일 (일)</span>
                          </span>
                          <span className="right">
                            <span className="m" style={{ display: "block" }}>
                              340만 원
                            </span>
                            <span className="st">예정</span>
                          </span>
                        </span>

                        <span className="appcard done">
                          <span
                            className="tile2"
                            style={{ background: "var(--cat-3)" }}
                          >
                            <span className="ck">
                              <svg className="ic">
                                <use href="#i-check" />
                              </svg>
                            </span>
                          </span>
                          <span className="mid">
                            <span className="t" style={{ display: "block" }}>
                              상견례
                            </span>
                            <span className="c" style={{ display: "block" }}>
                              상견례
                            </span>
                            <span className="d">2026년 7월 4일 (토)</span>
                          </span>
                          <span className="right">
                            <span className="m" style={{ display: "block" }}>
                              62만 원
                            </span>
                          </span>
                        </span>
                      </div>
                      <p className="appnav">
                        <span className="on">
                          <svg className="ic">
                            <use href="#i-home" />
                          </svg>
                          홈
                        </span>
                        <span>
                          <svg className="ic">
                            <use href="#i-search" />
                          </svg>
                          피드
                        </span>
                        <span>
                          <svg className="ic">
                            <use href="#i-grid" />
                          </svg>
                          참여 플랜
                        </span>
                        <span>
                          <svg className="ic">
                            <use href="#i-gear" />
                          </svg>
                          Settings
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="drift" aria-hidden="true">
                <span className="dchip">예식장</span>
                <span className="dchip">스드메</span>
                <span className="dchip">예물</span>
                <span className="dchip">신혼여행</span>
                <span className="dchip">청첩장</span>
                <span className="dchip">한복</span>
              </div>
              <div className="drift r" aria-hidden="true">
                <span className="dchip">상견례</span>
                <span className="dchip">본식 촬영</span>
                <span className="dchip">부케</span>
                <span className="dchip">답례품</span>
                <span className="dchip">신혼집</span>
              </div>
            </div>
          </div>
        </section>

        {/* ══ 웹 연동 ══ */}
        <section className="sec stage2 sync">
          <div className="pin2">
            <canvas className="gl" data-gl="flow" aria-hidden="true" />
            <p className="beats" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </p>
            <div className="wrap">
              <input
                className="pick"
                type="radio"
                name="k"
                id="k-hall"
                defaultChecked
              />
              <input className="pick" type="radio" name="k" id="k-sdm" />
              <input className="pick" type="radio" name="k" id="k-ring" />
              <input className="pick" type="radio" name="k" id="k-trip" />

              <h2>
                밖에서는 폰으로,
                <br />
                집에서는 큰 화면으로
              </h2>
              <p className="lead">
                같은 플랜입니다. 상담장에서 폰으로 적은 금액이 집에 오면 웹에
                그대로 있습니다.
              </p>

              <div className="syncgrid">
                <div className="device">
                  <div className="screen">
                    <p className="sbar">
                      <span>9:41</span>
                      <i aria-hidden="true" />
                    </p>
                    <div className="sbody">
                      <p className="apphead">
                        <span className="nm">지현 · 민수</span>
                        <span className="dday">D-129</span>
                      </p>
                      <span className="appcard" data-k="hall">
                        <span
                          className="tile2"
                          style={{ background: "var(--cat-1)" }}
                        >
                          <span className="ck" />
                        </span>
                        <span className="mid">
                          <span className="t" style={{ display: "block" }}>
                            예식장
                          </span>
                          <span className="c">아모르하우스</span>
                        </span>
                        <span className="right">
                          <span className="m">1,200만 원</span>
                        </span>
                      </span>
                      <span className="appcard" data-k="sdm">
                        <span
                          className="tile2"
                          style={{ background: "var(--cat-2)" }}
                        >
                          <span className="ck" />
                        </span>
                        <span className="mid">
                          <span className="t" style={{ display: "block" }}>
                            스드메
                          </span>
                          <span className="c">아모레 스튜디오</span>
                        </span>
                        <span className="right">
                          <span className="m">580만 원</span>
                        </span>
                      </span>
                      <span className="appcard" data-k="ring">
                        <span
                          className="tile2"
                          style={{ background: "var(--cat-4)" }}
                        >
                          <span className="ck" />
                        </span>
                        <span className="mid">
                          <span className="t" style={{ display: "block" }}>
                            예물
                          </span>
                          <span className="c">종로 귀금속</span>
                        </span>
                        <span className="right">
                          <span className="m">340만 원</span>
                        </span>
                      </span>
                      <span className="appcard" data-k="trip">
                        <span
                          className="tile2"
                          style={{ background: "var(--cat-5)" }}
                        >
                          <span className="ck" />
                        </span>
                        <span className="mid">
                          <span className="t" style={{ display: "block" }}>
                            신혼여행
                          </span>
                          <span className="c">발리 6박</span>
                        </span>
                        <span className="right">
                          <span className="m">480만 원</span>
                        </span>
                      </span>
                      <p className="push">
                        <svg className="ic">
                          <use href="#i-bell" />
                        </svg>
                        <span className="t">
                          웹에서
                          <b className="nm" data-k="hall">
                            예식장
                          </b>
                          <b className="nm" data-k="sdm">
                            스드메
                          </b>
                          <b className="nm" data-k="ring">
                            예물
                          </b>
                          <b className="nm" data-k="trip">
                            신혼여행
                          </b>
                          을 보고 있어요
                        </span>
                      </p>
                    </div>
                    <p className="appnav">
                      <span className="on">
                        <svg className="ic">
                          <use href="#i-home" />
                        </svg>
                        홈
                      </span>
                      <span>
                        <svg className="ic">
                          <use href="#i-search" />
                        </svg>
                        피드
                      </span>
                      <span>
                        <svg className="ic">
                          <use href="#i-grid" />
                        </svg>
                        참여 플랜
                      </span>
                      <span>
                        <svg className="ic">
                          <use href="#i-gear" />
                        </svg>
                        Settings
                      </span>
                    </p>
                  </div>
                </div>

                <div className="web">
                  <p className="web-top">
                    <i aria-hidden="true" />
                    <b>웨딩 플랜트</b>
                    <span className="tag">
                      <svg className="ic">
                        <use href="#i-globe" />
                      </svg>
                      웹 · 큰 화면
                    </span>
                  </p>
                  <div className="wcards">
                    <label className="wcard" htmlFor="k-hall">
                      <span
                        className="badge"
                        style={{ background: "var(--cat-1)" }}
                      >
                        <svg className="ic">
                          <use href="#i-hall" />
                        </svg>
                      </span>
                      <span className="n">예식장</span>
                      <span className="m">
                        1,200<span style={{ fontSize: ".5em" }}>만</span>
                      </span>
                      <span className="s">6월 12일 확정</span>
                    </label>
                    <label className="wcard" htmlFor="k-sdm">
                      <span
                        className="badge"
                        style={{ background: "var(--cat-2)" }}
                      >
                        <svg className="ic">
                          <use href="#i-cam" />
                        </svg>
                      </span>
                      <span className="n">스드메</span>
                      <span className="m">
                        580<span style={{ fontSize: ".5em" }}>만</span>
                      </span>
                      <span className="s">아모레 스튜디오</span>
                    </label>
                    <label className="wcard" htmlFor="k-ring">
                      <span
                        className="badge"
                        style={{ background: "var(--cat-4)" }}
                      >
                        <svg className="ic">
                          <use href="#i-ring" />
                        </svg>
                      </span>
                      <span className="n">예물</span>
                      <span className="m">
                        340<span style={{ fontSize: ".5em" }}>만</span>
                      </span>
                      <span className="s">9월 27일 상담</span>
                    </label>
                    <label className="wcard" htmlFor="k-trip">
                      <span
                        className="badge"
                        style={{ background: "var(--cat-5)" }}
                      >
                        <svg className="ic">
                          <use href="#i-plane" />
                        </svg>
                      </span>
                      <span className="n">신혼여행</span>
                      <span className="m">
                        480<span style={{ fontSize: ".5em" }}>만</span>
                      </span>
                      <span className="s">발리 6박</span>
                    </label>
                  </div>
                  <div className="web-foot">
                    <span className="lbl">4,200만원 중 남음</span>
                    <span className="v">
                      1,400<small>만원</small>
                    </span>
                    <span className="bar" aria-hidden="true">
                      <i
                        style={{
                          width: "38.1%",
                          background: "var(--color-accent)",
                        }}
                      />
                      <i
                        style={{
                          width: "28.6%",
                          background: "var(--color-plan)",
                        }}
                      />
                    </span>
                  </div>
                </div>
              </div>

              <div className="plats">
                <span className="plat">
                  <svg className="ic">
                    <use href="#i-phone" />
                  </svg>
                  안드로이드 앱
                </span>
                <span className="plat">
                  <svg className="ic">
                    <use href="#i-globe" />
                  </svg>
                  웹
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ══ 노션 대조 ══ */}
        <section className="sec stage2 cmp">
          <div className="pin2">
            <p className="beats" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </p>
            <div className="wrap">
              <input
                className="pick"
                type="radio"
                name="c"
                id="c-1"
                defaultChecked
              />
              <input className="pick" type="radio" name="c" id="c-2" />
              <input className="pick" type="radio" name="c" id="c-3" />
              <input className="pick" type="radio" name="c" id="c-4" />

              <h2>
                템플릿을 살 필요도,
                <br />
                만들 필요도 없어요
              </h2>
              <p className="lead">
                노션은 무엇을 하려 해도 빈 페이지에서 시작해요. 여기는 열면 이미
                짜여 있어요.
              </p>

              <div className="cmphead">
                <p className="toggle">
                  <label htmlFor="c-1">
                    <svg className="ic">
                      <use href="#i-cal" />
                    </svg>
                    플랜 보드
                  </label>
                  <label htmlFor="c-2">
                    <svg className="ic">
                      <use href="#i-coin" />
                    </svg>
                    예산
                  </label>
                  <label htmlFor="c-3">
                    <svg className="ic">
                      <use href="#i-doc" />
                    </svg>
                    일정 상세
                  </label>
                  <label htmlFor="c-4">
                    <svg className="ic">
                      <use href="#i-bell" />
                    </svg>
                    함께 보기
                  </label>
                </p>
              </div>

              <div className="cmpgrid">
                <div className="cmpcol">
                  <div className="win2 nwin">
                    <p className="chrome">
                      <i />
                      <i />
                      <i />
                      <span className="logo">N</span>
                      <b>결혼 준비</b>
                      <span className="tag">노션 · 직접 만들어야 함</span>
                    </p>
                    <div className="body">
                      <div className="side-nav">
                        <b>내 워크스페이스</b>
                        <span>＋ 새 페이지</span>
                        <span className="on">결혼 준비</span>
                        <span>업체 후보</span>
                        <span>＋ 페이지 추가</span>
                      </div>
                      <div className="doc">
                        <p className="ttl">결혼 준비</p>
                        <p className="nrow nhead">
                          <span>이름</span>
                          <span>날짜</span>
                          <span>금액</span>
                          <span>
                            <span className="dash">＋ 속성</span>
                          </span>
                        </p>
                        <p className="nrow">
                          <span>예식장</span>
                          <span className="empty">비어 있음</span>
                          <span className="empty">비어 있음</span>
                          <span />
                        </p>
                        <p className="nrow">
                          <span>스드메</span>
                          <span className="empty">비어 있음</span>
                          <span className="empty">비어 있음</span>
                          <span />
                        </p>
                        <p className="nrow">
                          <span className="empty">제목 없음</span>
                          <span className="empty">비어 있음</span>
                          <span className="empty">비어 있음</span>
                          <span />
                        </p>
                        <p className="add">＋ 새로 만들기</p>
                      </div>
                    </div>
                  </div>
                  <p className="cmpcap">
                    <span className="s" data-c="1">
                      월별 칸과 상태 속성부터 직접 만들어야 해요.
                    </span>
                    <span className="s" data-c="2">
                      예산 표를 따로 만들고 남은 돈은 수식을 짜야 해요.
                    </span>
                    <span className="s" data-c="3">
                      일정 하나에 붙일 속성을 여섯 개쯤 정해야 해요.
                    </span>
                    <span className="s" data-c="4">
                      링크를 보내고 어디를 고쳤는지 말로 알려야 해요.
                    </span>
                  </p>
                </div>

                <div className="cmpcol app">
                  <div className="win2 pwin">
                    <p className="chrome">
                      <i />
                      <i />
                      <i />
                      <span className="logo" />
                      <b>웨딩 플랜트</b>
                      <span className="tag">열면 이미 있음</span>
                    </p>
                    <div className="body">
                      <div className="pane" data-c="1">
                        <p className="bh">
                          <b>2026년 3월</b>
                          <span className="cnt">2</span>
                          <span className="sum">3,180만 원</span>
                        </p>
                        <p className="brule" aria-hidden="true" />
                        <div className="bc">
                          <p className="l1">
                            <span className="box">
                              <svg className="ic">
                                <use href="#i-check" />
                              </svg>
                            </span>
                            <span className="t">예식장 계약</span>
                          </p>
                          <p className="l2">
                            <span className="cat">예식장</span>
                            <span>3월 4일</span>
                            <span className="amt">3,000만 원</span>
                          </p>
                        </div>
                        <div className="bc">
                          <p className="l1">
                            <span className="box">
                              <svg className="ic">
                                <use href="#i-check" />
                              </svg>
                            </span>
                            <span className="t">A스튜디오 본식 촬영</span>
                          </p>
                          <p className="l2">
                            <span className="cat">스튜디오</span>
                            <span>3월 14일 · 오전 11:00</span>
                            <span className="amt">180만 원</span>
                          </p>
                        </div>
                        <p className="bsep">
                          <b>완료 1</b>
                          <i />
                          <span className="s">300만 원 씀</span>
                        </p>
                        <div className="bc done">
                          <p className="l1">
                            <span className="box">
                              <svg className="ic">
                                <use href="#i-check" />
                              </svg>
                            </span>
                            <span className="t">상견례</span>
                          </p>
                          <p className="l2">
                            <span className="cat">기타</span>
                            <span>3월 1일</span>
                            <span className="amt">300만 원</span>
                          </p>
                        </div>
                      </div>

                      <div className="pane bud" data-c="2">
                        <p className="top">
                          <span>
                            <span className="big">1,400만원</span>
                            <span className="sub">4,200만원 중 남음</span>
                          </span>
                          <span className="mo">
                            이번 달 지출<b>480만원</b>
                          </span>
                        </p>
                        <p className="track">
                          <i
                            style={{ width: "26.2%", background: "#ee2b8c" }}
                          />
                          <i style={{ width: "7.1%", background: "#ff7ab5" }} />
                          <i style={{ width: "4.8%", background: "#ffa8cd" }} />
                          <i
                            style={{ width: "28.6%", background: "#cdbfc7" }}
                          />
                        </p>
                        <div className="legend">
                          <p>
                            <span
                              className="sw"
                              style={{ background: "#ee2b8c" }}
                            />
                            <span className="nm">예식장</span>
                            <span className="v">1,100만원</span>
                            <span className="pc">26.2%</span>
                          </p>
                          <p>
                            <span
                              className="sw"
                              style={{ background: "#ff7ab5" }}
                            />
                            <span className="nm">스튜디오</span>
                            <span className="v">300만원</span>
                            <span className="pc">7.1%</span>
                          </p>
                          <p>
                            <span
                              className="sw"
                              style={{ background: "#ffa8cd" }}
                            />
                            <span className="nm">예물</span>
                            <span className="v">200만원</span>
                            <span className="pc">4.8%</span>
                          </p>
                          <p className="muted">
                            <span
                              className="sw"
                              style={{ background: "#cdbfc7" }}
                            />
                            <span className="nm">사용 예상</span>
                            <span className="v">1,200만원</span>
                            <span className="pc">28.6%</span>
                          </p>
                        </div>
                      </div>

                      <div className="pane insp" data-c="3">
                        <p>
                          <span className="chip">스튜디오</span>
                          <span className="pill">예정</span>
                        </p>
                        <p className="ttl">A스튜디오 본식 촬영</p>
                        <p className="meta">
                          2026년 3월 14일 · 오전 11:00 · 서울 강남구
                        </p>
                        <p className="foot">
                          <span>
                            <span className="k">지출 금액</span>
                            <span className="amt">180만 원</span>
                          </span>
                          <span className="pay">
                            <span className="k">결제 방식</span>
                            <b>계좌이체</b>
                          </span>
                        </p>
                      </div>

                      <div className="pane act" data-c="4">
                        <p className="h">최근 활동</p>
                        <p className="it">
                          <span className="av a1">진</span>
                          <span className="tx">
                            <span className="ln">
                              <b>현진</b>님이 예산을 4,200만원으로 바꿨어요
                            </span>
                            <time>방금</time>
                          </span>
                        </p>
                        <p className="it">
                          <span className="av a2">주</span>
                          <span className="tx">
                            <span className="ln">
                              <b>미주</b>님이 드레스 투어를 3월 21일로 옮겼어요
                            </span>
                            <time>1시간 전</time>
                          </span>
                        </p>
                        <p className="it">
                          <span className="av a1">진</span>
                          <span className="tx">
                            <span className="ln">
                              <b>현진</b>님이 예식장 계약을 완료했어요
                            </span>
                            <time>어제</time>
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                  <p className="cmpcap">
                    <span className="s" data-c="1">
                      열면 월별 칸에 항목이 놓여 있어요.
                    </span>
                    <span className="s" data-c="2">
                      수식 없이 남은 금액이 맨 위에 나와요.
                    </span>
                    <span className="s" data-c="3">
                      필요한 칸이 이미 정해져 있어요.
                    </span>
                    <span className="s" data-c="4">
                      바꾸면 상대 화면에도 그대로 떠요.
                    </span>
                  </p>
                </div>
              </div>

              <p className="note">
                노션이 나쁘다는 얘기가 아니에요. 결혼 준비에 쓸 시간을 도구
                만드는 데 쓰지 않아도 된다는 뜻이에요.
              </p>
            </div>
          </div>
        </section>

        {/* ══ 카카오톡 대조 ══ */}
        <section className="sec stage2 cmp kchat">
          <div className="pin2">
            <p className="beats" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </p>
            <div className="wrap">
              <input
                className="pick"
                type="radio"
                name="g"
                id="g-1"
                defaultChecked
              />
              <input className="pick" type="radio" name="g" id="g-2" />
              <input className="pick" type="radio" name="g" id="g-3" />
              <input className="pick" type="radio" name="g" id="g-4" />

              <h2>
                정한 건 대화에
                <br />
                묻히지 않아요
              </h2>
              <p className="lead">
                채팅과 플랜이 한 몸이라, 대화에서 정한 게 그대로 플랜에 남아요.
              </p>

              <div className="cmphead">
                <p className="toggle">
                  <label htmlFor="g-1">
                    <svg className="ic">
                      <use href="#i-msgs" />
                    </svg>
                    일정 카드
                  </label>
                  <label htmlFor="g-2">
                    <svg className="ic">
                      <use href="#i-doc" />
                    </svg>
                    바로 플랜으로
                  </label>
                  <label htmlFor="g-3">
                    <svg className="ic">
                      <use href="#i-ring" />
                    </svg>
                    둘만의 방
                  </label>
                  <label htmlFor="g-4">
                    <svg className="ic">
                      <use href="#i-grid" />
                    </svg>
                    플랜마다 대화
                  </label>
                </p>
              </div>

              <div className="cmpgrid">
                <div className="cmpcol">
                  <div className="dev2 kdev">
                    <div className="scr">
                      <p className="notch" aria-hidden="true" />
                      <p className="stat">
                        <b>11:00</b>
                        <span className="sig">
                          <i />
                          <i />
                          <i />
                          <i />
                        </span>
                      </p>
                      <p className="khead">
                        <span className="bk" aria-hidden="true">
                          ‹
                        </span>
                        <b>우리 결혼 준비</b>
                        <span className="n">5</span>
                        <span className="more" aria-hidden="true">
                          ☰
                        </span>
                      </p>
                      <div className="kbody">
                        <p className="kwho">미주</p>
                        <p className="kb key">
                          A스튜디오 3/14 11시로 잡았어 180만원
                        </p>
                        <p className="kb me">오케이 그걸로 하자</p>
                        <p className="kwho">어머니</p>
                        <p className="kb">상견례 날짜는 언제로 하니</p>
                        <p className="kb me">담주에 다시 얘기할게요</p>
                        <p className="kwho">미주</p>
                        <p className="kb">청첩장 시안 봤어? 200장이면 되려나</p>
                        <p className="kb me">오늘 볼게</p>
                      </div>
                      <p className="home" aria-hidden="true" />
                    </div>
                  </div>
                  <p className="cmpcap">
                    <span className="s" data-c="1">
                      정한 건 그냥 글자예요. 카드도 링크도 없어요.
                    </span>
                    <span className="s" data-c="2">
                      다시 보려면 대화를 한참 거슬러 올라가야 해요.
                    </span>
                    <span className="s" data-c="3">
                      양가 부모님과 친구들이 한 방에 섞여 있어요.
                    </span>
                    <span className="s" data-c="4">
                      어느 방에서 뭘 정했는지는 기억해야 해요.
                    </span>
                  </p>
                </div>

                <div className="cmpcol app">
                  <div className="dev2 pdev">
                    <div className="scr">
                      <p className="notch" aria-hidden="true" />
                      <p className="stat">
                        <b>11:00</b>
                        <span className="sig">
                          <i />
                          <i />
                          <i />
                          <i />
                        </span>
                      </p>
                      <div className="pbody">
                        <div className="pane" data-c="1">
                          <p className="chead">
                            <span>
                              <span className="nm">
                                우리 플랜
                                <span className="cbadge">
                                  <svg className="ic">
                                    <use href="#i-ring" />
                                  </svg>
                                  신랑 · 신부
                                </span>
                              </span>
                              <span className="mem">현진, 미주</span>
                            </span>
                            <span className="dots" aria-hidden="true">
                              ⋮
                            </span>
                          </p>
                          <div className="cbody">
                            <span className="cb">
                              <span className="who">미주</span>
                              <span className="t">스드메 A스튜디오로 하자</span>
                            </span>
                            <span className="cb me">
                              <span className="t">좋아, 일정에 넣을게</span>
                            </span>
                            <span className="schcard">
                              <span className="hd">A스튜디오 본식 촬영</span>
                              <span className="in">
                                <span className="cg">스튜디오</span>
                                <span className="dt">2026년 3월 14일</span>
                                <span className="cost">
                                  <span>비용</span>
                                  <b>180만원</b>
                                </span>
                                <span className="go">상세보기 ›</span>
                              </span>
                            </span>
                          </div>
                        </div>

                        <div className="pane" data-c="2">
                          <p className="chead">
                            <span>
                              <span className="nm">플랜 상세</span>
                              <span className="mem">대화에서 열었어요</span>
                            </span>
                            <span className="dots" aria-hidden="true">
                              ✕
                            </span>
                          </p>
                          <div className="insp">
                            <p>
                              <span className="chip">스튜디오</span>
                              <span className="pill">예정</span>
                            </p>
                            <p className="ttl">A스튜디오 본식 촬영</p>
                            <p className="meta">
                              2026년 3월 14일 · 오전 11:00
                              <br />
                              A스튜디오 강남점
                            </p>
                            <p className="foot">
                              <span>
                                <span className="k">지출 금액</span>
                                <span className="amt">180만 원</span>
                              </span>
                              <span className="pay">
                                <span className="k">결제 방식</span>
                                <b>계좌이체</b>
                              </span>
                            </p>
                          </div>
                        </div>

                        <div className="pane" data-c="3">
                          <p className="chead">
                            <span>
                              <span className="nm">
                                우리 플랜
                                <span className="cbadge">
                                  <svg className="ic">
                                    <use href="#i-ring" />
                                  </svg>
                                  신랑 · 신부
                                </span>
                              </span>
                              <span className="mem">
                                현진, 미주 — 둘뿐이에요
                              </span>
                            </span>
                            <span className="dots" aria-hidden="true">
                              ⋮
                            </span>
                          </p>
                          <div className="cbody">
                            <span className="cb">
                              <span className="who">미주</span>
                              <span className="t">
                                예식장 계약금 3,000 나갔어
                              </span>
                            </span>
                            <span className="cb me">
                              <span className="t">
                                확인했어. 예산에 잡아 뒀어
                              </span>
                            </span>
                            <span className="cb">
                              <span className="who">미주</span>
                              <span className="t">
                                부모님한테는 한 번에 말하자
                              </span>
                            </span>
                            <span className="cb me">
                              <span className="t">그러자</span>
                            </span>
                          </div>
                        </div>

                        <div className="pane" data-c="4">
                          <div className="rooms">
                            <p className="h">대화</p>
                            <p className="room on">
                              <span className="av">우리</span>
                              <span className="tx">
                                <span className="l1">
                                  <b>우리 플랜</b>
                                  <span className="cbadge">
                                    <svg className="ic">
                                      <use href="#i-ring" />
                                    </svg>
                                    신랑 · 신부
                                  </span>
                                </span>
                                <span className="l2">
                                  확인했어. 예산에 잡아 뒀어
                                </span>
                              </span>
                              <span className="rt">
                                <time>방금</time>
                                <span className="un">2</span>
                              </span>
                            </p>
                            <p className="room">
                              <span className="av">양가</span>
                              <span className="tx">
                                <span className="l1">
                                  <b>양가 상견례</b>
                                </span>
                                <span className="l2">
                                  상견례 날짜는 언제로 하니
                                </span>
                              </span>
                              <span className="rt">
                                <time>어제</time>
                              </span>
                            </p>
                            <p className="room">
                              <span className="av">친구</span>
                              <span className="tx">
                                <span className="l1">
                                  <b>신부 들러리</b>
                                </span>
                                <span className="l2">
                                  드레스 투어 같이 갈게
                                </span>
                              </span>
                              <span className="rt">
                                <time>3일 전</time>
                              </span>
                            </p>
                          </div>
                        </div>
                      </div>
                      <p className="home" aria-hidden="true" />
                    </div>
                  </div>
                  <p className="cmpcap">
                    <span className="s" data-c="1">
                      일정이 카드로 떠요. 금액까지 같이요.
                    </span>
                    <span className="s" data-c="2">
                      상세보기를 누르면 그 일정이 바로 열려요.
                    </span>
                    <span className="s" data-c="3">
                      둘만의 방이 따로 있어요.
                    </span>
                    <span className="s" data-c="4">
                      플랜마다 대화가 붙어 있어요.
                    </span>
                  </p>
                </div>
              </div>

              <p className="note">
                대화를 옮겨 오라는 얘기가 아니에요. 정한 것만 플랜에 남으면
                되고, 그 일을 채팅에서 바로 할 수 있다는 뜻이에요.
              </p>
            </div>
          </div>
        </section>

        <section className="finale" id="start" ref={startRef}>
          <div className="wrap">
            <p className="z">D-0</p>
            <h2>🎉&nbsp;결혼 축하드립니다&nbsp;🎉</h2>
            <button
              type="button"
              className="cta"
              onClick={handleKakaoAuth}
              disabled={loading}
            >
              {loading ? "확인 중..." : "카카오로 시작하기"}
            </button>
            <Link className="sub-cta" href="/setting">
              로그인 없이 둘러보기
            </Link>
          </div>
        </section>
      </main>

      <footer>
        <div className="wrap">
          <p className="big">
            결혼 준비는 둘이 하는 일입니다.
            <br />
            도구도 그래야 합니다.
          </p>
          <div className="meta">
            <span>웨딩 플랜트</span>
            <Link href="/privacy">개인정보처리방침</Link>
            <span>seoulmomenttw@gmail.com</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
