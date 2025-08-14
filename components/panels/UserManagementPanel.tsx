import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { User, EnrollmentEntry, SignupData, ProgramEntry, UserRole } from '../../types';
import AddUserModal from '../modals/AddUserModal';
import RolePermissionModal from '../modals/RolePermissionModal';

interface UserManagementPanelProps {
  onClose: () => void;
  onShowUserDetail: (userId: string) => void;
  activeUserId: string | null;
  coursesData: EnrollmentEntry[];
  allPrograms: ProgramEntry[];
}

const ROLE_DISPLAY_NAMES: Record<UserRole, string> = {
  user: 'User',
  teacher: 'Teacher',
  student: 'Student',
  'routine-organizer': 'Routine Organizer',
  moderator: 'Moderator',
  'coordination-officer': 'Coordination Officer',
  admin: 'Admin',
};

const LoadingSpinner: React.FC = () => (
    <div className="flex justify-center items-center h-full w-full bg-teal-900/50">
      <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-yellow-300"></div>
    </div>
);

const UserManagementPanel: React.FC<UserManagementPanelProps> = ({ onClose, onShowUserDetail, activeUserId, coursesData, allPrograms }) => {
  const { user: currentUser, users, deleteUser, signup, loading: authLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);

  // State and refs for virtualization
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  const ROW_HEIGHT = 69 + 6; // calculated height (69px) for card + mb-1.5 (6px) for margin = 75px
  const OVERSCAN_COUNT = 5;

  const teacherDesignationMapString = useMemo(() => {
    const map = new Map<string, string>();
    coursesData.forEach(course => {
        if (course.teacherId && course.designation && !map.has(course.teacherId)) {
            map.set(course.teacherId, course.designation);
        }
    });
    return JSON.stringify(Array.from(map.entries()));
  }, [coursesData]);

  const processedUsers = useMemo(() => {
    const teacherDesignationMap = new Map<string, string>(JSON.parse(teacherDesignationMapString));
    
    const syncedUsers = users.map(user => {
        if (user.employeeId && teacherDesignationMap.has(user.employeeId)) {
            const syncedDesignation = teacherDesignationMap.get(user.employeeId);
            if(user.designation !== syncedDesignation) {
               return { ...user, designation: syncedDesignation };
            }
        }
        return user;
    });

    return syncedUsers.sort((a, b) => a.name.localeCompare(b.name));
  }, [users, teacherDesignationMapString]);
  
  const teacherEmployeeIds = useMemo(() => {
    const ids = new Set<string>();
    coursesData.forEach(course => {
        if (course.teacherId) {
            ids.add(course.teacherId);
        }
    });
    return ids;
  }, [coursesData]);

  const filteredUsers = useMemo(() => {
    if (!searchTerm.trim()) {
      return processedUsers;
    }
    const lowercasedSearch = searchTerm.toLowerCase();
    return processedUsers.filter(user => 
      user.name.toLowerCase().includes(lowercasedSearch) ||
      user.email.toLowerCase().includes(lowercasedSearch) ||
      (user.employeeId && user.employeeId.toLowerCase().includes(lowercasedSearch))
    );
  }, [processedUsers, searchTerm]);
  
  const totalHeight = filteredUsers.length * ROW_HEIGHT;
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN_COUNT);
  const visibleItemCount = containerHeight > 0 ? Math.ceil(containerHeight / ROW_HEIGHT) : 0;
  const endIndex = Math.min(filteredUsers.length, startIndex + visibleItemCount + (2 * OVERSCAN_COUNT));

  const visibleUsers = useMemo(() => 
    filteredUsers.slice(startIndex, endIndex),
    [filteredUsers, startIndex, endIndex]
  );
  
  const paddingTop = startIndex * ROW_HEIGHT;

  const handleScroll = useCallback(() => {
    if (containerRef.current) {
        window.requestAnimationFrame(() => {
            setScrollTop(containerRef.current.scrollTop);
        });
    }
  }, []);

  useEffect(() => {
    if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight);
        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                setContainerHeight(entry.contentRect.height);
            }
        });
        resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }
  }, []);

  const confirmAndDelete = (userToDelete: User) => {
      if (userToDelete.id === currentUser?.id) {
          alert("You cannot delete your own account.");
          return;
      }
      if (window.confirm(`Are you sure you want to delete user "${userToDelete.name}"? This action cannot be undone.`)) {
          deleteUser(userToDelete.id);
      }
  };

  const handleAddUser = useCallback(async (data: SignupData) => {
    await signup(data, false);
  }, [signup]);
  
  const renderUserAvatar = (user: User) => {
    if (user.avatar && user.avatar.startsWith('data:image')) {
        return <img src={user.avatar} alt={`${user.name}'s avatar`} className="w-full h-full object-cover" />;
    }
    // Default user icon
    return (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-teal-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
    );
  };

  const roleStyles: { [key in UserRole]: { border: string, bg: string, text: string } } = {
      admin: { border: 'border-teal-400', bg: 'bg-teal-500', text: 'text-white' },
      moderator: { border: 'border-blue-400', bg: 'bg-blue-500', text: 'text-white' },
      user: { border: 'border-yellow-400', bg: 'bg-yellow-400', text: 'text-yellow-900' },
      'coordination-officer': { border: 'border-purple-400', bg: 'bg-purple-500', text: 'text-white' },
      teacher: { border: 'border-slate-400', bg: 'bg-slate-500', text: 'text-white' },
      'routine-organizer': { border: 'border-indigo-400', bg: 'bg-indigo-500', text: 'text-white' },
      student: { border: 'border-green-400', bg: 'bg-green-500', text: 'text-white' },
  };

  return (
    <div className="p-3 h-full flex flex-col bg-gradient-to-b from-[var(--color-primary-700)] to-[var(--color-primary-900)] text-white relative">
      {/* Header */}
      <div className="flex justify-between items-center mb-3 pb-2 border-b border-teal-600/50 flex-shrink-0">
        <h2 className="text-lg font-semibold text-white">
            User Management <span className="text-base font-normal text-teal-300">({users.length})</span>
        </h2>
        <button
          onClick={onClose}
          className="bg-teal-700/50 text-teal-200 hover:text-white p-1 rounded-full hover:bg-red-500/50 transition-colors"
          aria-label="Close user management panel"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      {/* Search Bar */}
      <div className="relative mb-3 flex-shrink-0">
          <input
              type="search"
              placeholder="Search by name, email, or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-teal-600 rounded-md shadow-sm focus:ring-1 focus:ring-yellow-400 focus:border-yellow-400 bg-teal-800/80 text-teal-100 placeholder-teal-300 transition-colors"
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-4 w-4 text-teal-300" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              </svg>
          </div>
      </div>

      {/* Virtualized List of User Cards */}
      <div className="flex-grow overflow-y-auto custom-scrollbar -mx-3 px-3" ref={containerRef} onScroll={handleScroll}>
        {authLoading ? (
          <LoadingSpinner />
        ) : filteredUsers.length > 0 ? (
          <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
            <div style={{ position: 'absolute', top: `${paddingTop}px`, left: 0, right: 0 }}>
              {visibleUsers.map(user => {
                const currentRoleStyle = roleStyles[user.role] || roleStyles.user;
                
                return (
                  <div
                    key={user.id}
                    onClick={() => onShowUserDetail(user.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { onShowUserDetail(user.id); } }}
                    role="button"
                    tabIndex={0}
                    className={`
                      relative backdrop-blur-sm rounded-lg 
                      border-l-4 
                      p-2.5 
                      flex items-center gap-3
                      cursor-pointer 
                      focus:outline-none
                      transition-all duration-200 
                      shadow-[inset_0_1px_4px_rgba(0,0,0,0.4)]
                      mb-1.5
                      ${currentRoleStyle.border} 
                      ${activeUserId === user.id ? 'bg-teal-900/60' : 'bg-black/20 hover:bg-black/30 hover:shadow-[inset_0_2px_8px_rgba(0,0,0,0.5)]'}
                    `}
                  >
                    {/* Avatar */}
                    <div className="relative group/avatar w-10 h-10 rounded-full bg-teal-900 flex-shrink-0 flex items-center justify-center overflow-hidden ring-2 ring-teal-900 shadow">
                        {renderUserAvatar(user)}
                         {/* Delete Button on Avatar Hover */}
                        {currentUser?.id !== user.id && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    confirmAndDelete(user);
                                }}
                                className="absolute inset-0 bg-red-600/80 flex items-center justify-center text-white transition-opacity duration-150 opacity-0 group-hover/avatar:opacity-100"
                                aria-label={`Delete user ${user.name}`}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                            </button>
                        )}
                    </div>
                    {/* User Info */}
                    <div className="flex-grow min-w-0">
                        <h4 className="font-bold text-white text-xs truncate" title={user.name}>
                            {user.name}
                        </h4>
                        <p className="text-xs text-teal-300 truncate" title={user.designation || 'N/A'}>
                            {user.designation || 'N/A'}
                        </p>
                        {/* Role Badge */}
                        <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${currentRoleStyle.bg} ${currentRoleStyle.text}`}>
                            {ROLE_DISPLAY_NAMES[user.role] || user.role}
                        </span>
                    </div>
                    
                    {/* Selected Icon */}
                    {activeUserId === user.id && (
                        <div className="absolute bottom-1.5 right-1.5 text-teal-300">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                        </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="text-center py-10 text-teal-300 italic">
            {users.length > 0 ? 'No users match your search.' : 'No users found.'}
          </div>
        )}
      </div>
      
      {/* Floating Action Buttons */}
      <div className="absolute bottom-4 right-4">
        <button
          onClick={() => setIsAddUserModalOpen(true)}
          className="bg-yellow-400 hover:bg-yellow-300 text-teal-900 font-bold p-3 rounded-full shadow-lg transition-transform transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-teal-900 focus:ring-yellow-400"
          aria-label="Add New User"
          title="Add New User"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      <AddUserModal
        isOpen={isAddUserModalOpen}
        onClose={() => setIsAddUserModalOpen(false)}
        onAddUser={handleAddUser}
        allPrograms={allPrograms}
        coursesData={coursesData}
      />
      
    </div>
  );
};

export default UserManagementPanel;
