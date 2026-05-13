import React from 'react'
import {
  Folder, FolderOpen, ChevronRight, ChevronDown, Plus, X, Search,
  Terminal, Zap, Sparkles, GitCommitHorizontal, GitBranch, GitFork, Settings,
  ArrowUpRight, Bookmark, TriangleAlert, Check, Loader, Copy, Send,
  MoreHorizontal, Pencil, Trash2, GripVertical, Shield, ShieldPlus, File,
  HardDrive, Moon, Sun, Mic, LogOut, LayoutDashboard, LayoutList, FileCode2,
  Wand2, Play, Cpu, FileCheck2, ScrollText, Image, Keyboard, Table2, FilePlus,
  ExternalLink, Download, FileText, Bug, Star, User, PanelLeft,
  Database, Trophy, ShipWheel, CircleCheckBig, Globe, Globe2, FileDown,
  Link2, Cloud, CloudUpload, CloudDownload, Camera, Lock, Bell, Paperclip, ChevronLeft, ChevronUp,
  History, Eye, AlertCircle,
  MousePointer2, MousePointerClick, MessageSquare, Save, Eraser, Undo2, RefreshCw, Compass, SquareTerminal,
  type LucideProps,
} from 'lucide-react'

// ── Central icon configuration ────────────────────────────────────────────────
// Change these values to update ALL icons site-wide
export const ICON_CONFIG = {
  size: 14,
  strokeWidth: 1.5,
}

// Wrapper: applies global defaults, individual props can still override
function ic(Icon: React.ComponentType<LucideProps>) {
  return (p: LucideProps) => (
    <Icon size={ICON_CONFIG.size} strokeWidth={ICON_CONFIG.strokeWidth} {...p} />
  )
}

// ── Icon exports ──────────────────────────────────────────────────────────────
export const IFolder       = ic(Folder)
export const IFolderOpen   = ic(FolderOpen)
export const IChev         = ic(ChevronRight)
export const IChevDown     = ic(ChevronDown)
export const IChevUp       = ic(ChevronUp)
export const IPlus         = ic(Plus)
export const IClose        = ic(X)
export const ISearch       = ic(Search)
export const ITerminal     = ic(Terminal)
export const IBolt         = ic(Zap)
export const ISpark        = ic(Sparkles)
export const IGit          = ic(GitCommitHorizontal)
export const IBranch       = ic(GitBranch)
export const ISettings     = ic(Settings)
export const IHistory      = ic(ArrowUpRight)
export const IBookmark     = ic(Bookmark)
export const IWarn         = ic(TriangleAlert)
export const ICheck        = ic(Check)
export const IX            = ic(X)
export const ILoader       = (p: LucideProps) => (
  <Loader
    size={ICON_CONFIG.size}
    strokeWidth={ICON_CONFIG.strokeWidth}
    {...p}
    style={{ animation: 'spin 1s linear infinite', ...(p.style ?? {}) }}
  />
)
export const ICopy         = ic(Copy)
export const ISend         = ic(Send)
export const IMore         = ic(MoreHorizontal)
export const IEdit         = ic(Pencil)
export const ITrash        = ic(Trash2)
export const IDrag         = ic(GripVertical)
export const IShield       = ic(Shield)
export const IShieldPlus   = ic(ShieldPlus)
export const IFile         = ic(File)
export const IDrive        = ic(HardDrive)
export const IMoon         = ic(Moon)
export const ISun          = ic(Sun)
export const IMic          = ic(Mic)
export const ILogout       = ic(LogOut)
export const IKanban       = ic(LayoutList)
export const IKanbanLegacy = ic(LayoutDashboard)
export const IDocAI        = ic(FileCode2)
export const IAiWand       = ic(Wand2)
export const IPlay         = ic(Play)
export const ICpu          = ic(Cpu)
export const IFileCheck    = ic(FileCheck2)
export const IScrollText   = ic(ScrollText)
export const IImage        = ic(Image)
export const IKeyboard     = ic(Keyboard)
export const ITable        = ic(Table2)
export const IFilePlus     = ic(FilePlus)
export const IExternalLink = ic(ExternalLink)
export const IDownload     = ic(Download)
export const IFileDown     = ic(FileDown)
export const IFileText     = ic(FileText)
export const IBug          = ic(Bug)
export const IStar         = ic(Star)
export const IUser         = ic(User)
export const IPanel        = ic(PanelLeft)
export const IGitFork      = ic(GitFork)
export const IDatabase     = ic(Database)
export const ITrophy       = ic(Trophy)
export const IShipWheel       = ic(ShipWheel)
export const ICircleCheckBig  = ic(CircleCheckBig)
export const IOrbit           = ic(Globe)
export const ILink            = ic(Link2)
export const ICloud           = ic(Cloud)
export const ICloudUpload     = ic(CloudUpload)
export const ICloudDownload   = ic(CloudDownload)
export const IHistoryClock    = ic(History)
export const IEye             = ic(Eye)
export const IAlertCircle     = ic(AlertCircle)
export const ICamera          = ic(Camera)
export const ILock            = ic(Lock)
export const IBell            = ic(Bell)
export const IPaperclip       = ic(Paperclip)
export const IWeb             = ic(Globe2)
export const IChevLeft        = ic(ChevronLeft)
export const IMousePointer        = ic(MousePointer2)
export const IMousePointerClick   = ic(MousePointerClick)
export const IMessageSquare   = ic(MessageSquare)
export const ISave            = ic(Save)
export const IEraser          = ic(Eraser)
export const IUndo            = ic(Undo2)
export const IRefresh         = ic(RefreshCw)
export const ICompass         = ic(Compass)
export const ISquareTerminal  = ic(SquareTerminal)

// ── Logo spinner (SVG from assets/spinner.html) ───────────────────────────────
export function ISpinner({ size = 20 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 3508 3508"
      xmlns="http://www.w3.org/2000/svg"
      className="logo-spin"
      style={{ width: size, height: size, display: 'block', overflow: 'visible', flexShrink: 0 }}
    >
      <g transform="matrix(40.987701,0,0,47.017293,-1066.181752,-723.213702)"><path d="M73,19.923L73,34.077C73,36.242 70.984,38 68.5,38C66.016,38 64,36.242 64,34.077L64,19.923C64,17.758 66.016,16 68.5,16C70.984,16 73,17.758 73,19.923Z" fill="rgb(255,134,82)" className="logo-pulse" style={{ animationDelay: '0s' }} /></g>
      <g transform="matrix(29.580315,28.930009,-31.91902,33.931797,1407.038703,-1975.472569)"><path d="M73,19.923L73,34.077C73,36.242 70.984,38 68.5,38C66.016,38 64,36.242 64,34.077L64,19.923C64,17.758 66.016,16 68.5,16C70.984,16 73,17.758 73,19.923Z" fill="rgb(255,134,82)" className="logo-pulse" style={{ animationDelay: '-0.6s' }} /></g>
      <g transform="matrix(29.238983,29.28855,-31.868474,33.077201,819.147115,-352.119241)"><path d="M73,19.923L73,34.077C73,36.242 70.984,38 68.5,38C66.016,38 64,36.242 64,34.077L64,19.923C64,17.758 66.016,16 68.5,16C70.984,16 73,17.758 73,19.923Z" fill="rgb(255,134,82)" className="logo-pulse" style={{ animationDelay: '-2.4s' }} /></g>
      <g transform="matrix(-40.986978,0.248248,-0.232396,-39.892632,4554.901946,4098.265856)"><path d="M73,19.923L73,34.077C73,36.242 70.984,38 68.5,38C66.016,38 64,36.242 64,34.077L64,19.923C64,17.758 66.016,16 68.5,16C70.984,16 73,17.758 73,19.923Z" fill="rgb(255,134,82)" className="logo-pulse" style={{ animationDelay: '-3s' }} /></g>
      <g transform="matrix(-27.307354,-31.16698,34.160049,-31.117626,1985.168069,4522.127633)"><path d="M73,19.923L73,34.077C73,36.242 70.984,38 68.5,38C66.016,38 64,36.242 64,34.077L64,19.923C64,17.758 66.016,16 68.5,16C70.984,16 73,17.758 73,19.923Z" fill="rgb(255,134,82)" className="logo-pulse" style={{ animationDelay: '-4.8s' }} /></g>
      <g transform="matrix(-29.582967,-33.764229,13.546438,-12.339941,2363.40733,3358.078607)"><path d="M73,19.923L73,34.077C73,36.242 70.984,38 68.5,38C66.016,38 64,36.242 64,34.077L64,19.923C64,17.758 66.016,16 68.5,16C70.984,16 73,17.758 73,19.923Z" fill="rgb(255,134,82)" className="logo-pulse" style={{ animationDelay: '-5.4s' }} /></g>
      <g transform="matrix(-29.582967,-33.764229,13.546438,-12.339941,3408.593705,4455.148787)"><path d="M73,19.923L73,34.077C73,36.242 70.984,38 68.5,38C66.016,38 64,36.242 64,34.077L64,19.923C64,17.758 66.016,16 68.5,16C70.984,16 73,17.758 73,19.923Z" fill="rgb(255,134,82)" /></g>
      <g transform="matrix(-29.582967,-33.764229,13.546438,-12.339941,4423.039305,5458.184379)"><path d="M73,19.923L73,34.077C73,36.242 70.984,38 68.5,38C66.016,38 64,36.242 64,34.077L64,19.923C64,17.758 66.016,16 68.5,16C70.984,16 73,17.758 73,19.923Z" fill="rgb(255,134,82)" className="logo-pulse" style={{ animationDelay: '-1.8s' }} /></g>
      <g transform="matrix(-28.982321,-29.552586,32.605921,-33.245834,2047.144742,5568.348688)"><path d="M73,19.923L73,34.077C73,36.242 70.984,38 68.5,38C66.016,38 64,36.242 64,34.077L64,19.923C64,17.758 66.016,16 68.5,16C70.984,16 73,17.758 73,19.923Z" fill="rgb(255,134,82)" className="logo-pulse" style={{ animationDelay: '-3.6s' }} /></g>
      <g transform="matrix(0.231081,-41.792485,46.110431,0.265075,1710.296113,4624.331086)"><path d="M73,19.923L73,34.077C73,36.242 70.984,38 68.5,38C66.016,38 64,36.242 64,34.077L64,19.923C64,17.758 66.016,16 68.5,16C70.984,16 73,17.758 73,19.923Z" fill="rgb(255,134,82)" className="logo-pulse" style={{ animationDelay: '-1.2s' }} /></g>
      <g transform="matrix(-0.543775,-41.789472,43.312489,-0.585961,-625.339269,4646.686721)"><path d="M73,19.923L73,34.077C73,36.242 70.984,38 68.5,38C66.016,38 64,36.242 64,34.077L64,19.923C64,17.758 66.016,16 68.5,16C70.984,16 73,17.758 73,19.923Z" fill="rgb(255,134,82)" className="logo-pulse" style={{ animationDelay: '-4.2s' }} /></g>
    </svg>
  )
}
