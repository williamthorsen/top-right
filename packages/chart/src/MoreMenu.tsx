import { type KeyboardEvent, type ReactElement, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

export interface MoreMenuProps {
  isChainShown: boolean;
  /** Whether the shown items contain a blocker chain; without one, the chain item is disabled. */
  hasChain: boolean;
  onChainShownChange: (isChainShown: boolean) => void;
}

/** The keys on the button that open the menu at its first item. */
const OPENING_KEYS: ReadonlySet<string> = new Set(['ArrowDown', 'Enter', ' ']);
/** The space kept between the menu and the viewport's right edge, in pixels. */
const VIEWPORT_GAP = 8;

/**
 * The strip's More menu, a menu button that holds the chart's advanced views, following the WAI-ARIA menu button
 * pattern: arrow keys move within the open menu, Escape closes it and returns focus to the button, and choosing an item
 * closes it.
 */
export function MoreMenu({ isChainShown, hasChain, onChainShownChange }: MoreMenuProps): ReactElement {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState<number>();
  const [shift, setShift] = useState(0);

  const items = [
    {
      label: 'Longest blocker chain',
      isChecked: isChainShown,
      isDisabled: !hasChain,
      onChoose: () => onChainShownChange(!isChainShown),
    },
  ];

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
    if (focusIndex !== undefined) menu.querySelectorAll<HTMLElement>('[role="menuitemcheckbox"]')[focusIndex]?.focus();
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
    close(true);
  }

  return (
    <div className="tr-more" ref={rootRef}>
      <button
        aria-controls={menuId}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="tr-menu-button"
        onClick={() => (isOpen ? close(false) : open(0))}
        onKeyDown={handleButtonKeyDown}
        ref={buttonRef}
        type="button"
      >
        More
      </button>
      <div
        aria-label="More"
        className="tr-menu"
        hidden={!isOpen}
        id={menuId}
        onKeyDown={handleMenuKeyDown}
        ref={menuRef}
        role="menu"
        tabIndex={-1}
        style={{ left: shift }}
      >
        {items.map((item, index) => (
          <div
            aria-checked={item.isChecked}
            aria-disabled={item.isDisabled}
            className="tr-menu-item"
            key={item.label}
            onClick={() => choose(index)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              choose(index);
            }}
            role="menuitemcheckbox"
            tabIndex={index === (focusIndex ?? 0) ? 0 : -1}
          >
            <span aria-hidden="true" className="tr-menu-check">
              {item.isChecked ? '✓' : ''}
            </span>
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}
