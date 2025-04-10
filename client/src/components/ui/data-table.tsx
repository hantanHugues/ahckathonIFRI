import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate, formatTime, getStatusColor } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Download, Filter, Search } from "lucide-react";

interface DataTableProps<T> {
  data: T[];
  columns: {
    key: keyof T | 'status';
    header: string;
    render?: (value: any, item: T) => React.ReactNode;
  }[];
  pagination?: boolean;
  pageSize?: number;
  searchable?: boolean;
  searchKeys?: (keyof T)[];
  onExport?: () => void;
  statusFn?: (item: T) => { text: string; status: 'normal' | 'warning' | 'danger' | 'unknown' };
}

export function DataTable<T>({
  data,
  columns,
  pagination = true,
  pageSize = 5,
  searchable = true,
  searchKeys = [],
  onExport,
  statusFn
}: DataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchText, setSearchText] = useState("");
  
  // Filtrer les données en fonction du texte de recherche
  const filteredData = searchable && searchText
    ? data.filter(item => {
        return searchKeys.some(key => {
          const value = item[key];
          return value !== null && 
                 value !== undefined && 
                 String(value).toLowerCase().includes(searchText.toLowerCase());
        });
      })
    : data;
  
  // Calculer le nombre total de pages
  const totalPages = pagination ? Math.ceil(filteredData.length / pageSize) : 1;
  
  // Obtenir les données paginées
  const paginatedData = pagination
    ? filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : filteredData;
  
  // Changer de page
  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };
  
  return (
    <div className="bg-white rounded-lg shadow-sm border border-neutral-light">
      {/* En-tête du tableau */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 border-b border-neutral-light">
        <h3 className="font-medium text-lg text-neutral-darkest">Historique des Données</h3>
        
        <div className="flex items-center space-x-2 mt-2 md:mt-0">
          {searchable && (
            <div className="relative">
              <Input
                type="text"
                placeholder="Rechercher..."
                className="pl-8 pr-4 py-1 text-sm"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
              <Search className="absolute left-2 top-2 h-4 w-4 text-neutral-dark" />
            </div>
          )}
          
          <Button variant="outline" size="sm" className="text-sm">
            <Filter className="h-4 w-4 mr-1" />
            <span>Filtrer</span>
          </Button>
          
          {onExport && (
            <Button variant="default" size="sm" className="text-sm" onClick={onExport}>
              <Download className="h-4 w-4 mr-1" />
              <span>CSV</span>
            </Button>
          )}
        </div>
      </div>
      
      {/* Tableau */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-neutral-lightest text-neutral-dark text-sm">
              {columns.map((column, index) => (
                <th key={index} className="px-4 py-2 text-left font-medium">
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-light">
            {paginatedData.length > 0 ? (
              paginatedData.map((item, rowIndex) => (
                <tr key={rowIndex} className="text-neutral-darkest hover:bg-neutral-lightest transition">
                  {columns.map((column, colIndex) => {
                    // Cas spécial pour la colonne de statut
                    if (column.key === 'status' && statusFn) {
                      const { text, status } = statusFn(item);
                      const statusColor = getStatusColor(status);
                      
                      return (
                        <td key={colIndex} className="px-4 py-3">
                          <span className={`px-2 py-1 ${statusColor} rounded-full text-xs`}>
                            {text}
                          </span>
                        </td>
                      );
                    }
                    
                    // Pour les autres colonnes
                    const value = column.key !== 'status' ? item[column.key] : undefined;
                    
                    return (
                      <td key={colIndex} className="px-4 py-3">
                        {column.render 
                          ? column.render(value, item)
                          : value !== undefined && value !== null
                            ? String(value)
                            : ''}
                      </td>
                    );
                  })}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-4 py-3 text-center text-neutral-dark">
                  Aucune donnée disponible
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {/* Pagination */}
      {pagination && totalPages > 1 && (
        <div className="flex justify-between items-center p-4 border-t border-neutral-light">
          <div className="text-sm text-neutral-dark">
            Affichage de {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, filteredData.length)} sur {filteredData.length} entrées
          </div>
          
          <div className="flex items-center space-x-1">
            <Button
              variant="outline"
              size="sm"
              className="text-sm"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              // Calculer les pages à afficher
              let pageToShow;
              if (totalPages <= 5) {
                pageToShow = i + 1;
              } else if (currentPage <= 3) {
                pageToShow = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageToShow = totalPages - 4 + i;
              } else {
                pageToShow = currentPage - 2 + i;
              }
              
              return (
                <Button
                  key={i}
                  variant={currentPage === pageToShow ? "default" : "outline"}
                  size="sm"
                  className="text-sm"
                  onClick={() => goToPage(pageToShow)}
                >
                  {pageToShow}
                </Button>
              );
            })}
            
            <Button
              variant="outline"
              size="sm"
              className="text-sm"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
