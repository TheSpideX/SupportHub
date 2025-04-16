import React, { useState, useEffect } from 'react';
import { FaExclamationCircle, FaUser, FaTags, FaSave } from 'react-icons/fa';
import { useUpdateQueryMutation, Query } from '../api/queryApi';
import { toast } from 'react-hot-toast';

interface EditQueryFormProps {
  query: Query;
  onSuccess?: () => void;
}

const EditQueryForm: React.FC<EditQueryFormProps> = ({ query, onSuccess }) => {
  const [formData, setFormData] = useState({
    title: query.title || '',
    description: query.description || '',
    status: query.status || 'new',
    priority: query.priority || 'medium',
    category: query.category || '',
    subcategory: query.subcategory || '',
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [updateQuery, { isLoading }] = useUpdateQueryMutation();
  
  // Update form data when query changes
  useEffect(() => {
    setFormData({
      title: query.title || '',
      description: query.description || '',
      status: query.status || 'new',
      priority: query.priority || 'medium',
      category: query.category || '',
      subcategory: query.subcategory || '',
    });
  }, [query]);
  
  // Categories with subcategories
  const categories = [
    { 
      name: 'Account', 
      subcategories: ['Login Issues', 'Registration', 'Password Reset', 'Profile', 'Permissions'] 
    },
    { 
      name: 'Billing', 
      subcategories: ['Invoice', 'Payment', 'Subscription', 'Refund', 'Pricing'] 
    },
    { 
      name: 'Product', 
      subcategories: ['Feature Request', 'Bug Report', 'Usage Question', 'Documentation', 'Integration'] 
    },
    { 
      name: 'Service', 
      subcategories: ['Outage', 'Performance', 'Data', 'Security', 'Compliance'] 
    },
    { 
      name: 'Other', 
      subcategories: ['General Inquiry', 'Feedback', 'Partnership', 'Press', 'Legal'] 
    }
  ];
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    const newErrors: Record<string, string> = {};
    if (!formData.title.trim()) newErrors.title = 'Title is required';
    if (!formData.description.trim()) newErrors.description = 'Description is required';
    if (!formData.category) newErrors.category = 'Category is required';
    if (!formData.priority) newErrors.priority = 'Priority is required';
    if (!formData.status) newErrors.status = 'Status is required';
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    try {
      await updateQuery({
        id: query._id,
        data: formData
      }).unwrap();
      
      toast.success('Query updated successfully');
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error('Failed to update query:', err);
      toast.error('Failed to update query. Please try again.');
    }
  };
  
  // Handle input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    setFormData({
      ...formData,
      [name]: value
    });
    
    // Clear error when field is edited
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: ''
      });
    }
  };
  
  // Update subcategories when category changes
  useEffect(() => {
    if (formData.category && formData.category !== query.category) {
      setFormData({
        ...formData,
        subcategory: ''
      });
    }
  }, [formData.category, query.category]);
  
  // Get subcategories for selected category
  const getSubcategories = () => {
    const category = categories.find(c => c.name === formData.category);
    return category ? category.subcategories : [];
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        {/* Title */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-300 mb-1">
            Query Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="title"
            name="title"
            value={formData.title}
            onChange={handleChange}
            className={`w-full bg-gray-700/50 border ${errors.title ? 'border-red-500' : 'border-gray-600/50'} rounded-lg py-2 px-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50`}
          />
          {errors.title && (
            <p className="mt-1 text-sm text-red-500 flex items-center">
              <FaExclamationCircle className="mr-1" /> {errors.title}
            </p>
          )}
        </div>
        
        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-1">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={5}
            className={`w-full bg-gray-700/50 border ${errors.description ? 'border-red-500' : 'border-gray-600/50'} rounded-lg py-2 px-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50`}
          />
          {errors.description && (
            <p className="mt-1 text-sm text-red-500 flex items-center">
              <FaExclamationCircle className="mr-1" /> {errors.description}
            </p>
          )}
        </div>
        
        {/* Status */}
        <div>
          <label htmlFor="status" className="block text-sm font-medium text-gray-300 mb-1">
            Status <span className="text-red-500">*</span>
          </label>
          <select
            id="status"
            name="status"
            value={formData.status}
            onChange={handleChange}
            className={`w-full bg-gray-700/50 border ${errors.status ? 'border-red-500' : 'border-gray-600/50'} rounded-lg py-2 px-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none`}
            disabled={query.status === 'converted'}
          >
            <option value="new">New</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
            {query.status === 'converted' && <option value="converted">Converted to Ticket</option>}
          </select>
          {errors.status && (
            <p className="mt-1 text-sm text-red-500 flex items-center">
              <FaExclamationCircle className="mr-1" /> {errors.status}
            </p>
          )}
          {query.status === 'converted' && (
            <p className="mt-1 text-sm text-amber-500 flex items-center">
              <FaExclamationCircle className="mr-1" /> This query has been converted to a ticket and cannot be edited.
            </p>
          )}
        </div>
        
        {/* Category and Subcategory */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-300 mb-1">
              Category <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleChange}
                className={`w-full bg-gray-700/50 border ${errors.category ? 'border-red-500' : 'border-gray-600/50'} rounded-lg py-2 px-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none`}
                disabled={query.status === 'converted'}
              >
                <option value="">Select Category</option>
                {categories.map(category => (
                  <option key={category.name} value={category.name}>
                    {category.name}
                  </option>
                ))}
              </select>
              <FaTags className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            </div>
            {errors.category && (
              <p className="mt-1 text-sm text-red-500 flex items-center">
                <FaExclamationCircle className="mr-1" /> {errors.category}
              </p>
            )}
          </div>
          
          <div>
            <label htmlFor="subcategory" className="block text-sm font-medium text-gray-300 mb-1">
              Subcategory
            </label>
            <div className="relative">
              <select
                id="subcategory"
                name="subcategory"
                value={formData.subcategory}
                onChange={handleChange}
                disabled={!formData.category || query.status === 'converted'}
                className="w-full bg-gray-700/50 border border-gray-600/50 rounded-lg py-2 px-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none disabled:opacity-50"
              >
                <option value="">Select Subcategory</option>
                {getSubcategories().map(subcategory => (
                  <option key={subcategory} value={subcategory}>
                    {subcategory}
                  </option>
                ))}
              </select>
              <FaTags className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            </div>
          </div>
        </div>
        
        {/* Priority */}
        <div>
          <label htmlFor="priority" className="block text-sm font-medium text-gray-300 mb-1">
            Priority <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-4 gap-3">
            <label className={`flex items-center justify-center p-3 rounded-lg border ${formData.priority === 'low' ? 'bg-green-500/20 border-green-500' : 'bg-gray-700/30 border-gray-600/50'} cursor-pointer transition-colors ${query.status === 'converted' ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <input
                type="radio"
                name="priority"
                value="low"
                checked={formData.priority === 'low'}
                onChange={handleChange}
                className="sr-only"
                disabled={query.status === 'converted'}
              />
              <span className="text-sm font-medium">Low</span>
            </label>
            
            <label className={`flex items-center justify-center p-3 rounded-lg border ${formData.priority === 'medium' ? 'bg-yellow-500/20 border-yellow-500' : 'bg-gray-700/30 border-gray-600/50'} cursor-pointer transition-colors ${query.status === 'converted' ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <input
                type="radio"
                name="priority"
                value="medium"
                checked={formData.priority === 'medium'}
                onChange={handleChange}
                className="sr-only"
                disabled={query.status === 'converted'}
              />
              <span className="text-sm font-medium">Medium</span>
            </label>
            
            <label className={`flex items-center justify-center p-3 rounded-lg border ${formData.priority === 'high' ? 'bg-orange-500/20 border-orange-500' : 'bg-gray-700/30 border-gray-600/50'} cursor-pointer transition-colors ${query.status === 'converted' ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <input
                type="radio"
                name="priority"
                value="high"
                checked={formData.priority === 'high'}
                onChange={handleChange}
                className="sr-only"
                disabled={query.status === 'converted'}
              />
              <span className="text-sm font-medium">High</span>
            </label>
            
            <label className={`flex items-center justify-center p-3 rounded-lg border ${formData.priority === 'critical' ? 'bg-red-500/20 border-red-500' : 'bg-gray-700/30 border-gray-600/50'} cursor-pointer transition-colors ${query.status === 'converted' ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <input
                type="radio"
                name="priority"
                value="critical"
                checked={formData.priority === 'critical'}
                onChange={handleChange}
                className="sr-only"
                disabled={query.status === 'converted'}
              />
              <span className="text-sm font-medium">Critical</span>
            </label>
          </div>
          {errors.priority && (
            <p className="mt-1 text-sm text-red-500 flex items-center">
              <FaExclamationCircle className="mr-1" /> {errors.priority}
            </p>
          )}
        </div>
        
        {/* Customer Information (Read-only) */}
        <div className="border border-gray-700/50 rounded-lg p-4 bg-gray-800/30">
          <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center">
            <FaUser className="mr-2 text-blue-400" /> Customer Information
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Customer Name
              </label>
              <div className="bg-gray-700/30 border border-gray-600/30 rounded-lg py-2 px-4 text-white">
                {query.customer?.userId?.profile?.firstName} {query.customer?.userId?.profile?.lastName}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Customer Email
              </label>
              <div className="bg-gray-700/30 border border-gray-600/30 rounded-lg py-2 px-4 text-white">
                {query.customer?.userId?.email}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Form Actions */}
      <div className="flex justify-end space-x-3 pt-4 border-t border-gray-700">
        <button
          type="submit"
          disabled={isLoading || query.status === 'converted'}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Saving...
            </>
          ) : (
            <>
              <FaSave className="mr-2" /> Save Changes
            </>
          )}
        </button>
      </div>
    </form>
  );
};

export default EditQueryForm;
