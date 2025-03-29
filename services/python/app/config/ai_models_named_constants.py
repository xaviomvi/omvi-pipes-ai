from enum import Enum

class LLMProvider(Enum):
    AZURE_OPENAI_PROVIDER = "azureOpenAI"
    OPENAI_PROVIDER = "openAI"
    
class OCRProvider(Enum):
    AZURE_PROVIDER = "azure"
    PYMUPDF_PROVIDER = "pymupdf"
    
class AzureOpenAILLM(Enum):
    AZURE_OPENAI_VERSION = "2023-07-01-preview"
    
class AzureDocIntelligenceModel(Enum):
    PREBUILT_DOCUMENT = "prebuilt-document"