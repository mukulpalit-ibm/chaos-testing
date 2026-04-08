import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface RequestChartProps {
  data: Array<{ time: string; requests: number; chaos: number }>;
}

export function RequestChart({ data }: RequestChartProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Request Timeline</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="requests" stroke="#3B82F6" name="Total Requests" />
          <Line type="monotone" dataKey="chaos" stroke="#EF4444" name="Chaos Injected" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// Made with Bob
