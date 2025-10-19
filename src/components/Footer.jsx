import Link from 'next/link'
import { useRouter } from 'next/router'

import { Container } from '@/components/Container'

function NavLink({ href, children }) {
  return (
    <Link
      href={href}
      className="transition hover:text-teal-500 dark:hover:text-teal-400"
    >
      {children}
    </Link>
  )
}

export function Footer() {
  let router = useRouter()
  let noNavParam = router.query['no-nav']
  let hideNavigation = Array.isArray(noNavParam)
    ? noNavParam.some(
        (value) => typeof value === 'string' && value.toLowerCase() === 'true'
      )
    : typeof noNavParam === 'string' && noNavParam.toLowerCase() === 'true'

  return (
    <footer className="mt-32">
      <Container.Outer>
        <div className="border-t border-zinc-100 pb-16 pt-10 dark:border-zinc-700/40">
          <Container.Inner>
            <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
              {!hideNavigation && (
                <div className="flex gap-6 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  <NavLink href="/">Home</NavLink>
                  <NavLink href="/about">About</NavLink>
                  <NavLink href="/projects">Projects</NavLink>
                  <NavLink href="/photography">Photography</NavLink>
                  {/* <NavLink href="/speaking">Speaking</NavLink> */}
                  <NavLink href="/tools">Tools</NavLink>
                </div>
              )}
              <p className="text-sm text-zinc-400 dark:text-zinc-500">
                &copy; {new Date().getFullYear()} Gan Tu. All rights reserved.
              </p>
            </div>
          </Container.Inner>
        </div>
      </Container.Outer>
    </footer>
  )
}
