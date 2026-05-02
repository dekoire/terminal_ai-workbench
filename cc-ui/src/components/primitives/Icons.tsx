import React from 'react'
import {
  Folder, FolderOpen, ChevronRight, ChevronDown, Plus, X, Search,
  Terminal, Zap, Sparkles, GitCommitHorizontal, GitBranch, GitFork, Settings,
  ArrowUpRight, Bookmark, TriangleAlert, Check, Loader, Copy, Send,
  MoreHorizontal, Pencil, Trash2, GripVertical, Shield, ShieldPlus, File,
  HardDrive, Moon, Sun, Mic, LogOut, LayoutDashboard, LayoutList, FileCode2,
  Wand2, Play, Cpu, FileCheck2, ScrollText, Image, Keyboard, Table2, FilePlus,
  ExternalLink, Download, FileText, Bug, Star, User, PanelLeft,
  UsersRound, Database, Trophy, ShipWheel, CircleCheckBig,
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
export const ISpinner      = (p: LucideProps) => (
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
export const IFileText     = ic(FileText)
export const IBug          = ic(Bug)
export const IStar         = ic(Star)
export const IUser         = ic(User)
export const IPanel        = ic(PanelLeft)
export const IGitFork      = ic(GitFork)
export const ICrew         = ic(UsersRound)
export const IDatabase     = ic(Database)
export const ITrophy       = ic(Trophy)
export const IShipWheel       = ic(ShipWheel)
export const ICircleCheckBig  = ic(CircleCheckBig)
