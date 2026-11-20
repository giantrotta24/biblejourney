import { TimelineView } from '@/components/reference-views';
import { useProgress } from '@/progress/context';

export default function TimelineRoute() {
  const { days } = useProgress();
  return <TimelineView done={days} />;
}
