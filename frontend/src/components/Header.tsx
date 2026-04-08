import { Link, useLocation } from 'react-router-dom';

export function Header() {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <h1 className="text-2xl font-bold text-primary">Chaos Testing</h1>
          </div>
          <nav className="flex space-x-8">
            <Link
              to="/"
              className={`px-3 py-2 rounded-md text-sm font-medium ${
                isActive('/')
                  ? 'bg-primary text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Dashboard
            </Link>
            <Link
              to="/config"
              className={`px-3 py-2 rounded-md text-sm font-medium ${
                isActive('/config')
                  ? 'bg-primary text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Configuration
            </Link>
            <Link
              to="/monitor"
              className={`px-3 py-2 rounded-md text-sm font-medium ${
                isActive('/monitor')
                  ? 'bg-primary text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Monitor
            </Link>
            <Link
              to="/analysis"
              className={`px-3 py-2 rounded-md text-sm font-medium ${
                isActive('/analysis')
                  ? 'bg-primary text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              AI Analysis
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}

// Made with Bob
