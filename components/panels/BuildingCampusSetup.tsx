import React, { useState, useCallback, ChangeEvent, useMemo } from 'react';
import { BuildingEntry, SemesterCloneInfo, ProgramType, SemesterSystem } from '../../types';
import { useBuildings } from '../../contexts/BuildingContext';
import Modal from '../Modal';
import SearchableCampusNameDropdown from '../SearchableCampusNameDropdown'; 
import SearchableCreatableDropdown from '../SearchableCreatableDropdown';
import { useAuth } from '../../contexts/AuthContext';

interface BuildingCampusSetupProps {
  onShowBuildingRooms?: (buildingId: string | null) => void;
  allSemesterConfigurations: SemesterCloneInfo[];
  selectedSemesterIdForRoutineView: string | null;
  setSelectedSemesterIdForRoutineView: (semesterId: string | null) => void;
}

const SemesterDropdownIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
    </svg>
);


const BuildingCampusSetup: React.FC<BuildingCampusSetupProps> = ({
  onShowBuildingRooms,
  allSemesterConfigurations,
  selectedSemesterIdForRoutineView,
  setSelectedSemesterIdForRoutineView,
}) => {
  const { user } = useAuth();
  const { buildings, loading, error, addBuilding, updateBuilding, deleteBuilding } = useBuildings();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState<BuildingEntry | null>(null);
  const [formState, setFormState] = useState<Omit<BuildingEntry, 'id' | 'thumbnailUrl'> & { thumbnailUrl?: string, id?: string }>({
    campusName: '',
    buildingName: '',
    buildingShortName: '',
    address: '',
    thumbnailUrl: '', // Will hold base64 data URL
    squareFeet: undefined,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [submissionStatus, setSubmissionStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const uniqueCampusNames = useMemo(() => {
    if (!buildings) return [];
    return [...new Set(buildings.map(b => b.campusName).filter(name => name.trim() !== ''))].sort();
  }, [buildings]);


  const semesterDropdownItems = useMemo(() => {
    return allSemesterConfigurations.map(semConfig => ({
        id: semConfig.targetSemester,
        name: semConfig.targetSemester,
    })).sort((a,b) => {
        const semesterOrder = ['Spring', 'Summer', 'Fall'];
        const [aSem, aYear] = a.name.split(' ');
        const [bSem, bYear] = b.name.split(' ');
        if (aYear !== bYear) return (parseInt(bYear) || 0) - (parseInt(aYear) || 0); // Descending year
        return semesterOrder.indexOf(aSem) - semesterOrder.indexOf(bSem);
    });
  }, [allSemesterConfigurations]);
  
  const semesterDropdownButtonClass = useMemo(() => {
    const baseClasses = "w-full flex items-center justify-between p-1.5 text-xs rounded-md transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-offset-1 shadow-sm";
    
    if (selectedSemesterIdForRoutineView) {
      // Selected state: vibrant teal
      return `${baseClasses} bg-teal-100 border-teal-400 text-teal-800 font-semibold focus:ring-teal-500 focus:ring-offset-gray-50`;
    } else {
      // Default state: neutral
      return `${baseClasses} bg-white border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-teal-500 focus:ring-offset-gray-50`;
    }
  }, [selectedSemesterIdForRoutineView]);


  const resetFormAndCloseModal = useCallback(() => {
    setFormState({ campusName: '', buildingName: '', buildingShortName: '', address: '', thumbnailUrl: '', squareFeet: undefined });
    setEditingBuilding(null);
    setThumbnailPreview(null);
    setFormError(null);
    setIsModalOpen(false);
    setSubmissionStatus(null);
  }, []);

  const handleOpenAddModal = () => {
    setEditingBuilding(null);
    setFormState({ campusName: '', buildingName: '', buildingShortName: '', address: '', thumbnailUrl: '', squareFeet: undefined });
    setThumbnailPreview(null);
    setFormError(null);
    setSubmissionStatus(null);
    setIsModalOpen(true);
  };
  
  const handleOpenEditModal = (building: BuildingEntry) => {
    setEditingBuilding(building);
    setFormState({ ...building }); // Spread all properties including id and thumbnailUrl
    setThumbnailPreview(building.thumbnailUrl);
    setFormError(null);
    setSubmissionStatus(null);
    setIsModalOpen(true);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormState(prev => ({ ...prev, [name]: name === 'squareFeet' ? (value === '' ? undefined : Number(value)) : value }));
  };
  
  const handleCampusNameSelect = useCallback((campusName: string) => {
    setFormState(prev => ({ ...prev, campusName }));
  }, []);


  const handleThumbnailChange = (e: ChangeEvent<HTMLInputElement>) => {
    const fileInput = e.target;
    const file = fileInput.files?.[0];

    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        setFormError("Thumbnail image size should not exceed 2MB.");
        setThumbnailPreview(editingBuilding?.thumbnailUrl || null);
        setFormState(prev => ({ ...prev, thumbnailUrl: editingBuilding?.thumbnailUrl || '' }));
        if (fileInput) fileInput.value = ''; 
        return;
      }

      const reader = new FileReader();
      
      reader.onload = (loadEvent) => {
        const result = loadEvent.target?.result;
        if (typeof result === 'string') {
          setThumbnailPreview(result);
          setFormState(prev => ({ ...prev, thumbnailUrl: result }));
          setFormError(null);
        } else {
          setFormError("Could not read image data correctly.");
          setThumbnailPreview(editingBuilding?.thumbnailUrl || null);
          setFormState(prev => ({ ...prev, thumbnailUrl: editingBuilding?.thumbnailUrl || '' }));
        }
        if (fileInput) fileInput.value = '';
      };
      
      reader.onerror = () => {
        setFormError("Failed to read the thumbnail image.");
        setThumbnailPreview(editingBuilding?.thumbnailUrl || null);
        setFormState(prev => ({ ...prev, thumbnailUrl: editingBuilding?.thumbnailUrl || '' }));
        if (fileInput) fileInput.value = '';
      };

      reader.readAsDataURL(file);
    } else {
        setThumbnailPreview(editingBuilding?.thumbnailUrl || null);
        setFormState(prev => ({...prev, thumbnailUrl: editingBuilding?.thumbnailUrl || ''}));
    }
  };

  const handleSubmit = async () => {
    setFormError(null);
    setSubmissionStatus(null);

    if (!formState.campusName || !formState.buildingName || !formState.buildingShortName || !formState.address) {
      setFormError('Campus Name, Building Name, Short Name, and Address are required.');
      return;
    }
    
    if (!formState.thumbnailUrl) {
        setFormError('Thumbnail image is required.');
        return;
    }
    
    const payload: Omit<BuildingEntry, 'id'> = {
        campusName: formState.campusName,
        buildingName: formState.buildingName,
        buildingShortName: formState.buildingShortName,
        address: formState.address,
        thumbnailUrl: formState.thumbnailUrl, 
        squareFeet: formState.squareFeet,
    };
    
    try {
      if (editingBuilding) {
        await updateBuilding({ ...payload, id: editingBuilding.id });
        setSubmissionStatus({ type: 'success', message: 'Building updated successfully!' });
      } else {
        await addBuilding(payload);
        setSubmissionStatus({ type: 'success', message: 'Building added successfully!' });
      }
      setTimeout(resetFormAndCloseModal, 1500);
    } catch (e: any) {
      setFormError(e.message || 'Failed to save building.');
      setSubmissionStatus({ type: 'error', message: e.message || 'Failed to save building.' });
    }
  };
  
  const handleDeleteBuilding = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this building? This action cannot be undone.")) {
      try {
        await deleteBuilding(id);
      } catch (e: any) {
        alert(`Failed to delete building: ${e.message}`);
      }
    }
  };

  const sortedBuildings = useMemo(() => {
    if (!buildings) {
      return [];
    }
    return [...buildings].sort((a, b) => a.buildingName.localeCompare(b.buildingName));
  }, [buildings]);


  const modalFormContent = (
    <div className="space-y-4">
      <div>
        <label htmlFor="campusName" className="block text-sm font-medium text-gray-700 mb-1">Campus Name *</label>
        <SearchableCampusNameDropdown
            allCampusNames={uniqueCampusNames}
            currentCampusName={formState.campusName}
            onCampusNameSelect={handleCampusNameSelect}
            placeholderText="Select or Add Campus Name"
        />
      </div>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
            <label htmlFor="buildingName" className="block text-sm font-medium text-gray-700 mb-1">Building Name *</label>
            <input type="text" name="buildingName" id="buildingName" value={formState.buildingName} onChange={handleInputChange} required className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-teal-500 focus:border-teal-500 text-sm"/>
        </div>
        <div>
            <label htmlFor="buildingShortName" className="block text-sm font-medium text-gray-700 mb-1">Building Short Name *</label>
            <input type="text" name="buildingShortName" id="buildingShortName" value={formState.buildingShortName} onChange={handleInputChange} required placeholder="e.g., KT, IB" className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-teal-500 focus:border-teal-500 text-sm"/>
        </div>
      </div>
      <div>
        <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
        <textarea name="address" id="address" value={formState.address} onChange={handleInputChange} rows={3} required className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-teal-500 focus:border-teal-500 text-sm"></textarea>
      </div>
      <div>
        <label htmlFor="thumbnailFile" className="block text-sm font-medium text-gray-700 mb-1">Thumbnail Image * <span className="text-xs text-gray-500">(Max 2MB, {editingBuilding && formState.thumbnailUrl ? 'Current image retained if no new file is chosen' : 'Required for new entry'})</span></label>
        <input type="file" name="thumbnailFile" id="thumbnailFile" accept="image/*" onChange={handleThumbnailChange} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100"/>
        {thumbnailPreview && <img src={thumbnailPreview} alt="Thumbnail Preview" className="mt-2 rounded-md max-h-32 object-contain border border-gray-200 shadow-sm" />}
      </div>
      <div>
        <label htmlFor="squareFeet" className="block text-sm font-medium text-gray-700 mb-1">Square Feet (Optional)</label>
        <input type="number" name="squareFeet" id="squareFeet" value={formState.squareFeet ?? ''} onChange={handleInputChange} placeholder="e.g., 50000" className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-teal-500 focus:border-teal-500 text-sm"/>
      </div>

      {formError && <p className="text-sm text-red-600 p-2 bg-red-100 border border-red-300 rounded-md">{formError}</p>}
      {submissionStatus && (
        <p className={`text-sm p-2 rounded-md border ${submissionStatus.type === 'success' ? 'bg-green-100 border-green-300 text-green-700' : 'bg-red-100 border-red-300 text-red-700'}`}>
            {submissionStatus.message}
        </p>
      )}

      <div className="flex justify-end gap-3 pt-3 border-t border-gray-200 mt-4">
        <button type="button" onClick={resetFormAndCloseModal} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md border border-gray-300">Cancel</button>
        <button type="button" onClick={handleSubmit} className="px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-md border border-transparent">
          {editingBuilding ? 'Update Building' : 'Save Building'}
        </button>
      </div>
    </div>
  );

  if (loading) return <div className="p-4 text-center text-gray-500">Loading buildings...</div>;
  if (error) return <div className="p-4 text-center text-red-500">Error: {error}</div>;

  return (
    <div className="p-1 sm:p-1.5 rounded-md bg-slate-100 flex flex-col h-full">
      <div className="flex-grow min-h-0 overflow-y-auto custom-scrollbar p-1.5">
        {sortedBuildings.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 p-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h6.75M9 12.75h6.75M9 18.75h6.75M5.25 6h.008v.008H5.25V6Zm.75 0H6V6h-.008v.008Zm13.5 0h-.008V6H18v.008Zm-.75 0h.008v.008H18V6Zm-12 5.25h.008v.008H5.25v-.008Zm.75 0H6v-.008h-.008v.008Zm13.5 0h-.008v.008H18v-.008Zm-.75 0h.008v.008H18v-.008Zm-12 5.25h.008v.008H5.25v-.008Zm.75 0H6v-.008h-.008v.008Zm13.5 0h-.008v.008H18v-.008Zm-.75 0h.008v.008H18v-.008Z" />
            </svg>
            <p className="font-semibold text-lg">No Buildings Added Yet</p>
            <p className="text-sm">Click the "Add New Building" button below to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:gap-4">
            <div className="bg-white rounded-lg shadow-md group relative focus-within:ring-2 focus-within:ring-teal-500 focus-within:ring-offset-2">
                <div 
                    className="flex flex-row items-center cursor-pointer hover:bg-gray-50 transition-colors p-2"
                    onClick={() => onShowBuildingRooms && onShowBuildingRooms(null)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            if (onShowBuildingRooms) onShowBuildingRooms(null);
                        }
                    }}
                    tabIndex={0}
                    aria-label="View rooms for all buildings"
                >
                    <div className="flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20">
                        <div className="w-full h-full bg-teal-50 rounded-md flex items-center justify-center p-3 transition-transform duration-300 group-hover:scale-105">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-full w-full text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                            </svg>
                        </div>
                    </div>
                    <div className="pl-3 flex-grow min-w-0">
                        <h4 className="text-md font-semibold text-teal-700 truncate">All Buildings</h4>
                        <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                            <SearchableCreatableDropdown
                                idPrefix="all-bld-sem-filter"
                                options={semesterDropdownItems}
                                value={selectedSemesterIdForRoutineView}
                                onChange={(id) => setSelectedSemesterIdForRoutineView(id)}
                                onCreate={() => Promise.resolve(null)}
                                allowCreation={false}
                                placeholder="Filter by Semester"
                                buttonClassName={semesterDropdownButtonClass}
                                dropdownClassName="absolute z-20 w-full mt-1 bg-white rounded-md shadow-lg max-h-60 overflow-auto custom-scrollbar border border-gray-300"
                            />
                        </div>
                    </div>
                </div>
            </div>
            {sortedBuildings.map(building => (
              <div 
                key={building.id} 
                className="bg-white rounded-lg shadow-md overflow-hidden group relative cursor-pointer hover:shadow-xl focus-within:ring-2 focus-within:ring-teal-500 focus-within:ring-offset-2 transition-all duration-200"
                onClick={(e) => {
                  if (e.target instanceof HTMLElement && e.target.closest('button[data-action-button="true"]')) {
                    return;
                  }
                  if (onShowBuildingRooms) {
                    onShowBuildingRooms(building.id);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    if (e.target instanceof HTMLElement && e.target.closest('button[data-action-button="true"]')) {
                      return;
                    }
                    if (onShowBuildingRooms) {
                      onShowBuildingRooms(building.id);
                    }
                  }
                }}
                tabIndex={0}
                aria-label={`View details for ${building.buildingName}`}
              >
                 <div className="w-full h-32 bg-gray-200">
                    <img 
                        src={building.thumbnailUrl} 
                        alt={`Thumbnail for ${building.buildingName}`}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = "data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22100%25%22%20height%3D%22100%25%22%20viewBox%3D%220%200%20100%2080%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20fill%3D%22%23e2e8f0%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2250%25%22%20font-family%3D%22sans-serif%22%20font-size%3D%2210%22%20fill%3D%22%2394a3b8%22%20text-anchor%3D%22middle%22%20dominant-baseline%3D%22middle%22%3EError%3C%2Ftext%3E%3C%2Fsvg%3E";
                            target.onerror = null; 
                        }}
                    />
                 </div>
                <div className="p-3">
                  <h4 className="text-md font-semibold text-teal-700 truncate flex items-center gap-1.5" title={`${building.buildingName} (${building.buildingShortName})`}>
                    <span>{building.buildingName}</span>
                    <span className="text-xs font-medium text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded-full">{building.buildingShortName}</span>
                  </h4>
                  <p className="text-xs text-gray-500 mt-1" title={building.address}>{building.address}</p>
                </div>
                <div className="absolute top-2 right-2 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200">
                    <button 
                        data-action-button="true"
                        onClick={(e) => { e.stopPropagation(); handleOpenEditModal(building); }}
                        className="p-1.5 bg-white/80 backdrop-blur-sm text-teal-600 hover:text-teal-700 rounded-full shadow-md hover:bg-teal-50 transition-all focus:opacity-100" 
                        title="Edit Building" 
                        aria-label={`Edit ${building.buildingName}`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>
                    </button>
                    <button 
                        data-action-button="true"
                        onClick={(e) => { e.stopPropagation(); handleDeleteBuilding(building.id); }}
                        className="p-1.5 bg-white/80 backdrop-blur-sm text-red-600 hover:text-red-700 rounded-full shadow-md hover:bg-red-50 transition-all focus:opacity-100" 
                        title="Delete Building" 
                        aria-label={`Delete ${building.buildingName}`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                    </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {user?.roomEditAccess?.canAddBuilding && (
        <div className="mt-auto pt-3 pb-1 flex-shrink-0">
            <button
            onClick={handleOpenAddModal}
            className="w-full px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-md flex items-center justify-center shadow-sm"
            aria-label="Add new building"
            >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Add New Building
            </button>
        </div>
      )}
      <Modal isOpen={isModalOpen} onClose={resetFormAndCloseModal} title={editingBuilding ? "Edit Building" : "Add New Building"}>
        {modalFormContent}
      </Modal>
    </div>
  );
};

export default BuildingCampusSetup;