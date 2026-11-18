
'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { useEffect, useState } from 'react'
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from 'framer-motion'

import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Cloud,
  Database,
  FileCheck2,
  FileText,
  Globe2,
  LayoutDashboard,
  Layers3,
  LockKeyhole,
  MousePointer2,
  Network,
  PanelTop,
  Plus,
  RotateCcw,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react'

const STORAGE_KEY = 'srizony-cms-welcome-dismissed-v1'
const SESSION_KEY = 'srizony-cms-welcome-shown-session-v1'

const STEPS = [
  {
    title: 'Welcome to the Srizony CMS',
    description:
      'This workspace controls the public website. Changes made here can affect what visitors see, so review your edits before saving or publishing.',
    detail:
      'Use the sidebar to move between content areas. The header provides the current page context, reload, save and appearance controls.',
    icon: BookOpen,
    bullets: [
      'Your access level determines which actions are available.',
      'Unsaved changes are indicated before you leave a page.',
      'Use the help guide again whenever you need a refresher.',
    ],
  },
  {
    title: 'Dashboard and insights',
    description:
      'Start with the dashboard for a summary of website activity and current content.',
    detail:
      'Reports provide visitor and operational views. Use filters and exports where available, and treat analytics as operational information rather than a substitute for verified records.',
    icon: LayoutDashboard,
    bullets: [
      'Dashboard: overview and shortcuts.',
      'Visitors & Reports: activity and reporting.',
      'CMS Data Pipeline: data and content integrity status.',
    ],
  },
  {
    title: 'Manage website content',
    description:
      'Content Management is where you update the public-facing structure and information.',
    detail:
      'Navigation controls menus and destinations; Site Content manages published records; Page Builder controls page sections, Portfolio, Jobs and Website Essentials manage their respective content.',
    icon: FileText,
    bullets: [
      'Preview links and destinations before publishing.',
      'Use clear English and Bengali labels where supported.',
      'Footer Navigation controls footer sections, columns and links.',
    ],
  },
  {
    title: 'Navigation and page structure',
    description:
      'Navigation and page content work together: menu items can point to pages, external destinations or grouped items.',
    detail:
      'When changing slugs or destinations, check the public route and internal links. Avoid deleting content that is still referenced by navigation or other pages.',
    icon: Network,
    bullets: [
      'Keep menu labels concise.',
      'Check desktop and mobile navigation after changes.',
      'Use Page Builder to review section order and visibility.',
    ],
  },
  {
    title: 'Settings, users and data safety',
    description:
      'Settings controls user access, database operations, reports and site typography.',
    detail:
      'Only authorized administrators should manage users, database imports, backups or restores. Always verify a backup and test a restore in a safe environment before production recovery.',
    icon: Settings,
    bullets: [
      'Admin: full administrative access.',
      'Editor: content editing within permitted areas.',
      'Analyst: read-only access to supported views.',
    ],
  },
  {
    title: 'You are ready to begin',
    description:
      'You can return to the relevant CMS section whenever you need to review a workflow.',
    detail:
      'The guide can be skipped on future logins on this browser. If you leave the option unchecked, it will appear again at the next login.',
    icon: CheckCircle2,
    bullets: [
      'Save changes after reviewing them.',
      'Check the public website after important updates.',
      'Never share passwords, API keys or backup credentials.',
    ],
  },
]

const slideTransition = {
  duration: 0.32,
  ease: 'easeOut' as const,
}

const chartValues = [38, 56, 46, 72, 52, 85, 66, 94, 59, 78, 68, 100]

const roleDescriptions = {
  Admin: 'Manage users, settings, data operations and all permitted CMS areas.',
  Editor: 'Create and update content within assigned permissions.',
  Analyst: 'Review reports, insights and supported read-only views.',
}

type Role = keyof typeof roleDescriptions

function VisualFrame({
  children,
  label,
  number,
}: {
  children: React.ReactNode
  label: string
  number: string
}) {
  return (
    <div className="cms-welcome-visual">
      <div className="cms-welcome-visual-heading">
        <div>
          <span className="cms-welcome-eyebrow">INTERACTIVE PREVIEW</span>
          <h3>{label}</h3>
        </div>
        <span className="cms-welcome-visual-number">{number}</span>
      </div>
      {children}
      <div className="cms-welcome-visual-caption">
        <span className="cms-welcome-live-dot" />
        Explore the visual to understand the workflow
      </div>
    </div>
  )
}

function WelcomeVisual() {
  const reduceMotion = useReducedMotion()

  return (
    <VisualFrame label="Your workspace, connected." number="01 / 06">
      <div className="cms-welcome-hero-visual">
        <motion.div
          className="cms-welcome-orbit cms-welcome-orbit-one"
          animate={
            reduceMotion
              ? undefined
              : { rotate: 360 }
          }
          transition={{
            duration: 28,
            repeat: Infinity,
            ease: 'linear',
          }}
        />

        <motion.div
          className="cms-welcome-orbit cms-welcome-orbit-two"
          animate={
            reduceMotion
              ? undefined
              : { rotate: -360 }
          }
          transition={{
            duration: 36,
            repeat: Infinity,
            ease: 'linear',
          }}
        />

        <motion.div
          className="cms-welcome-float-icon cms-welcome-float-one"
          animate={
            reduceMotion
              ? undefined
              : { y: [0, -9, 0], rotate: [0, 5, 0] }
          }
          transition={{ duration: 4, repeat: Infinity }}
        >
          <Globe2 />
        </motion.div>

        <motion.div
          className="cms-welcome-float-icon cms-welcome-float-two"
          animate={
            reduceMotion
              ? undefined
              : { y: [0, 8, 0], rotate: [0, -5, 0] }
          }
          transition={{ duration: 4.5, repeat: Infinity }}
        >
          <Layers3 />
        </motion.div>

        <motion.div
          className="cms-welcome-float-icon cms-welcome-float-three"
          animate={
            reduceMotion
              ? undefined
              : { y: [0, -7, 0] }
          }
          transition={{ duration: 3.8, repeat: Infinity }}
        >
          <ShieldCheck />
        </motion.div>

        <motion.div
          className="cms-welcome-mini-window"
          initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={slideTransition}
        >
          <div className="cms-welcome-mini-header">
            <div className="cms-welcome-window-dots">
              <i />
              <i />
              <i />
            </div>
            <span>srizony.cms</span>
            <span className="cms-welcome-window-status">
              <Check size={11} /> Active
            </span>
          </div>

          <div className="cms-welcome-mini-body">
            <div className="cms-welcome-mini-sidebar">
              <span className="cms-welcome-mini-brand">
                <Layers3 size={16} />
              </span>
              {[LayoutDashboard, FileText, Network, Settings].map(
                (Icon, index) => (
                  <span
                    key={index}
                    className={index === 0 ? 'is-active' : ''}
                  >
                    <Icon size={15} />
                  </span>
                )
              )}
            </div>

            <div className="cms-welcome-mini-main">
              <div className="cms-welcome-mini-title">
                <div>
                  <span />
                  <span />
                </div>
                <span className="cms-welcome-mini-avatar">S</span>
              </div>

              <div className="cms-welcome-mini-stats">
                {[1, 2, 3].map((item) => (
                  <motion.div
                    key={item}
                    initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: item * 0.1 }}
                  >
                    <span />
                    <strong />
                  </motion.div>
                ))}
              </div>

              <div className="cms-welcome-mini-content">
                <span />
                <div className="cms-welcome-mini-content-lines">
                  <i />
                  <i />
                  <i />
                </div>
              </div>

              <div className="cms-welcome-mini-bottom">
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
        </motion.div>

        <div className="cms-welcome-hero-label">
          <Sparkles size={14} />
          One workspace. Complete control.
        </div>
      </div>
    </VisualFrame>
  )
}

function DashboardVisual() {
  const reduceMotion = useReducedMotion()

  return (
    <VisualFrame label="Understand your website." number="02 / 06">
      <div className="cms-welcome-dashboard">
        <div className="cms-welcome-dash-top">
          <div>
            <span className="cms-welcome-dash-label">Website overview</span>
            <strong>Performance snapshot</strong>
          </div>
          <span className="cms-welcome-range">Last 30 days</span>
        </div>

        <div className="cms-welcome-metric-grid">
          {[
            { label: 'Website visits', value: '24,891', icon: Activity, trend: '+12.8%' },
            { label: 'Published pages', value: '128', icon: FileCheck2, trend: '+8.2%' },
            { label: 'CMS users', value: '12', icon: Users, trend: 'Active' },
          ].map((metric, index) => {
            const Icon = metric.icon

            return (
              <motion.div
                key={metric.label}
                className="cms-welcome-metric"
                initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <div className="cms-welcome-metric-icon">
                  <Icon size={15} />
                </div>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                <small>{metric.trend}</small>
              </motion.div>
            )
          })}
        </div>

        <div className="cms-welcome-chart-card">
          <div className="cms-welcome-chart-heading">
            <div>
              <strong>Visitor activity</strong>
              <span>Illustrative analytics preview</span>
            </div>
            <Activity size={16} />
          </div>

          <div
            className="cms-welcome-chart"
            role="img"
            aria-label="Illustrative animated visitor activity chart"
          >
            {chartValues.map((value, index) => (
              <div className="cms-welcome-chart-column" key={index}>
                <motion.span
                  initial={reduceMotion ? false : { scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{
                    delay: 0.06 * index,
                    duration: 0.45,
                    ease: 'easeOut',
                  }}
                  style={{ height: `${value}%` }}
                />
              </div>
            ))}
          </div>

          <div className="cms-welcome-chart-axis">
            <span>Week 01</span>
            <span>Week 02</span>
            <span>Week 03</span>
            <span>Week 04</span>
          </div>
        </div>

        <div className="cms-welcome-insight">
          <Sparkles size={16} />
          <span>
            Use reports and filters to investigate website activity.
          </span>
        </div>
      </div>
    </VisualFrame>
  )
}

function ContentVisual() {
  const reduceMotion = useReducedMotion()
  const [selectedBlock, setSelectedBlock] = useState('Hero')

  const blocks = [
    { name: 'Hero', icon: PanelTop },
    { name: 'Text', icon: FileText },
    { name: 'Features', icon: Layers3 },
    { name: 'Gallery', icon: Globe2 },
  ]

  return (
    <VisualFrame label="Build and arrange content." number="03 / 06">
      <div className="cms-welcome-builder">
        <div className="cms-welcome-builder-toolbar">
          <div>
            <span className="cms-welcome-builder-dot" />
            <strong>Page Builder</strong>
          </div>
          <span className="cms-welcome-preview-tag">Live preview</span>
        </div>

        <div className="cms-welcome-builder-layout">
          <div className="cms-welcome-block-list">
            <span className="cms-welcome-section-label">PAGE COMPONENTS</span>

            {blocks.map((block) => {
              const Icon = block.icon
              const active = selectedBlock === block.name

              return (
                <button
                  key={block.name}
                  type="button"
                  aria-pressed={active}
                  className={`cms-welcome-block-option ${active ? 'is-selected' : ''}`}
                  onClick={() => setSelectedBlock(block.name)}
                >
                  <Icon size={15} />
                  <span>{block.name}</span>
                  {active && <Check size={13} />}
                </button>
              )
            })}

            <div className="cms-welcome-add-block">
              <Plus size={14} />
              Add component
            </div>
          </div>

          <div className="cms-welcome-page-canvas">
            <div className="cms-welcome-canvas-top">
              <span>PUBLIC PAGE</span>
              <Globe2 size={13} />
            </div>

            <div className="cms-welcome-canvas-page">
              <AnimatePresence mode="wait">
                <motion.div
                  key={selectedBlock}
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={slideTransition}
                  className={`cms-welcome-canvas-content content-${selectedBlock.toLowerCase()}`}
                >
                  {selectedBlock === 'Hero' && (
                    <>
                      <span className="cms-welcome-canvas-kicker">WELCOME TO OUR WEBSITE</span>
                      <strong>Design your digital experience.</strong>
                      <span className="cms-welcome-canvas-description" />
                      <span className="cms-welcome-canvas-button">Explore more</span>
                    </>
                  )}

                  {selectedBlock === 'Text' && (
                    <>
                      <span className="cms-welcome-canvas-kicker">OUR STORY</span>
                      <strong>Content that communicates.</strong>
                      <span className="cms-welcome-canvas-description" />
                      <span className="cms-welcome-canvas-description short" />
                      <span className="cms-welcome-canvas-description" />
                    </>
                  )}

                  {selectedBlock === 'Features' && (
                    <>
                      <span className="cms-welcome-canvas-kicker">WHAT WE OFFER</span>
                      <strong>Our key features</strong>
                      <div className="cms-welcome-feature-preview">
                        <i><Check size={12} /></i>
                        <i><Check size={12} /></i>
                        <i><Check size={12} /></i>
                      </div>
                    </>
                  )}

                  {selectedBlock === 'Gallery' && (
                    <>
                      <span className="cms-welcome-canvas-kicker">OUR WORK</span>
                      <strong>Visual portfolio</strong>
                      <div className="cms-welcome-gallery-preview">
                        <i />
                        <i />
                        <i />
                      </div>
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="cms-welcome-canvas-footer">
              <span>Section: {selectedBlock}</span>
              <MousePointer2 size={13} />
            </div>
          </div>
        </div>

        <div className="cms-welcome-builder-hint">
          <MousePointer2 size={14} />
          Select different components to preview them.
        </div>
      </div>
    </VisualFrame>
  )
}

function NavigationVisual() {
  const reduceMotion = useReducedMotion()
  const [expanded, setExpanded] = useState({
    pages: true,
    resources: false,
  })

  const toggle = (key: keyof typeof expanded) => {
    setExpanded((current) => ({
      ...current,
      [key]: !current[key],
    }))
  }

  return (
    <VisualFrame label="Connect pages and destinations." number="04 / 06">
      <div className="cms-welcome-nav-visual">
        <div className="cms-welcome-nav-toolbar">
          <div>
            <Network size={15} />
            <strong>Navigation structure</strong>
          </div>
          <span>Public menu</span>
        </div>

        <div className="cms-welcome-nav-tree">
          <div className="cms-welcome-nav-root">
            <Globe2 size={17} />
            <strong>Website</strong>
            <span className="cms-welcome-nav-root-badge">Root</span>
          </div>

          <div className="cms-welcome-nav-children">
            <div className="cms-welcome-nav-node">
              <div className="cms-welcome-nav-node-line" />
              <button
                type="button"
                className="cms-welcome-tree-toggle"
                onClick={() => toggle('pages')}
                aria-expanded={expanded.pages}
              >
                {expanded.pages ? (
                  <ChevronDown size={15} />
                ) : (
                  <ChevronRight size={15} />
                )}
                <PanelTop size={15} />
                <span>Pages</span>
                <small>3</small>
              </button>
            </div>

            <AnimatePresence initial={false}>
              {expanded.pages && (
                <motion.div
                  className="cms-welcome-tree-children"
                  initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={slideTransition}
                >
                  {['Home', 'About us', 'Contact'].map((item, index) => (
                    <div className="cms-welcome-tree-leaf" key={item}>
                      <span className="cms-welcome-tree-connector" />
                      <FileText size={14} />
                      <span>{item}</span>
                      {index === 0 && <small>Default</small>}
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="cms-welcome-nav-node">
              <div className="cms-welcome-nav-node-line" />
              <button
                type="button"
                className="cms-welcome-tree-toggle"
                onClick={() => toggle('resources')}
                aria-expanded={expanded.resources}
              >
                {expanded.resources ? (
                  <ChevronDown size={15} />
                ) : (
                  <ChevronRight size={15} />
                )}
                <Layers3 size={15} />
                <span>Resources</span>
                <small>2</small>
              </button>
            </div>

            <AnimatePresence initial={false}>
              {expanded.resources && (
                <motion.div
                  className="cms-welcome-tree-children"
                  initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={slideTransition}
                >
                  {['Portfolio', 'Jobs'].map((item) => (
                    <div className="cms-welcome-tree-leaf" key={item}>
                      <span className="cms-welcome-tree-connector" />
                      <FileText size={14} />
                      <span>{item}</span>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="cms-welcome-nav-external">
            <Globe2 size={15} />
            <span>External destinations</span>
            <ArrowRight size={13} />
          </div>
        </div>

        <div className="cms-welcome-nav-footer">
          <Network size={15} />
          <span>Organize routes, groups and menu hierarchy.</span>
        </div>
      </div>
    </VisualFrame>
  )
}

function SecurityVisual() {
  const reduceMotion = useReducedMotion()
  const [role, setRole] = useState<Role>('Editor')
  const [showCheckpoint, setShowCheckpoint] = useState(false)

  return (
    <VisualFrame label="Protect access and data." number="05 / 06">
      <div className="cms-welcome-security">
        <div className="cms-welcome-security-heading">
          <div>
            <span className="cms-welcome-section-label">ACCESS MANAGEMENT</span>
            <strong>Choose a permission level</strong>
          </div>
          <LockKeyhole size={19} />
        </div>

        <div className="cms-welcome-role-selector">
          {(['Admin', 'Editor', 'Analyst'] as Role[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setRole(item)}
              aria-pressed={role === item}
              className={`cms-welcome-role-option ${role === item ? 'is-selected' : ''}`}
            >
              {item === 'Admin' && <ShieldCheck size={15} />}
              {item === 'Editor' && <FileText size={15} />}
              {item === 'Analyst' && <Activity size={15} />}
              {item}
              {role === item && <Check size={13} />}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={role}
            className="cms-welcome-role-description"
            initial={reduceMotion ? false : { opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={slideTransition}
          >
            <div className="cms-welcome-role-avatar">
              <Users size={17} />
            </div>
            <div>
              <strong>{role} permissions</strong>
              <span>{roleDescriptions[role]}</span>
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="cms-welcome-backup-card">
          <div className="cms-welcome-backup-heading">
            <div className="cms-welcome-backup-icon">
              <Database size={17} />
            </div>
            <div>
              <strong>Data protection</strong>
              <span>Backup and recovery workflow</span>
            </div>
            <ShieldCheck size={18} />
          </div>

          <div className="cms-welcome-backup-flow">
            <div>
              <Cloud size={17} />
              <span>Backup</span>
            </div>
            <ArrowRight size={15} />
            <div>
              <Database size={17} />
              <span>Storage</span>
            </div>
            <ArrowRight size={15} />
            <div>
              <RotateCcw size={17} />
              <span>Restore</span>
            </div>
          </div>

          <AnimatePresence>
            {showCheckpoint && (
              <motion.div
                className="cms-welcome-checkpoint"
                initial={reduceMotion ? false : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={slideTransition}
              >
                <CheckCircle2 size={15} />
                Workflow checkpoint preview displayed. This is not an actual backup operation.
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="button"
            className="cms-welcome-backup-action"
            onClick={() => setShowCheckpoint((value) => !value)}
            aria-expanded={showCheckpoint}
          >
            {showCheckpoint ? 'Hide checkpoint' : 'Preview backup checkpoint'}
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </VisualFrame>
  )
}

function CompleteVisual() {
  const reduceMotion = useReducedMotion()

  return (
    <VisualFrame label="You're ready to take control." number="06 / 06">
      <div className="cms-welcome-complete">
        <div className="cms-welcome-complete-orbit">
          <motion.div
            className="cms-welcome-complete-ring"
            initial={reduceMotion ? false : { rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
          <motion.div
            className="cms-welcome-complete-center"
            initial={reduceMotion ? false : { scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 180, damping: 14 }}
          >
            <CheckCircle2 size={46} />
          </motion.div>

          {[0, 1, 2, 3].map((item) => (
            <motion.span
              key={item}
              className={`cms-welcome-complete-particle particle-${item}`}
              animate={
                reduceMotion
                  ? undefined
                  : { y: [0, -9, 0], opacity: [0.5, 1, 0.5] }
              }
              transition={{
                duration: 2.2,
                repeat: Infinity,
                delay: item * 0.25,
              }}
            />
          ))}
        </div>

        <motion.div
          className="cms-welcome-complete-message"
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <span className="cms-welcome-complete-label">
            <Sparkles size={14} /> ONBOARDING COMPLETED
          </span>
          <strong>Your CMS workspace is ready.</strong>
          <span>Six steps. One clear understanding of your workspace.</span>
        </motion.div>

        <div className="cms-welcome-complete-checklist">
          {[
            'Understand your dashboard',
            'Manage your website content',
            'Organize navigation and routes',
            'Protect data and permissions',
          ].map((item, index) => (
            <motion.div
              key={item}
              initial={reduceMotion ? false : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 + 0.25 }}
            >
              <span><Check size={12} /></span>
              {item}
            </motion.div>
          ))}
        </div>
      </div>
    </VisualFrame>
  )
}

function StepVisual({ step }: { step: number }) {
  switch (step) {
    case 0:
      return <WelcomeVisual />
    case 1:
      return <DashboardVisual />
    case 2:
      return <ContentVisual />
    case 3:
      return <NavigationVisual />
    case 4:
      return <SecurityVisual />
    default:
      return <CompleteVisual />
  }
}

export default function CmsWelcomeWizard() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [doNotShowAgain, setDoNotShowAgain] = useState(false)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        if (
          localStorage.getItem(STORAGE_KEY) === '1' ||
          sessionStorage.getItem(SESSION_KEY) === '1'
        ) {
          return
        }

        sessionStorage.setItem(SESSION_KEY, '1')
        setOpen(true)
      } catch {
        setOpen(true)
      }
    }, 0)

    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!open) return

    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null

      if (
        target?.closest('input, textarea, select, [contenteditable="true"]')
      ) {
        return
      }

      if (event.key === 'Escape') {
        setOpen(false)
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault()
        setStep((value) => Math.min(STEPS.length - 1, value + 1))
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        setStep((value) => Math.max(0, value - 1))
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open])

  function finish() {
    if (doNotShowAgain) {
      try {
        localStorage.setItem(STORAGE_KEY, '1')
      } catch {
        // Local preference is optional.
      }
    }

    setOpen(false)
  }

  if (!open) return null

  const current = STEPS[step]
  const Icon = current.icon
  const progress = ((step + 1) / STEPS.length) * 100

  return (
    <AnimatePresence>
      <motion.div
        className="cms-welcome-overlay"
        role="presentation"
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        <motion.section
          className="cms-welcome-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cms-welcome-title"
          aria-describedby="cms-welcome-description"
          initial={reduceMotion ? false : { opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 14, scale: 0.98 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          <div className="cms-welcome-topline">
            <span className="cms-welcome-brand">
              <span className="cms-welcome-brand-icon">
                <BookOpen size={15} />
              </span>
              <span>
                <strong>SRIZONY CMS</strong>
                <small>QUICK START GUIDE</small>
              </span>
            </span>

            <div className="cms-welcome-top-right">
              <span className="cms-welcome-step-count">
                <strong>{String(step + 1).padStart(2, '0')}</strong>
                <span> / {String(STEPS.length).padStart(2, '0')}</span>
              </span>
              <button
                type="button"
                className="cms-welcome-close"
                onClick={() => setOpen(false)}
                aria-label="Close welcome guide"
              >
                ×
              </button>
            </div>
          </div>

          <div
            className="cms-welcome-progress"
            role="progressbar"
            aria-label="Welcome guide progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress)}
          >
            <motion.span
              animate={{ width: `${progress}%` }}
              transition={{ duration: reduceMotion ? 0 : 0.35 }}
            />
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              className="cms-welcome-body"
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
              transition={slideTransition}
            >
              <div className="cms-welcome-copy">
                <div className="cms-welcome-step-icon">
                  <Icon size={24} />
                </div>

                <span className="cms-welcome-step-eyebrow">
                  STEP {String(step + 1).padStart(2, '0')} —{' '}
                  {step === 5 ? 'GETTING STARTED' : 'CMS OVERVIEW'}
                </span>

                <h2 id="cms-welcome-title">{current.title}</h2>

                <p
                  id="cms-welcome-description"
                  className="cms-welcome-description"
                >
                  {current.description}
                </p>

                <div className="cms-welcome-detail">
                  <span className="cms-welcome-detail-indicator" />
                  {current.detail}
                </div>

                <ul className="cms-welcome-bullets">
                  {current.bullets.map((item) => (
                    <li key={item}>
                      <span><Check size={13} /></span>
                      {item}
                    </li>
                  ))}
                </ul>

                <div className="cms-welcome-keyboard-hint">
                  <span><ArrowLeft size={11} /><ArrowRight size={11} /></span>
                  Use your arrow keys to navigate
                </div>
              </div>

              <StepVisual step={step} />
            </motion.div>
          </AnimatePresence>

          <div className="cms-welcome-footer">
            <div className="cms-welcome-footer-left">
              {step === STEPS.length - 1 ? (
                <label className="cms-welcome-dismiss">
                  <Checkbox
                    checked={doNotShowAgain}
                    onChange={(event) =>
                      setDoNotShowAgain(event.target.checked)
                    }
                  />
                  <span>Do not show again</span>
                  <small>Optional</small>
                </label>
              ) : (
                <span className="cms-welcome-footnote">
                  <LockKeyhole size={13} />
                  Your progress is not saved as a CMS change.
                </span>
              )}
            </div>

            <div className="cms-welcome-actions">
              {step > 0 && (
                <button
                  type="button"
                  className="ui-button ui-button-outline ui-button-sm cms-welcome-back"
                  onClick={() =>
                    setStep((value) => Math.max(0, value - 1))
                  }
                >
                  <ArrowLeft size={15} />
                  Back
                </button>
              )}

              {step < STEPS.length - 1 ? (
                <button
                  type="button"
                  className="ui-button ui-button-primary ui-button-sm cms-welcome-next"
                  onClick={() =>
                    setStep((value) =>
                      Math.min(STEPS.length - 1, value + 1)
                    )
                  }
                >
                  Continue
                  <ArrowRight size={15} />
                </button>
              ) : (
                <button
                  type="button"
                  className="ui-button ui-button-primary ui-button-sm cms-welcome-next"
                  onClick={finish}
                >
                  Enter CMS
                  <CheckCircle2 size={15} />
                </button>
              )}
            </div>
          </div>
        </motion.section>
      </motion.div>
    </AnimatePresence>
  )
}
