import { useEffect, useRef, useState } from 'react'
import {
  Archive,
  Bell,
  CalendarDays,
  ClipboardCheck,
  Folder,
  History,
  House,
  List,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { didCountIncrease } from '../../utils/navBadgeLogic.jsx'
import { getSidebarIconName } from '../../utils/sidebarNavigation.jsx'

const sidebarIconComponents = {
  Archive,
  Bell,
  CalendarDays,
  ClipboardCheck,
  Folder,
  History,
  House,
  List,
  ShieldCheck,
  Users,
}

export function SidebarTab({ item, activeNav, onSelect, isEditing = false, onRemove = null }) {
  const previousCountRef = useRef(item.count)
  const [countIncreased, setCountIncreased] = useState(false)

  useEffect(() => {
    if (didCountIncrease(previousCountRef.current, item.count)) {
      setCountIncreased(false)
      const animationFrame = window.requestAnimationFrame(() => setCountIncreased(true))
      const timer = window.setTimeout(() => setCountIncreased(false), 900)
      previousCountRef.current = item.count

      return () => {
        window.cancelAnimationFrame(animationFrame)
        window.clearTimeout(timer)
      }
    }

    previousCountRef.current = item.count
    return undefined
  }, [item.count])

  return (
    <div className={activeNav === item.id ? 'nav-row active' : 'nav-row'}>
      <button
        type="button"
        className="nav-link"
        onClick={() => onSelect(item.id)}
      >
        <SidebarNavIcon itemId={item.id} />
        <span>{item.label}</span>
        {item.count && <small className={countIncreased ? 'count-bump' : ''}>{item.count}</small>}
      </button>
      {isEditing && onRemove && (
        <button
          type="button"
          className="nav-delete"
          aria-label={`Delete ${item.label}`}
          onClick={() => onRemove(item.id)}
        >
          x
        </button>
      )}
    </div>
  )
}

export function SidebarNavIcon({ itemId }) {
  const iconName = getSidebarIconName(itemId)
  const Icon = sidebarIconComponents[iconName]

  return Icon ? <Icon className="nav-icon" size={18} strokeWidth={1.7} aria-hidden="true" /> : null
}

export function SidebarSection({
  title,
  items,
  activeNav,
  onSelect,
}) {
  return (
    <div className="nav-group">
      <div className="nav-group-title">
        <span>{title}</span>
      </div>

      {items.map((item) => (
        <SidebarTab
          key={item.id}
          item={item}
          activeNav={activeNav}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}
