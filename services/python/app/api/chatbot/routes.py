import asyncio
import os
from jinja2 import Template 
from pydantic import BaseModel
from dependency_injector.wiring import inject
from fastapi import APIRouter, Depends, HTTPException, Request
from app.setups.query_setup import AppContainer
from app.utils.logger import logger
from typing import Optional, Dict, Any, List
from app.modules.retrieval.retrieval_service import RetrievalService
from app.modules.retrieval.retrieval_arango import ArangoService
from app.modules.qna.prompt_templates import qna_prompt
from app.api.chatbot.citations import process_citations
from app.utils.query_transform import setup_query_transformation

router = APIRouter()

# Pydantic models
class ChatQuery(BaseModel):
    query: str
    limit: Optional[int] = 20
    previousConversations: List[Dict] = []
    filters: Optional[Dict[str, Any]] = None
    retrieval_mode: Optional[str] = "HYBRID"

class AzureLLMConfig(BaseModel):
    provider: str
    azure_endpoint: str
    azure_deployment: str
    azure_api_version: str
    api_key: str
    model: str
    temperature: float = 0.3

class LLMFactory:
    @staticmethod
    def create_async_llm(config: AzureLLMConfig):
        """Create an asynchronous LLM instance"""
        if config.provider == "azure":
            from langchain_openai import AzureChatOpenAI
            
            return AzureChatOpenAI(
                azure_endpoint=config.azure_endpoint,
                azure_deployment=config.azure_deployment,
                api_version=config.azure_api_version,
                api_key=config.api_key,
                temperature=config.temperature
            )
        raise ValueError(f"Unsupported provider: {config.provider}")


async def get_retrieval_service(request: Request) -> RetrievalService:
    # Retrieve the container from the app (set in your lifespan)
    container: AppContainer = request.app.container
    # Await the async resource provider to get the actual service instance
    retrieval_service = await container.retrieval_service()
    return retrieval_service

async def get_arango_service(request: Request) -> ArangoService:
    container: AppContainer = request.app.container
    arango_service = await container.arango_service()
    return arango_service

@router.post("/chat")
@inject
async def askAI(request: Request, query_info: ChatQuery, 
                retrieval_service=Depends(get_retrieval_service),
                arango_service=Depends(get_arango_service)):
    """Perform semantic search across documents"""
    try:
        # Setup LLM configuration
        llm_config = AzureLLMConfig(
            provider="azure",
            azure_endpoint=os.getenv("AZURE_ENDPOINT"),
            azure_deployment=os.getenv("AZURE_DEPLOYMENT_NAME"),
            azure_api_version=os.getenv("AZURE_API_VERSION"),
            api_key=os.getenv("AZURE_API_KEY"),
            model="gpt-4o",
            temperature=0.3
        )
        # Create async LLM
        llm = LLMFactory.create_async_llm(llm_config)
        
        # Setup query transformation
        rewrite_chain, expansion_chain = await setup_query_transformation(llm)
        
        # Run query transformations in parallel
        rewritten_query, expanded_queries = await asyncio.gather(
            rewrite_chain.ainvoke(query_info.query),
            expansion_chain.ainvoke(query_info.query)
        )
        
        logger.info(f"Rewritten query: {rewritten_query}")
        logger.info(f"Expanded queries: {expanded_queries}")
        
        expanded_queries_list = [q.strip() for q in expanded_queries.split('\n') if q.strip()]

        queries = [rewritten_query.strip()] if rewritten_query.strip() else []
        queries.extend([q for q in expanded_queries_list if q not in queries])

        # Get search results
        results = await retrieval_service.search_with_filters(
            queries=queries,
            org_id=request.state.user.get('orgId'),
            user_id=request.state.user.get('userId'),
            limit=query_info.limit,
            filter_groups=query_info.filters,
            arango_service=arango_service
        )
        logger.info("Results from the AI service received")
        results = results.get('searchResults')
        # Format conversation history
        previous_conversations = query_info.previousConversations
        
        # Prepare prompt with retrieved context
        template = Template(qna_prompt)
        rendered_form = template.render(query=query_info.query, records=results)
        
        # Create messages for the LLM
        messages = [
            {"role": "system", "content": "You are a enterprise questions answering expert"}
        ]

        # Add conversation history
        for conversation in previous_conversations:
            if conversation.get('role') == 'user_query':
                messages.append({"role": "user", "content": conversation.get('content')})
            elif conversation.get('role') == 'bot_response':
                messages.append({"role": "assistant", "content": conversation.get('content')})
        
        # Add current query with context
        messages.append({"role": "user", "content": rendered_form})
        
        # Make async LLM call
        response = await llm.ainvoke(messages)
        
        # Process citations and return response
        return process_citations(response, results)
    except Exception as e:
        logger.error(f"Error in askAI: {str(e)}", exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}