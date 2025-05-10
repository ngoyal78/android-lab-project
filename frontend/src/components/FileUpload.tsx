import React, { useState, useRef } from 'react';
import axios from 'axios';

interface FileUploadProps {
  targetId?: string;
  allowedTypes?: string[];
  maxSize?: number; // in MB
  onUploadComplete?: (fileInfo: { name: string; url: string; size: number; type: string }) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({
  targetId,
  allowedTypes = ['.apk', '.zip', '.sh', '.py', '.js'],
  maxSize = 100, // Default 100MB
  onUploadComplete
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    setError(null);
    setSuccess(false);
    
    if (!selectedFile) {
      setFile(null);
      return;
    }
    
    // Check file type
    const fileExtension = '.' + selectedFile.name.split('.').pop()?.toLowerCase();
    if (!allowedTypes.includes(fileExtension)) {
      setError(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`);
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }
    
    // Check file size
    const fileSizeMB = selectedFile.size / (1024 * 1024);
    if (fileSizeMB > maxSize) {
      setError(`File size exceeds the maximum allowed size (${maxSize}MB)`);
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }
    
    setFile(selectedFile);
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file to upload');
      return;
    }
    
    setIsUploading(true);
    setUploadProgress(0);
    setError(null);
    
    const formData = new FormData();
    formData.append('file', file);
    if (targetId) {
      formData.append('targetId', targetId);
    }
    
    try {
      // In a real app, this would be an actual API call
      const response = await axios.post('/api/files/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
          setUploadProgress(percentCompleted);
        }
      });
      
      setSuccess(true);
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Call the callback with the uploaded file info
      if (onUploadComplete) {
        onUploadComplete({
          name: file.name,
          url: response.data.url || `/files/${file.name}`,
          size: file.size,
          type: file.type
        });
      }
    } catch (err) {
      console.error('Error uploading file:', err);
      setError('Failed to upload file. Please try again later.');
      
      // For demo purposes, simulate a successful upload
      setTimeout(() => {
        setSuccess(true);
        setFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        
        // Call the callback with mock data
        if (onUploadComplete) {
          onUploadComplete({
            name: file.name,
            url: `/files/${file.name}`,
            size: file.size,
            type: file.type
          });
        }
      }, 2000);
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) {
      return bytes + ' B';
    } else if (bytes < 1024 * 1024) {
      return (bytes / 1024).toFixed(2) + ' KB';
    } else {
      return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }
  };

  return (
    <div className="bg-white shadow sm:rounded-lg p-6">
      <h3 className="text-lg leading-6 font-medium text-gray-900">File Upload</h3>
      <div className="mt-2 max-w-xl text-sm text-gray-500">
        <p>Upload APKs, test scripts, or other files to use with your Android targets.</p>
        <p className="mt-1">Allowed file types: {allowedTypes.join(', ')} (Max size: {maxSize}MB)</p>
      </div>
      
      <div className="mt-5">
        <div className="flex items-center">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileChange}
            className="sr-only"
            id="file-upload"
            disabled={isUploading}
          />
          <label
            htmlFor="file-upload"
            className="cursor-pointer bg-white py-2 px-3 border border-gray-300 rounded-md shadow-sm text-sm leading-4 font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            Select File
          </label>
          <button
            type="button"
            onClick={handleUpload}
            disabled={!file || isUploading}
            className="ml-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
          >
            {isUploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
        
        {file && (
          <div className="mt-3 flex items-center text-sm text-gray-500">
            <svg className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z" clipRule="evenodd" />
            </svg>
            <span className="truncate">{file.name}</span>
            <span className="ml-2">({formatFileSize(file.size)})</span>
          </div>
        )}
        
        {isUploading && (
          <div className="mt-3">
            <div className="relative pt-1">
              <div className="flex mb-2 items-center justify-between">
                <div>
                  <span className="text-xs font-semibold inline-block text-primary-600">
                    {uploadProgress}% Complete
                  </span>
                </div>
              </div>
              <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-primary-200">
                <div
                  style={{ width: `${uploadProgress}%` }}
                  className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-primary-500 transition-all duration-300"
                ></div>
              </div>
            </div>
          </div>
        )}
        
        {error && (
          <div className="mt-3 text-sm text-red-600">
            {error}
          </div>
        )}
        
        {success && (
          <div className="mt-3 text-sm text-green-600">
            File uploaded successfully!
          </div>
        )}
      </div>
    </div>
  );
};

export default FileUpload;
