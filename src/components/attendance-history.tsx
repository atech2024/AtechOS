import {schoolDate,schoolTime} from '@/lib/school-date'
import {T} from '@/components/translation-provider'
type Record={date:string;status:string;check_in_at:string|null;check_out_at:string|null}
export default function AttendanceHistory({records}:{records:Record[]}){
 return <details className="my-5 rounded-xl border bg-white p-4"><summary className="cursor-pointer font-semibold"><T text="Daily attendance"/></summary><div className="overflow-x-auto"><table className="my-3 w-full text-left"><thead><tr><th>Date</th><th><T text="Status"/></th><th><T text="Check-in"/></th><th><T text="Check-out"/></th></tr></thead><tbody>{[...records].sort((a,b)=>b.date.localeCompare(a.date)).map(r=><tr key={r.date} className="border-t"><td className="py-3">{schoolDate(r.date)}</td><td><T text={r.status}/></td><td>{schoolTime(r.check_in_at)}</td><td>{schoolTime(r.check_out_at)}</td></tr>)}</tbody></table></div>{!records.length&&<p><T text="No attendance recorded for this selection."/></p>}</details>
}
