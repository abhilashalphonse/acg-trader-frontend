function ToolIcon({ size=18, strokeWidth=1.65, className='', children }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" focusable="false">{children}</svg>;
}
function Anchor({cx,cy,r=1.55}) { return <circle cx={cx} cy={cy} r={r} fill="currentColor" stroke="none"/>; }
export function CursorToolIcon(p){return <ToolIcon {...p}><circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5"/></ToolIcon>;}
export function TrendLineToolIcon(p){return <ToolIcon {...p}><path d="M4 18.5 20 5.5"/><Anchor cx="4" cy="18.5"/><Anchor cx="20" cy="5.5"/></ToolIcon>;}
export function RayToolIcon(p){return <ToolIcon {...p}><path d="M4 18.5 21 4.7"/><Anchor cx="4" cy="18.5"/><circle cx="10.3" cy="13.4" r="1.45" fill="#09090b"/></ToolIcon>;}
export function ExtendedLineToolIcon(p){return <ToolIcon {...p}><path d="M2.3 20.7 21.7 3.3"/><Anchor cx="8.1" cy="15.5"/><Anchor cx="15.8" cy="8.6"/></ToolIcon>;}
export function HorizontalLineToolIcon(p){return <ToolIcon {...p}><path d="M2.5 12h19"/><Anchor cx="12" cy="12"/></ToolIcon>;}
export function HorizontalRayToolIcon(p){return <ToolIcon {...p}><path d="M5 12h16.5"/><Anchor cx="5" cy="12"/></ToolIcon>;}
export function VerticalLineToolIcon(p){return <ToolIcon {...p}><path d="M12 2.5v19"/><Anchor cx="12" cy="12"/></ToolIcon>;}
export function RulerToolIcon(p){return <ToolIcon {...p}><path d="m5 16.8 11.8-11.8 3.2 3.2L8.2 20 5 16.8Z"/><path d="m9 15 1.8 1.8M11.4 12.6l1.3 1.3M13.8 10.2l1.8 1.8M16.2 7.8l1.3 1.3"/></ToolIcon>;}
export function RectangleToolIcon(p){return <ToolIcon {...p}><rect x="4.5" y="5" width="15" height="14" rx=".6"/><Anchor cx="4.5" cy="5" r="1.25"/><Anchor cx="19.5" cy="19" r="1.25"/></ToolIcon>;}
export function FibonacciToolIcon(p){return <ToolIcon {...p}><path d="M5 19 19 5" opacity=".7"/><path d="M4 6.5h16M4 9.5h16M4 12h16M4 14.5h16M4 17.5h16"/><Anchor cx="5" cy="19" r="1.2"/><Anchor cx="19" cy="5" r="1.2"/></ToolIcon>;}
export function TextToolIcon(p){return <ToolIcon {...p}><path d="M5 5.5h14M12 5.5v13M8.7 18.5h6.6"/></ToolIcon>;}
export function LongPositionToolIcon(p){return <ToolIcon {...p}><rect x="4" y="4" width="16" height="7.5" rx=".8"/><rect x="4" y="12.5" width="16" height="7.5" rx=".8"/><path d="M4 12h16M12 10V6.2M12 6.2 9.8 8.4M12 6.2l2.2 2.2"/></ToolIcon>;}
export function ShortPositionToolIcon(p){return <ToolIcon {...p}><rect x="4" y="4" width="16" height="7.5" rx=".8"/><rect x="4" y="12.5" width="16" height="7.5" rx=".8"/><path d="M4 12h16M12 14v3.8M12 17.8 9.8 15.6M12 17.8l2.2-2.2"/></ToolIcon>;}
export const DRAWING_TOOL_ICONS=Object.freeze({
  cursor:CursorToolIcon, trendline:TrendLineToolIcon, ray:RayToolIcon, 'extended-line':ExtendedLineToolIcon,
  hline:HorizontalLineToolIcon, 'horizontal-ray':HorizontalRayToolIcon, vline:VerticalLineToolIcon, ruler:RulerToolIcon,
  rectangle:RectangleToolIcon, fibonacci:FibonacciToolIcon, text:TextToolIcon,
  'long-position':LongPositionToolIcon, 'short-position':ShortPositionToolIcon,
});
