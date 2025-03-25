from dependency_injector.wiring import inject, Provide
from fastapi import APIRouter, Depends, HTTPException, Request
from app.setups.query_setup import AppContainer
from app.utils.logger import logger
from langchain_qdrant import RetrievalMode
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from app.modules.retrieval.retrieval_service import RetrievalService
from app.modules.retrieval.retrieval_arango import ArangoService

router = APIRouter()

# Pydantic models
class SearchQuery(BaseModel):
    query: str
    limit: Optional[int] = 5
    filters: Optional[Dict[str, Any]] = {}

class SimilarDocumentQuery(BaseModel):
    document_id: str
    limit: Optional[int] = 5
    filters: Optional[Dict[str, Any]] = None

class SearchRequest(BaseModel):
    query: str
    topK: int = 20
    filtersV1: List[Dict[str, List[str]]]

async def get_retrieval_service(request: Request) -> RetrievalService:
    container: AppContainer = request.app.container
    retrieval_service = await container.retrieval_service()
    return retrieval_service

async def get_arango_service(request: Request) -> ArangoService:
    container: AppContainer = request.app.container
    arango_service = await container.arango_service()
    return arango_service

@router.post("/search")
@inject
async def search(request: Request, body: SearchQuery, 
                retrieval_service=Depends(get_retrieval_service),
                arango_service=Depends(get_arango_service)):
    """Perform semantic search across documents"""
    try:
        print("orgId is ", request.state.user.get('orgId'))
        results = await retrieval_service.search_with_filters(
            query=body.query,
            org_id=request.state.user.get('orgId'),
            user_id=request.state.user.get('userId'),
            limit=body.limit,
            filter_groups=body.filters,
            arango_service=arango_service
        )
        return results
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
