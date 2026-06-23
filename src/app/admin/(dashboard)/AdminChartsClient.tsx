'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

interface SalesPoint {
  date: string;
  amount: number;
}

interface StatusPoint {
  status: string;
  count: number;
}

interface DonutSegment extends StatusPoint {
  percent: number;
  strokeDasharray: string;
  strokeDashoffset: number;
  color: string;
}

interface ProductPoint {
  name: string;
  quantity: number;
}

interface AdminChartsProps {
  salesData: SalesPoint[];
  statusData: StatusPoint[];
  topProducts: ProductPoint[];
  period: string;
  periodLabel: string;
}

const PERIOD_OPTIONS = [
  { key: 'today', label: 'Hoy' },
  { key: '7d',    label: '7 días' },
  { key: '30d',   label: '30 días' },
  { key: '365d',  label: 'Este año' },
];

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente ⏳',
  paid: 'Pagado 💳',
  processing: 'Procesando ⚙️',
  shipped: 'Enviado 🚚',
  delivered: 'Entregado ✅',
  cancelled: 'Cancelado ❌',
};

const STATUS_COLORS: Record<string, string> = {
  pending: '#F1C40F',
  paid: '#9B59B6',
  processing: '#3498DB',
  shipped: '#E67E22',
  delivered: '#2ECC71',
  cancelled: '#E74C3C',
};

export default function AdminChartsClient({ salesData, statusData, topProducts, period, periodLabel }: AdminChartsProps) {
  const [hoveredSalesIndex, setHoveredSalesIndex] = useState<number | null>(null);
  const [hoveredStatus, setHoveredStatus] = useState<DonutSegment | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [animateBars, setAnimateBars] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setPeriod = (p: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('period', p);
    router.push(`${pathname}?${params.toString()}`);
  };

  useEffect(() => {
    setIsMounted(true);
    const timer = setTimeout(() => setAnimateBars(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  // 1. Sales Trend calculations (SVG Spline Line/Area)
  const width = 500;
  const height = 220;
  const paddingLeft = 55;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 35;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const amounts = salesData.map((d) => d.amount);
  const maxAmount = Math.max(...amounts, 10);

  const numPoints = salesData.length;
  const points = salesData.map((d, i) => {
    const x = paddingLeft + (numPoints > 1 ? (i / (numPoints - 1)) : 0.5) * chartWidth;
    const y = height - paddingBottom - (d.amount / maxAmount) * chartHeight;
    return { x, y, date: d.date, amount: d.amount };
  });

  // Calculate Cubic Bezier Smooth Spline Paths
  const getBezierPath = (pts: typeof points) => {
    if (pts.length === 0) return '';
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
    let path = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const curr = pts[i];
      const next = pts[i + 1];
      const cpX1 = curr.x + (next.x - curr.x) / 3;
      const cpY1 = curr.y;
      const cpX2 = curr.x + 2 * (next.x - curr.x) / 3;
      const cpY2 = next.y;
      path += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${next.x} ${next.y}`;
    }
    return path;
  };

  const getBezierAreaPath = (pts: typeof points) => {
    if (pts.length === 0) return '';
    const spline = getBezierPath(pts);
    return `${spline} L ${pts[pts.length - 1].x} ${height - paddingBottom} L ${pts[0].x} ${height - paddingBottom} Z`;
  };

  const linePath = getBezierPath(points);
  const areaPath = getBezierAreaPath(points);

  // 2. Status Donut calculations
  const totalOrders = statusData.reduce((acc, curr) => acc + curr.count, 0);
  const radius = 65;
  const cx = 90;
  const cy = 90;
  const circumference = 2 * Math.PI * radius;

  let accumulatedPercent = 0;
  const donutSegments = statusData.map((d) => {
    const percent = totalOrders > 0 ? d.count / totalOrders : 0;
    const strokeDasharray = `${percent * circumference} ${circumference}`;
    const strokeDashoffset = -accumulatedPercent * circumference;
    const color = STATUS_COLORS[d.status] || '#95A5A6';
    
    accumulatedPercent += percent;

    return {
      ...d,
      percent,
      strokeDasharray,
      strokeDashoffset,
      color,
    };
  });

  // 3. Top Products max qty
  const maxProductQty = Math.max(...topProducts.map((p) => p.quantity), 1);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .charts-grid {
          display: grid;
          grid-template-columns: 1.6fr 1fr;
          gap: 1.5rem;
          margin-bottom: 2rem;
        }
        @media (max-width: 1024px) {
          .charts-grid {
            grid-template-columns: 1fr;
          }
        }
        .chart-card {
          background: rgba(30, 30, 42, 0.45);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1.5px solid rgba(212, 175, 55, 0.12);
          border-radius: 16px;
          padding: 1.5rem;
          position: relative;
          display: flex;
          flex-direction: column;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
          transition: transform 0.2s ease, border-color 0.2s ease;
        }
        .chart-card:hover {
          border-color: rgba(212, 175, 55, 0.25);
        }
        .chart-card h3 {
          margin-top: 0;
          margin-bottom: 1.2rem;
          font-size: 1rem;
          font-weight: 700;
          color: var(--text);
          display: flex;
          align-items: center;
          gap: 0.5rem;
          letter-spacing: 0.02em;
        }
        .chart-tooltip {
          position: absolute;
          background: rgba(18, 18, 26, 0.96);
          border: 1.5px solid var(--gold);
          color: var(--text);
          padding: 0.6rem 0.9rem;
          border-radius: 10px;
          font-size: 0.8rem;
          pointer-events: none;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
          z-index: 10;
          transition: opacity 0.15s ease, transform 0.15s ease;
        }
        .donut-segment {
          transition: stroke-width 0.3s cubic-bezier(0.4, 0, 0.2, 1), filter 0.3s ease;
          cursor: pointer;
        }
        .donut-segment:hover {
          stroke-width: 14;
          filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.3));
        }
        .bar-row {
          margin-bottom: 1.2rem;
          padding: 0.4rem;
          border-radius: 8px;
          transition: background 0.2s ease;
        }
        .bar-row:hover {
          background: rgba(255, 255, 255, 0.02);
        }
        .bar-row:last-child {
          margin-bottom: 0;
        }
        .bar-label {
          display: flex;
          justify-content: space-between;
          font-size: 0.85rem;
          margin-bottom: 0.4rem;
          color: var(--text-muted);
        }
        .bar-container {
          height: 10px;
          background: rgba(255, 255, 255, 0.04);
          border-radius: 6px;
          overflow: hidden;
          position: relative;
        }
        .bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #A8861B, var(--gold), #FFE494);
          border-radius: 6px;
          transition: width 1.2s cubic-bezier(0.25, 1, 0.5, 1);
        }
        .badge-rank {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          background: rgba(212, 175, 55, 0.15);
          color: var(--gold);
          border-radius: 50%;
          font-size: 0.75rem;
          font-weight: bold;
          margin-right: 0.5rem;
          border: 1px solid rgba(212, 175, 55, 0.3);
        }
      `}} />

      <div className="charts-grid">
        {/* Sales Trend Chart */}
        <div className="chart-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '0.6rem' }}>
            <h3 style={{ margin: 0, color: 'var(--gold)' }}>📈 Historial de Ventas — {periodLabel}</h3>
            <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
              {PERIOD_OPTIONS.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setPeriod(opt.key)}
                  style={{
                    padding: '0.35rem 0.85rem',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    borderRadius: '20px',
                    border: `1.5px solid ${period === opt.key ? 'var(--gold)' : 'rgba(255,255,255,0.1)'}`,
                    background: period === opt.key ? 'rgba(212,175,55,0.16)' : 'transparent',
                    color: period === opt.key ? 'var(--gold)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    transition: 'all 0.25s ease',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ position: 'relative', width: '100%', flex: 1, minHeight: '220px' }}>
            <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" style={{ overflow: 'visible' }}>
              <defs>
                <linearGradient id="salesAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--gold)" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="var(--gold)" stopOpacity="0.0" />
                </linearGradient>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Grid Lines */}
              {Array.from({ length: 4 }).map((_, k) => {
                const yLine = paddingTop + (k / 3) * chartHeight;
                const value = maxAmount - (k / 3) * maxAmount;
                return (
                  <g key={k}>
                    <line
                      x1={paddingLeft}
                      y1={yLine}
                      x2={width - paddingRight}
                      y2={yLine}
                      stroke="rgba(255, 255, 255, 0.06)"
                      strokeDasharray="4 4"
                    />
                    <text
                      x={paddingLeft - 8}
                      y={yLine + 3}
                      fill="var(--text-muted)"
                      fontSize="9"
                      textAnchor="end"
                      fontFamily="monospace"
                    >
                      {formatCurrency(value)}
                    </text>
                  </g>
                );
              })}

              {/* Area & Spline Line */}
              {points.length > 0 && (
                <>
                  <path d={areaPath} fill="url(#salesAreaGrad)" />
                  <path 
                    d={linePath} 
                    fill="none" 
                    stroke="var(--gold)" 
                    strokeWidth="3" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    filter="url(#glow)"
                  />
                </>
              )}

              {/* Data points */}
              {points.map((p, idx) => (
                <g 
                  key={idx} 
                  onMouseEnter={() => setHoveredSalesIndex(idx)} 
                  onMouseLeave={() => setHoveredSalesIndex(null)}
                  onClick={() => setHoveredSalesIndex(hoveredSalesIndex === idx ? null : idx)}
                  style={{ cursor: 'pointer' }}
                >
                  {hoveredSalesIndex === idx && (
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r="9"
                      fill="rgba(212, 175, 55, 0.25)"
                      style={{ transition: 'all 0.15s ease' }}
                    />
                  )}
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={hoveredSalesIndex === idx ? 6 : 4.5}
                    fill={hoveredSalesIndex === idx ? 'var(--gold)' : 'var(--bg2)'}
                    stroke="var(--gold)"
                    strokeWidth="2.5"
                    style={{ transition: 'all 0.15s ease' }}
                  />
                  <text
                    x={p.x}
                    y={height - 10}
                    fill="var(--text-muted)"
                    fontSize="9.5"
                    textAnchor="middle"
                    fontWeight={hoveredSalesIndex === idx ? 'bold' : 'normal'}
                  >
                    {isMounted
                      ? (period === 'today'
                          ? p.date
                          : period === '365d'
                            ? p.date.substring(5) // Month number
                            : new Date(p.date + 'T12:00:00').toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit' }))
                      : p.date}
                  </text>
                </g>
              ))}
            </svg>

            {/* Sales Tooltip */}
            {hoveredSalesIndex !== null && points[hoveredSalesIndex] && (
              <div
                className="chart-tooltip"
                style={{
                  left: `${(points[hoveredSalesIndex].x / width) * 100}%`,
                  top: `${(points[hoveredSalesIndex].y / height) * 100 - 20}%`,
                  transform: 'translate(-50%, -100%)',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {isMounted
                    ? (period === 'today'
                        ? `Hoy, ${points[hoveredSalesIndex].date}`
                        : period === '365d'
                          ? points[hoveredSalesIndex].date
                          : new Date(points[hoveredSalesIndex].date + 'T12:00:00').toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'short' }))
                    : points[hoveredSalesIndex].date}
                </div>
                <div style={{ fontWeight: 'bold', color: 'var(--gold)', marginTop: '0.2rem', fontSize: '0.95rem' }}>
                  {formatCurrency(points[hoveredSalesIndex].amount)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Order Status Donut Chart */}
        <div className="chart-card">
          <h3 style={{ color: 'var(--gold)' }}>📦 Estado de los Pedidos</h3>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
            <div style={{ position: 'relative', width: '180px', height: '180px' }}>
              <svg width="100%" height="100%" viewBox="0 0 180 180">
                <circle
                  cx={cx}
                  cy={cy}
                  r={radius}
                  fill="none"
                  stroke="rgba(255,255,255,0.03)"
                  strokeWidth="8"
                />
                {donutSegments.map((seg, idx) => (
                  <circle
                    key={idx}
                    className="donut-segment"
                    cx={cx}
                    cy={cy}
                    r={radius}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth={hoveredStatus?.status === seg.status ? 14 : 9}
                    strokeDasharray={seg.strokeDasharray}
                    strokeDashoffset={seg.strokeDashoffset}
                    transform="rotate(-90 90 90)"
                    onMouseEnter={() => setHoveredStatus(seg)}
                    onMouseLeave={() => setHoveredStatus(null)}
                    onClick={() => setHoveredStatus(hoveredStatus?.status === seg.status ? null : seg)}
                    onTouchStart={(e) => {
                      e.preventDefault();
                      setHoveredStatus(hoveredStatus?.status === seg.status ? null : seg);
                    }}
                  />
                ))}
              </svg>

              {/* Donut Center Label */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                }}
              >
                {hoveredStatus ? (
                  <>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {STATUS_LABELS[hoveredStatus.status] || hoveredStatus.status}
                    </span>
                    <strong style={{ fontSize: '1.1rem', color: hoveredStatus.color, marginTop: '0.2rem' }}>
                      {hoveredStatus.count} ({Math.round(hoveredStatus.percent * 100)}%)
                    </strong>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pedidos Totales</span>
                    <strong style={{ fontSize: '1.4rem', color: 'var(--text)', marginTop: '0.2rem' }}>{totalOrders}</strong>
                  </>
                )}
              </div>
            </div>

            {/* Donut Legend */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 1rem', width: '100%', marginTop: '1.2rem' }}>
              {donutSegments.map((seg, idx) => (
                <div
                  key={idx}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.45rem', 
                    fontSize: '0.78rem', 
                    color: hoveredStatus?.status === seg.status ? 'var(--text)' : 'var(--text-muted)', 
                    cursor: 'pointer',
                    transition: 'color 0.2s'
                  }}
                  onMouseEnter={() => setHoveredStatus(seg)}
                  onMouseLeave={() => setHoveredStatus(null)}
                >
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: seg.color, border: '1px solid rgba(255,255,255,0.1)' }} />
                  <span style={{ textTransform: 'capitalize' }}>
                    {STATUS_LABELS[seg.status]?.split(' ')[0] || seg.status}: <strong>{seg.count}</strong>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Top Selling Products Progress List */}
      <div className="chart-card" style={{ marginBottom: '2rem' }}>
        <h3 style={{ color: 'var(--gold)' }}>⭐ Productos Más Vendidos ({periodLabel})</h3>
        {topProducts.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '1.5rem 0', textAlign: 'center' }}>
            No hay información de ventas registrada aún.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.4rem' }}>
            {topProducts.map((p, idx) => {
              const pct = (p.quantity / maxProductQty) * 100;
              return (
                <div key={idx} className="bar-row">
                  <div className="bar-label">
                    <span style={{ color: 'var(--text)', fontWeight: 600, display: 'flex', alignItems: 'center' }}>
                      <span className="badge-rank">{idx + 1}</span>
                      {p.name}
                    </span>
                    <strong style={{ color: 'var(--gold)', fontSize: '0.9rem' }}>{p.quantity} {p.quantity === 1 ? 'unidad' : 'unidades'}</strong>
                  </div>
                  <div className="bar-container">
                    <div className="bar-fill" style={{ width: animateBars ? `${pct}%` : '0%' }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
