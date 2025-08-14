


import React from 'react';

interface BasePanelProps {
  title?: string; // Made title optional
  onClose: () => void;
  children: React.ReactNode;
  footerContent?: React.ReactNode;
  className?: string; 
}

const BasePanel: React.FC<BasePanelProps> = ({ title, onClose, children, footerContent, className = '' }) => {
  return (
    <div className={`p-2 sm:p-3 h-full flex flex-col bg-white text-gray-800 ${className} relative`}> {/* Added relative positioning */}
      {/* Header - Only render if title is provided */}
      {title && (
        <div className="flex justify-between items-center mb-2 sm:mb-3 pb-1 sm:pb-1.5 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-base sm:text-lg font-semibold text-teal-700">{title}</h2>
          <button
            onClick={onClose}
            className="bg-gray-100 text-gray-500 hover:text-red-600 p-1 rounded-full hover:bg-red-100 transition-colors" // Added bg-gray-100
            aria-label={`Close ${title.toLowerCase()} panel`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
      
      {/* If no title, there is no default close button anymore. The child panel must manage its own close actions. */}


      {/* Main Content */}
      {/* If !title, pt-0 ensures children (like SettingsPanel content) start at the top of this content area */}
      <div className={`flex-grow overflow-y-auto pr-0.5 custom-scrollbar ${!title ? 'pt-0' : ''}`}> 
        {children}
      </div>

      {/* Footer */}
      {footerContent && (
        <div className="mt-auto border-t border-gray-200 bg-gray-50 p-2 sm:p-3 flex-shrink-0 shadow-inner">
          {footerContent}
        </div>
      )}
    </div>
  );
};

export default BasePanel;