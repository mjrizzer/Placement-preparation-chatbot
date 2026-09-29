'use client';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
export default function ProgressChart({ data }: { data: { date: string; score: number }[] }) {
  return (
    <div
      className="chart"
      role="img"
      aria-label={'Progress scores: ' + data.map((d) => d.date + ' ' + d.score + '%').join(', ')}
    >
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data} margin={{ top: 15, right: 10, left: -24, bottom: 0 }}>
          <defs>
            <linearGradient id="score-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#16a079" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#16a079" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="4 5" vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="date"
            tickFormatter={(s) =>
              new Date(s).toLocaleDateString('en', { month: 'short', day: 'numeric' })
            }
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: '#87908f' }}
            minTickGap={30}
          />
          <YAxis
            domain={[0, 100]}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: '#87908f' }}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: '1px solid #e0e7e3',
              background: 'var(--surface)',
              color: 'var(--text)',
            }}
          />
          <Area
            type="monotone"
            dataKey="score"
            name="Score"
            stroke="#159770"
            fill="url(#score-fill)"
            strokeWidth={2.5}
            dot={{ r: 3, fill: '#159770' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
