// ai-models-service.ts
import axios from 'src/utils/axios';

import type { LlmConfig, OCRConfig, ModelConfig, EmbeddingConfig } from './types';

const API_BASE = '/api/v1/configurationManager';

/**
 * Fetch all AI models configuration
 */
export const getAiModelsConfig = async () => {
  try {
    const response = await axios.get(`${API_BASE}/aiModelsConfig`);
    return response.data;
  } catch (error) {
    console.error('Error fetching AI models configuration:', error);
    throw error;
  }
};

/**
 * Update AI models configuration
 */
export const updateAiModelsConfig = async (config: Record<string, ModelConfig[]>) => {
  try {
    const response = await axios.post(`${API_BASE}/aiModelsConfig`, config);
    return response.data;
  } catch (error) {
    console.error('Error updating AI models configuration:', error);
    throw error;
  }
};

/**
 * Get LLM configuration
 */
export const getLlmConfig = async () => {
  try {
    const response = await axios.get(`${API_BASE}/aiModelsConfig`);
    const llmConfigs = response.data.llm || [];
    return llmConfigs.length > 0 ? llmConfigs[0].configuration : null;
  } catch (error) {
    console.error('Error fetching LLM configuration:', error);
    throw error;
  }
};

/**
 * Update LLM configuration
 */
export const updateLlmConfig = async (config: LlmConfig, name: string = 'openAI') => {
  try {
    // First get the current configuration
    const currentConfig = await getAiModelsConfig();

    // Create or update the LLM configuration
    const updatedConfig = {
      ...currentConfig,
      llm: [
        {
          name,
          configuration: config,
        },
      ],
    };

    // Update the configuration
    const response = await axios.post(`${API_BASE}/aiModelsConfig`, updatedConfig);
    return response.data;
  } catch (error) {
    console.error('Error updating LLM configuration:', error);
    throw error;
  }
};

/**
 * Get OCR configuration
 */
export const getOcrConfig = async () => {
  try {
    const response = await axios.get(`${API_BASE}/aiModelsConfig`);
    const ocrConfigs = response.data.ocr || [];
    return ocrConfigs.length > 0 ? ocrConfigs[0].configuration : null;
  } catch (error) {
    console.error('Error fetching OCR configuration:', error);
    throw error;
  }
};

/**
 * Update OCR configuration
 */
export const updateOcrConfig = async (config: OCRConfig) => {
  try {
    // First get the current configuration
    const currentConfig = await getAiModelsConfig();

    // Create or update the OCR configuration
    const updatedConfig = {
      ...currentConfig,
      ocr: [
        {
          name: config.name,
          configuration: config,
        },
      ],
    };

    // Update the configuration
    const response = await axios.post(`${API_BASE}/aiModelsConfig`, updatedConfig);
    return response.data;
  } catch (error) {
    console.error('Error updating OCR configuration:', error);
    throw error;
  }
};

/**
 * Get Embedding configuration
 */
export const getEmbeddingConfig = async (): Promise<EmbeddingConfig | null> => {
  try {
    const response = await axios.get(`${API_BASE}/aiModelsConfig`);
    const embeddingConfigs = response.data.embedding || [];

    // If no embedding configurations exist, return default
    if (embeddingConfigs.length === 0) {
      return { modelType: 'default' };
    }

    const config = embeddingConfigs[0];
    // Determine the model type based on provider
    let modelType: 'openAI' | 'azureOpenAI' | 'default' = 'default';

    if (config.provider === 'azureOpenAI') {
      modelType = 'azureOpenAI';
    } else if (config.provider === 'openAI') {
      modelType = 'openAI';
    }

    // Return the configuration with the correct model type
    return {
      modelType,
      ...config.configuration,
    };
  } catch (error) {
    console.error('Error fetching Embedding configuration:', error);
    throw error;
  }
};

/**
 * Update Embedding configuration with support for default (empty config)
 */
export const updateEmbeddingConfig = async (config: EmbeddingConfig): Promise<any> => {
  try {
    // First get the current configuration
    const response = await axios.get(`${API_BASE}/aiModelsConfig`);
    const currentConfig = response.data;

    let updatedConfig;

    // Handle the default case - sends an empty array for embedding
    if (config.modelType === 'default') {
      updatedConfig = {
        ...currentConfig,
        embedding: [], // Empty array means use default
      };
    } else {
      // For OpenAI or Azure, prepare the configuration
      const { modelType, ...configData } = config;
      const provider = modelType === 'azureOpenAI' ? 'azureOpenAI' : 'openAI';

      updatedConfig = {
        ...currentConfig,
        embedding: [
          {
            provider,
            configuration: configData,
          },
        ],
      };
    }

    // Update the configuration
    const updateResponse = await axios.post(`${API_BASE}/aiModelsConfig`, updatedConfig);
    return updateResponse.data;
  } catch (error) {
    console.error('Error updating Embedding configuration:', error);
    throw error;
  }
};

/**
 * Generic function to get configuration for a specific model type
 */
export const getModelConfig = async (modelType: string) => {
  try {
    const response = await axios.get(`${API_BASE}/aiModelsConfig`);
    const configs = response.data[modelType] || [];
    return configs.length > 0 ? configs : [];
  } catch (error) {
    console.error(`Error fetching ${modelType} configuration:`, error);
    throw error;
  }
};

/**
 * Generic function to update configuration for a specific model type
 */
export const updateModelConfig = async (modelType: string, config: ModelConfig) => {
  try {
    // First get the current configuration
    const currentConfig = await getAiModelsConfig();

    // Create or update the model configuration
    const modelConfigs = [...(currentConfig[modelType] || [])];
    const existingIndex = modelConfigs.findIndex((c) => c.name === config.name);

    if (existingIndex >= 0) {
      modelConfigs[existingIndex] = config;
    } else {
      modelConfigs.push(config);
    }

    const updatedConfig = {
      ...currentConfig,
      [modelType]: modelConfigs,
    };

    // Update the configuration
    const response = await axios.post(`${API_BASE}/aiModelsConfig`, updatedConfig);
    return response.data;
  } catch (error) {
    console.error(`Error updating ${modelType} configuration:`, error);
    throw error;
  }
};
