interface MetricCardProps {
  title: string;
  value: string | number;
  icon?: string;
  color?: string;
}

export function MetricCard({ title, value, icon, color = 'primary' }: MetricCardProps) {
  const colorClasses = {
    primary: 'border-primary',
    success: 'border-success',
    warning: 'border-warning',
    danger: 'border-danger',
  };

  return (
    <div className={`bg-white rounded-lg shadow p-6 border-l-4 ${colorClasses[color as keyof typeof colorClasses] || colorClasses.primary}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
        </div>
        {icon && (
          <div className="text-4xl opacity-20">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

// Made with Bob
