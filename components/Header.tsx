import React, { useState, useRef, useEffect } from 'react';
import DaySelector from './DaySelector'; 
import { DayOfWeek, RoutineViewMode, User } from '../types';   

interface HeaderProps {
  days: DayOfWeek[];
  selectedDay: DayOfWeek;
  onDaySelect: (day: DayOfWeek) => void;
  selectedDate: string | null;
  onDateChange: (date: string) => void;
  routineViewMode: RoutineViewMode;
  user: User | null;
  logout: () => void;
  onChangePassword: (userId: string, current: string, newPass: string) => Promise<void>;
  onShowUserDetail: (userId: string) => void;
  routineDisplayMode: 'published' | 'editable';
  onRoutineDisplayModeChange: (mode: 'published' | 'editable') => void;
  onPublish: () => void;
  isPublishable: boolean;
  lastPublishTimestamp: string | null;
}

const Header: React.FC<HeaderProps> = React.memo(({
  days, selectedDay, onDaySelect, selectedDate, onDateChange,
  routineViewMode, user, logout, onChangePassword, onShowUserDetail,
  routineDisplayMode, onRoutineDisplayModeChange, onPublish, isPublishable, lastPublishTimestamp
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile');
  const userMenuRef = useRef<HTMLDivElement>(null);

  // State for password change form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset form when menu is closed or tab is changed
  useEffect(() => {
    if (!isUserMenuOpen || activeTab === 'profile') {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
        setPasswordError(null);
        setPasswordSuccess(null);
        setIsPasswordLoading(false);
    }
  }, [isUserMenuOpen, activeTab]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setPasswordError('All fields are required.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }
    if (newPassword.length < 1) {
      setPasswordError('New password cannot be empty.');
      return;
    }

    setIsPasswordLoading(true);
    try {
      if (!user) throw new Error("User not found");
      await onChangePassword(user.id, currentPassword, newPassword);
      setPasswordSuccess('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setTimeout(() => {
        setPasswordSuccess(null);
        setIsUserMenuOpen(false); // Close menu on success
      }, 2000);
    } catch (err: any) {
      setPasswordError(err.message || 'An unknown error occurred.');
    } finally {
      setIsPasswordLoading(false);
    }
  };
  
  const toggleMenu = () => {
    if (!isUserMenuOpen) {
      setActiveTab('profile');
    }
    setIsUserMenuOpen(prev => !prev);
  };
  
  const getTabButtonClasses = (tabName: 'profile' | 'password') => {
    const base = "flex-1 text-center text-sm font-medium py-2 transition-colors";
    if (tabName === activeTab) {
      return `${base} text-teal-600 border-b-2 border-teal-600`;
    }
    return `${base} text-gray-500 hover:text-gray-700 border-b-2 border-transparent`;
  }

  const getModeButtonClasses = (mode: 'published' | 'editable') => {
      const base = "px-2 py-1 text-xs sm:text-sm font-semibold rounded-md transition-colors duration-150 flex-1";
      const disabledClasses = "disabled:bg-teal-800 disabled:text-teal-500 disabled:cursor-not-allowed disabled:shadow-none";
      if (routineDisplayMode === mode) {
          return `${base} bg-white text-teal-700 shadow-inner ${disabledClasses}`;
      }
      return `${base} text-teal-100 hover:bg-white/20 ${disabledClasses}`;
  };

  return (
    <header className="w-full bg-[var(--color-primary-700)] text-[var(--color-text-on-primary)] p-1 sm:p-1.5 shadow-md relative z-40">
      <div className="px-1 sm:px-2 flex flex-row flex-nowrap justify-between items-center gap-2 sm:gap-3">
        <div className="flex items-center flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6 mr-1.5 sm:mr-2 text-[var(--color-accent-yellow-300)] flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2H6zm1 2a1 1 0 000 2h6a1 1 0 100-2H7zM6 7a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
          </svg>
          <div className="flex flex-col">
            <h1 className="text-base sm:text-lg font-bold tracking-tight leading-tight">RBRMS</h1>
            <p className="text-[9px] sm:text-[10px] font-medium text-[var(--color-primary-200)] leading-tight -mt-0.5"> 
              Daffodil International University
            </p>
          </div>
        </div>

        <div className="flex-grow flex items-center justify-center gap-2">
            <div className="flex-shrink-0 bg-teal-800 p-0.5 rounded-lg flex w-48 shadow-md">
                <button
                    onClick={() => onRoutineDisplayModeChange('editable')}
                    className={getModeButtonClasses('editable')}
                    aria-pressed={routineDisplayMode === 'editable'}
                    disabled={!user?.dashboardAccess?.canViewEditableRoutine}
                    title={!user?.dashboardAccess?.canViewEditableRoutine ? "Permission denied to view editable routine" : ""}
                >
                    Editable
                </button>
                <button
                    onClick={() => onRoutineDisplayModeChange('published')}
                    className={getModeButtonClasses('published')}
                    aria-pressed={routineDisplayMode === 'published'}
                    disabled={!user?.dashboardAccess?.canViewPublishedRoutine}
                    title={!user?.dashboardAccess?.canViewPublishedRoutine ? "Permission denied to view published routine" : ""}
                >
                    Published
                </button>
            </div>
             {routineDisplayMode === 'editable' && (
                <div className="flex items-center gap-2">
                    <button
                        onClick={onPublish}
                        disabled={!isPublishable}
                        className="px-2.5 py-1.5 bg-yellow-400 text-teal-900 rounded-md text-xs sm:text-sm font-semibold shadow-md hover:bg-yellow-300 disabled:bg-teal-700 disabled:text-teal-400 disabled:cursor-not-allowed transition-all duration-150"
                        title={isPublishable ? "Save the current editable routine as the new published version" : !user?.dashboardAccess?.canPublishRoutine ? "You do not have permission to publish routines" : "Select a program and a semester to enable publishing"}
                    >
                        <div className="flex items-center gap-1.5">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                        </svg>
                        <span>Publish</span>
                        </div>
                    </button>
                    {lastPublishTimestamp && (
                        <div className="text-teal-200 text-[10px] leading-tight hidden sm:block" title={`Last published on ${new Date(lastPublishTimestamp).toLocaleString()}`}>
                            Last publish: <br />
                            <span className="font-semibold text-white">
                                {new Date(lastPublishTimestamp).toLocaleString([], {
                                    month: 'short', day: 'numeric',
                                    hour: '2-digit', minute: '2-digit', hour12: true
                                })}
                            </span>
                        </div>
                    )}
                </div>
            )}
        </div>


        <div className="flex items-center justify-end gap-2 sm:gap-3 min-w-0">
          <DaySelector
            days={days}
            selectedDays={[selectedDay]}
            onDayClick={onDaySelect}
            isHeaderContext={true}
            disabled={routineViewMode === 'dayCentric'}
          />
          <input
            type="date"
            value={selectedDate || ''}
            onChange={(e) => onDateChange(e.target.value)}
            className="p-1 rounded-md bg-[var(--color-primary-600)] text-[var(--color-text-on-primary)] border border-[var(--color-primary-500)] hover:bg-[var(--color-primary-500)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent-yellow-400)] focus:ring-offset-2 focus:ring-offset-[var(--color-primary-700)] text-xs sm:text-sm flex-shrink-0"
            aria-label="View routine for a specific date"
            title="View routine for a specific date"
            style={{ colorScheme: 'dark' }}
          />
          <div className="h-6 w-px bg-[var(--color-primary-500)]"></div>
           <div className="relative" ref={userMenuRef}>
            <button
              onClick={toggleMenu}
              className="flex items-center justify-center h-8 w-8 rounded-full bg-[var(--color-primary-600)] hover:bg-[var(--color-primary-500)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--color-primary-700)] focus:ring-white transition"
              aria-label="Open user menu"
              aria-haspopup="true"
              aria-expanded={isUserMenuOpen}
            >
              {user?.avatar && user.avatar.startsWith('data:image') ? (
                <img src={user.avatar} alt="User Avatar" className="w-full h-full object-cover rounded-full" />
              ) : (
                <span className="text-lg">{user?.avatar || '👤'}</span>
              )}
            </button>
            <div
              className={`absolute right-0 mt-2 w-72 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50 transition ease-out duration-100 transform ${isUserMenuOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}
              role="menu"
              aria-orientation="vertical"
              aria-labelledby="user-menu-button"
            >
              {isUserMenuOpen && (
                <div role="none">
                  <div className="px-4 py-3 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex-shrink-0 overflow-hidden ring-2 ring-white shadow">
                            {user?.avatar && user.avatar.startsWith('data:image') ? ( <img src={user.avatar} alt="User Avatar" className="w-full h-full object-cover" /> ) : ( <span className="text-2xl flex items-center justify-center h-full w-full">{user?.avatar || '👤'}</span> )}
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-900 truncate" title={user?.name}>{user?.name || 'Guest User'}</p>
                            <p className="text-xs text-gray-500 truncate" title={user?.email}>{user?.email || 'no-email@provided.com'}</p>
                        </div>
                    </div>
                  </div>
                  <div className="border-b border-gray-200">
                      <nav className="-mb-px flex justify-around" aria-label="Tabs">
                          <button onClick={() => setActiveTab('profile')} className={getTabButtonClasses('profile')}>Profile</button>
                          <button onClick={() => setActiveTab('password')} className={getTabButtonClasses('password')}>Password</button>
                      </nav>
                  </div>
                  <div className="p-4">
                    {activeTab === 'profile' && (
                        <div className="text-sm text-gray-700 space-y-2">
                           <div className="flex justify-between"><span className="font-medium text-gray-500">Designation:</span> <span>{user?.designation || 'N/A'}</span></div>
                           <div className="flex justify-between"><span className="font-medium text-gray-500">Employee ID:</span> <span>{user?.employeeId || 'N/A'}</span></div>
                           <button onClick={() => { onShowUserDetail(user!.id); setIsUserMenuOpen(false); }} className="mt-2 w-full text-center text-xs font-semibold text-teal-600 hover:text-teal-800 hover:underline">
                                View Full Profile & Settings
                           </button>
                        </div>
                    )}
                    {activeTab === 'password' && (
                        <form onSubmit={handlePasswordSubmit} className="space-y-3">
                             <div>
                                <label className="block text-xs font-medium text-gray-600">Current Password</label>
                                <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required className="mt-1 w-full p-2 text-sm border-gray-300 rounded-md shadow-sm focus:ring-1 focus:ring-teal-500"/>
                             </div>
                             <div>
                                <label className="block text-xs font-medium text-gray-600">New Password</label>
                                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required className="mt-1 w-full p-2 text-sm border-gray-300 rounded-md shadow-sm focus:ring-1 focus:ring-teal-500"/>
                             </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600">Confirm New Password</label>
                                <input type="password" value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)} required className="mt-1 w-full p-2 text-sm border-gray-300 rounded-md shadow-sm focus:ring-1 focus:ring-teal-500"/>
                             </div>
                             {passwordError && <p className="text-xs text-red-600">{passwordError}</p>}
                             {passwordSuccess && <p className="text-xs text-green-600">{passwordSuccess}</p>}
                             <button type="submit" disabled={isPasswordLoading} className="w-full px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-md hover:bg-teal-700 disabled:bg-gray-400">
                                {isPasswordLoading ? 'Updating...' : 'Update Password'}
                             </button>
                        </form>
                    )}
                  </div>
                  <div className="border-t border-gray-200 py-1">
                     <button
                        onClick={logout}
                        className="flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                        role="menuitem"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="mr-3 h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        <span>Logout</span>
                      </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
});

Header.displayName = 'Header';
export default Header;