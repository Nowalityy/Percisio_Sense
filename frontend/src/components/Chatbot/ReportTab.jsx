import { ReportInput } from './ReportInput';

export default function ReportTab() {
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 app-scrollbar">
        <ReportInput embedded />
      </div>
    </div>
  );
}
