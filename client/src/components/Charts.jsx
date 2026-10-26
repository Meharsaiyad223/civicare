import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const colors = ['#42bea1', '#f4ad65', '#6ca9e9', '#a78bfa', '#7d91a6'];

export function CategoryChart({ reports = [], counts }) {
  const values = counts || reports.reduce((result, report) => {
    result[report.category] = (result[report.category] || 0) + 1;
    return result;
  }, {});
  const chartData = Object.entries(values).map(([category, count]) => ({ category: category.replaceAll('_', ' '), count }));
  return (
    <section className="panel-card chart-card">
      <div className="section-heading"><div><p className="eyebrow">REPORT MIX</p><h3>Issues by category</h3></div><span className="chart-caption">Current view</span></div>
      {chartData.length ? <ResponsiveContainer width="100%" height={230}>
        <BarChart data={chartData} margin={{ top: 10, right: 8, left: -20, bottom: 10 }}>
          <CartesianGrid vertical={false} stroke="#e8eeeb" />
          <XAxis dataKey="category" tickLine={false} axisLine={false} tick={{ fill: '#6b7c8b', fontSize: 11 }} interval={0} angle={-8} textAnchor="end" height={42} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#8b98a4', fontSize: 11 }} />
          <Tooltip cursor={{ fill: '#f2f7f5' }} contentStyle={{ border: '1px solid #e6ece9', borderRadius: 12, boxShadow: '0 12px 30px #23353312' }} />
          <Bar dataKey="count" name="Reports" radius={[7, 7, 2, 2]} maxBarSize={42}>{chartData.map((entry, index) => <Cell key={entry.category} fill={colors[index % colors.length]} />)}</Bar>
        </BarChart>
      </ResponsiveContainer> : <div className="empty-chart">New reports will appear here.</div>}
    </section>
  );
}

export function RecurrenceStat({ count = 0, total = 0 }) {
  const rate = total ? Math.round((count / total) * 100) : 0;
  return <div className="recurrence-stat"><div className="recurrence-ring" style={{ '--rate': `${rate * 3.6}deg` }}><span>{rate}%</span></div><div><small>REOCCURRED</small><strong>{count} of {total} reports</strong><p>Repeat issues after a repair</p></div></div>;
}
