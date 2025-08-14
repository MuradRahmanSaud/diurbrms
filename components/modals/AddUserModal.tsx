import React, { useState, useEffect } from 'react';
import Modal from '../Modal';
import { SignupData, UserRole, ProgramEntry, RoomEditAccess, DashboardAccess, EnrollmentEntry, AssignAccessLevel } from '../../types';
import SearchableProgramDropdownForRooms from '../SearchableProgramDropdownForRooms';
import { useRolePermissions } from '../../contexts/RolePermissionContext';

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddUser: (data: SignupData) => Promise<void>;
  allPrograms: ProgramEntry[];
  coursesData: EnrollmentEntry[];
}

const AddUserModal: React.FC<AddUserModalProps> = ({ isOpen, onClose, onAddUser, allPrograms, coursesData }) => {
  const { userRoles, roleDisplayNames, getPermissionsForRole } = useRolePermissions();

  const [formData, setFormData] = useState<Omit<SignupData, 'password_plaintext' | 'avatar'>>({
    name: '',
    email: '',
    employeeId: '',
    designation: '',
    role: 'user',
    makeupSlotBookingAccess: 'none',
    bulkAssignAccess: 'none',
    accessibleProgramPIds: [],
    roomEditAccess: {
      canManageRoomManagement: false,
      canAddBuilding: false,
      canAddRoom: false,
      canViewRoomDetail: false,
      canEditAssignToProgram: false,
      canEditShareWithPrograms: false,
      canEditDetailsTab: false,
      canEditSlotsTab: false,
    },
    dashboardAccess: {
      canViewCourseList: false,
      canViewSectionList: false,
      canViewRoomList: false,
      canViewTeacherList: false,
      canViewSlotRequirement: false,
      canAutoAssign: false,
      canManageVersions: false,
      canViewSlotUsage: false,
      canViewMakeupSchedule: false,
    },
    programManagementAccess: {
        canAddProgram: false,
        canEditProgram: false,
    },
  });
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: '', email: '', employeeId: '', designation: '', role: 'user',
        makeupSlotBookingAccess: 'none',
        bulkAssignAccess: 'none',
        accessibleProgramPIds: [],
        roomEditAccess: {
          canManageRoomManagement: false,
          canAddBuilding: false,
          canAddRoom: false,
          canViewRoomDetail: false,
          canEditAssignToProgram: false,
          canEditShareWithPrograms: false,
          canEditDetailsTab: false,
          canEditSlotsTab: false,
        },
        dashboardAccess: { canViewCourseList: false, canViewSectionList: false, canViewRoomList: false, canViewTeacherList: false, canViewSlotRequirement: false, canAutoAssign: false, canManageVersions: false, canViewSlotUsage: false, canViewMakeupSchedule: false },
        programManagementAccess: { canAddProgram: false, canEditProgram: false },
      });
      setPassword('');
      setConfirmPassword('');
      setAvatarPreview(null);
      setError(null);
      setIsLoading(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (formData.employeeId) {
        setPassword(formData.employeeId);
        setConfirmPassword(formData.employeeId);
        
        const teacher = coursesData.find(c => c.teacherId === formData.employeeId);
        if (teacher) {
            setFormData(prev => ({ 
                ...prev, 
                designation: teacher.designation, 
                role: 'teacher',
            }));
        } else {
            setFormData(prev => ({...prev, designation: '', role: 'user'}));
        }
    } else {
        setFormData(prev => ({...prev, designation: ''}));
        setPassword('');
        setConfirmPassword('');
    }
  }, [formData.employeeId, coursesData]);
  
  useEffect(() => {
      const permissionsTemplate = getPermissionsForRole(formData.role);
      if (permissionsTemplate) {
          setFormData(prev => ({
              ...prev,
              makeupSlotBookingAccess: permissionsTemplate.makeupSlotBookingAccess,
              bulkAssignAccess: permissionsTemplate.bulkAssignAccess,
              roomEditAccess: permissionsTemplate.roomEditAccess,
              dashboardAccess: permissionsTemplate.dashboardAccess,
              programManagementAccess: permissionsTemplate.programManagementAccess,
              notificationAccess: permissionsTemplate.notificationAccess,
          }));
      }
  }, [formData.role, getPermissionsForRole]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1 * 1024 * 1024) { // 1MB limit for profile pics
        setError("Profile picture size should not exceed 1MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
        setError(null);
      };
      reader.onerror = () => {
        setError("Failed to read the image file.");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
        const { checked } = e.target as HTMLInputElement;
        setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
        setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim() || !formData.email.trim() || !password) {
      setError('Name, Email, and Password are required.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      await onAddUser({ ...formData, password_plaintext: password, avatar: avatarPreview || undefined });
      onClose();
    } catch (err: any) {
      setError(err.message || 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const footerContent = (
    <div className="flex justify-end gap-3">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md border border-gray-300">
            Cancel
        </button>
        <button type="submit" form="add-user-form" disabled={isLoading} className="px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-md border border-transparent disabled:bg-gray-400">
            {isLoading ? 'Adding User...' : 'Add User'}
        </button>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New User" footerContent={footerContent} maxWidthClass="max-w-lg">
      <form id="add-user-form" onSubmit={handleSubmit} className="space-y-3">
        <div className="flex flex-col items-center gap-2">
            <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center text-4xl text-gray-500 overflow-hidden ring-2 ring-offset-2 ring-gray-300">
                {avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar Preview" className="w-full h-full object-cover" />
                ) : ( '👤' )}
            </div>
            <label htmlFor="avatar-upload" className="cursor-pointer text-sm text-teal-600 hover:text-teal-500 font-medium"> Upload Photo </label>
            <input id="avatar-upload" name="avatar" type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
        </div>

        <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">Full Name *</label>
            <input type="text" name="name" id="name" value={formData.name} onChange={handleChange} required className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-teal-500 focus:border-teal-500 text-gray-900"/>
        </div>
        <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email Address *</label>
            <input type="email" name="email" id="email" value={formData.email} onChange={handleChange} required className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-teal-500 focus:border-teal-500 text-gray-900"/>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label htmlFor="employeeId" className="block text-sm font-medium text-gray-700">Employee ID</label>
                <input type="text" name="employeeId" id="employeeId" value={formData.employeeId || ''} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-teal-500 focus:border-teal-500 text-gray-900"/>
            </div>
            <div>
                <label htmlFor="designation" className="block text-sm font-medium text-gray-700">Designation</label>
                <input type="text" name="designation" id="designation" value={formData.designation || ''} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-teal-500 focus:border-teal-500 text-gray-900"/>
            </div>
        </div>
        <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700">Role</label>
            <select name="role" id="role" value={formData.role} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-teal-500 focus:border-teal-500 bg-white text-gray-900">
                {userRoles.map(role => (
                    <option key={role} value={role}>
                        {roleDisplayNames[role] || role}
                    </option>
                ))}
            </select>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label htmlFor="makeupSlotBookingAccess" className="block text-sm font-medium text-gray-700">Make-up Access</label>
                <select name="makeupSlotBookingAccess" id="makeupSlotBookingAccess" value={formData.makeupSlotBookingAccess} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-teal-500 focus:border-teal-500 bg-white text-gray-900">
                    <option value="none">No Access</option>
                    <option value="own">Own Courses Only</option>
                    <option value="full">Full Access</option>
                </select>
            </div>
             <div>
                <label htmlFor="bulkAssignAccess" className="block text-sm font-medium text-gray-700">Bulk Assign Access</label>
                <select name="bulkAssignAccess" id="bulkAssignAccess" value={formData.bulkAssignAccess} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-teal-500 focus:border-teal-500 bg-white text-gray-900">
                    <option value="none">No Access</option>
                    <option value="own">Own Courses Only</option>
                    <option value="full">Full Access</option>
                </select>
            </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password *</label>
                <input type="password" name="password" id="password" value={password} onChange={e => setPassword(e.target.value)} required className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-teal-500 focus:border-teal-500 text-gray-900"/>
            </div>
            <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">Confirm Password *</label>
                <input type="password" name="confirmPassword" id="confirmPassword" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-teal-500 focus:border-teal-500 text-gray-900"/>
            </div>
        </div>
        
        {error && (
            <div className="p-3 text-sm text-red-700 bg-red-100 rounded-md" role="alert">
                {error}
            </div>
        )}
      </form>
    </Modal>
  );
};

export default AddUserModal;
