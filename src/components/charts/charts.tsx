"use client";

import { useId, useState } from "react";

/**
 * Dependency-free SVG charts.
 *
 * Hand-rolled rather than pulling in a charting library for two reasons: most
 * of them handle RTL poorly (axis direction, label anchoring, tooltip flip),
 * and adding one would be a stack change. SVG geometry is unaffected by
 * `dir="rtl"`, so every coordinate here is explicit — which is exactly what an
 * RTL chart needs.
 *
 * TIME DIRECTION: series run right-to-left — oldest month at the right edge —
 * matching the reading direction of the rest of the app. Flip `RTL_TIME` to
 * false for the international left-to-right convention.
 *
 * Palette: validated with the dataviz palette checker (six checks, light and
 * dark). Categorical hues are assigned in fixed order and never cycled; the
 * 7th+ series would fold into "أخرى" rather than generating a hue. Status
 * colours are reserved and never reused as categorical slots.
 */

const RTL_TIME = true;

const arNum = (n: number) => n.toLocaleString("ar-SA");

/** Halalas → a short Arabic-Indic riyal label for axis ticks. */
function shortSar(halalas: number): string {
  const r = halalas / 100;
  if (Math.abs(r) >= 1_000_000) return `${arNum(Math.round(r / 100_000) / 10)}م`;
  if (Math.abs(r) >= 1_000) return `${arNum(Math.round(r / 100) / 10)}أ`;
  return arNum(Math.round(r));
}

const fullSar = (halalas: number) => `${arNum(Math.round(halalas / 100))} ر.س`;

// ── frame ───────────────────────────────────────────────────────────────

export function ChartFrame({
  title,
  hint,
  legend,
  children,
}: {
  title: string;
  hint?: string;
  legend?: Array<{ label: string; color: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="chart-card">
      <header className="chart-head">
        <h2>{title}</h2>
        {legend && legend.length >= 2 && (
          <ul className="chart-legend">
            {legend.map((l) => (
              <li key={l.label}>
                <span className="swatch" style={{ background: l.color }} aria-hidden="true" />
                {l.label}
              </li>
            ))}
          </ul>
        )}
      </header>
      {hint && <p className="chart-hint">{hint}</p>}
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="chart-empty">{children}</div>;
}

// ── time series (1 or 2 series) ─────────────────────────────────────────

type Tip = { x: number; y: number; rows: Array<{ label: string; value: string }>; head: string };

export function TimeSeries({
  points,
  series,
  money = false,
  emptyLabel,
}: {
  points: Array<{ key: string; label: string; values: number[] }>;
  series: Array<{ label: string; color: string }>;
  money?: boolean;
  emptyLabel: string;
}) {
  const gid = useId().replace(/:/g, "");
  const [tip, setTip] = useState<Tip | null>(null);

  const total = points.reduce((s, p) => s + p.values.reduce((a, b) => a + b, 0), 0);
  if (points.length === 0 || total === 0) return <Empty>{emptyLabel}</Empty>;

  const W = 720;
  const H = 220;
  const padX = 44;
  const padTop = 14;
  const padBottom = 28;
  const plotW = W - padX * 2;
  const plotH = H - padTop - padBottom;

  const max = Math.max(...points.flatMap((p) => p.values), 1);
  const niceMax = Math.ceil(max / 4) * 4 || 4;

  const xAt = (i: number) => {
    const t = points.length === 1 ? 0.5 : i / (points.length - 1);
    return RTL_TIME ? W - padX - t * plotW : padX + t * plotW;
  };
  const yAt = (v: number) => padTop + plotH - (v / niceMax) * plotH;

  const fmt = money ? fullSar : arNum;
  const tickFmt = money ? shortSar : arNum;

  return (
    <div className="chart-wrap">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="chart-svg"
        role="img"
        aria-label={series.map((s) => s.label).join("، ")}
        onMouseLeave={() => setTip(null)}
      >
        <defs>
          {series.map((s, si) => (
            <linearGradient key={si} id={`${gid}-f${si}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.18" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0.01" />
            </linearGradient>
          ))}
        </defs>

        {/* recessive gridlines + y ticks */}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const y = padTop + plotH - f * plotH;
          return (
            <g key={f}>
              <line x1={padX} x2={W - padX} y1={y} y2={y} className="chart-grid" />
              <text
                x={RTL_TIME ? W - padX + 8 : padX - 8}
                y={y + 4}
                className="chart-tick"
                textAnchor={RTL_TIME ? "start" : "end"}
              >
                {tickFmt(Math.round(niceMax * f))}
              </text>
            </g>
          );
        })}

        {/* areas then lines, so lines sit above every fill */}
        {series.map((s, si) => {
          const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${xAt(i)},${yAt(p.values[si] ?? 0)}`).join(" ");
          const area = `${d} L${xAt(points.length - 1)},${padTop + plotH} L${xAt(0)},${padTop + plotH} Z`;
          return <path key={`a${si}`} d={area} fill={`url(#${gid}-f${si})`} />;
        })}
        {series.map((s, si) => (
          <path
            key={`l${si}`}
            d={points.map((p, i) => `${i === 0 ? "M" : "L"}${xAt(i)},${yAt(p.values[si] ?? 0)}`).join(" ")}
            className="chart-line"
            stroke={s.color}
          />
        ))}

        {/* hover columns + markers */}
        {points.map((p, i) => {
          const cx = xAt(i);
          const colW = plotW / Math.max(points.length - 1, 1);
          return (
            <g key={p.key}>
              <rect
                x={cx - colW / 2}
                y={padTop}
                width={colW}
                height={plotH}
                fill="transparent"
                onMouseEnter={() =>
                  setTip({
                    x: (cx / W) * 100,
                    y: (yAt(Math.max(...p.values)) / H) * 100,
                    head: p.label,
                    rows: series.map((s, si) => ({ label: s.label, value: fmt(p.values[si] ?? 0) })),
                  })
                }
              />
              {series.map((s, si) => (
                <circle
                  key={si}
                  cx={cx}
                  cy={yAt(p.values[si] ?? 0)}
                  r={tip?.head === p.label ? 5 : 0}
                  fill={s.color}
                  className="chart-marker"
                />
              ))}
            </g>
          );
        })}

        {/* x labels — every other bucket, so they never collide */}
        {points.map((p, i) =>
          i % 2 === 0 ? (
            <text key={p.key} x={xAt(i)} y={H - 8} className="chart-tick" textAnchor="middle">
              {p.label}
            </text>
          ) : null,
        )}
      </svg>

      {tip && (
        <div
          className="chart-tip"
          style={{ insetInlineStart: `${RTL_TIME ? 100 - tip.x : tip.x}%`, top: `${tip.y}%` }}
        >
          <strong>{tip.head}</strong>
          {tip.rows.map((r) => (
            <span key={r.label}>
              {r.label}: {r.value}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── horizontal bars (categorical magnitude) ─────────────────────────────

export function HorizontalBars({
  items,
  palette,
  emptyLabel,
}: {
  items: Array<{ label: string; value: number }>;
  palette: readonly string[];
  emptyLabel: string;
}) {
  if (items.length === 0) return <Empty>{emptyLabel}</Empty>;
  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <ul className="hbars">
      {items.map((it, i) => (
        <li key={it.label}>
          <span className="hbar-label">{it.label}</span>
          <span className="hbar-track">
            <span
              className="hbar-fill"
              style={{
                width: `${Math.max((it.value / max) * 100, 2)}%`,
                background: palette[i % palette.length],
              }}
            />
          </span>
          <span className="hbar-value">{arNum(it.value)}</span>
        </li>
      ))}
    </ul>
  );
}

// ── status bars (reserved status palette, never categorical) ────────────

export function StatusBars({
  items,
  emptyLabel,
}: {
  items: Array<{ label: string; value: number; tone: "critical" | "serious" | "warning" | "good" }>;
  emptyLabel: string;
}) {
  const total = items.reduce((s, i) => s + i.value, 0);
  if (total === 0) return <Empty>{emptyLabel}</Empty>;
  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <ul className="hbars">
      {items.map((it) => (
        <li key={it.label}>
          <span className="hbar-label">
            <span className={`status-dot tone-${it.tone}`} aria-hidden="true" />
            {it.label}
          </span>
          <span className="hbar-track">
            <span
              className={`hbar-fill tone-${it.tone}`}
              style={{ width: `${Math.max((it.value / max) * 100, 2)}%` }}
            />
          </span>
          <span className="hbar-value">{arNum(it.value)}</span>
        </li>
      ))}
    </ul>
  );
}
