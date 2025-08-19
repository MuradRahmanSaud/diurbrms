import React, { useState, useMemo, useCallback, useEffect } from 'react';
import Modal from '../Modal';
import { useRolePermissions, RolePermissions } from '../../contexts/RolePermissionContext';
import { User, UserRole, RoomEditAccess, DashboardAccess, ProgramManagementAccess, NotificationAccess, AssignAccessLevel } from '../../types';

const PERMISSION_LABELS: Record<string, string> = {
    // RoomEditAccess
    canManageRoomManagement: "Manage Rooms Panel",
    canAddBuilding: "Add Building",
    canAddRoom: "Add Room",
    canViewRoomDetail: "View Room Details",
    canEditAssignToProgram: "Assign Primary Program",
    canEditShareWithPrograms: "Share with Programs",
    canEditDetailsTab: "Edit Room Details",
    canEditSlotsTab: "Edit Room Slots",
    canImportRoomData: "Import Room Data",
    canExportRoomData: "Export Room Data",
    // DashboardAccess
    canViewCourseList: "View Course List",
    canViewSectionList: "View Section List",
    canViewRoomList: "View Room List",
    canViewTeacherList: "View Teacher List",
    canViewSlotRequirement: "View Slot Requirement",
    canAutoAssign: "Run Auto-Scheduler",
    canManageVersions: "Manage Routine Versions",
    canViewSlotUsage: "View Slot Usage",
    canViewMakeupSchedule: "View Make-up Schedule",
    canEditCourseSectionDetails: "Edit Course/Section Details",
    canImportCourseData: "Import Course Data",
    canExportCourseData: "Export Course Data",
    classMonitoringAccess: "Class Monitoring",
    canManageProgramSetup: "Access Program Setup Panel",
    canManageDefaultSlots: "Manage Default Slots",
    canManageSemesterSetup: "Manage Semester Setup",
    canViewSectionTable: "View Section Table",
    canCustomizeTheme: "Customize Theme",
    canDragAndDrop: "Drag & Drop Scheduling",
    canViewSlotHistory: "View Slot History",
    canViewEditableRoutine: "View Editable Routine",
    canViewPublishedRoutine: "View Published Routine",
    canPublishRoutine: "Publish Routines",
    // ProgramManagementAccess
    canAddProgram: "Add New Program",
    canEditProgram: "Edit Program Details",
    // NotificationAccess
    canGetNotification: "Get Slot Notifications",
    canApproveSlots: "Approve Slot Changes",
};


const PermissionToggle = ({ id, label, checked, onToggle, disabled = false }: { id: string; label: string; checked: boolean; onToggle: () => void; disabled?: boolean; }) => (
    <div className={`flex items-center justify-between transition-opacity ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}>
        <label htmlFor={id} className={`font-medium text-sm ${disabled ? 'text-gray-500' : 'text-gray-700'} ${disabled ? '' : 'cursor-pointer'}`}>{label}</label>
        <button
            id={id}
            onClick={onToggle}
            disabled={disabled}
            className={`relative inline-flex flex-shrink-0 h-5 w-10 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 ${checked ? 'bg-teal-600' : 'bg-gray-300'} ${disabled ? 'cursor-not-allowed' : ''}`}
            role="switch"
            aria-checked={checked}
        >
            <span className="sr-only">Toggle {label}</span>
            <span aria-hidden="true" className={`inline-block h-4 w-4 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200 ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
        </button>
    </div>
);

const permissionGroupStyles = [
  { bg: 'bg-teal-50', border: 'border-teal-200', headerBg: 'bg-teal-100', headerText: 'text-teal-800' },
  { bg: 'bg-sky-50', border: 'border-sky-200', headerBg: 'bg-sky-100', headerText: 'text-sky-800' },
  { bg: 'bg-indigo-50', border: 'border-indigo-200', headerBg: 'bg-indigo-100', headerText: 'text-indigo-800' },
  { bg: 'bg-rose-50', border: 'border-rose-200', headerBg: 'bg-rose-100', headerText: 'text-rose-800' },
  { bg: 'bg-amber-50', border: 'border-amber-200', headerBg: 'bg-amber-100', headerText: 'text-amber-800' },
  { bg: 'bg-lime-50', border: 'border-lime-200', headerBg: 'bg-lime-100', headerText: 'text-lime-800' },
  { bg: 'bg-violet-50', border: 'border-violet-200', headerBg: 'bg-violet-100', headerText: 'text-violet-800' },
];

const PermissionGroup: React.FC<{ title: string; children: React.ReactNode; colorIndex: number; }> = ({ title, children, colorIndex }) => {
    const styles = permissionGroupStyles[colorIndex % permissionGroupStyles.length];
    return (
        <div className={`border rounded-lg h-fit shadow-sm ${styles.bg} ${styles.border}`}>
            <h4 className={`font-semibold ${styles.headerText} ${styles.headerBg} px-4 py-2 rounded-t-md border-b ${styles.border} text-sm`}>{title}</h4>
            <div className="p-4">
                {children}
            </div>
        </div>
    );
};


const RolePermissionModal: React.FC<{ isOpen: boolean; onClose: () => void; }> = ({ isOpen, onClose }) => {
    const { rolePermissions, updatePermissionsForRole, userRoles, roleDisplayNames, addRole } = useRolePermissions();
    const [selectedRole, setSelectedRole] = useState<UserRole>('teacher');
    const [stagedPermissions, setStagedPermissions] = useState<RolePermissions | null>(null);
    const [newRoleName, setNewRoleName] = useState('');
    const [addRoleError, setAddRoleError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setStagedPermissions(JSON.parse(JSON.stringify(rolePermissions))); // Deep copy for editing
            setSelectedRole('teacher');
        }
    }, [isOpen, rolePermissions]);
    
    const handleAddRole = () => {
        setAddRoleError(null);
        if (!newRoleName.trim()) {
            setAddRoleError("Role name cannot be empty.");
            return;
        }
        try {
            const displayName = newRoleName.trim();
            addRole(displayName);
            setNewRoleName('');
            // The key is derived inside the context, find it to select it
            const roleKey = displayName.toLowerCase().replace(/\s+/g, '-');
            setSelectedRole(roleKey);
        } catch (e: any) {
            setAddRoleError(e.message);
        }
    };

    const handleSave = () => {
        if (stagedPermissions && stagedPermissions[selectedRole]) {
            updatePermissionsForRole(selectedRole, stagedPermissions[selectedRole]);
            alert(`Permissions for role '${roleDisplayNames[selectedRole] || selectedRole}' have been updated.`);
        }
        onClose();
    };

    const handlePermissionToggle = (
      permissionType: 'dashboardAccess' | 'roomEditAccess' | 'programManagementAccess' | 'notificationAccess', 
      key: any
    ) => {
        setStagedPermissions(prev => {
            if (!prev) return null;
            const newPerms = { ...prev };
            const rolePerms = { ...newPerms[selectedRole] };
            const accessGroup = { ...(rolePerms[permissionType] as any) };

            accessGroup[key] = !accessGroup[key];
            rolePerms[permissionType] = accessGroup;
            newPerms[selectedRole] = rolePerms;
            return newPerms;
        });
    };

    const handleAccessLevelChange = (
        permissionKey: 'makeupSlotBookingAccess' | 'bulkAssignAccess' | 'classMonitoringAccess',
        value: AssignAccessLevel
    ) => {
        setStagedPermissions(prev => {
            if (!prev) return null;
            const newPerms = { ...prev };
            const rolePerms = { ...newPerms[selectedRole] };
            
            if (permissionKey === 'classMonitoringAccess') {
                const dashboardAccess = { ...(rolePerms.dashboardAccess as DashboardAccess) };
                dashboardAccess.classMonitoringAccess = value;
                rolePerms.dashboardAccess = dashboardAccess;
            } else {
                rolePerms[permissionKey as 'makeupSlotBookingAccess' | 'bulkAssignAccess'] = value;
            }
            
            newPerms[selectedRole] = rolePerms;
            return newPerms;
        });
    };

    const currentPermissions = stagedPermissions ? stagedPermissions[selectedRole] : null;
    const isRoleDisabled = selectedRole === 'admin';

    const renderPermissionGroup = (
        permissions: (keyof DashboardAccess | keyof RoomEditAccess | keyof ProgramManagementAccess | keyof NotificationAccess)[],
        permissionType: 'dashboardAccess' | 'roomEditAccess' | 'programManagementAccess' | 'notificationAccess'
    ) => (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4">
            {permissions.map(key => (
                <PermissionToggle
                    key={key}
                    id={`${selectedRole}-${key}`}
                    label={PERMISSION_LABELS[key] || key}
                    checked={!!(currentPermissions?.[permissionType] as any)?.[key]}
                    onToggle={() => handlePermissionToggle(permissionType, key)}
                    disabled={isRoleDisabled}
                />
            ))}
        </div>
    );
    

    const footer = (
      <div className="flex justify-between items-center w-full">
        <div className="flex-grow max-w-sm">
            <div className="flex gap-1">
                <input
                    type="text"
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    placeholder="Enter new role name..."
                    className="flex-grow p-1.5 border border-gray-300 rounded-l-md text-sm"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddRole(); }}
                />
                <button
                    onClick={handleAddRole}
                    className="px-4 bg-teal-600 text-white rounded-r-md text-sm font-semibold hover:bg-teal-700"
                >
                    Add Role
                </button>
            </div>
            {addRoleError && <p className="text-xs text-red-600 mt-1 pl-1">{addRoleError}</p>}
        </div>
        <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-md text-sm font-medium">Cancel</button>
            <button onClick={handleSave} disabled={isRoleDisabled} className="px-4 py-2 bg-teal-600 text-white rounded-md disabled:bg-gray-400 text-sm font-medium">Save Changes</button>
        </div>
      </div>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Manage Role Permissions" footerContent={footer} maxWidthClass="max-w-screen-xl" heightClass="h-[85vh]">
            <div className="flex flex-col h-full">
                <div className="flex flex-row flex-grow min-h-0">
                    {/* Left Sidebar for Roles */}
                    <aside className="w-56 flex-shrink-0 bg-slate-50 border-r border-gray-200 flex flex-col">
                        <div className="p-3 border-b border-gray-200">
                           <h3 className="font-semibold text-gray-800 text-sm">Select Role</h3>
                        </div>
                        <div className="overflow-y-auto custom-scrollbar p-2 space-y-1">
                            {userRoles.map(role => (
                                <button
                                    key={role}
                                    onClick={() => setSelectedRole(role)}
                                    className={`w-full text-left px-2.5 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                                        selectedRole === role ? 'bg-teal-100 text-teal-800' : 'text-gray-700 hover:bg-gray-100'
                                    }`}
                                >
                                    {roleDisplayNames[role] || role}
                                </button>
                            ))}
                        </div>
                    </aside>

                    {/* Right Content for Permissions */}
                    <main className="flex-grow p-4 overflow-y-auto custom-scrollbar">
                        {currentPermissions ? (
                            <div className="space-y-4">
                                {isRoleDisabled && <div className="p-3 bg-yellow-100 text-yellow-800 text-sm rounded-md">Admin permissions are fixed and cannot be changed.</div>}
                                
                                <PermissionGroup title="Routine Access & Actions" colorIndex={0}>
                                    {renderPermissionGroup(['canViewEditableRoutine', 'canViewPublishedRoutine', 'canPublishRoutine'], 'dashboardAccess')}
                                </PermissionGroup>
                                <PermissionGroup title="Dashboard Access" colorIndex={1}>
                                    {renderPermissionGroup(['canViewCourseList', 'canViewSectionList', 'canViewRoomList', 'canViewTeacherList', 'canViewSlotRequirement', 'canViewSlotUsage', 'canViewMakeupSchedule', 'canViewSectionTable', 'canCustomizeTheme'], 'dashboardAccess')}
                                </PermissionGroup>
                                <PermissionGroup title="Routine Management" colorIndex={2}>
                                    <div className="space-y-4">
                                        {renderPermissionGroup(['canAutoAssign', 'canManageVersions', 'canDragAndDrop', 'canViewSlotHistory'], 'dashboardAccess')}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4 border-t border-gray-200">
                                            <div>
                                                <label htmlFor="class-monitoring-access" className="block text-sm font-medium text-gray-700">Class Monitoring</label>
                                                <p className="text-xs text-gray-500 mb-1">Allows user to log attendance and schedule make-up classes.</p>
                                                <select id="class-monitoring-access" value={currentPermissions.dashboardAccess?.classMonitoringAccess || 'none'} onChange={(e) => handleAccessLevelChange('classMonitoringAccess', e.target.value as AssignAccessLevel)} disabled={isRoleDisabled} className="mt-1 block w-full p-2 border border-gray-300 rounded-md text-sm">
                                                    <option value="none">No Access</option>
                                                    <option value="own">Own Courses</option>
                                                    <option value="full">Full Access</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label htmlFor="bulk-assign-access" className="block text-sm font-medium text-gray-700">Bulk Assign</label>
                                                <p className="text-xs text-gray-500 mb-1">Assigns a course to all weeks for a slot.</p>
                                                <select id="bulk-assign-access" value={currentPermissions.bulkAssignAccess || 'none'} onChange={(e) => handleAccessLevelChange('bulkAssignAccess', e.target.value as AssignAccessLevel)} disabled={isRoleDisabled} className="mt-1 block w-full p-2 border border-gray-300 rounded-md text-sm">
                                                    <option value="none">No Access</option>
                                                    <option value="own">Own Courses</option>
                                                    <option value="full">Full Access</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label htmlFor="makeup-access" className="block text-sm font-medium text-gray-700">Make-up/Specific</label>
                                                <p className="text-xs text-gray-500 mb-1">Assigns single classes to specific dates.</p>
                                                <select id="makeup-access" value={currentPermissions.makeupSlotBookingAccess || 'none'} onChange={(e) => handleAccessLevelChange('makeupSlotBookingAccess', e.target.value as AssignAccessLevel)} disabled={isRoleDisabled} className="mt-1 block w-full p-2 border border-gray-300 rounded-md text-sm">
                                                    <option value="none">No Access</option>
                                                    <option value="own">Own Courses</option>
                                                    <option value="full">Full Access</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                </PermissionGroup>
                                <PermissionGroup title="Room Management" colorIndex={3}>
                                    {renderPermissionGroup(['canManageRoomManagement', 'canAddBuilding', 'canAddRoom', 'canViewRoomDetail', 'canEditAssignToProgram', 'canEditShareWithPrograms', 'canEditDetailsTab', 'canEditSlotsTab', 'canImportRoomData', 'canExportRoomData'], 'roomEditAccess')}
                                </PermissionGroup>
                                <PermissionGroup title="Course Data" colorIndex={4}>
                                    {renderPermissionGroup(['canEditCourseSectionDetails', 'canImportCourseData', 'canExportCourseData'], 'dashboardAccess')}
                                </PermissionGroup>
                                <PermissionGroup title="System Setup" colorIndex={5}>
                                    {renderPermissionGroup(['canManageProgramSetup', 'canManageDefaultSlots', 'canManageSemesterSetup'], 'dashboardAccess')}
                                </PermissionGroup>
                                {currentPermissions?.dashboardAccess?.canManageProgramSetup && (
                                <PermissionGroup title="Program Management" colorIndex={6}>
                                    {renderPermissionGroup(['canAddProgram', 'canEditProgram'], 'programManagementAccess')}
                                </PermissionGroup>
                                )}
                                <PermissionGroup title="Notifications" colorIndex={7}>
                                    {renderPermissionGroup(['canGetNotification', 'canApproveSlots'], 'notificationAccess')}
                                </PermissionGroup>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-500">Loading permissions...</div>
                        )}
                    </main>
                </div>
            </div>
        </Modal>
    );
};

export default RolePermissionModal;