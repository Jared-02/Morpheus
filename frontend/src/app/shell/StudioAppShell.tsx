import { useEffect } from 'react'
import { Drawer, ScrollArea } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { Link, Outlet, useLocation, useParams } from 'react-router-dom'
import { useProjectStore } from '../../stores/useProjectStore'
import StudioTopNav from './StudioTopNav'

function IconOverview() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </svg>
  )
}

function IconModel() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="12" cy="18" r="2.5" />
      <path d="M8 7.6 10.6 15" />
      <path d="M16 7.6 13.4 15" />
      <path d="M8.5 6h7" />
    </svg>
  )
}

function IconWrite() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 20h5l10-10-5-5L4 15z" />
      <path d="m13.5 5.5 5 5" />
    </svg>
  )
}

function IconMedia() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M9 9v6" />
      <path d="M13 8v8" />
      <path d="M17 10v4" />
    </svg>
  )
}

function IconAudio() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M11 5 6 9H3v6h3l5 4z" />
      <path d="M15 10a3 3 0 0 1 0 4" />
      <path d="M17.5 7.5a6.5 6.5 0 0 1 0 9" />
    </svg>
  )
}

function IconStoryboard() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m10 9 5 3-5 3z" />
    </svg>
  )
}

function IconReplay() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 4v6h6" />
      <path d="M20 12a8 8 0 1 1-2.3-5.6L10 10" />
    </svg>
  )
}

function IconAgent() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="7" />
      <circle cx="9" cy="10" r="1" />
      <circle cx="15" cy="10" r="1" />
      <path d="M9 15c.8.7 1.8 1 3 1s2.2-.3 3-1" />
      <path d="M12 3v2" />
    </svg>
  )
}

function isPathActive(pathname: string, target: string, exact = false) {
  if (exact) {
    return pathname === target
  }
  return pathname === target || pathname.startsWith(`${target}/`)
}

export default function StudioAppShell() {
  const { projectId } = useParams<{ projectId: string }>()
  const location = useLocation()
  const fetchProject = useProjectStore((state) => state.fetchProject)
  const currentProject = useProjectStore((state) => state.currentProject)
  const [mobileNavOpened, { toggle: toggleMobileNav, close: closeMobileNav }] = useDisclosure(false)

  useEffect(() => {
    if (projectId) {
      void fetchProject(projectId)
    }
  }, [projectId, fetchProject])

  if (!projectId) {
    return <Outlet />
  }

  const basePath = `/project/${projectId}`
  const mediaRootPath = `${basePath}/media`
  const audioPath = `${basePath}/media/audio-book`
  const storyboardPath = `${basePath}/media/storyboard`
  const displayProjectName = currentProject?.name?.trim() || '赛博之城'
  const projectGenre = currentProject?.genre?.trim() || '科幻'
  const projectStyle = currentProject?.style?.trim() || '悬疑'
  const projectChapterCount = currentProject?.chapter_count ?? 12
  const projectWordTarget = currentProject?.target_length
    ? `${(currentProject.target_length / 10000).toFixed(2)}万`
    : '18.77万'

  const mainItems = [
    { key: 'overview', label: '项目概述', to: basePath, icon: <IconOverview />, exact: true },
    { key: 'model', label: '叙事建模', to: `${basePath}/model`, icon: <IconModel /> },
    { key: 'write', label: '文本创作', to: `${basePath}/write`, icon: <IconWrite /> },
    { key: 'media', label: '媒体创作', to: audioPath, icon: <IconMedia />, nested: true },
    { key: 'replay', label: '智策回溯', to: `${basePath}/replay`, icon: <IconReplay /> },
    { key: 'agents', label: '智能体', to: `${basePath}/agents`, icon: <IconAgent /> },
  ]

  const mediaActive = isPathActive(location.pathname, mediaRootPath)

  return (
    <div className="studio-shell-layout">
      <header className="studio-shell-layout__header">
        <StudioTopNav
          projectName={displayProjectName}
          mobileNavOpened={mobileNavOpened}
          onToggleMobileNav={toggleMobileNav}
        />
      </header>

      <aside className="studio-shell-layout__sidebar" aria-label="全局目录">
        <div className="studio-shell__sidebar-inner">
          <div className="studio-shell__sidebar-scroll">
            <nav className="studio-shell__directory">
              {mainItems.map((item) => {
                const active = item.key === 'media'
                  ? mediaActive
                  : isPathActive(location.pathname, item.to, item.exact)

                return (
                  <div key={item.key} className="studio-shell__directory-block">
                    <Link
                      to={item.to}
                      className={`studio-shell__directory-link ${active ? 'is-active' : ''}`}
                      onClick={closeMobileNav}
                    >
                      <span className="studio-shell__directory-icon" aria-hidden="true">{item.icon}</span>
                      <span className="studio-shell__directory-text">{item.label}</span>
                      {item.nested && <span className="studio-shell__directory-caret">▾</span>}
                    </Link>

                    {item.nested && mediaActive && (
                      <div className="studio-shell__directory-children">
                        <Link
                          to={audioPath}
                          className={`studio-shell__directory-child ${isPathActive(location.pathname, audioPath) ? 'is-active' : ''}`}
                          onClick={closeMobileNav}
                        >
                          <span className="studio-shell__directory-icon" aria-hidden="true"><IconAudio /></span>
                          <span>AI 音频</span>
                        </Link>

                        <Link
                          to={storyboardPath}
                          className={`studio-shell__directory-child ${isPathActive(location.pathname, storyboardPath) ? 'is-active' : ''}`}
                          onClick={closeMobileNav}
                        >
                          <span className="studio-shell__directory-icon" aria-hidden="true"><IconStoryboard /></span>
                          <span>AI 漫剧</span>
                        </Link>
                      </div>
                    )}
                  </div>
                )
              })}
            </nav>
          </div>

          <section className="studio-shell__project-switch-card" aria-label="当前项目信息">
            <div className="studio-shell__project-cover" aria-hidden="true" />
            <div className="studio-shell__project-meta">
              <strong>{displayProjectName}</strong>
              <p>类型：{projectGenre} / {projectStyle}</p>
              <p>章节：{projectChapterCount} 章</p>
              <p>字数：{projectWordTarget}</p>
            </div>
            <Link to="/" className="studio-shell__switch-project-btn" onClick={closeMobileNav}>
              切换项目
            </Link>
          </section>
        </div>
      </aside>

      <main className="studio-shell-layout__main">
        <div className="studio-shell__main">
          <Outlet />
        </div>
      </main>

      <Drawer
        opened={mobileNavOpened}
        onClose={closeMobileNav}
        title="全局目录"
        padding="md"
        size="88%"
        hiddenFrom="md"
      >
        <ScrollArea.Autosize mah="70vh" type="scroll">
          <div className="studio-shell__mobile-links">
            {mainItems.map((item) => {
              const active = item.key === 'media'
                ? mediaActive
                : isPathActive(location.pathname, item.to, item.exact)

              return (
                <Link
                  key={item.key}
                  to={item.to}
                  className={`studio-shell__mobile-link ${active ? 'is-active' : ''}`}
                  onClick={closeMobileNav}
                >
                  {item.label}
                </Link>
              )
            })}

            <Link
              to={audioPath}
              className={`studio-shell__mobile-link is-child ${isPathActive(location.pathname, audioPath) ? 'is-active' : ''}`}
              onClick={closeMobileNav}
            >
              AI 音频
            </Link>
            <Link
              to={storyboardPath}
              className={`studio-shell__mobile-link is-child ${isPathActive(location.pathname, storyboardPath) ? 'is-active' : ''}`}
              onClick={closeMobileNav}
            >
              AI 漫剧
            </Link>
            <Link to="/" className="studio-shell__mobile-link" onClick={closeMobileNav}>
              切换项目
            </Link>
          </div>
        </ScrollArea.Autosize>
      </Drawer>
    </div>
  )
}
