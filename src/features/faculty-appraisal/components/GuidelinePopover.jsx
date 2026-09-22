import { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

// Render outside cards/scroll containers so their overflow cannot clip guidance.
export default function GuidelinePopover({ anchorRef, children, style, ...props }) {
  const panelRef = useRef(null);
  useLayoutEffect(() => {
    const position = () => {
      const panel = panelRef.current;
      const anchor = anchorRef.current;
      if (!panel || !anchor) return;
      const viewport = window.visualViewport;
      const width = viewport?.width || window.innerWidth;
      const height = viewport?.height || window.innerHeight;
      const x = viewport?.offsetLeft || 0;
      const y = viewport?.offsetTop || 0;
      const margin = 12;
      panel.style.maxWidth = `${Math.max(0, width - margin * 2)}px`;
      panel.style.maxHeight = `${Math.max(0, height - margin * 2)}px`;
      const rect = anchor.getBoundingClientRect();
      const bounds = panel.getBoundingClientRect();
      const below = rect.bottom + 8;
      const above = rect.top - bounds.height - 8;
      const top = below + bounds.height <= y + height - margin ? below : above >= y + margin ? above : y + margin;
      panel.style.top = `${Math.max(y + margin, Math.min(top, y + height - margin - bounds.height))}px`;
      panel.style.left = `${Math.max(x + margin, Math.min(rect.left, x + width - margin - bounds.width))}px`;
    };
    position();
    const observer = new ResizeObserver(position);
    observer.observe(panelRef.current);
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    window.visualViewport?.addEventListener('resize', position);
    window.visualViewport?.addEventListener('scroll', position);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
      window.visualViewport?.removeEventListener('resize', position);
      window.visualViewport?.removeEventListener('scroll', position);
    };
  }, [anchorRef]);

  return createPortal(<div {...props} ref={panelRef} style={{ ...style, position: 'fixed', right: 'auto', boxSizing: 'border-box', overflowY: 'auto', overflowX: 'hidden', overscrollBehavior: 'contain' }}>{children}</div>, document.body);
}
