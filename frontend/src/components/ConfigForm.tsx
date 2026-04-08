import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type {
  ChaosConfig,
  ConfigValidationResult,
  DiscoveredRoute,
  HttpMethod,
  RouteChaosRule,
} from '../types';

interface ConfigFormProps {
  config: ChaosConfig;
  routes: DiscoveredRoute[];
  validation: ConfigValidationResult;
  saving: boolean;
  onValidate: (config: ChaosConfig) => Promise<ConfigValidationResult>;
  onSave: (config: ChaosConfig) => Promise<boolean>;
  onAddRouteRule: (path: string, method: HttpMethod) => Promise<boolean>;
}

const defaultRouteRule = (path = '/api/example', method: HttpMethod = 'GET'): RouteChaosRule => ({
  id: `${method}-${path}-${Date.now()}`,
  path,
  method,
  enabled: true,
  latency: {
    enabled: true,
    minDelay: 100,
    maxDelay: 500,
    probability: 0.2,
  },
  errors: {
    enabled: true,
    probability: 0.1,
    statusCodes: [500, 502, 503],
  },
});

const methodOptions: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'ANY'];

// HTTP Error Status Codes with descriptions
const HTTP_ERROR_CODES = [
  // 4xx Client Errors
  { code: 400, label: '400 - Bad Request', description: 'Invalid request syntax' },
  { code: 401, label: '401 - Unauthorized', description: 'Authentication required' },
  { code: 403, label: '403 - Forbidden', description: 'Access denied' },
  { code: 404, label: '404 - Not Found', description: 'Resource not found' },
  { code: 405, label: '405 - Method Not Allowed', description: 'HTTP method not supported' },
  { code: 408, label: '408 - Request Timeout', description: 'Request took too long' },
  { code: 409, label: '409 - Conflict', description: 'Request conflicts with current state' },
  { code: 410, label: '410 - Gone', description: 'Resource permanently deleted' },
  { code: 429, label: '429 - Too Many Requests', description: 'Rate limit exceeded' },
  // 5xx Server Errors
  { code: 500, label: '500 - Internal Server Error', description: 'Generic server error' },
  { code: 502, label: '502 - Bad Gateway', description: 'Invalid upstream response' },
  { code: 503, label: '503 - Service Unavailable', description: 'Server temporarily unavailable' },
  { code: 504, label: '504 - Gateway Timeout', description: 'Upstream server timeout' },
  { code: 507, label: '507 - Insufficient Storage', description: 'Server storage full' },
] as const;

export function ConfigForm({
  config,
  routes,
  validation,
  saving,
  onValidate,
  onSave,
  onAddRouteRule,
}: ConfigFormProps) {
  const [formData, setFormData] = useState<ChaosConfig>(config);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const availableRoutes = useMemo(
    () =>
      routes.filter(
        route =>
          !formData.routes.some(existing => existing.path === route.path && existing.method === route.method),
      ),
    [routes, formData.routes],
  );

  const updateForm = (updater: (current: ChaosConfig) => ChaosConfig) => {
    setFormData(current => {
      const next = updater(current);
      setIsDirty(true);
      return next;
    });
  };

  const updateRouteRule = (routeId: string, updater: (route: RouteChaosRule) => RouteChaosRule) => {
    updateForm(current => ({
      ...current,
      routes: current.routes.map(route => (route.id === routeId ? updater(route) : route)),
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);

    const validationResult = await onValidate(formData);
    if (!validationResult.valid) {
      setMessage({ type: 'error', text: 'Resolve validation errors before saving.' });
      return;
    }

    const success = await onSave({
      ...formData,
      versionName: formData.versionName?.trim() || `Config ${new Date().toLocaleTimeString()}`,
    });

    if (success) {
      setMessage({ type: 'success', text: 'Configuration saved successfully.' });
      setIsDirty(false);
    } else {
      setMessage({ type: 'error', text: 'Failed to save configuration.' });
    }
  };

  const handleReset = async () => {
    setFormData(config);
    setMessage(null);
    setIsDirty(false);
    await onValidate(config);
  };

  const handleAddManualRoute = () => {
    updateForm(current => ({
      ...current,
      routes: [...current.routes, defaultRouteRule()],
    }));
  };

  const handleAddDiscoveredRoute = async (path: string, method: HttpMethod) => {
    const success = await onAddRouteRule(path, method);

    if (success) {
      setFormData(current => ({
        ...current,
        routes: current.routes.some(route => route.path === path && route.method === method)
          ? current.routes
          : [...current.routes, defaultRouteRule(path, method)],
      }));
      setMessage({ type: 'success', text: `Added discovered route rule for ${method} ${path}.` });
      setIsDirty(true);
    } else {
      setMessage({ type: 'error', text: `Failed to add discovered route rule for ${method} ${path}.` });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Chaos Configuration</h2>
            <p className="mt-1 text-sm text-gray-600">
              Configure global chaos behavior, route-level rules, and rollback history.
            </p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
            <div>
              <span className="font-semibold">Unsaved changes:</span> {isDirty ? 'Yes' : 'No'}
            </div>
            {formData.updatedAt && (
              <div>
                <span className="font-semibold">Last updated:</span>{' '}
                {new Date(formData.updatedAt).toLocaleString()}
              </div>
            )}
          </div>
        </div>

        {message && (
          <div
            className={`mt-4 rounded p-4 ${
              message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}
          >
            {message.text}
          </div>
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Guardrails & Validation</h3>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <h4 className="font-semibold text-red-800">Errors</h4>
                {validation.errors.length === 0 ? (
                  <p className="mt-2 text-sm text-red-700">No blocking validation errors.</p>
                ) : (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-700">
                    {validation.errors.map(error => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <h4 className="font-semibold text-amber-800">Warnings</h4>
                {validation.warnings.length === 0 ? (
                  <p className="mt-2 text-sm text-amber-700">No warnings.</p>
                ) : (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-700">
                    {validation.warnings.map(warning => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => onValidate(formData)}
              className="mt-4 px-4 py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Re-run Validation
            </button>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Global Settings</h3>

            <div className="mb-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.enabled}
                  onChange={e => updateForm(current => ({ ...current, enabled: e.target.checked }))}
                  className="mr-2 h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                />
                <span className="text-sm font-medium text-gray-700">Enable Chaos Testing</span>
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Version Name
                </label>
                <input
                  type="text"
                  value={formData.versionName || ''}
                  onChange={e => updateForm(current => ({ ...current, versionName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g. Orders latency experiment"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default Chaos Probability: {Math.round(formData.defaultProbability * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={formData.defaultProbability * 100}
                  onChange={e =>
                    updateForm(current => ({
                      ...current,
                      defaultProbability: parseInt(e.target.value, 10) / 100,
                    }))
                  }
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Global Latency Injection</h3>

              <label className="flex items-center mb-4">
                <input
                  type="checkbox"
                  checked={formData.latency.enabled}
                  onChange={e =>
                    updateForm(current => ({
                      ...current,
                      latency: { ...current.latency, enabled: e.target.checked },
                    }))
                  }
                  className="mr-2 h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                />
                <span className="text-sm font-medium text-gray-700">Enable Latency Injection</span>
              </label>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Min Delay (ms)</label>
                  <input
                    type="number"
                    value={formData.latency.minDelay}
                    onChange={e =>
                      updateForm(current => ({
                        ...current,
                        latency: { ...current.latency, minDelay: parseInt(e.target.value, 10) || 0 },
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    disabled={!formData.latency.enabled}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Max Delay (ms)</label>
                  <input
                    type="number"
                    value={formData.latency.maxDelay}
                    onChange={e =>
                      updateForm(current => ({
                        ...current,
                        latency: { ...current.latency, maxDelay: parseInt(e.target.value, 10) || 0 },
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    disabled={!formData.latency.enabled}
                  />
                </div>
              </div>

              <label className="block text-sm font-medium text-gray-700 mb-2">
                Probability: {Math.round(formData.latency.probability * 100)}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={formData.latency.probability * 100}
                onChange={e =>
                  updateForm(current => ({
                    ...current,
                    latency: { ...current.latency, probability: parseInt(e.target.value, 10) / 100 },
                  }))
                }
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                disabled={!formData.latency.enabled}
              />
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Global Error Injection</h3>

              <label className="flex items-center mb-4">
                <input
                  type="checkbox"
                  checked={formData.errors.enabled}
                  onChange={e =>
                    updateForm(current => ({
                      ...current,
                      errors: { ...current.errors, enabled: e.target.checked },
                    }))
                  }
                  className="mr-2 h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                />
                <span className="text-sm font-medium text-gray-700">Enable Error Injection</span>
              </label>

              <label className="block text-sm font-medium text-gray-700 mb-2">
                Probability: {Math.round(formData.errors.probability * 100)}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={formData.errors.probability * 100}
                onChange={e =>
                  updateForm(current => ({
                    ...current,
                    errors: { ...current.errors, probability: parseInt(e.target.value, 10) / 100 },
                  }))
                }
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer mb-4"
                disabled={!formData.errors.enabled}
              />

              <label className="block text-sm font-medium text-gray-700 mb-2">
                Error Status Codes
              </label>
              <div className="space-y-2 max-h-64 overflow-y-auto border border-gray-300 rounded-md p-3 bg-gray-50">
                {HTTP_ERROR_CODES.map(({ code, label, description }) => (
                  <label
                    key={code}
                    className={`flex items-start p-2 rounded hover:bg-gray-100 cursor-pointer ${
                      !formData.errors.enabled ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={formData.errors.statusCodes.includes(code)}
                      onChange={e => {
                        const isChecked = e.target.checked;
                        updateForm(current => ({
                          ...current,
                          errors: {
                            ...current.errors,
                            statusCodes: isChecked
                              ? [...current.errors.statusCodes, code].sort((a, b) => a - b)
                              : current.errors.statusCodes.filter(c => c !== code),
                          },
                        }));
                      }}
                      disabled={!formData.errors.enabled}
                      className="mt-1 mr-3 h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{label}</div>
                      <div className="text-xs text-gray-600">{description}</div>
                    </div>
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Selected: {formData.errors.statusCodes.length > 0
                  ? formData.errors.statusCodes.join(', ')
                  : 'None'}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Route-Level Chaos Rules</h3>
                <p className="text-sm text-gray-600">Create targeted experiments per route and method.</p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleAddManualRoute}
                  className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Add Manual Rule
                </button>
              </div>
            </div>

            {availableRoutes.length > 0 && (
              <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
                <h4 className="font-semibold text-blue-900">Discovered Routes</h4>
                <div className="mt-3 grid gap-3">
                  {availableRoutes.map(route => (
                    <div
                      key={route.id}
                      className="flex flex-col gap-3 rounded-md border border-blue-100 bg-white p-3 md:flex-row md:items-center md:justify-between"
                    >
                      <div>
                        <p className="font-medium text-gray-900">
                          {route.method} {route.path}
                        </p>
                        <p className="text-sm text-gray-600">
                          {route.requestCount} requests • Avg latency {route.averageLatency}ms • Error rate{' '}
                          {route.errorRate.toFixed(1)}%
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAddDiscoveredRoute(route.path, route.method)}
                        className="px-4 py-2 rounded-md bg-primary text-white text-sm font-medium hover:bg-blue-600"
                      >
                        Add Rule
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4">
              {formData.routes.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-gray-500">
                  No route-specific rules configured yet.
                </div>
              ) : (
                formData.routes.map(route => (
                  <div key={route.id} className="rounded-lg border border-gray-200 p-4">
                    <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr_auto]">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Path</label>
                          <input
                            type="text"
                            value={route.path}
                            onChange={e =>
                              updateRouteRule(route.id, current => ({ ...current, path: e.target.value }))
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Method</label>
                          <select
                            value={route.method}
                            onChange={e =>
                              updateRouteRule(route.id, current => ({
                                ...current,
                                method: e.target.value as HttpMethod,
                              }))
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                          >
                            {methodOptions.map(method => (
                              <option key={method} value={method}>
                                {method}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <label className="flex items-center text-sm font-medium text-gray-700">
                          <input
                            type="checkbox"
                            checked={route.enabled}
                            onChange={e =>
                              updateRouteRule(route.id, current => ({ ...current, enabled: e.target.checked }))
                            }
                            className="mr-2 h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                          />
                          Enabled
                        </label>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          updateForm(current => ({
                            ...current,
                            routes: current.routes.filter(currentRoute => currentRoute.id !== route.id),
                          }))
                        }
                        className="px-4 py-2 rounded-md bg-red-50 text-red-700 text-sm font-medium hover:bg-red-100"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="mt-4 grid gap-4 xl:grid-cols-2">
                      <div className="rounded-md border border-gray-200 p-4">
                        <h4 className="font-semibold text-gray-900 mb-3">Latency Rule</h4>
                        <label className="flex items-center mb-3 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={route.latency.enabled}
                            onChange={e =>
                              updateRouteRule(route.id, current => ({
                                ...current,
                                latency: { ...current.latency, enabled: e.target.checked },
                              }))
                            }
                            className="mr-2 h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                          />
                          Enable route latency
                        </label>

                        <div className="grid grid-cols-2 gap-4 mb-3">
                          <input
                            type="number"
                            value={route.latency.minDelay}
                            onChange={e =>
                              updateRouteRule(route.id, current => ({
                                ...current,
                                latency: {
                                  ...current.latency,
                                  minDelay: parseInt(e.target.value, 10) || 0,
                                },
                              }))
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            disabled={!route.latency.enabled}
                          />
                          <input
                            type="number"
                            value={route.latency.maxDelay}
                            onChange={e =>
                              updateRouteRule(route.id, current => ({
                                ...current,
                                latency: {
                                  ...current.latency,
                                  maxDelay: parseInt(e.target.value, 10) || 0,
                                },
                              }))
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            disabled={!route.latency.enabled}
                          />
                        </div>

                        <label className="block text-sm text-gray-700 mb-2">
                          Probability: {Math.round(route.latency.probability * 100)}%
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={route.latency.probability * 100}
                          onChange={e =>
                            updateRouteRule(route.id, current => ({
                              ...current,
                              latency: {
                                ...current.latency,
                                probability: parseInt(e.target.value, 10) / 100,
                              },
                            }))
                          }
                          className="w-full"
                          disabled={!route.latency.enabled}
                        />
                      </div>

                      <div className="rounded-md border border-gray-200 p-4">
                        <h4 className="font-semibold text-gray-900 mb-3">Error Rule</h4>
                        <label className="flex items-center mb-3 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={route.errors.enabled}
                            onChange={e =>
                              updateRouteRule(route.id, current => ({
                                ...current,
                                errors: { ...current.errors, enabled: e.target.checked },
                              }))
                            }
                            className="mr-2 h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                          />
                          Enable route errors
                        </label>

                        <label className="block text-sm text-gray-700 mb-2">
                          Probability: {Math.round(route.errors.probability * 100)}%
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={route.errors.probability * 100}
                          onChange={e =>
                            updateRouteRule(route.id, current => ({
                              ...current,
                              errors: {
                                ...current.errors,
                                probability: parseInt(e.target.value, 10) / 100,
                              },
                            }))
                          }
                          className="w-full mb-3"
                          disabled={!route.errors.enabled}
                        />

                        <label className="block text-sm text-gray-700 mb-2">Error Status Codes</label>
                        <div className="space-y-1 max-h-48 overflow-y-auto border border-gray-300 rounded-md p-2 bg-gray-50">
                          {HTTP_ERROR_CODES.map(({ code, label, description }) => (
                            <label
                              key={code}
                              className={`flex items-start p-2 rounded hover:bg-gray-100 cursor-pointer text-sm ${
                                !route.errors.enabled ? 'opacity-50 cursor-not-allowed' : ''
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={route.errors.statusCodes.includes(code)}
                                onChange={e => {
                                  const isChecked = e.target.checked;
                                  updateRouteRule(route.id, current => ({
                                    ...current,
                                    errors: {
                                      ...current.errors,
                                      statusCodes: isChecked
                                        ? [...current.errors.statusCodes, code].sort((a, b) => a - b)
                                        : current.errors.statusCodes.filter(c => c !== code),
                                    },
                                  }));
                                }}
                                disabled={!route.errors.enabled}
                                className="mt-0.5 mr-2 h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                              />
                              <div className="flex-1">
                                <div className="font-medium text-gray-900">{label}</div>
                                <div className="text-xs text-gray-600">{description}</div>
                              </div>
                            </label>
                          ))}
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                          Selected: {route.errors.statusCodes.length > 0
                            ? route.errors.statusCodes.join(', ')
                            : 'None'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Configuration Preview</h3>
            <pre className="bg-gray-50 p-4 rounded border border-gray-200 overflow-x-auto text-sm">
              {JSON.stringify(formData, null, 2)}
            </pre>
          </div>

          <div className="flex flex-wrap gap-4">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-primary text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>

            <button
              type="button"
              onClick={handleReset}
              disabled={saving}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reset
            </button>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Phase 1 Safety Guardrails</h3>
            <ul className="space-y-2 text-sm text-gray-700 list-disc pl-5">
              <li>Validate every config before save.</li>
              <li>Keep probabilities conservative for first experiments.</li>
              <li>Use route-level targeting instead of broad global chaos when possible.</li>
              <li>Rollback immediately if success rate drops unexpectedly.</li>
            </ul>
          </div>
        </aside>
      </section>
    </form>
  );
}

// Made with Bob
