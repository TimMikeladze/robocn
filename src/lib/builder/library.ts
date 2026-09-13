import generated from "./generated.json"

export type LibraryComponent = { id: string; title: string; description: string }
export const libraryComponents: LibraryComponent[] = Object.values(generated.modules)
  .filter(mod => mod.type === "registry:ui" && mod.item)
  .map(mod => ({ id: mod.item!, title: mod.title, description: mod.description }))
  .sort((a, b) => a.title.localeCompare(b.title))

export function loadLibraryComponent(id: string) {
  const mod = Object.values(generated.modules).find(mod => mod.item === id && mod.type === "registry:ui")
  if (!mod) return null
  const component = mod.exports.find(name => /^[A-Z][a-z][A-Za-z0-9]*$/.test(name))
  if (!component) return null
  let imports = ""
  let preview = `export default ${component}`
  if (id === "robot-arm-3d") {
    imports = 'import { RobotStage as BuilderStage } from "@/components/ui/robot-stage";'
    preview = `export default function Preview(props: React.ComponentProps<typeof ${component}>) { return <BuilderStage style={{width:"100%",height:"100%"}}><${component} {...props} /></BuilderStage> }`
  } else if (id === "robot-stage") {
    imports = 'import { RobotArm3D as BuilderArm } from "@/components/ui/robot-arm-3d";'
    preview = `export default function Preview(props: {color?:string;accent?:string;paused?:boolean}) { return <${component} color={props.color} accent={props.accent} style={{width:"100%",height:"100%"}}><BuilderArm {...props} /></${component}> }`
  } else if (id === "arm-controls") {
    imports = 'import { RobotArm as BuilderArm } from "@/components/ui/robot-arm";'
    preview = `export default function Preview(props: {color?:string;accent?:string;paused?:boolean}) { const [angles,setAngles]=React.useState([35,-65,25]); return <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",justifyContent:"center",gap:12,width:"100%",height:"100%",overflow:"auto",padding:16}}><BuilderArm {...props} angles={angles} size={200}/><${component} angles={angles} onAnglesChange={setAngles} style={{width:280}} /></div> }`
  } else if (id === "lidar-scan") {
    preview = `// Illustrative room samples; replace with real sensor returns in your app.\nexport default function Preview(props: React.ComponentProps<typeof ${component}>) { return <${component} {...props} samples={Array.from({length:72},(_,i)=>({angle:i*5,distance:5+2*Math.sin(i*.35)}))} aria-label="Lidar scan with illustrative room samples" /> }`
  }
  return { code: `${mod.source}\n\n// Sandbox entry point. The component above is the library's actual source.\n${imports}\n${preview}\n`, name: id, explanation: `Loaded ${mod.title} from the robocn library. You're editing its actual source; the original library component is unchanged.` }
}
