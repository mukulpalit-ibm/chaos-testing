import { ConfigForm } from '../components/ConfigForm';
import { useConfig } from '../hooks/useConfig';

export function Configuration() {
  const {
    config,
    loading,
    error,
    saving,
    validation,
    routes,
    saveConfig,
    validate,
    addRouteRuleFromDiscovery,
  } = useConfig();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading configuration...</div>
      </div>
    );
  }

  if (error && !config) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        Error: {error}
      </div>
    );
  }

  if (!config) {
    return (
      <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-3 rounded">
        No configuration available.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          Error: {error}
        </div>
      )}

      <ConfigForm
        config={config}
        routes={routes}
        validation={validation}
        saving={saving}
        onValidate={validate}
        onSave={saveConfig}
        onAddRouteRule={addRouteRuleFromDiscovery}
      />
    </div>
  );
}

// Made with Bob
