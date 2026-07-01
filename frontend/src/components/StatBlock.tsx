interface StatBlockProps {
  label: string;
  score: number;
  modifier: number;
}

export default function StatBlock({ label, score, modifier }: StatBlockProps) {
  const sign = modifier >= 0 ? "+" : "";
  return (
    <div className="bg-gray-800 p-2 rounded text-center">
      <div className="font-bold text-xs text-gray-400">{label}</div>
      <div className="text-xl font-mono">{score}</div>
      <div className="text-amber-400 font-mono text-sm">{sign}{modifier}</div>
    </div>
  );
}
