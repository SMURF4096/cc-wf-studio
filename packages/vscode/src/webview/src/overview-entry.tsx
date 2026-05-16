/**
 * Lightweight read-only preview entry.
 *
 * Powers `ccwf preview` — the CLI serves this HTML, injects a workflow JSON
 * into `window.__CC_WF_PREVIEW__`, and the browser renders the existing
 * `WorkflowOverview` component (Mermaid + Markdown panes). No editor, no
 * canvas, no VSCode message channel.
 *
 * `overview-polyfill` MUST be the first import: it installs a
 * `window.acquireVsCodeApi` stub that catches the one bridge call this view
 * actually makes (`OPEN_EXTERNAL_URL` for markdown links) before
 * `vscode-api.ts` reads `window.acquireVsCodeApi?.()`.
 */

import './overview-polyfill';
import type { Workflow } from '@cc-wf-studio/core';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { WorkflowOverview } from './components/overview/WorkflowOverview';
import { I18nProvider } from './i18n/i18n-context';
import './styles/main.css';

interface PreviewBootstrap {
  workflow?: Workflow | null;
  locale?: string;
  /** When set, the page subscribes to this Server-Sent Events stream and
   * reloads on `workflow-changed`. CLI sets it when `--watch` is in effect. */
  sseUrl?: string;
}

const cfg = (window.__CC_WF_PREVIEW__ ?? {}) as PreviewBootstrap;
const initialWorkflow: Workflow | null = (cfg.workflow as Workflow | undefined) ?? null;
const locale = typeof cfg.locale === 'string' && cfg.locale.length > 0 ? cfg.locale : 'en';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <I18nProvider locale={locale}>
      <WorkflowOverview
        workflow={initialWorkflow}
        splitRatioStorageKey="cc-wf-studio.previewMermaidPanelRatio"
      />
    </I18nProvider>
  </React.StrictMode>
);

// Auto-reload when the CLI signals the source file changed (--watch).
if (typeof cfg.sseUrl === 'string' && cfg.sseUrl.length > 0) {
  try {
    const source = new EventSource(cfg.sseUrl);
    source.addEventListener('workflow-changed', () => {
      window.location.reload();
    });
    source.addEventListener('error', () => {
      // EventSource auto-retries; we just log so the user can see why a
      // dropped connection isn't reloading the page.
      console.warn('[ccwf preview] SSE connection error; auto-reload may be stalled.');
    });
  } catch (error) {
    console.warn('[ccwf preview] Failed to start auto-reload listener:', error);
  }
}
