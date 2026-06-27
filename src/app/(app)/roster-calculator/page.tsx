import { getRosterCalcData } from '@/modules/roster-calculator/server/queries';
import { RosterCalculatorClient } from './RosterCalculatorClient';

export default async function RosterCalculatorPage() {
  const data = await getRosterCalcData();
  return <RosterCalculatorClient data={data} />;
}
