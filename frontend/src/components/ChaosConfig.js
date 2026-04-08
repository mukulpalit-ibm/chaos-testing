import React, { useState } from 'react';
import './ChaosConfig.css';

function ChaosConfig({ chaosConfigs, stats, onUpdate, onDelete }) {
  const [selectedEndpoint, setSelectedEndpoint] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    random_failure: '0%',
    random_latency_min: '0ms',
    random_latency_max: '0ms'
  });

  // Get all unique endpoints from stats
  const allEndpoints = Object.keys(stats);

  const handleEndpointSelect = (endpoint) => {
    setSelectedEndpoint(endpoint);
    const existingConfig = chaosConfigs[endpoint];
    if (existingConfig) {
      setFormData({
        random_failure: existingConfig.random_failure || '0%',
        random_latency_min: existingConfig.random_latency_min || '0ms',
        random_latency_max: existingConfig.random_latency_max || '0ms'
      });
    } else {
      setFormData({
        random_failure: '0%',
        random_latency_min: '0ms',
        random_latency_max: '0ms'
      });
    }
    setShowForm(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const success = await onUpdate(selectedEndpoint, formData);
    if (success) {
      setShowForm(false);
      setSelectedEndpoint('');
    }
  };

  const handleDelete = async (endpoint) => {
    if (window.confirm(`Are you sure you want to remove chaos config for ${endpoint}?`)) {
      await onDelete(endpoint);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setSelectedEndpoint('');
  };

  return (
    <div className="chaos-config">
      <h2>⚙️ Chaos Configuration</h2>

      <div className="config-section">
        <h3>Active Chaos Configurations</h3>
        {Object.keys(chaosConfigs).length === 0 ? (
          <div className="no-configs">
            No chaos configurations active. Select an endpoint below to configure chaos testing.
          </div>
        ) : (
          <div className="config-list">
            {Object.entries(chaosConfigs).map(([path, config]) => (
              <div key={path} className="config-item">
                <div className="config-header">
                  <span className="config-path">{path}</span>
                  <div className="config-actions">
                    <button 
                      className="btn-edit"
                      onClick={() => handleEndpointSelect(path)}
                    >
                      ✏️ Edit
                    </button>
                    <button 
                      className="btn-delete"
                      onClick={() => handleDelete(path)}
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
                <div className="config-details">
                  <div className="config-detail">
                    <span className="detail-label">Failure Rate:</span>
                    <span className="detail-value">{config.random_failure}</span>
                  </div>
                  <div className="config-detail">
                    <span className="detail-label">Latency Range:</span>
                    <span className="detail-value">
                      {config.random_latency_min} - {config.random_latency_max}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="config-section">
        <h3>Configure Chaos for Endpoint</h3>
        
        {!showForm ? (
          <div className="endpoint-selector">
            <p>Select an endpoint to configure chaos testing:</p>
            {allEndpoints.length === 0 ? (
              <div className="no-endpoints">
                No endpoints available yet. Make some requests through the middleware first.
              </div>
            ) : (
              <div className="endpoint-buttons">
                {allEndpoints.map(endpoint => (
                  <button
                    key={endpoint}
                    className="endpoint-btn"
                    onClick={() => handleEndpointSelect(endpoint)}
                  >
                    {endpoint}
                    {chaosConfigs[endpoint] && <span className="configured-badge">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <form className="chaos-form" onSubmit={handleSubmit}>
            <div className="form-header">
              <h4>Configure: {selectedEndpoint}</h4>
            </div>

            <div className="form-group">
              <label htmlFor="random_failure">
                Random Failure Rate
                <span className="help-text">Percentage of requests that should fail (e.g., 10%)</span>
              </label>
              <input
                type="text"
                id="random_failure"
                name="random_failure"
                value={formData.random_failure}
                onChange={handleInputChange}
                placeholder="e.g., 10%"
              />
            </div>

            <div className="form-group">
              <label htmlFor="random_latency_min">
                Minimum Latency
                <span className="help-text">Minimum artificial delay (e.g., 0ms, 100ms, 1s)</span>
              </label>
              <input
                type="text"
                id="random_latency_min"
                name="random_latency_min"
                value={formData.random_latency_min}
                onChange={handleInputChange}
                placeholder="e.g., 0ms"
              />
            </div>

            <div className="form-group">
              <label htmlFor="random_latency_max">
                Maximum Latency
                <span className="help-text">Maximum artificial delay (e.g., 500ms, 2s)</span>
              </label>
              <input
                type="text"
                id="random_latency_max"
                name="random_latency_max"
                value={formData.random_latency_max}
                onChange={handleInputChange}
                placeholder="e.g., 500ms"
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="btn-submit">
                💾 Save Configuration
              </button>
              <button type="button" className="btn-cancel" onClick={handleCancel}>
                ❌ Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default ChaosConfig;

// Made with Bob
