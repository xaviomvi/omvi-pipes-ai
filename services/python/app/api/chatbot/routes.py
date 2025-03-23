from dependency_injector.wiring import inject
from fastapi import APIRouter, Depends, HTTPException, Request
from app.setup import AppContainer
from app.utils.logger import logger
from langchain_qdrant import RetrievalMode
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from app.modules.retrieval.retrieval_service import RetrievalService
from jinja2 import Template 
from app.modules.qna.prompt_templates import qna_prompt
from app.core.llm_service import LLMFactory
from app.core.llm_service import AzureLLMConfig
import os
from app.api.chatbot.citations import process_citations

router = APIRouter()

# Pydantic models
class ChatQuery(BaseModel):
    query: str
    top_k: Optional[int] = 20
    previousConversations: List[Dict] = []
    filters: Optional[Dict[str, Any]] = None
    retrieval_mode: Optional[str] = "HYBRID"

async def get_retrieval_service(request: Request) -> RetrievalService:
    # Retrieve the container from the app (set in your lifespan)
    container: AppContainer = request.app.container
    # Await the async resource provider to get the actual service instance
    retrieval_service = await container.retrieval_service()
    return retrieval_service

@router.post("/")
@inject
async def askAI(request: Request, query_info: ChatQuery, retrieval_service=Depends(get_retrieval_service)):
    """Perform semantic search across documents"""
    try:
        mode = RetrievalMode[query_info.retrieval_mode.upper()]
        results = await retrieval_service.search(
            query=query_info.query,
            org_id=request.state.user.get('orgId'),
            top_k=query_info.top_k,
            filters=query_info.filters,
            retrieval_mode=mode
        )
        previous_conversations = query_info.previousConversations
        formatted_results = retrieval_service.format_results_with_metadata(results)
        print(formatted_results, "formatted_results")
        template = Template(qna_prompt) 
        rendered_form = template.render(query=query_info.query, records = formatted_results) 

        llm_config = AzureLLMConfig(
            provider = "azure",
            azure_endpoint = os.getenv("AZURE_ENDPOINT"),
            azure_deployment = os.getenv("AZURE_DEPLOYMENT_NAME"),
            azure_api_version = os.getenv("AZURE_API_VERSION"),
            api_key = os.getenv("AZURE_API_KEY"),
            model = "gpt-4o",
            temperature = 0.3
        )

        llm = LLMFactory.create_llm(llm_config)

        messages = [
            {"role": "system", "content": "You are a enterprise questions answering expert"}
        ]

        for conversation in previous_conversations:
            if conversation.get('role') == 'user_query':
                messages.append({"role": "user", "content": conversation.get('content')})
            elif conversation.get('role') == 'bot_response':
                messages.append({"role": "assistant", "content": conversation.get('content')})
        
        messages.append({"role": "user", "content": rendered_form})
        
        response = llm.invoke(messages)
        
        return process_citations(response, formatted_results)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}
