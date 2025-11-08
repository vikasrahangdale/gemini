import { useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";

const API_BASE = "http://localhost:5000";

export const useSupplier = () => {
  const [supplierMode, setSupplierMode] = useState(false);

  const toggleSupplierMode = () => {
    const newMode = !supplierMode;
    setSupplierMode(newMode);
    toast.success(`Supplier Mode ${newMode ? "ON" : "OFF"}`);
  };

  const generateFallbackSupplierResults = (query, filters) => {
    let filteredSuppliers = [
      {
        name: `Global ${query} Suppliers Inc.`,
        country: "United States",
        matchScore: "85",
        productRange: `Industrial ${query} and components`,
        website: "https://www.globalsuppliers.com",
        description: `Leading global supplier of ${query} with 20+ years experience.`,
        rating: 4,
        supplierType: "supplier",
        languageMatch: 90
      },
      {
        name: `Premium ${query} Manufacturers`,
        country: "Germany",
        matchScore: "78",
        productRange: `High-quality ${query} solutions`,
        website: "https://www.premium-manufacturers.de",
        description: `German engineering excellence in ${query} manufacturing.`,
        rating: 5,
        supplierType: "manufacturer",
        languageMatch: 85
      },
      {
        name: `Asia ${query} Trading Co.`,
        country: "China",
        matchScore: "92",
        productRange: `Bulk ${query} and wholesale`,
        website: "https://www.asiatrading.com",
        description: `Cost-effective ${query} solutions from Asia.`,
        rating: 3,
        supplierType: "exporter",
        languageMatch: 75
      },
      {
        name: `European ${query} Factory`,
        country: "Italy",
        matchScore: "88",
        productRange: `Specialized ${query} manufacturing`,
        website: "https://www.europeanfactory.it",
        description: `Italian craftsmanship in ${query} production.`,
        rating: 4,
        supplierType: "factory",
        languageMatch: 60
      },
      {
        name: `Global ${query} Wholesalers`,
        country: "United Kingdom",
        matchScore: "81",
        productRange: `Bulk ${query} distribution`,
        website: "https://www.globalwholesalers.uk",
        description: `Wholesale distribution of ${query} worldwide.`,
        rating: 4,
        supplierType: "wholesaler",
        languageMatch: 95
      }
    ];

    // Apply filters
    if (filters.countries.length > 0) {
      filteredSuppliers = filteredSuppliers.filter(supplier => 
        filters.countries.includes(supplier.country)
      );
    }

    if (filters.supplierTypes.length > 0) {
      filteredSuppliers = filteredSuppliers.filter(supplier => 
        filters.supplierTypes.includes(supplier.supplierType)
      );
    }

    if (filters.minRating > 0) {
      filteredSuppliers = filteredSuppliers.filter(supplier => 
        supplier.rating >= filters.minRating
      );
    }

    if (filters.languagePercentage > 0) {
      filteredSuppliers = filteredSuppliers.filter(supplier => 
        supplier.languageMatch >= filters.languagePercentage
      );
    }

    return filteredSuppliers;
  };

  const searchSuppliers = async (query, conversationId, token, filters = {}) => {
    console.log("🛍️ Using supplier search for:", query);
    console.log("🔍 Applied filters:", filters);

    try {
      const res = await axios.post(
        `${API_BASE}/supplier/search`,
        { query, conversationId, filters },
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      console.log("✅ Supplier API Response:", res.data);

      const suppliers = res.data?.data?.results || res.data?.results || [];

      if (suppliers.length > 0) {
        let assistantContent = `🔍 **Supplier Search Results for "${query}"**\n\n`;
        
        // Show active filters
        const activeFilters = [];
        if (filters.countries.length > 0) activeFilters.push(`Countries: ${filters.countries.join(', ')}`);
        if (filters.supplierTypes.length > 0) activeFilters.push(`Types: ${filters.supplierTypes.join(', ')}`);
        if (filters.minRating > 0) activeFilters.push(`Min Rating: ${filters.minRating}⭐`);
        if (filters.languagePercentage > 0) activeFilters.push(`Language Match: ${filters.languagePercentage}%`);
        
        if (activeFilters.length > 0) {
          assistantContent += `*Applied Filters: ${activeFilters.join(' | ')}*\n\n`;
        }

        suppliers.forEach((supplier, index) => {
          assistantContent += `**${index + 1}. ${supplier.name}**\n`;
          assistantContent += `📍 ${supplier.country || 'N/A'} | ⭐ ${supplier.rating || 'N/A'} | 🗣️ ${supplier.languageMatch || 'N/A'}%\n`;
          assistantContent += `🏷️ ${supplier.supplierType || 'supplier'} | 📊 Match: ${supplier.matchScore || 'N/A'}%\n`;
          assistantContent += `📦 ${supplier.productRange || 'N/A'}\n`;
          assistantContent += `🔗 ${supplier.website || 'N/A'}\n`;
          assistantContent += `📝 ${supplier.description || 'No description available'}\n\n`;
        });
        return assistantContent;
      } else {
        return `❌ No suppliers found for "${query}" with the current filters. Try adjusting your filters or search terms.`;
      }

    } catch (apiError) {
      console.error("❌ Supplier API failed:", apiError);
      const fallbackSuppliers = generateFallbackSupplierResults(query, filters);
      
      if (fallbackSuppliers.length === 0) {
        return `❌ No suppliers found for "${query}" with the current filters. Try adjusting your filters.`;
      }

      let assistantContent = `🔍 **Supplier Search Results for "${query}"**\n\n*Note: Showing sample data (backend unavailable)*\n\n`;
      
      // Show active filters
      const activeFilters = [];
      if (filters.countries.length > 0) activeFilters.push(`Countries: ${filters.countries.join(', ')}`);
      if (filters.supplierTypes.length > 0) activeFilters.push(`Types: ${filters.supplierTypes.join(', ')}`);
      if (filters.minRating > 0) activeFilters.push(`Min Rating: ${filters.minRating}⭐`);
      if (filters.languagePercentage > 0) activeFilters.push(`Language Match: ${filters.languagePercentage}%`);
      
      if (activeFilters.length > 0) {
        assistantContent += `*Applied Filters: ${activeFilters.join(' | ')}*\n\n`;
      }

      fallbackSuppliers.forEach((supplier, index) => {
        assistantContent += `**${index + 1}. ${supplier.name}**\n`;
        assistantContent += `📍 ${supplier.country} | ⭐ ${supplier.rating} | 🗣️ ${supplier.languageMatch}%\n`;
        assistantContent += `🏷️ ${supplier.supplierType} | 📊 Match: ${supplier.matchScore}%\n`;
        assistantContent += `📦 ${supplier.productRange}\n`;
        assistantContent += `🔗 ${supplier.website}\n`;
        assistantContent += `📝 ${supplier.description}\n\n`;
      });
      return assistantContent;
    }
  };

  return {
    supplierMode,
    toggleSupplierMode,
    searchSuppliers,
    generateFallbackSupplierResults
  };
};

// ✅ Export as default for backward compatibility
export default useSupplier;