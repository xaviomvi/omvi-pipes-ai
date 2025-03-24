from dependency_injector.wiring import inject, Provide
from fastapi import APIRouter, Depends, HTTPException, Request
from app.setup import AppContainer
from app.utils.logger import logger
from langchain_qdrant import RetrievalMode
from pydantic import BaseModel
from typing import Optional, Dict, Any
from app.modules.retrieval.retrieval_service import RetrievalService

router = APIRouter()

# Pydantic models
class SearchQuery(BaseModel):
    query: str
    limit: Optional[int] = 5
    filters: Optional[Dict[str, Any]] = None
    retrieval_mode: Optional[str] = "HYBRID"

class SimilarDocumentQuery(BaseModel):
    document_id: str
    limit: Optional[int] = 5
    filters: Optional[Dict[str, Any]] = None


async def get_retrieval_service(request: Request) -> RetrievalService:
    # Retrieve the container from the app (set in your lifespan)
    container: AppContainer = request.app.container
    # Await the async resource provider to get the actual service instance
    retrieval_service = await container.retrieval_service()
    return retrieval_service

@router.post("/search")
@inject
async def search(request: Request, body: SearchQuery, retrieval_service=Depends(get_retrieval_service)):
    """Perform semantic search across documents"""
    try:
        print("orgId is ", request.state.user.get('orgId'))
        results = await retrieval_service.search(
            query=body.query,
            org_id=request.state.user.get('orgId'),
            limit=body.limit,
            filters=body.filters,
        )
        
        return results
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/similar-documents")
@inject
async def find_similar_documents(query: SimilarDocumentQuery, retrieval_service=get_retrieval_service):
    """Find documents similar to a given document ID"""
    try:
        results = await retrieval_service.similar_documents(
            document_id=query.document_id,
            limit=query.limit,
            filters=query.filters
        )
        return results
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}
