export type PreviewSettings = { variant: string; view: string; paused: boolean; color: string; accent: string; size: number; theme: string }

// Only trusted framework code wraps the generated program. No same-origin permission
// is granted to the iframe; CSP blocks fetches, images, forms, and nested frames.
export function previewDocument(javascript: string, origin: string) {
  const safeOrigin = new URL(origin).origin.replace(/"/g, "&quot;")
  return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' ${safeOrigin}; style-src 'unsafe-inline' ${safeOrigin}; connect-src 'none'; img-src data:; font-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'; worker-src 'none'">
<link rel="stylesheet" href="${safeOrigin}/builder-runtime.css">
<style>
:root { --robot-shell:#f38b4a; --robot-metal:#bfc5cf; --robot-dark:#35404f; --robot-accent:#30bfa9; --robot-glow:#53ddca; --robot-grid:#82909d; --foreground:#222; --background:#fff; }
* { box-sizing:border-box } html,body,#root { margin:0;width:100%;height:100%;overflow:hidden } body { font-family:system-ui;color:var(--foreground);background:transparent } #root { display:flex;align-items:center;justify-content:center } svg { max-width:95%;max-height:95%;overflow:visible } button { cursor:pointer }
.robocn-spin { animation:spin 1.1s linear infinite }.robocn-pulse { animation:pulse 1.1s ease-in-out infinite }.robocn-blink { animation:blink 5.4s ease-in-out infinite }.robocn-scan { animation:scan 1.6s ease-in-out infinite }
@keyframes spin { to{transform:rotate(360deg)} } @keyframes pulse {50%{opacity:.45}} @keyframes blink {0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.08)}} @keyframes scan {0%,100%{transform:rotate(-16deg)}50%{transform:rotate(16deg)}}
html[data-paused="true"] * { animation-play-state:paused!important }
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
</style></head><body><div id="root"></div>
<script>window.addEventListener('error',e=>parent.postMessage({type:'robocn-error',message:String(e.message).slice(0,4000)},'*'));window.addEventListener('unhandledrejection',e=>parent.postMessage({type:'robocn-error',message:String(e.reason).slice(0,4000)},'*'));</script>
<script src="${safeOrigin}/builder-runtime.js" onerror="parent.postMessage({type:'robocn-error',message:'Preview runtime could not load. Retry the preview.'},'*')"></script>
<script>${javascript.replace(/<\/script/gi, "<\\/script")}</script>
<script>
const React=window.__robocn['react'];
const root=window.__robocn['react-dom/client'].createRoot(document.getElementById('root'));
class Boundary extends React.Component {
  constructor(p){super(p);this.state={error:false}}
  static getDerivedStateFromError(){return {error:true}}
  componentDidCatch(e){parent.postMessage({type:'robocn-error',message:String(e.message).slice(0,4000)},'*')}
  render(){return this.state.error?React.createElement('p',null,'This version needs a small repair.'):this.props.children}
}
function Rendered({settings}){
  React.useEffect(()=>{parent.postMessage({type:'robocn-ready'},'*')},[]);
  return React.createElement(window.__Robot,{...settings,view:settings.view==='native'?undefined:settings.view,interactive:true});
}
function render(settings){
  const dark=settings.theme==='dark';
  document.documentElement.classList.toggle('dark',dark);
  document.documentElement.style.setProperty('--foreground',dark?'#e6e9ed':'#222');
  document.documentElement.style.setProperty('--background',dark?'#181b1f':'#fff');
  document.documentElement.style.setProperty('--robot-shell',settings.color);
  document.documentElement.style.setProperty('--robot-accent',settings.accent);
  document.documentElement.dataset.paused=String(settings.paused);
  root.render(React.createElement(Boundary,null,React.createElement(Rendered,{settings})));
}
window.addEventListener('message',e=>{if(e.source===parent&&e.data?.type==='robocn-settings')render(e.data.settings)});
parent.postMessage({type:'robocn-loaded'},'*');
</script></body></html>`
}
