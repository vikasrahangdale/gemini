import React from 'react';

const SupplierResults = ({ suppliers, searchQuery, darkMode }) => {
  const getScoreColor = (score) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 80) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getFlagEmoji = (country) => {
    const flags = {
      'China': '🇨🇳',
      'India': '🇮🇳',
      'Vietnam': '🇻🇳',
      'USA': '🇺🇸'
    };
    return flags[country] || '🏳️';
  };

  return (
    <div className={`rounded-lg p-4 mb-4 ${darkMode ? 'bg-gray-800' : 'bg-blue-50'}`}>
      {/* Header */}
      <div className="mb-4">
        <h3 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          🔍 Supplier Search Results
        </h3>
        <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          Found {suppliers.length} suppliers for "{searchQuery}"
        </p>
      </div>

      {/* Suppliers List */}
      <div className="space-y-4">
        {suppliers.map((supplier, index) => (
          <div
            key={index}
            className={`p-4 rounded-lg border ${
              darkMode 
                ? 'bg-gray-700 border-gray-600' 
                : 'bg-white border-gray-200'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">{getFlagEmoji(supplier.country)}</span>
                  <h4 className={`font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    {supplier.name}
                  </h4>
                </div>
                
                <div className="flex items-center gap-4 mb-2">
                  <span className={`font-bold ${getScoreColor(supplier.matchScore)}`}>
                    ✅ Match: {supplier.matchScore}%
                  </span>
                  <span className={`text-sm px-2 py-1 rounded ${
                    supplier.matchScore >= 90 
                      ? 'bg-green-100 text-green-800' 
                      : supplier.matchScore >= 80
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {supplier.matchScore >= 90 ? 'Excellent' : 
                     supplier.matchScore >= 80 ? 'Good' : 'Fair'}
                  </span>
                </div>
                
                <p className={`mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  🪑 <span className="font-medium">Product Range:</span> {supplier.productRange.join(', ')}
                </p>
                
                <a
                  href={supplier.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`text-blue-500 hover:text-blue-700 font-medium`}
                >
                  🌐 Visit Website
                </a>
              </div>
              
              {supplier.image && (
                <img
                  src={supplier.image}
                  alt={supplier.name}
                  className="w-20 h-20 object-cover rounded ml-4"
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SupplierResults;