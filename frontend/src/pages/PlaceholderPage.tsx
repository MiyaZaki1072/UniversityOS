import { Link, useLocation } from 'react-router-dom'
import { findNavItem } from '../components/layout/nav'
import { Button } from '../components/ui/Button'
import { EmptyState, PageHeader, RecordCard } from '../components/ui/Panels'

/** Holds the place of modules that haven't been redesigned yet. */
export function PlaceholderPage() {
  const { pathname } = useLocation()
  const item = findNavItem(pathname)
  return (
    <>
      <PageHeader division={`Division ${item.code} · ${item.label}`} title={item.title} />
      <RecordCard>
        <EmptyState
          code="FILE PENDING REVIEW"
          title={`${item.label} is next in the redesign queue`}
          body="The visual direction is being reviewed on the Dashboard first. This module will be built on the same design system once it's approved."
          action={
            <Link to="/">
              <Button variant="secondary" size="sm">
                Back to briefing
              </Button>
            </Link>
          }
        />
      </RecordCard>
    </>
  )
}
