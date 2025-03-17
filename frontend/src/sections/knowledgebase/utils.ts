import axios from 'src/utils/axios';

import { CONFIG } from 'src/config-global';

import type { Modules } from './types/modules';
import type { Departments } from './types/departments';
import type { SearchTagsRecords } from './types/search-tags';
import type { RecordCategories } from './types/record-categories';
import type {RecordDetailsResponse } from './types/record-details';
import type { KnowledgeBaseResponse } from './types/knowledge-base';
import type { SearchFilters, SearchResponse } from './types/search-response';


// export const fetchKnowledgeBaseDetails = async () => {
//   try {
//     const response = await axios.get(`${API_BASE_URL}/api/v1/knowledgebase`);
//     return response.data;
//   } catch (error) {
//     console.error('Error fetching knowledge base details:', error);
//     throw error;
//   }
// };

export const fetchKnowledgeBaseDetails = async (
  queryParams: URLSearchParams
): Promise<KnowledgeBaseResponse> => {
  try {
    console.log(queryParams, 'queryParams');
    const response = await axios.get<KnowledgeBaseResponse>(
      `${CONFIG.backendUrl}/api/v1/knowledgebase`,
      { params: queryParams }
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching knowledge base details:', error);
    throw error;
  }
};

export const searchKnowledgeBase = async (
  searchtext: string,
  topK: number = 10,
  filters: SearchFilters = {}
): Promise<SearchResponse> => {
  try {
    const queryParams = new URLSearchParams({
      topK: topK.toString(),
      ...(filters as any),
    });

    const response = await axios.post<SearchResponse>(
      `${CONFIG.backendUrl}/api/v1/knowledgebase/search?${queryParams}`,
      {
        searchtext,
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error searching knowledge base:', error);
    throw error;
  }
};

export const uploadKnowledgeBaseFiles = async (formData: FormData) => {
  try {
    const response = await axios.post(`${CONFIG.backendUrl}/api/v1/knowledgebase`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error uploading files:', error);
    throw error;
  }
};

export const fetchDepartments = async () => {
  try {
    const response = await axios.get<Departments[]>(`${CONFIG.backendUrl}/api/v1/departments/`);
    return response.data;
  } catch (error) {
    console.error('Error fetching departments:', error);
    throw error;
  }
};

export const fetchTags = async () => {
  try {
    const response = await axios.get<SearchTagsRecords[]>(
      `${CONFIG.backendUrl}/api/v1/search-tags?category=Records`
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching Tags:', error);
    throw error;
  }
};

export const fetchModules = async () => {
  try {
    const response = await axios.get<Modules[]>(`${CONFIG.backendUrl}/api/v1/modules`);
    return response.data;
  } catch (error) {
    console.error('Error fetching modules:', error);
    throw error;
  }
};

export const fetchRecordCategories = async () => {
  try {
    const response = await axios.get<RecordCategories[]>(`${CONFIG.backendUrl}/api/v1/recordCategories`);
    return response.data;
  } catch (error) {
    console.error('Error fetching record categories:', error);
    throw error;
  }
};

export const fetchRecordDetails = async (recordId: string): Promise<RecordDetailsResponse> => {
  try {
    const response = await axios.get<RecordDetailsResponse>(`${CONFIG.backendUrl}/api/v1/knowledgebase/${recordId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching record details:', error);
    throw error;
  }
};

export const handleDownloadDocument = async (externalRecordId : string) => {
  try {
    const response = await axios.post(
      `${CONFIG.backendUrl}/api/v1/document/${externalRecordId}/signedUrlOfVersion`
    );
    const signedUrl = response.data;
    
    // Create a temporary anchor element
    const link = document.createElement('a');
    link.href = signedUrl;
    link.setAttribute('download', ''); // This will use the filename from the Content-Disposition header
    
    // Append to the document, trigger click, and then remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('Failed to download document:', error);
  }
};