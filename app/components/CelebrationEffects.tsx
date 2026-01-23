"use client";

export function CelebrationEffects() {
  const confettiColors = [
    "#FF6B6B",
    "#4ECDC4",
    "#45B7D1",
    "#FFA07A",
    "#98D8C8",
    "#F7DC6F",
    "#BB8FCE",
    "#85C1E2",
    "#F8B739",
    "#FF6B9D",
  ];

  return (
    <div className="pointer-events-none absolute inset-0 z-40 overflow-visible">
      {confettiColors.map((color, index) => {
        const isRound = index % 2 === 0;
        const size = isRound ? "8px" : "10px";
        const shape = isRound ? "50%" : "2px";
        return (
          <div
            key={index}
            className="confetti"
            style={
              {
                "--confetti-color": color,
                "--confetti-left": `${(index * 10) % 100}%`,
                "--confetti-duration": `${3 + (index % 3)}s`,
                "--confetti-delay": `${index * 0.05}s`,
                "--confetti-size": size,
                "--confetti-shape": shape,
                "--confetti-drift": `${(index % 2 === 0 ? 1 : -1) * (20 + (index % 30))}px`,
              } as React.CSSProperties
            }
          />
        );
      })}
      {confettiColors.map((color, index) => {
        const isRound = index % 3 === 0;
        const size = isRound ? "6px" : "12px";
        const shape = isRound ? "50%" : "0px";
        return (
          <div
            key={`second-${index}`}
            className="confetti"
            style={
              {
                "--confetti-color": color,
                "--confetti-left": `${(index * 7 + 15) % 100}%`,
                "--confetti-duration": `${4 + (index % 2)}s`,
                "--confetti-delay": `${index * 0.08}s`,
                "--confetti-size": size,
                "--confetti-shape": shape,
                "--confetti-drift": `${(index % 2 === 0 ? 1 : -1) * (15 + (index % 25))}px`,
              } as React.CSSProperties
            }
          />
        );
      })}
      {confettiColors.map((color, index) => {
        const isRound = index % 2 === 1;
        const size = isRound ? "9px" : "11px";
        const shape = isRound ? "50%" : "3px";
        return (
          <div
            key={`third-${index}`}
            className="confetti"
            style={
              {
                "--confetti-color": color,
                "--confetti-left": `${(index * 13 + 30) % 100}%`,
                "--confetti-duration": `${3.5 + (index % 2.5)}s`,
                "--confetti-delay": `${index * 0.06}s`,
                "--confetti-size": size,
                "--confetti-shape": shape,
                "--confetti-drift": `${(index % 2 === 0 ? 1 : -1) * (25 + (index % 35))}px`,
              } as React.CSSProperties
            }
          />
        );
      })}
      {/* 추가 종이 조각들 - 즉시 시작 */}
      {confettiColors.map((color, index) => {
        const isRound = index % 4 === 0;
        const size = isRound ? "7px" : "9px";
        const shape = isRound ? "50%" : "1px";
        return (
          <div
            key={`fourth-${index}`}
            className="confetti"
            style={
              {
                "--confetti-color": color,
                "--confetti-left": `${(index * 11 + 5) % 100}%`,
                "--confetti-duration": `${3.2 + (index % 2.8)}s`,
                "--confetti-delay": "0s",
                "--confetti-size": size,
                "--confetti-shape": shape,
                "--confetti-drift": `${(index % 2 === 0 ? 1 : -1) * (18 + (index % 28))}px`,
              } as React.CSSProperties
            }
          />
        );
      })}
    </div>
  );
}
