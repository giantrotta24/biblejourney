import { ProgressStrip } from "@/components/progress-strip";
import { TodayView } from "@/components/today-view";

export default function TodayPage() {
  return (
    <>
      <h1 className="sr-only">Today</h1>
      <ProgressStrip />
      <TodayView />
    </>
  );
}
