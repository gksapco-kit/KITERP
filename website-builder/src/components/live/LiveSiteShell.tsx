import { Link, useNavigate } from 'react-router-dom'
import { NavbarBlock } from '../blocks/NavbarBlock'
import { pageBackgroundStyle } from '../../lib/pageBackground'
import { useBuilderStore } from '../../store/useBuilderStore'

export function LiveSiteShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const pages = useBuilderStore((s) => s.pages)
  const homePage = pages.find((p) => p.kind === 'home') ?? pages[0]
  const navbarBlock = homePage?.blocks.find((b) => b.type === 'navbar')
  const pageBgStyle = homePage ? pageBackgroundStyle(homePage) : undefined

  return (
    <div className="min-h-screen" style={pageBgStyle}>
      {navbarBlock && (
        <header className="sticky top-0 z-20 border-b border-gray-200/80 bg-white/90 backdrop-blur-md">
          <div className="mx-auto w-full max-w-[1600px] px-4 py-3 sm:px-8 lg:px-12">
            <NavbarBlock
              block={navbarBlock}
              interactive
              onNavigate={(s) => navigate(`/site/${s}`)}
              onCartClick={() => navigate('/site/cart')}
            />
          </div>
        </header>
      )}
      <main className="mx-auto w-full max-w-[1600px] px-4 py-8 sm:px-8 lg:px-12">{children}</main>
      <footer className="border-t border-gray-100 py-6 text-center text-xs text-gray-400">
        <Link to="/" className="hover:text-brand-600">
          Edit site in Website Builder
        </Link>
      </footer>
    </div>
  )
}
