import React, { useEffect, useState, useRef } from 'react';

export const TelemetryWidget: React.FC = () => {
  const [dataPoints, setDataPoints] = useState<number[]>([30, 40, 35, 50, 45, 40, 60, 50, 55, 45]);
  const [latency, setLatency] = useState(45);
  const [cpu, setCpu] = useState(12);
  const spikeRef = useRef<number>(0);

  useEffect(() => {
    // Periodically update graph data points
    const interval = setInterval(() => {
      setDataPoints((prev) => {
        let nextVal = 30 + Math.random() * 30;

        // If there's an active spike, use it and decay it
        if (spikeRef.current > 0) {
          nextVal = spikeRef.current;
          spikeRef.current = Math.max(0, spikeRef.current - 12);
        }

        const next = [...prev.slice(1), nextVal];
        return next;
      });

      // Update CPU & Latency readouts
      setLatency(Math.floor(25 + Math.random() * 30 + (spikeRef.current > 0 ? 40 : 0)));
      setCpu(Math.floor(8 + Math.random() * 8 + (spikeRef.current / 5)));
    }, 400);

    // Global listener for actions that spike telemetry (typing, sending message)
    const handleSpike = () => {
      spikeRef.current = 92;
    };
    (window as any).triggerTelemetrySpike = handleSpike;

    return () => {
      clearInterval(interval);
      delete (window as any).triggerTelemetrySpike;
    };
  }, []);

  // Generate SVG path coordinate strings
  const width = 140;
  const height = 30;
  const maxVal = 100;

  const points = dataPoints.map((val, idx) => {
    const x = (idx / (dataPoints.length - 1)) * width;
    const y = height - (val / maxVal) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="telemetry-widget" style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '0.45rem 1rem',
      backgroundColor: 'rgba(0, 0, 0, 0.2)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-md)',
      fontFamily: 'Consolas, monospace',
      fontSize: '0.7rem',
      color: 'var(--text-secondary)',
      userSelect: 'none',
      backdropFilter: 'blur(8px)',
      boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.4)'
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <span>CPU: <span style={{ color: cpu > 30 ? 'var(--accent)' : 'var(--online)', fontWeight: 600 }}>{cpu}%</span></span>
          <span>PING: <span style={{ color: 'var(--online)' }}>{latency}ms</span></span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <span>HUD: <span style={{ color: 'var(--accent-hover)' }}>SYNCED</span></span>
          <span>NET: <span style={{ color: '#3b82f6' }}>SECURE</span></span>
        </div>
      </div>

      <div style={{ position: 'relative', width: `${width}px`, height: `${height}px` }}>
        {/* SVG Sparkline Graph */}
        <svg width={width} height={height} style={{ overflow: 'visible' }}>
          <defs>
            <linearGradient id="sparklineGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.5" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          
          {/* Filled Area */}
          <polygon
            points={`0,${height} ${points} ${width},${height}`}
            fill="url(#sparklineGradient)"
          />
          
          {/* Stroke Line */}
          <polyline
            fill="none"
            stroke="var(--accent)"
            strokeWidth="1.5"
            points={points}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
};
