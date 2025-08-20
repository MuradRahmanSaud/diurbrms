import React, { createContext, useState, useEffect, useCallback, useContext, ReactNode } from 'react';
import { RoomCategoryEntry } from '../types';
import { api } from '../services/api';

interface RoomCategoryContextType {
  categories: RoomCategoryEntry[];
  loading: boolean;
  error: string | null;
  addCategory: (categoryData: Omit<RoomCategoryEntry, 'id'>) => Promise<RoomCategoryEntry>;
  updateCategory: (category: RoomCategoryEntry) => Promise<RoomCategoryEntry>;
  deleteCategory: (categoryId: string) => Promise<void>;
  getCategoryById: (categoryId: string) => RoomCategoryEntry | undefined;
}

const RoomCategoryContext = createContext<RoomCategoryContextType | undefined>(undefined);

export const RoomCategoryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [categories, setCategories] = useState<RoomCategoryEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAndSetCategories = async () => {
        setLoading(true);
        setError(null);
        try {
            const fetchedCategories = await api.fetchRoomCategories();
            setCategories(fetchedCategories.sort((a,b) => a.categoryName.localeCompare(b.categoryName)));
        } catch(e: any) {
            setError(`Failed to load room categories: ${e.message}.`);
            console.error("Failed to load room categories:", e);
        } finally {
            setLoading(false);
        }
    };
    fetchAndSetCategories();
  }, []);

  const addCategory = useCallback(async (categoryData: Omit<RoomCategoryEntry, 'id'>): Promise<RoomCategoryEntry> => {
    // In a real app: const newCategory = await api.addCategory(categoryData);
    if (categories.some(c => c.categoryName.toLowerCase() === categoryData.categoryName.toLowerCase())) {
        throw new Error(`Category "${categoryData.categoryName}" already exists.`);
    }
    const newCategory: RoomCategoryEntry = { ...categoryData, id: `temp-cat-${Date.now()}` };
    setCategories(prev => [...prev, newCategory].sort((a,b) => a.categoryName.localeCompare(b.categoryName)));
    return newCategory;
  }, [categories]);

  const updateCategory = useCallback(async (updatedCategory: RoomCategoryEntry): Promise<RoomCategoryEntry> => {
    // await api.updateCategory(updatedCategory);
    setCategories(prev => prev.map(c => c.id === updatedCategory.id ? updatedCategory : c).sort((a,b) => a.categoryName.localeCompare(b.categoryName)));
    return updatedCategory;
  }, []);

  const deleteCategory = useCallback(async (categoryId: string): Promise<void> => {
    // await api.deleteCategory(categoryId);
    setCategories(prev => prev.filter(c => c.id !== categoryId));
  }, []);

  const getCategoryById = useCallback((categoryId: string): RoomCategoryEntry | undefined => {
    return categories.find(c => c.id === categoryId);
  }, [categories]);

  return (
    <RoomCategoryContext.Provider value={{ categories, loading, error, addCategory, updateCategory, deleteCategory, getCategoryById }}>
      {children}
    </RoomCategoryContext.Provider>
  );
};

export const useRoomCategories = (): RoomCategoryContextType => {
  const context = useContext(RoomCategoryContext);
  if (context === undefined) {
    throw new Error('useRoomCategories must be used within a RoomCategoryProvider');
  }
  return context;
};
