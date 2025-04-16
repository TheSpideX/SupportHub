import React, { useState } from 'react';
import { FaComment, FaPaperPlane, FaLock } from 'react-icons/fa';
import { useAddCommentMutation } from '../api/ticketApi';
import { toast } from 'react-hot-toast';

interface AddCommentFormProps {
  ticketId: string;
  onSuccess?: () => void;
  allowInternal?: boolean;
}

const AddCommentForm: React.FC<AddCommentFormProps> = ({ 
  ticketId, 
  onSuccess,
  allowInternal = false
}) => {
  const [comment, setComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [addComment, { isLoading }] = useAddCommentMutation();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!comment.trim()) {
      toast.error('Comment cannot be empty');
      return;
    }
    
    try {
      await addComment({
        id: ticketId,
        data: {
          text: comment,
          isInternal: allowInternal ? isInternal : false
        }
      }).unwrap();
      
      setComment('');
      toast.success('Comment added successfully');
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error('Failed to add comment:', err);
      toast.error('Failed to add comment. Please try again.');
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex items-center justify-between">
        <label htmlFor="comment" className="block text-sm font-medium text-gray-300">
          <FaComment className="inline mr-2" /> Add Comment
        </label>
        
        {allowInternal && (
          <div className="flex items-center">
            <label className="inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isInternal}
                onChange={() => setIsInternal(!isInternal)}
                className="sr-only peer"
              />
              <div className={`relative w-11 h-6 ${isInternal ? 'bg-blue-600' : 'bg-gray-700'} rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all`}></div>
              <span className="ms-3 text-sm font-medium text-gray-300 flex items-center">
                <FaLock className="mr-1" /> Internal Only
              </span>
            </label>
          </div>
        )}
      </div>
      
      <div className="relative">
        <textarea
          id="comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          className={`w-full bg-gray-700/50 border border-gray-600/50 rounded-lg py-2 px-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${isInternal ? 'border-blue-500/50' : ''}`}
          placeholder={isInternal ? "Internal comment (not visible to customer)" : "Add your comment here..."}
        />
        
        <button
          type="submit"
          disabled={isLoading || !comment.trim()}
          className="absolute bottom-2 right-2 p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <FaPaperPlane />
          )}
        </button>
      </div>
      
      {isInternal && (
        <p className="text-xs text-blue-400 flex items-center">
          <FaLock className="mr-1" /> This comment will only be visible to team members, not to customers.
        </p>
      )}
    </form>
  );
};

export default AddCommentForm;
