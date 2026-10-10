import { useEffect } from 'react';
import { useEditorStore } from '@/stores/useEditorStore';

/**
 * Warns before losing unsaved work.
 *
 * Covers the three ways a user can actually lose an unsaved session:
 *   - closing or reloading the tab (`beforeunload`)
 *   - navigating in-app to another model or project (`click` capture on internal
 *     links), which a `beforeunload` prompt would NOT catch because a client-side
 *     route change fires no unload event
 *
 * The guard only fires while the project is genuinely dirty, so a clean session
 * never shows a dialog.
 */

export function useUnsavedChangesGuard(): void {
  const isDirty = useEditorStore((s) => s.isDirty);

  useEffect(() => {
    if (!isDirty) return undefined;

    const onBeforeUnload = (event: BeforeUnloadEvent): string => {
      // Browsers ignore custom text here, but setting returnValue (or returning
      // a value) is what triggers the native confirmation.
      event.preventDefault();
      event.returnValue = '';
      return '';
    };

    const onDocumentClick = (event: MouseEvent): void => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest?.('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      // Only internal navigation is guarded; a download or an external link does
      // not abandon the editing session.
      if (!href || href.startsWith('#') || href.startsWith('http')) return;
      if (!window.confirm('You have unsaved changes. Leave without saving?')) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onDocumentClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onDocumentClick, true);
    };
  }, [isDirty]);
}