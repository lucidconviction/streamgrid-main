/**
 * Headless end-to-end check for the sports TV guide watch buttons.
 *
 * Launches Chromium against the dev server, opens the Live Sports page, opens
 * the TV Guide tab and clicks the first "Watch" button — then reports which
 * channel the player opened and whether the player rendered a source.
 *
 * Usage: npx tsx scripts/check-sports-guide.ts [url]
 */
import { spawn } from 'child_process';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import WebSocket from 'ws';

const APP_URL = process.argv[2] || 'http://localhost:4207/';
const PORT = 9333;
const PROFILE = mkdtempSync(join(tmpdir(), 'sg-chrome-'));

const chrome = spawn('/snap/bin/chromium', [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${PROFILE}`,
  '--no-sandbox',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--window-size=1600,1000',
  APP_URL,
], { stdio: 'ignore' });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function shutdown(code: number) {
  try { chrome.kill('SIGKILL'); } catch { /* snap wrapper may refuse SIGKILL */ }
  process.exit(code);
}

async function waitForTarget(): Promise<string> {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json`);
      const targets = (await res.json()) as any[];
      const page = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      /* devtools not up yet */
    }
    await sleep(500);
  }
  throw new Error('Chromium DevTools endpoint never came up');
}

class Cdp {
  private ws: WebSocket;
  private id = 0;
  private pending = new Map<number, (value: any) => void>();
  private listeners: ((msg: any) => void)[] = [];

  constructor(url: string) {
    this.ws = new WebSocket(url);
    this.ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.id && this.pending.has(msg.id)) {
        const resolver = this.pending.get(msg.id)!;
        this.pending.delete(msg.id);
        resolver(msg);
      } else if (msg.method) {
        this.listeners.forEach((l) => l(msg));
      }
    });
    this.ws.on('close', (code, reason) => {
      console.log(`[cdp] websocket closed code=${code} reason=${reason?.toString()}`);
      for (const [, resolver] of this.pending) {
        resolver({ error: { message: 'websocket closed' } });
      }
      this.pending.clear();
    });
    this.ws.on('error', (err: any) => console.log('[cdp] websocket error', err?.message));
  }

  on(fn: (msg: any) => void) { this.listeners.push(fn); }

  close() { this.ws.close(); }

  ready() {
    return new Promise<void>((resolve) => this.ws.once('open', () => resolve()));
  }

  send(method: string, params: any = {}, timeoutMs = 15000): Promise<any> {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP ${method} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      this.pending.set(id, (value) => {
        clearTimeout(timer);
        if (value?.error) reject(new Error(`CDP ${method} error: ${JSON.stringify(value.error)}`));
        else resolve(value);
      });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval<T>(expression: string, timeoutMs = 15000): Promise<T> {
    const res = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    }, timeoutMs);
    if (res.result?.exceptionDetails) {
      throw new Error(res.result.exceptionDetails.text + ' ' + JSON.stringify(res.result.exceptionDetails.exception));
    }
    return res.result?.result?.value as T;
  }
}

async function main() {
  const wsUrl = await waitForTarget();
  const cdp = new Cdp(wsUrl);
  await cdp.ready();

  const consoleLines: string[] = [];
  cdp.on((msg) => {
    if (msg.method === 'Runtime.consoleAPICalled') {
      const text = (msg.params.args || [])
        .map((a: any) => a.value ?? a.description ?? a.unserializableValue ?? '')
        .join(' ');
      consoleLines.push(`[console.${msg.params.type}] ${text}`);
    } else if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      consoleLines.push(`[exception] ${d.text} ${d.exception?.description || ''}`);
    } else if (msg.method === 'Log.entryAdded') {
      const e = msg.params.entry;
      consoleLines.push(`[log.${e.level}] ${e.text}${e.url ? ' ' + e.url : ''}`);
    }
  });

  await cdp.send('Runtime.enable');
  await cdp.send('Log.enable');
  await cdp.send('Page.enable');

  // Let the app boot and fetch its catalog.
  await sleep(9000);

  const nav = await cdp.eval<boolean>(`(() => {
    const el = Array.from(document.querySelectorAll('button, a')).find(b => (b.textContent||'').trim() === 'Live Sports');
    if (!el) return false;
    el.click();
    return true;
  })()`);
  console.log('opened Live Sports page:', nav);
  await sleep(2500);

  const guide = await cdp.eval<boolean>(`(() => {
    const el = Array.from(document.querySelectorAll('button')).find(b => (b.textContent||'').trim().startsWith('TV Guide'));
    if (!el) return false;
    el.click();
    return true;
  })()`);
  console.log('opened TV Guide tab:', guide);
  await sleep(1200);

  const rows = await cdp.eval<any[]>(`(() => {
    const rows = Array.from(document.querySelectorAll('div.grid')).filter(d => (d.className||'').includes('grid-cols-[48px_100px_1fr_44px_44px_24px]'));
    return rows.map(row => {
      const watch = Array.from(row.querySelectorAll('button')).find(b => (b.getAttribute('title')||'').startsWith('Watch on'));
      return {
        match: row.querySelector('span:nth-child(3)')?.textContent?.trim(),
        target: watch?.getAttribute('title'),
        disabled: watch?.disabled ?? null
      };
    });
  })()`);
  console.log('\nTV Guide rows → resolved channel:');
  rows.forEach((r) => console.log(`  ${(r.match || '').padEnd(42)} -> ${r.target}${r.disabled ? ' (disabled)' : ''}`));

  const clicked = await cdp.eval<any>(`(() => {
    const rows = Array.from(document.querySelectorAll('div.grid')).filter(d => (d.className||'').includes('grid-cols-[48px_100px_1fr_44px_44px_24px]'));
    const row = rows.find(r => {
      const w = Array.from(r.querySelectorAll('button')).find(b => (b.getAttribute('title')||'').startsWith('Watch on'));
      return w && !w.disabled;
    });
    if (!row) return null;
    const watch = Array.from(row.querySelectorAll('button')).find(b => (b.getAttribute('title')||'').startsWith('Watch on'));
    watch.click();
    return watch.getAttribute('title');
  })()`);
  console.log('\nclicked watch button:', clicked);

  // Poll the renderer: it may be busy loading the embed, or blocked entirely.
  let player: any = null;
  for (let i = 0; i < 8; i++) {
    await sleep(3000);
    try {
      player = await cdp.eval<any>(`(() => {
        const text = document.body.innerText;
        const iframes = Array.from(document.querySelectorAll('iframe')).map(f => f.getAttribute('src'));
        const videos = Array.from(document.querySelectorAll('video')).map(v => v.getAttribute('src'));
        return {
          inPlayer: text.includes('Back to All Channels'),
          noSourceMessage: text.includes('No stream source available'),
          iframes,
          videos,
          title: document.title
        };
      })()`, 8000);
      console.log(`poll ${i + 1}:`, JSON.stringify(player));
      if (player?.inPlayer) break;
    } catch (e: any) {
      console.log(`poll ${i + 1}: renderer busy (${e.message})`);
      // Is the page target still alive?
      try {
        const res = await fetch(`http://127.0.0.1:${PORT}/json`);
        const targets = (await res.json()) as any[];
        console.log('  targets:', targets.map((t) => `${t.type}:${t.title}`).join(' | '));
      } catch (err: any) {
        console.log('  /json unreachable:', err.message);
      }
    }
  }

  if (player) {
    console.log('\nplayer state:', JSON.stringify(player, null, 2));
  }

  // Screenshot for visual confirmation
  try {
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' }, 8000);
    const file = '/tmp/opencode/guide-shot.png';
    writeFileSync(file, Buffer.from(shot.result.data, 'base64'));
    console.log('\nscreenshot:', file);
  } catch (e: any) {
    console.log('\nscreenshot failed:', e.message);
  }

  if (consoleLines.length) {
    console.log('\n--- browser console ---');
    consoleLines.slice(-60).forEach((l) => console.log(l));
  }

  cdp.close();
  shutdown(0);
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  shutdown(1);
});
