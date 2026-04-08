import React, { useState, useEffect } from 'react';
import './App.css';
import Dashboard from './components/Dashboard';
import ChaosConfig from './components/ChaosConfig';

const MIDDLEWARE_URL = 'http://localhost:4000';

function App() {
  const [chaosData, setChaosData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchChaosData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${MIDDLEWARE_URL}/chaos`);
      if (!response.ok) {
        throw new Error('Failed to fetch chaos data');
      }
      const data = await response.json();
      setChaosData(data);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching chaos data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChaosData();
    // Refresh data every 5 seconds
    const interval = setInterval(fetchChaosData, 5000);
    return () => clearInterval(interval);
  }, []);

  const updateChaosConfig = async (path, config) => {
    try {
      const response = await fetch(`${MIDDLEWARE_URL}/chaos${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update chaos config');
      }
      
      // Refresh data after update
      await fetchChaosData();
      return true;
    } catch (err) {
      console.error('Error updating chaos config:', err);
      setError(err.message);
      return false;
    }
  };

  const deleteChaosConfig = async (path) => {
    try {
      const response = await fetch(`${MIDDLEWARE_URL}/chaos${path}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete chaos config');
      }
      
      // Refresh data after deletion
      await fetchChaosData();
      return true;
    } catch (err) {
      console.error('Error deleting chaos config:', err);
      setError(err.message);
      return false;
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>🌪️ Chaos Testing Dashboard</h1>
        <p>Monitor and control chaos engineering experiments</p>
      </header>

      {loading && !chaosData && (
        <div className="loading">Loading chaos data...</div>
      )}

      {error && (
        <div className="error-banner">
          ⚠️ Error: {error}
          <button onClick={fetchChaosData}>Retry</button>
        </div>
      )}

      {chaosData && (
        <>
          <Dashboard stats={chaosData.stats || {}} />
          <ChaosConfig
            chaosConfigs={chaosData.chaos_configs || {}}
            stats={chaosData.stats || {}}
            onUpdate={updateChaosConfig}
            onDelete={deleteChaosConfig}
          />
        </>
      )}
    </div>
  );
}

export default App;

// Made with Bob
