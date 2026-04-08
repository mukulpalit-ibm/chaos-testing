import { useCallback, useRef, useState } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

interface HeaderRow {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

interface RequestResult {
  index: number;
  status: number;
  latencyMs: number;
  bodyPreview: string;
  chaosDetected: boolean;
  error?: string;
}

interface Summary {
  total: number;
  success: number;
  errors: number;
  avgLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  chaosHits: number;
}

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
type Method = typeof METHODS[number];

const BODY_METHODS: Method[] = ['POST', 'PUT', 'PATCH'];

// ── helpers ──────────────────────────────────────────────────────────────────

function statusBadge(status: number) {
  if (status === 0) return 'bg-gray-200 text-gray-700';
  if (status >= 200 && status < 300) return 'bg-green-100 text-green-800';
  if (status >= 400 && status < 500) return 'bg-yellow-100 text-yellow-800';
  return 'bg-red-100 text-red-800';
}

function computeSummary(results: RequestResult[]): Summary {
  if (results.length === 0)
    return { total: 0, success: 0, errors: 0, avgLatencyMs: 0, minLatencyMs: 0, maxLatencyMs: 0, chaosHits: 0 };
  const latencies = results.map(r => r.latencyMs);
  return {
    total:        results.length,
    success:      results.filter(r => r.status >= 200 && r.status < 300).length,
    errors:       results.filter(r => r.status === 0 || r.status >= 400).length,
    avgLatencyMs: Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length),
    minLatencyMs: Math.min(...latencies),
    maxLatencyMs: Math.max(...latencies),
    chaosHits:    results.filter(r => r.chaosDetected).length,
  };
}

function uid() { return Math.random().toString(36).slice(2); }

// ── Component ────────────────────────────────────────────────────────────────

export function Tester() {
  // Config state
  const [baseUrl, setBaseUrl]     = useState('http://localhost:3999');
  const [path, setPath]           = useState('/products');
  const [method, setMethod]       = useState<Method>('GET');
  const [count, setCount]         = useState(10);
  const [delayMs, setDelayMs]     = useState(0);
  const [body, setBody]           = useState('');
  const [headers, setHeaders]     = useState<HeaderRow[]>([
    { id: uid(), key: 'Content-Type', value: 'application/json', enabled: true },
  ]);

  // Run state
  const [running, setRunning]     = useState(false);
  const [progress, setProgress]   = useState(0);
  const [results, setResults]     = useState<RequestResult[]>([]);
  const [hasRun, setHasRun]       = useState(false);
  const abortRef                  = useRef(false);

  // ── header rows ────────────────────────────────────────────────────────────
  const addHeader = () =>
    setHeaders(h => [...h, { id: uid(), key: '', value: '', enabled: true }]);

  const updateHeader = (id: string, field: keyof Omit<HeaderRow, 'id'>, val: string | boolean) =>
    setHeaders(h => h.map(row => row.id === id ? { ...row, [field]: val } : row));

  const removeHeader = (id: string) =>
    setHeaders(h => h.filter(row => row.id !== id));

  // ── run ────────────────────────────────────────────────────────────────────
  const handleRun = useCallback(async () => {
    abortRef.current = false;
    setRunning(true);
    setProgress(0);
    setResults([]);
    setHasRun(true);

    const url    = `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
    const hdrs: Record<string, string> = {};
    for (const row of headers) {
      if (row.enabled && row.key.trim()) hdrs[row.key.trim()] = row.value;
    }

    const collected: RequestResult[] = [];

    for (let i = 0; i < count; i++) {
      if (abortRef.current) break;

      const start = performance.now();
      let status = 0;
      let bodyPreview = '';
      let error: string | undefined;

      try {
        const init: RequestInit = {
          method,
          headers: hdrs,
        };
        if (BODY_METHODS.includes(method) && body.trim()) {
          init.body = body;
        }

        const res     = await fetch(url, init);
        status        = res.status;
        const text    = await res.text();
        bodyPreview   = text.slice(0, 120) + (text.length > 120 ? '…' : '');
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
      }

      const latencyMs     = Math.round(performance.now() - start);
      const chaosDetected = status >= 400 || (bodyPreview.includes('Chaos Injected'));

      const result: RequestResult = { index: i + 1, status, latencyMs, bodyPreview, chaosDetected, error };
      collected.push(result);

      // Batch-update state every request so the table fills in live
      setResults([...collected]);
      setProgress(i + 1);

      if (delayMs > 0 && i < count - 1) {
        await new Promise(res => setTimeout(res, delayMs));
      }
    }

    setRunning(false);
  }, [baseUrl, path, method, count, delayMs, body, headers]);

  const handleStop = () => { abortRef.current = true; };

  const summary = computeSummary(results);
  const successRate = summary.total > 0
    ? Math.round((summary.success / summary.total) * 100) : 0;

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-900">Chaos Test Runner</h2>
        <p className="mt-1 text-sm text-gray-600">
          Fire real HTTP requests through the proxy from the browser. Add headers, pick a method,
          set N — then watch chaos injection happen live.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.6fr]">
        {/* ── LEFT: config ─────────────────────────────────────────────────── */}
        <div className="space-y-5">

          {/* URL + method */}
          <div className="bg-white rounded-lg shadow p-5">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Target</h3>

            <div className="flex gap-2 mb-3">
              <select
                value={method}
                onChange={e => setMethod(e.target.value as Method)}
                disabled={running}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary w-28"
              >
                {METHODS.map(m => <option key={m}>{m}</option>)}
              </select>

              <div className="flex flex-1 rounded-md border border-gray-300 overflow-hidden focus-within:ring-2 focus-within:ring-primary">
                <input
                  value={baseUrl}
                  onChange={e => setBaseUrl(e.target.value)}
                  disabled={running}
                  className="px-3 py-2 text-sm bg-gray-50 border-r border-gray-300 w-52 focus:outline-none"
                  placeholder="http://localhost:3999"
                />
                <input
                  value={path}
                  onChange={e => setPath(e.target.value)}
                  disabled={running}
                  className="px-3 py-2 text-sm flex-1 focus:outline-none"
                  placeholder="/products"
                />
              </div>
            </div>

            <div className="mt-1 text-xs text-gray-400 font-mono truncate">
              → {baseUrl.replace(/\/$/, '')}/{path.replace(/^\//, '')}
            </div>
          </div>

          {/* Count + delay */}
          <div className="bg-white rounded-lg shadow p-5">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Load</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Number of requests
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCount(c => Math.max(1, c - 1))}
                    disabled={running}
                    className="w-8 h-8 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-40"
                  >−</button>
                  <input
                    type="number"
                    min={1} max={200}
                    value={count}
                    onChange={e => setCount(Math.min(200, Math.max(1, parseInt(e.target.value) || 1)))}
                    disabled={running}
                    className="w-16 text-center px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <button
                    onClick={() => setCount(c => Math.min(200, c + 1))}
                    disabled={running}
                    className="w-8 h-8 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-40"
                  >+</button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Delay between requests
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0} max={5000}
                    value={delayMs}
                    onChange={e => setDelayMs(Math.max(0, parseInt(e.target.value) || 0))}
                    disabled={running}
                    className="w-20 px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <span className="text-sm text-gray-500">ms</span>
                </div>
              </div>
            </div>
          </div>

          {/* Headers */}
          <div className="bg-white rounded-lg shadow p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Headers <span className="normal-case font-normal text-gray-400 ml-1">(-H flags)</span>
              </h3>
              <button
                onClick={addHeader}
                disabled={running}
                className="text-xs px-3 py-1 bg-primary text-white rounded hover:bg-blue-600 disabled:opacity-40"
              >
                + Add Header
              </button>
            </div>

            {headers.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-3">No headers. Click + Add Header.</p>
            ) : (
              <div className="space-y-2">
                {headers.map(row => (
                  <div key={row.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={row.enabled}
                      onChange={e => updateHeader(row.id, 'enabled', e.target.checked)}
                      disabled={running}
                      className="h-4 w-4 text-primary border-gray-300 rounded"
                    />
                    <input
                      value={row.key}
                      onChange={e => updateHeader(row.id, 'key', e.target.value)}
                      disabled={running}
                      placeholder="Header name"
                      className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <input
                      value={row.value}
                      onChange={e => updateHeader(row.id, 'value', e.target.value)}
                      disabled={running}
                      placeholder="Value"
                      className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <button
                      onClick={() => removeHeader(row.id)}
                      disabled={running}
                      className="text-gray-400 hover:text-red-500 disabled:opacity-40 text-lg leading-none"
                    >×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Request body */}
          {BODY_METHODS.includes(method) && (
            <div className="bg-white rounded-lg shadow p-5">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                Request Body
              </h3>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                disabled={running}
                rows={5}
                placeholder={'{\n  "key": "value"\n}'}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary resize-y"
              />
            </div>
          )}

          {/* Run button */}
          <div className="flex gap-3 items-center">
            {!running ? (
              <button
                onClick={handleRun}
                className="flex-1 py-3 bg-primary text-white font-semibold rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              >
                ▶  Run {count} Request{count !== 1 ? 's' : ''}
              </button>
            ) : (
              <>
                <div className="flex-1 bg-gray-100 rounded-lg overflow-hidden h-11 relative">
                  <div
                    className="bg-primary h-full transition-all duration-200"
                    style={{ width: `${(progress / count) * 100}%` }}
                  />
                  <span className="absolute inset-0 flex items-center justify-center text-sm font-medium text-gray-700">
                    {progress} / {count} requests
                  </span>
                </div>
                <button
                  onClick={handleStop}
                  className="px-4 py-2 bg-danger text-white rounded-lg hover:bg-red-600 text-sm font-semibold"
                >
                  Stop
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── RIGHT: results ────────────────────────────────────────────────── */}
        <div className="space-y-5">
          {/* Summary cards */}
          {hasRun && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Total',       value: summary.total,       color: 'text-gray-900' },
                { label: 'Success',     value: summary.success,     color: 'text-green-600' },
                { label: 'Errors',      value: summary.errors,      color: 'text-red-600' },
                { label: 'Success %',   value: `${successRate}%`,   color: successRate >= 80 ? 'text-green-600' : 'text-red-600' },
                { label: 'Avg Latency', value: `${summary.avgLatencyMs}ms`, color: 'text-blue-600' },
                { label: 'Chaos Hits',  value: summary.chaosHits,   color: 'text-orange-600' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-white rounded-lg shadow p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">{label}</p>
                  <p className={`text-2xl font-bold ${color}`}>{value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Latency range bar */}
          {hasRun && summary.total > 0 && (
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Min: {summary.minLatencyMs}ms</span>
                <span>Avg: {summary.avgLatencyMs}ms</span>
                <span>Max: {summary.maxLatencyMs}ms</span>
              </div>
              <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="absolute h-full bg-primary rounded-full"
                  style={{
                    left: `${(summary.minLatencyMs / summary.maxLatencyMs) * 100}%`,
                    width: `${((summary.avgLatencyMs - summary.minLatencyMs) / Math.max(summary.maxLatencyMs, 1)) * 100}%`,
                  }}
                />
                <div
                  className="absolute h-full w-1 bg-blue-900 rounded-full"
                  style={{ left: `${(summary.avgLatencyMs / Math.max(summary.maxLatencyMs, 1)) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Results table */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">
                {hasRun ? `Request Log  (${results.length} entries)` : 'Request Log'}
              </h3>
              {results.length > 0 && (
                <button
                  onClick={() => { setResults([]); setHasRun(false); setProgress(0); }}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  Clear
                </button>
              )}
            </div>

            {!hasRun ? (
              <div className="py-16 text-center text-gray-400 text-sm">
                Configure your request above and click Run.
              </div>
            ) : results.length === 0 && running ? (
              <div className="py-16 text-center text-gray-400 text-sm">Sending first request…</div>
            ) : (
              <div className="overflow-auto max-h-[480px]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50 z-10">
                    <tr className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      <th className="px-4 py-2 text-left w-10">#</th>
                      <th className="px-4 py-2 text-left w-20">Status</th>
                      <th className="px-4 py-2 text-right w-24">Latency</th>
                      <th className="px-4 py-2 text-center w-20">Chaos?</th>
                      <th className="px-4 py-2 text-left">Response Preview</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map(r => (
                      <tr key={r.index} className="border-t border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-2 text-gray-400 tabular-nums">{r.index}</td>
                        <td className="px-4 py-2">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${statusBadge(r.status)}`}>
                            {r.status === 0 ? 'ERR' : r.status}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-gray-600 tabular-nums">
                          {r.latencyMs}ms
                        </td>
                        <td className="px-4 py-2 text-center">
                          {r.chaosDetected
                            ? <span className="text-xs font-semibold text-orange-600">⚡ YES</span>
                            : <span className="text-xs text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-2 font-mono text-xs text-gray-500 truncate max-w-xs">
                          {r.error ? (
                            <span className="text-red-500">{r.error}</span>
                          ) : (
                            r.bodyPreview
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
