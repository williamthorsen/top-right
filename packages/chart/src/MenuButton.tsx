import {
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

export interface MenuButtonItem {
  label: string;
  role: 'menuitemcheckbox' | 'menuitemradio';
  isChecked: boolean;
  isDisabled?: boolean;
  onChoose: () => void;
}

/** Items shown under a visible heading, which names their group. */
export interface MenuButtonGroup {
  label: string;
  items: readonly MenuButtonItem[];
}

export interface MenuButtonProps {
  /** The button's visible content, which the caret follows. */
  children: ReactNode;
  /** The button's accessible name when its content does not state it. */
  buttonLabel?: string;
  menuLabel: string;
  /** The menu's items and groups of items, which the arrow keys move across as one list. */
  items: readonly (MenuButtonGroup | MenuButtonItem)[];
  /** Whether choosing an item closes the menu; without it, the menu stays open while its items are toggled. */
  closesOnChoose?: boolean;
  /** A class added to the button, beside `tr-menu-button`. */
  className?: string;
}

/** The keys on the button that open the menu at its first item. */
const OPENING_KEYS: ReadonlySet<string> = new Set(['ArrowDown', 'Enter', ' ']);
/** The space kept between the menu and the viewport's right edge, in pixels. */
const VIEWPORT_GAP = 8;

/**
 * A menu button that follows the WAI-ARIA menu button pattern: arrow keys move within the open menu, Escape closes it
 * and returns focus to the button, and choosing an item closes it unless `closesOnChoose` is false.
 */
export function MenuButton({
  children,
  buttonLabel,
  menuLabel,
  items: entries,
  closesOnChoose = true,
  className,
}: MenuButtonProps): ReactElement {
  const menuId = useId();
  const groupIdPrefix = useId();
  const items = entries.flatMap((entry) => (isGroup(entry) ? entry.items : [entry]));
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState<number>();
  const [shift, setShift] = useState(0);

  // Close on a press outside the menu and its button.
  useEffect(() => {
    if (!isOpen) return;
    function closeOnOutsidePress(event: PointerEvent): void {
      if (event.target instanceof Node && rootRef.current?.contains(event.target)) return;
      setIsOpen(false);
    }
    document.addEventListener('pointerdown', closeOnOutsidePress);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePress);
  }, [isOpen]);

  // Move focus to the item that the keyboard chose, and keep the open menu inside the viewport.
  useLayoutEffect(() => {
    if (!isOpen) return;
    const menu = menuRef.current;
    if (!menu) return;
    const overflow = menu.getBoundingClientRect().right - (window.innerWidth - VIEWPORT_GAP);
    if (overflow > 0) setShift(-overflow);
    if (focusIndex !== undefined) menu.querySelectorAll<HTMLElement>('[role^="menuitem"]')[focusIndex]?.focus();
  }, [isOpen, focusIndex]);

  function open(index: number): void {
    setShift(0);
    setIsOpen(true);
    setFocusIndex(index);
  }

  function close(returnFocus: boolean): void {
    setIsOpen(false);
    setFocusIndex(undefined);
    if (returnFocus) buttonRef.current?.focus();
  }

  function handleButtonKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
    if (OPENING_KEYS.has(event.key)) {
      event.preventDefault();
      open(0);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      open(items.length - 1);
    }
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const current = focusIndex ?? 0;
    const moves: Readonly<Record<string, number>> = {
      ArrowDown: (current + 1) % items.length,
      ArrowUp: (current - 1 + items.length) % items.length,
      End: items.length - 1,
      Home: 0,
    };
    const next = moves[event.key];
    if (next !== undefined) {
      event.preventDefault();
      setFocusIndex(next);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
    } else if (event.key === 'Tab') {
      close(false);
    }
  }

  function choose(index: number): void {
    const item = items[index];
    if (!item || item.isDisabled) return;
    item.onChoose();
    if (closesOnChoose) close(true);
    else setFocusIndex(index);
  }

  function renderItem(item: MenuButtonItem, index: number, groupLabel: string): ReactElement {
    return (
      <div
        aria-checked={item.isChecked}
        aria-disabled={item.isDisabled}
        className="tr-menu-item"
        key={`${groupLabel}:${item.label}`}
        onClick={() => choose(index)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          choose(index);
        }}
        role={item.role}
        tabIndex={index === (focusIndex ?? 0) ? 0 : -1}
      >
        <span aria-hidden="true" className="tr-menu-check">
          {item.isChecked ? '✓' : ''}
        </span>
        {item.label}
      </div>
    );
  }

  /** Returns each entry's element, numbering the items across groups as the arrow keys move through them. */
  function renderEntries(): ReactElement[] {
    let index = 0;
    return entries.map((entry, entryIndex) => {
      if (!isGroup(entry)) return renderItem(entry, index++, '');
      const headingId = `${groupIdPrefix}-${entryIndex}`;
      return (
        <div aria-labelledby={headingId} className="tr-menu-group" key={`group:${entry.label}`} role="group">
          <div className="tr-menu-group-label" id={headingId} role="presentation">
            {entry.label}
          </div>
          {entry.items.map((item) => renderItem(item, index++, entry.label))}
        </div>
      );
    });
  }

  return (
    <div className="tr-menu-root" ref={rootRef}>
      <button
        aria-controls={menuId}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={buttonLabel}
        className={className === undefined ? 'tr-menu-button' : `tr-menu-button ${className}`}
        onClick={() => (isOpen ? close(false) : open(0))}
        onKeyDown={handleButtonKeyDown}
        ref={buttonRef}
        type="button"
      >
        {children}
        <span aria-hidden="true" className="tr-menu-caret">
          {isOpen ? '▴' : '▾'}
        </span>
      </button>
      <div
        aria-label={menuLabel}
        className="tr-menu"
        hidden={!isOpen}
        id={menuId}
        onKeyDown={handleMenuKeyDown}
        ref={menuRef}
        role="menu"
        tabIndex={-1}
        style={{ left: shift }}
      >
        {renderEntries()}
      </div>
    </div>
  );
}

// region | Helpers
function isGroup(entry: MenuButtonGroup | MenuButtonItem): entry is MenuButtonGroup {
  return 'items' in entry;
}
// endregion | Helpers
