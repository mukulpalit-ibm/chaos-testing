import React from 'react';
import './Dashboard.css';

function Dashboard({ stats }) {
  const calculateTotals = () => {
    let totalRequests = 0;
    let totalSuccess = 0;
    let totalFailed = 0;
    let totalLatency = 0;
    let endpointCount = 0;

    Object.values(stats).forEach(stat => {
      totalRequests += stat.total_requests || 0;
      totalSuccess += stat.success_requests || 0;
      totalFailed += stat.failed_requests || 0;
      totalLatency += stat.avg_latency_ms || 0;
      endpointCount++;
    });

    const avgLatency = endpointCount > 0 ? (totalLatency / endpointCount).toFixed(2) : 0;
    const successRate = totalRequests > 0 ? ((totalSuccess / totalRequests) * 100).toFixed(1) : 0;

    return {
      totalRequests,
      totalSuccess,
      totalFailed,
      avgLatency,
      successRate
    };
  };

  const totals = calculateTotals();

  return (
    <div className="dashboard">
      <h2>📊 Overall Statistics</h2>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📈</div>
          <div className="stat-content">
            <div className="stat-label">Total Requests</div>
            <div className="stat-value">{totals.totalRequests}</div>
          </div>
        </div>

        <div className="stat-card success">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <div className="stat-label">Successful</div>
            <div className="stat-value">{totals.totalSuccess}</div>
          </div>
        </div>

        <div className="stat-card failure">
          <div className="stat-icon">❌</div>
          <div className="stat-content">
            <div className="stat-label">Failed</div>
            <div className="stat-value">{totals.totalFailed}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">⚡</div>
          <div className="stat-content">
            <div className="stat-label">Avg Response Time</div>
            <div className="stat-value">{totals.avgLatency} ms</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <div className="stat-label">Success Rate</div>
            <div className="stat-value">{totals.successRate}%</div>
          </div>
        </div>
      </div>

      <h3>📍 Endpoint Statistics</h3>
      <div className="endpoint-stats">
        {Object.keys(stats).length === 0 ? (
          <div className="no-data">No endpoint statistics available yet. Make some requests to see data.</div>
        ) : (
          <table className="stats-table">
            <thead>
              <tr>
                <th>Endpoint</th>
                <th>Total Requests</th>
                <th>Success</th>
                <th>Failed</th>
                <th>Avg Latency (ms)</th>
                <th>Success Rate</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(stats).map(([path, stat]) => {
                const successRate = stat.total_requests > 0 
                  ? ((stat.success_requests / stat.total_requests) * 100).toFixed(1)
                  : 0;
                
                return (
                  <tr key={path}>
                    <td className="endpoint-path">{path}</td>
                    <td>{stat.total_requests}</td>
                    <td className="success-count">{stat.success_requests}</td>
                    <td className="failure-count">{stat.failed_requests}</td>
                    <td>{stat.avg_latency_ms?.toFixed(2) || 0}</td>
                    <td>
                      <div className="success-rate-bar">
                        <div 
                          className="success-rate-fill" 
                          style={{ width: `${successRate}%` }}
                        />
                        <span className="success-rate-text">{successRate}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default Dashboard;

// Made with Bob
