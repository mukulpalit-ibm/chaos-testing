import { useState } from 'react';
import { api } from '../services/api';
import type { AnalysisResponse, Anomaly, Pattern, Recommendation } from '../types';

// --- Severity / Priority badge colours ---

const severityClass: Record<string, string> = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-red-100 text-red-800',
};

const priorityClass: Record<string, string> = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
};

const healthColour = (score: number) => {
  if (score >= 80) return 'text-green-600';
  if (score >= 50) return 'text-yellow-600';
  return 'text-red-600';
};

// --- Sub-components ---------------------------------------------------------

function PatternCard({ pattern }: { pattern: Pattern }) {
  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="font-medium text-gray-900 capitalize">{pattern.type.replace(/_/g, ' ')}</span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${severityClass[pattern.severity] ?? 'bg-gray-100 text-gray-700'}`}>
          {pattern.severity}
        </span>
      </div>
      <p className="text-sm text-gray-700 mb-2">{pattern.description}</p>
      {pattern.affectedRoutes.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {pattern.affectedRoutes.map(r => (
            <span key={r} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">{r}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function RecommendationCard({ rec }: { rec: Recommendation }) {
  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="font-semibold text-gray-900">{rec.title}</span>
        <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${priorityClass[rec.priority] ?? 'bg-gray-100 text-gray-700'}`}>
          {rec.priority}
        </span>
      </div>
      <p className="text-sm text-gray-700 mb-3">{rec.description}</p>
      {rec.actionItems.length > 0 && (
        <ul className="list-disc pl-5 space-y-1 mb-3">
          {rec.actionItems.map((item, i) => (
            <li key={i} className="text-sm text-gray-700">{item}</li>
          ))}
        </ul>
      )}
      {rec.impact && (
        <p className="text-xs text-gray-500 italic">Impact: {rec.impact}</p>
      )}
    </div>
  );
}

function AnomalyRow({ anomaly }: { anomaly: Anomaly }) {
  const isPositive = anomaly.actual <= anomaly.expected;
  return (
    <tr className="border-t border-gray-100">
      <td className="py-3 pr-4 font-mono text-sm text-gray-800">{anomaly.metric}</td>
      <td className="py-3 pr-4 text-sm text-gray-600 text-right">{anomaly.expected.toFixed(2)}</td>
      <td className={`py-3 pr-4 text-sm font-semibold text-right ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {anomaly.actual.toFixed(2)}
      </td>
      <td className="py-3 pr-4 text-sm text-gray-600 text-right">{anomaly.deviation.toFixed(2)}</td>
      <td className="py-3 text-sm text-gray-700">{anomaly.description}</td>
    </tr>
  );
}

// --- Main page --------------------------------------------------------------

const MODELS = ['llama3', 'phi3', 'mistral', 'gemma'];

export function Analysis() {
  const [model, setModel] = useState('llama3');
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await api.getAnalysis(model);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Trigger panel */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">AI Chaos Analysis</h2>
            <p className="mt-1 text-sm text-gray-600">
              Run an LLM-powered analysis of recent chaos data. Requires Ollama running locally.
            </p>
          </div>

          <div className="flex items-end gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
              <select
                value={model}
                onChange={e => setModel(e.target.value)}
                disabled={loading}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {MODELS.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <button
              onClick={runAnalysis}
              disabled={loading}
              className="px-6 py-2 bg-primary text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Analysing…' : 'Run Analysis'}
            </button>
          </div>
        </div>

        {loading && (
          <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
            <svg className="animate-spin h-4 w-4 text-primary" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Waiting for LLM response — this may take up to 60 seconds…
          </div>
        )}

        {error && (
          <div className="mt-4 bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded text-sm">
            {error}
          </div>
        )}
      </div>

      {result && (
        <>
          {/* Health score + summary */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-sm text-gray-500 uppercase tracking-wide">Health Score</p>
                <p className={`text-6xl font-bold ${healthColour(result.healthScore)}`}>
                  {Math.round(result.healthScore)}
                </p>
                <p className="text-xs text-gray-400 mt-1">out of 100</p>
              </div>

              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Summary</h3>
                <p className="text-gray-700 leading-relaxed">{result.summary}</p>
                <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500">
                  <span>Model: <strong>{result.model}</strong></span>
                  <span>Generated: <strong>{new Date(result.generatedAt).toLocaleString()}</strong></span>
                  <span>Processing time: <strong>{result.processingTimeMs}ms</strong></span>
                </div>
              </div>
            </div>
          </div>

          {/* Patterns */}
          {result.patterns.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Detected Patterns <span className="text-sm font-normal text-gray-500">({result.patterns.length})</span>
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {result.patterns.map((p, i) => (
                  <PatternCard key={i} pattern={p} />
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {result.recommendations.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Recommendations <span className="text-sm font-normal text-gray-500">({result.recommendations.length})</span>
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {result.recommendations.map((rec, i) => (
                  <RecommendationCard key={i} rec={rec} />
                ))}
              </div>
            </div>
          )}

          {/* Anomalies */}
          {result.anomalies.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Anomalies <span className="text-sm font-normal text-gray-500">({result.anomalies.length})</span>
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      <th className="pb-3 pr-4">Metric</th>
                      <th className="pb-3 pr-4 text-right">Expected</th>
                      <th className="pb-3 pr-4 text-right">Actual</th>
                      <th className="pb-3 pr-4 text-right">Deviation</th>
                      <th className="pb-3">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.anomalies.map((a, i) => (
                      <AnomalyRow key={i} anomaly={a} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
