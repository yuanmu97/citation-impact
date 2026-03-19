interface Props {
  steps: string[];
  current: number;
  onStepClick: (index: number) => void;
}

export default function StepWizard({ steps, current, onStepClick }: Props) {
  return (
    <div className="flex items-center justify-center gap-2">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} className="flex items-center gap-2">
            {i > 0 && (
              <div className={`w-8 h-0.5 ${done ? 'bg-primary-500' : 'bg-gray-200'}`} />
            )}
            <button
              type="button"
              onClick={() => onStepClick(i)}
              disabled={i > current}
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition
                ${active ? 'bg-primary-600 text-white shadow' : ''}
                ${done ? 'bg-primary-100 text-primary-700 cursor-pointer hover:bg-primary-200' : ''}
                ${!active && !done ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}
              `}
            >
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border border-current/20">
                {done ? '✓' : i + 1}
              </span>
              <span className="hidden sm:inline">{label}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
