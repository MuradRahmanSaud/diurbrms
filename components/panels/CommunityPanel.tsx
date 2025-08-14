import React from 'react';
import BasePanel from './BasePanel';

interface CommunityPanelProps {
  onClose: () => void;
}

const CommunityPanel: React.FC<CommunityPanelProps> = ({ onClose }) => {
  // Sample forum posts
  const forumPosts = [
    { id: 1, user: 'StudentA', avatar: '👤', title: 'Discussion: CSE111 Midterm Prep', replies: 5, time: '1h ago' },
    { id: 2, user: 'FacultyB', avatar: '🧑‍🏫', title: 'Reminder: Project Submission Deadline for ENG101', replies: 2, time: '5h ago' },
    { id: 3, user: 'StudentC', avatar: '👤', title: 'Lost & Found: Blue Water Bottle in AB1-101', replies: 0, time: '1d ago' },
  ];

  return (
    <BasePanel title="Community Hub" onClose={onClose}>
      {/* This outer div will be the direct child within BasePanel's scrollable content area */}
      <div>
        <div className="mb-4">
          <textarea 
            className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-teal-500 focus:border-teal-500" 
            rows={3}
            placeholder="Start a new discussion or ask a question..."
          ></textarea>
          <button className="mt-2 w-full px-4 py-2 bg-teal-500 text-white text-sm rounded-md hover:bg-teal-600 transition-colors">
            Post New Topic
          </button>
        </div>
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-teal-600 mb-2">Recent Discussions</h3>
          {forumPosts.length > 0 ? (
            forumPosts.map(post => (
              <div key={post.id} className="p-3 rounded-md shadow-sm border border-gray-200 hover:shadow-md transition-shadow bg-gray-50">
                <div className="flex items-center mb-1">
                  <span className="text-lg mr-2">{post.avatar}</span>
                  <span className="font-medium text-teal-700 text-sm">{post.user}</span>
                </div>
                <h4 className="font-semibold text-gray-800 text-xs mb-0.5">{post.title}</h4>
                <div className="flex justify-between items-center text-xs text-gray-500">
                  <span>{post.replies} replies</span>
                  <span>{post.time}</span>
                </div>
              </div>
            ))
          ) : (
             <p className="text-gray-500 italic text-center py-5">No discussions yet. Start one!</p>
          )}
        </div>
      </div>
    </BasePanel>
  );
};

export default CommunityPanel;