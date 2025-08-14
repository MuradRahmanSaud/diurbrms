
import React, { createContext, useState, useEffect, useCallback, useContext, ReactNode } from 'react';
import { RoomCategoryEntry } from '../types';

export const RBRMS_ROOM_CATEGORIES_KEY = 'rbrms-room-categories';

const SEED_ROOM_CATEGORIES: Omit<RoomCategoryEntry, 'id'>[] = [
  { categoryName: "Classroom" },
  { categoryName: "Faculty Room" },
  { categoryName: "Office Room" },
];

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
    setLoading(true);
    try {
      const savedCategoriesJson = localStorage.getItem(RBRMS_ROOM_CATEGORIES_KEY);
      let initialCategories: RoomCategoryEntry[] = [];
      if (savedCategoriesJson) {
        const parsedRaw = JSON.parse(savedCategoriesJson);
        if (Array.isArray(parsedRaw)) {
          initialCategories = parsedRaw.map((c: any, index: number) => ({
            id: typeof c.id === 'string' ? c.id : `generated-cat-${Date.now()}-${index}`,
            categoryName: String(c.categoryName || ''),
          }));
        } else {
             initialCategories = SEED_ROOM_CATEGORIES.map((c, index) => ({ ...c, id: `seed-cat-${Date.now()}-${index}` }));
        }
      } else {
        initialCategories = SEED_ROOM_CATEGORIES.map((c, index) => ({ ...c, id: `seed-cat-${Date.now()}-${index}` }));
      }
      setCategories(initialCategories.sort((a,b) => a.categoryName.localeCompare(b.categoryName)));
    } catch (e: any) {
      console.error("Failed to load room categories:", e);
      setError(`Failed to load room categories: ${e.message}. Using seed data.`);
      setCategories(SEED_ROOM_CATEGORIES.map((c, index) => ({ ...c, id: `seed-cat-error-${Date.now()}-${index}` })).sort((a,b) => a.categoryName.localeCompare(b.categoryName)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loading) {
      try {
        localStorage.setItem(RBRMS_ROOM_CATEGORIES_KEY, JSON.stringify(categories));
      } catch (e) {
        console.error("Failed to save room categories to localStorage:", e);
        alert("Could not save room category data. Your browser storage might be full.");
      }
    }
  }, [categories, loading]);

  const addCategory = useCallback(async (categoryData: Omit<RoomCategoryEntry, 'id'>): Promise<RoomCategoryEntry> => {
    return new Promise((resolve, reject) => {
      if (!categoryData.categoryName) {
        reject(new Error('Category Name is required.'));
        return;
      }
      if (categories.some(c => c.categoryName.toLowerCase() === categoryData.categoryName.toLowerCase())) {
        reject(new Error(`Category "${categoryData.categoryName}" already exists.`));
        return;
      }
      const newCategory: RoomCategoryEntry = {
        ...categoryData,
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      };
      setCategories(prev => [...prev, newCategory].sort((a,b) => a.categoryName.localeCompare(b.categoryName)));
      resolve(newCategory);
    });
  }, [categories]);

  const updateCategory = useCallback(async (updatedCategory: RoomCategoryEntry): Promise<RoomCategoryEntry> => {
     return new Promise((resolve, reject) => {
        if (categories.some(c => c.categoryName.toLowerCase() === updatedCategory.categoryName.toLowerCase() && c.id !== updatedCategory.id)) {
            reject(new Error(`Another category with name "${updatedCategory.categoryName}" already exists.`));
            return;
        }
        setCategories(prev => prev.map(c => c.id === updatedCategory.id ? updatedCategory : c).sort((a,b) => a.categoryName.localeCompare(b.categoryName)));
        resolve(updatedCategory);
    });
  }, [categories]);

  const deleteCategory = useCallback(async (categoryId: string): Promise<void> => {
    return new Promise((resolve) => {
      // TODO: Check if any room types or rooms are associated with this category.
      setCategories(prev => prev.filter(c => c.id !== categoryId));
      resolve();
    });
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
