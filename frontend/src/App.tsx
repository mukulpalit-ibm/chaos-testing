import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Header } from './components/Header';
import { Dashboard } from './pages/Dashboard';
import { Configuration } from './pages/Configuration';
import { Monitor } from './pages/Monitor';
import { Analysis } from './pages/Analysis';
import { Tester } from './pages/Tester';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        <Header />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/config" element={<Configuration />} />
            <Route path="/monitor" element={<Monitor />} />
            <Route path="/analysis" element={<Analysis />} />
            <Route path="/tester" element={<Tester />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;

// Made with Bob
