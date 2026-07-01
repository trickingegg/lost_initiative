interface HealthBarProps {
  current: number;
  max: number;
}

export default function HealthBar({ current, max }: HealthBarProps) {
  const percentage = max > 0 ? (current / max) * 100 : 0;
  const color =
    percentage < 25 ? "bg-red-500" : percentage < 50 ? "bg-yellow-500" : "bg-green-500";

  return (
    <div>
      <div className="flex justify-between items-center mb-1 text-sm">
        <span className="font-bold text-gray-400">Health</span>
        <span className="font-mono">{current} / {max}</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-4">
        <div
          className={`${color} h-4 rounded-full transition-all duration-500 ease-out`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
