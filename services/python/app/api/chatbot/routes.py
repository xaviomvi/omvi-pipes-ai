from dependency_injector.wiring import inject
from fastapi import APIRouter, Depends, HTTPException, Request
from app.setup import AppContainer
from app.utils.logger import logger
from langchain_qdrant import RetrievalMode
from pydantic import BaseModel
from typing import Optional, Dict, Any
from app.modules.retrieval.retrieval_service import RetrievalService

router = APIRouter()

# Pydantic models
class ChatQuery(BaseModel):
    query: str
    top_k: Optional[int] = 5
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
async def search(query: ChatQuery, retrieval_service=Depends(get_retrieval_service)):
    """Perform semantic search across documents"""
    try:
        mode = RetrievalMode[query.retrieval_mode.upper()]
        results = await retrieval_service.search(
            query=query.query,
            top_k=query.top_k,
            filters=query.filters,
            retrieval_mode=mode
        )
        return results
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}
