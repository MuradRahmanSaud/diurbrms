import React, { createContext, useState, useEffect, useCallback, useContext, ReactNode, useMemo } from 'react';
import { User, UserRole, DayOfWeek, SignupData, RoomEditAccess, DashboardAccess, AssignAccessLevel, ProgramManagementAccess, NotificationAccess, RolePermissions } from '../types';
import { useRolePermissions } from './RolePermissionContext';
import { api } from '../services/api'; // Import the new API service

// Seed data is removed. Data will now be fetched.
// const SEED_USERS: (User & { password_plaintext: string })[] = [ ... ];

// A simple type for the sync function argument
interface TeacherInfo {
    employeeId: string;
    teacherName: string;
    email: string;
    designation: string;
}

interface AuthContextType {
  user: User | null;
  users: User[]; // All users for management panel
  loading: boolean;
  login: (email: string, password_plaintext: string) => Promise<void>;
  signup: (data: SignupData, autoLogin?: boolean) => Promise<void>;
  logout: () => void;
  updateUser: (updatedUserData: User) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  syncTeachersAsUsers: (teachers: TeacherInfo[]) => void;
  changePassword: (userId: string, current: string, newPass: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const RBRMS_AUTH_USER_KEY = 'rbrms-auth-user';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [allUsersWithPasswords, setAllUsersWithPasswords] = useState<(User & { password_plaintext: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const { getPermissionsForRole } = useRolePermissions();
  
  // Load all users from the API on initial mount
  useEffect(() => {
    const initializeAuth = async () => {
      setLoading(true);
      try {
        // In a real app, you might check for a session token here first.
        // For now, we just fetch the user list for the login screen to use.
        // const usersFromApi = await api.fetchAllUsers();
        // setAllUsersWithPasswords(usersFromApi);
        console.log("Auth context initialized. Ready for login.");
      } catch (e) {
        console.error("Failed to initialize auth data from API", e);
        // Handle error, maybe show a global error message
      } finally {
        setLoading(false);
      }
    };
    initializeAuth();
  }, []);


  // The public `users` array, without passwords
  const users = useMemo(() => allUsersWithPasswords.map(({ password_plaintext, ...rest }) => rest), [allUsersWithPasswords]);

  const login = useCallback(async (email: string, password_plaintext: string): Promise<void> => {
    // This will now call the API service, which is currently mocked.
    const loggedInUser = await api.login(email, password_plaintext);
    setUser(loggedInUser);
    localStorage.setItem(RBRMS_AUTH_USER_KEY, JSON.stringify(loggedInUser));
  }, []);
  
  const signup = useCallback(async (data: SignupData, autoLogin: boolean = true): Promise<void> => {
    const newUser = await api.signup(data);
    if (autoLogin) {
      setUser(newUser);
      localStorage.setItem(RBRMS_AUTH_USER_KEY, JSON.stringify(newUser));
    }
    // We would also need a way to refresh the `allUsersWithPasswords` list here.
  }, []);
  
  const updateUser = useCallback(async (updatedUserData: User): Promise<void> => {
    const updatedUser = await api.updateUser(updatedUserData);
     if (user?.id === updatedUser.id) {
        setUser(updatedUser);
        localStorage.setItem(RBRMS_AUTH_USER_KEY, JSON.stringify(updatedUser));
    }
    // Refresh all users list
    // const usersFromApi = await api.fetchAllUsers();
    // setAllUsersWithPasswords(usersFromApi);
  }, [user]);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(RBRMS_AUTH_USER_KEY);
    // In a real app, you might also call an API endpoint to invalidate the session/token.
  }, []);
  
  const deleteUser = useCallback(async (userId: string): Promise<void> => {
      await api.deleteUser(userId);
      // Refresh all users list
      // const usersFromApi = await api.fetchAllUsers();
      // setAllUsersWithPasswords(usersFromApi);
  }, []);

  const syncTeachersAsUsers = useCallback((teachers: TeacherInfo[]) => {
      // This logic would likely move to the backend.
      // The frontend would just trigger an API endpoint, e.g., `api.syncTeachers()`.
      console.log("[AuthContext] Teacher sync requested. In a real app, this would be a backend process.", teachers);
  }, []);

  const changePassword = useCallback(async (userId: string, current: string, newPass: string): Promise<void> => {
    await api.changePassword(userId, current, newPass);
  }, []);

  return (
    <AuthContext.Provider value={{ user, users, loading, login, signup, logout, updateUser, deleteUser, syncTeachersAsUsers, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
