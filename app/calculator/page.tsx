"use client";

import { useState, useMemo } from "react";

const C = [-1.06, -0.394, 0, 0.394, 1.06];
const SSV = [2, 1.5, 1, -1, -1.5, -2];
const BARC = ["#0E4744", "#1B6F6B", "#4D9C97", "#E8956F", "#D2683C", "#A8431F"];
const LBL = ["3 - 0", "3 - 1", "3 - 2", "2 - 3", "1 - 3", "0 - 3"];

function erf(x: number) {
  const s = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
}
function cdf(z: number) { return 0.5 * (1 + erf(z / Math.SQRT2)); }

export default function CalculatorPage() {
  const [nameA, setNameA] = useState("대한민국");
  const [nameB, setNameB] = useState("베트남");
  const [wrsA, setWrsA] = useState("135");
  const [wrsB, setWrsB] = useState("150");
  const [mwf, setMwf] = useState("30");

  const result = useMemo(() => {
    const a = parseFloat(wrsA) || 0;
    const b = parseFloat(wrsB) || 0;
    const m = parseFloat(mwf);
    const d = 8 * (a - b) / 1000;
    const cd = C.map((c) => cdf(c + d));
    const P = [cd[0], cd[1] - cd[0], cd[2] - cd[1], cd[3] - cd[2], cd[4] - cd[3], 1 - cd[4]];
    let emr = 0;
    for (let i = 0; i < 6; i++) emr += P[i] * SSV[i];
    const winp = P[0] + P[1] + P[2];
    let maxI = 0;
    for (let i = 1; i < 6; i++) if (P[i] > P[maxI]) maxI = i;
    const rows = P.map((p, i) => {
      const pts = (SSV[i] - emr) * m / 8;
      return {
        label: LBL[i],
        prob: p,
        ptsA: (pts >= 0 ? "+" : "−") + Math.abs(pts).toFixed(2),
        ptsB: (pts >= 0 ? "−" : "+") + Math.abs(pts).toFixed(2),
        ptsPos: pts >= 0,
        most: i === maxI,
      };
    });
    return { d, emr, winp, P, rows };
  }, [wrsA, wrsB, mwf]);

  const swap = () => {
    setNameA(nameB); setNameB(nameA);
    setWrsA(wrsB); setWrsB(wrsA);
  };

  return (
    <div className="calc-root">
      <style>{`
        .calc-root{--court:#E8744A;--court-deep:#C2542E;--surround:#1B6F6B;--surround-deep:#0E4744;--ink:#22211E;--paper:#FAF6F0;--line:#E4DCD0;--muted:#8A8276;--win:#1B6F6B;--lose:#C2542E;
          font-family:'IBM Plex Sans KR',sans-serif;background:var(--paper);color:var(--ink);min-height:100vh;padding:32px 16px 96px;}
        .calc-root .num{font-variant-numeric:tabular-nums;}
        .calc-wrap{max-width:860px;margin:0 auto;}
        .calc-root .eyebrow{display:inline-block;font-size:12px;letter-spacing:.14em;font-weight:700;color:var(--surround);border:1.5px solid var(--surround);padding:4px 10px;border-radius:999px;margin-bottom:12px;}
        .calc-root h1{font-size:clamp(24px,4vw,34px);font-weight:700;line-height:1.25;}
        .calc-root h1 em{font-style:normal;color:var(--court-deep);}
        .calc-root .sub{margin-top:8px;font-size:14px;color:var(--muted);line-height:1.7;}
        .calc-court{position:relative;background:var(--court);border:3px solid var(--surround-deep);border-radius:16px;padding:24px;display:grid;grid-template-columns:1fr 1fr;gap:48px;margin:28px 0 20px;}
        .calc-court::before{content:"";position:absolute;top:12px;bottom:12px;left:50%;width:0;border-left:3px dashed rgba(255,255,255,.85);transform:translateX(-1.5px);}
        .calc-side label{display:block;font-size:12px;font-weight:700;letter-spacing:.08em;color:#FFF;opacity:.9;margin:14px 0 6px;}
        .calc-side label:first-child{margin-top:0;}
        .calc-side input[type=text]{width:100%;font-family:inherit;font-size:17px;font-weight:700;color:var(--ink);background:#FFF;border:none;border-radius:8px;padding:10px 12px;}
        .calc-side input[type=number]{width:100%;font-size:28px;font-weight:800;color:var(--court-deep);background:#FFF;border:none;border-radius:8px;padding:8px 12px;}
        .calc-side input:focus{outline:3px solid var(--surround-deep);}
        .calc-swap{position:absolute;left:50%;top:-16px;transform:translateX(-50%);background:var(--surround-deep);color:#FFF;border:none;border-radius:999px;font-family:inherit;font-size:12px;font-weight:700;padding:7px 14px;cursor:pointer;}
        .calc-swap:hover{background:var(--surround);}
        .calc-controls{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-bottom:28px;}
        .calc-controls label{font-size:13px;font-weight:500;color:var(--muted);}
        .calc-root select{font-family:inherit;font-size:14px;font-weight:500;color:var(--ink);background:#FFF;border:1.5px solid var(--line);border-radius:8px;padding:9px 12px;cursor:pointer;}
        .calc-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:28px;}
        .calc-stat{background:#FFF;border:1.5px solid var(--line);border-radius:12px;padding:14px 16px;}
        .calc-stat p{font-size:12px;font-weight:500;color:var(--muted);margin-bottom:4px;}
        .calc-stat strong{font-size:24px;font-weight:800;}
        .calc-probbar{display:flex;height:34px;border-radius:8px;overflow:hidden;border:1.5px solid var(--line);margin-bottom:8px;}
        .calc-probbar div{display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#FFF;min-width:0;overflow:hidden;white-space:nowrap;transition:width .35s ease;}
        .calc-legend{display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-bottom:28px;}
        .calc-legend .lw{color:var(--win);}.calc-legend .ll{color:var(--lose);}
        .calc-root table{width:100%;border-collapse:collapse;background:#FFF;border:1.5px solid var(--line);border-radius:12px;overflow:hidden;font-size:14px;}
        .calc-root thead th{background:var(--surround-deep);color:#FFF;font-weight:700;font-size:13px;text-align:right;padding:11px 14px;}
        .calc-root thead th:first-child{text-align:left;}
        .calc-root tbody td{padding:11px 14px;text-align:right;border-top:1px solid var(--line);}
        .calc-root tbody td:first-child{text-align:left;font-weight:700;}
        .calc-root tbody tr.most td{background:#FBF0E8;}
        .calc-root .pos{color:var(--win);font-weight:800;}.calc-root .neg{color:var(--lose);font-weight:800;}
        .calc-root .pct{color:var(--muted);}
        .calc-root .tag{display:inline-block;font-size:10.5px;font-weight:700;color:var(--court-deep);border:1px solid var(--court-deep);border-radius:999px;padding:1px 7px;margin-left:8px;vertical-align:1px;}
        .calc-footer{margin-top:28px;font-size:12.5px;color:var(--muted);line-height:1.8;}
        .calc-footer b{color:var(--ink);}
        @media (max-width:560px){.calc-court{grid-template-columns:1fr;gap:20px;padding:20px;}.calc-court::before{display:none;}.calc-swap{position:static;transform:none;margin:0 auto;display:block;}}
      `}</style>

      <div className="calc-wrap">
        <header>
          <span className="eyebrow">FIVB WORLD RANKING</span>
          <h1>세계랭킹 포인트 <em>계산기</em></h1>
          <p className="sub">두 팀의 WR 점수와 대회 가중치를 입력하면, 경기 결과별로 얻거나 잃는 랭킹 포인트를 FIVB 공식대로 계산합니다. 한 팀이 얻는 만큼 상대 팀이 잃습니다.</p>
        </header>

        <div className="calc-court">
          <button className="calc-swap" type="button" onClick={swap}>⇄ 홈/원정 교체</button>
          <div className="calc-side">
            <label>팀 A</label>
            <input type="text" value={nameA} onChange={(e) => setNameA(e.target.value)} />
            <label>WR 점수</label>
            <input type="number" value={wrsA} step="0.01" onChange={(e) => setWrsA(e.target.value)} />
          </div>
          <div className="calc-side">
            <label>팀 B</label>
            <input type="text" value={nameB} onChange={(e) => setNameB(e.target.value)} />
            <label>WR 점수</label>
            <input type="number" value={wrsB} step="0.01" onChange={(e) => setWrsB(e.target.value)} />
          </div>
        </div>

        <div className="calc-controls">
          <label>대회 가중치 (MWF)</label>
          <select value={mwf} onChange={(e) => setMwf(e.target.value)}>
            <option value="50">올림픽 — 50</option>
            <option value="50">FIVB 월드컵 — 50</option>
            <option value="40">발리볼네이션스리그(VNL) — 40</option>
            <option value="40">대륙선수권 — 40</option>
            <option value="30">연간 대륙 대회 — 30</option>
            <option value="20">존·인정단체 대회 — 20</option>
          </select>
        </div>

        <div className="calc-stats">
          <div className="calc-stat"><p>전력차 Δ</p><strong className="num">{result.d.toFixed(3)}</strong></div>
          <div className="calc-stat"><p>기대 결과 EMR ({nameA} 기준)</p><strong className="num">{result.emr.toFixed(3)}</strong></div>
          <div className="calc-stat"><p>{nameA} 승리 확률</p><strong className="num">{(result.winp * 100).toFixed(1)}%</strong></div>
        </div>

        <div className="calc-probbar" role="img" aria-label="6가지 경기 결과의 확률 분포">
          {result.P.map((p, i) => (
            <div key={i} style={{ width: `${(p * 100).toFixed(2)}%`, background: BARC[i] }}>
              {p >= 0.07 ? LBL[i] : ""}
            </div>
          ))}
        </div>
        <div className="calc-legend">
          <span className="lw"><b>◀ {nameA} 승</b> (3-0 · 3-1 · 3-2)</span>
          <span className="ll"><b>(2-3 · 1-3 · 0-3) {nameB} 승 ▶</b></span>
        </div>

        <table>
          <thead>
            <tr>
              <th>결과</th><th>확률</th><th>{nameA} 포인트</th><th>{nameB} 포인트</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.map((r, i) => (
              <tr key={i} className={r.most ? "most" : ""}>
                <td>{r.label}{r.most && <span className="tag">최다 예상</span>}</td>
                <td className="pct num">{(r.prob * 100).toFixed(1)}%</td>
                <td className={"num " + (r.ptsPos ? "pos" : "neg")}>{r.ptsA}</td>
                <td className={"num " + (r.ptsPos ? "neg" : "pos")}>{r.ptsB}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <footer className="calc-footer">
          <b>계산 방식</b> — Δ = 8 × (WRS_A − WRS_B) ÷ 1000 → 정규분포로 6가지 결과 확률 산출 → EMR = Σ(확률 × 세트변량) → 포인트 = (세트변량 − EMR) × MWF ÷ 8.<br />
          세트변량(SSV): 3-0 = +2, 3-1 = +1.5, 3-2 = +1, 2-3 = −1, 1-3 = −1.5, 0-3 = −2.<br />
          ※ 컷포인트 C1~C5는 FIVB가 공개하지 않아 대칭 분포 추정치(±1.06, ±0.394, 0)를 사용했습니다. 실제 공식 포인트와 1~2점 내외의 오차가 있을 수 있습니다.
        </footer>
      </div>
    </div>
  );
}
