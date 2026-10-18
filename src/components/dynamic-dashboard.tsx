import type {ReactNode} from 'react'
import {resolveDashboardWidgets,type DashboardContext,type DashboardEvent,type DashboardWidget} from '@/lib/dashboard-dynamics'
export default function DynamicDashboard({context,events,widgets,className='space-y-5'}:{context:DashboardContext;events:readonly DashboardEvent[];widgets:readonly DashboardWidget<ReactNode>[];className?:string}){
 const ordered=resolveDashboardWidgets(widgets,events,context)
 return <div className={className}>{ordered.map(widget=><div key={widget.id} data-dashboard-widget={widget.id}>{widget.content}</div>)}</div>
}
