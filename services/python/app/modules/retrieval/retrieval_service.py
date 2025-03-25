from typing import List, Dict, Any, Optional
from langchain_community.embeddings import HuggingFaceEmbeddings
from qdrant_client import QdrantClient
from qdrant_client.http.models import Filter, FieldCondition, MatchValue
from langchain_qdrant import QdrantVectorStore, FastEmbedSparse, RetrievalMode
from dotenv import load_dotenv
from app.modules.retrieval.retrieval_arango import ArangoService
from app.config.arangodb_constants import CollectionNames,RecordTypes

class RetrievalService:
    def __init__(
        self,
        collection_name: str,
        qdrant_api_key: str,
        qdrant_host: str,
    ):
        """
        Initialize the retrieval service with necessary configurations.

        Args:
            collection_name: Name of the Qdrant collection
            qdrant_api_key: API key for Qdrant
            qdrant_host: Qdrant server host URL
        """
        load_dotenv()  # Load environment variables

        # Initialize dense embeddings with BGE (same as indexing)
        model_name = "BAAI/bge-large-en-v1.5"
        encode_kwargs = {'normalize_embeddings': True}

        self.dense_embeddings = HuggingFaceEmbeddings(
            model_name=model_name,
            model_kwargs={'device': 'cpu'},
            encode_kwargs=encode_kwargs
        )

        # Initialize sparse embeddings (same as indexing)
        self.sparse_embeddings = FastEmbedSparse(model_name="Qdrant/BM25")

        # Initialize Qdrant client
        self.qdrant_client = QdrantClient(
            host=qdrant_host,
            api_key=qdrant_api_key,
            prefer_grpc=True,
            https=False,
        )

        self.collection_name = collection_name

        # Initialize vector store with same configuration as indexing
        self.vector_store = QdrantVectorStore(
            client=self.qdrant_client,
            collection_name=collection_name,
            vector_name="dense",
            sparse_vector_name="sparse",
            embedding=self.dense_embeddings,
            sparse_embedding=self.sparse_embeddings,
            retrieval_mode=RetrievalMode.HYBRID,
        )

    def _preprocess_query(self, query: str) -> str:
        """
        Preprocess the query text.

        Args:
            query: Raw query text

        Returns:
            Preprocessed query text
        """
        # Add query prefix for better retrieval performance (BGE recommendation)
        # Same as in indexing pipeline
        return f"Represent this document for retrieval: {query.strip()}"

    def _format_results(self, results: List[tuple]) -> List[Dict[str, Any]]:
        """Format search results into a consistent structure with flattened metadata."""
        formatted_results = []
        for doc, score in results:
            formatted_result = {
                "content": doc.page_content,
                "score": float(score),
                "citationType": "vectordb|document",
                "metadata": doc.metadata
            }
            formatted_results.append(formatted_result)
        return formatted_results

    def _build_qdrant_filter(self, accessible_records: List[str]) -> Filter:
        """
        Build Qdrant filter for accessible records.
        
        Args:
            accessible_records: List of record IDs the user has access to
        
        Returns:
            Qdrant Filter object
        """
        print("RECORD IDS: ", accessible_records)
        return Filter(
            should=[
                FieldCondition(
                    key="metadata.recordId",
                    match=MatchValue(value=record_id)
                ) for record_id in accessible_records
            ]
        )

    async def search_with_filters(
        self,
        query: str,
        user_id: str,
        org_id: str,
        filter_groups: Optional[Dict[str, List[str]]] = None,
        limit: int = 20,
        arango_service: Optional[ArangoService] = None
    ) -> List[Dict[str, Any]]:
        """
        Perform semantic search on accessible records.
        """
        try:
            # Get accessible records
            if not arango_service:
                raise ValueError("ArangoService is required for permission checking")
            
            if filter_groups is None:
                filter_groups = {}
            
            print("org_id: ", org_id)
            print("user_id: ", user_id)
            print("query: ", query)
            print("limit: ", limit)
            print("filter_groups: ", filter_groups)
            
            # Convert filter_groups to format expected by get_accessible_records
            arango_filters = {}
            if filter_groups:  # Only process if filter_groups is not empty
                for key, values in filter_groups.items():
                    # Convert key to match collection naming
                    metadata_key = key.lower()  # e.g., 'departments', 'categories', etc.
                    arango_filters[metadata_key] = values
            
            accessible_records = await arango_service.get_accessible_records(
                user_id=user_id,
                org_id=org_id,
                filters=arango_filters
            )
            
            print("accessible_records: ", accessible_records)
            if not accessible_records:
                return []
            
            # Extract record IDs from accessible records
            record_ids = [record['_key'] for record in accessible_records]
                        
            # Build Qdrant filter
            qdrant_filter = self._build_qdrant_filter(record_ids)
            
            # Perform similarity search
            processed_query = self._preprocess_query(query)
            
            results = self.vector_store.similarity_search_with_score(
                query=processed_query,
                k=limit,
                filter=qdrant_filter
            )
            
            search_results = self._format_results(results)
            record_ids = list(set(result['metadata']['recordId'] for result in search_results))
            
            # Get full record documents from Arango
            records = []
            if record_ids:
                for record_id in record_ids:
                    record = await arango_service.get_document(record_id, CollectionNames.RECORDS.value)
                    if record['recordType'] == RecordTypes.FILE.value:
                        files = await arango_service.get_document(record_id, CollectionNames.FILES.value)
                        record = {**record, **files}
                    if record['recordType'] == RecordTypes.MAIL.value:
                        mail = await arango_service.get_document(record_id, CollectionNames.MAILS.value)
                        record = {**record, **mail}
                    records.append(record)
            
            return {
                "searchResults": search_results,
                "records": records
            }
            
        except Exception as e:
            raise ValueError(f"Filtered search failed: {str(e)}")

    async def search(
        self,
        query: str,
        limit: int = 5,
        filters: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Perform semantic search using the vector store.

        Args:
            query: Search query text
            limit: Number of results to return
            filters: Optional metadata filters
            retrieval_mode: Search mode (DENSE, SPARSE, or HYBRID)

        Returns:
            List of search results with scores and metadata
        """
        try:
            processed_query = self._preprocess_query(query)

            # Convert filters to Qdrant format if provided
            qdrant_filter = Filter(**filters) if filters else None
            # Perform search using the same vector store as indexing
            results = self.vector_store.similarity_search_with_score(
                query=processed_query,
                k=limit,
                filter=qdrant_filter
            )

            return self._format_results(results)
        except Exception as e:
            raise ValueError(f"Search failed: {str(e)}")

    async def similar_documents(
        self,
        document_id: str,
        limit: int = 5,
        filters: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Find similar documents to a given document by ID.

        Args:
            document_id: ID of the reference document
            limit: Number of similar documents to return
            filters: Optional metadata filters

        Returns:
            List of similar documents with scores and metadata
        """
        try:
            # Get the reference document's vectors
            reference_doc = await self.qdrant_client.retrieve(
                collection_name=self.collection_name,
                ids=[document_id],
            )

            if not reference_doc:
                raise ValueError(f"Document with ID {document_id} not found")

            # Convert filters to Qdrant format if provided
            qdrant_filter = Filter(**filters) if filters else None

            # Search using the reference document's vectors
            results = await self.qdrant_client.search(
                collection_name=self.collection_name,
                query_vector=reference_doc[0].vector,
                limit=limit + 1,  # Add 1 to account for the reference document
                filter=qdrant_filter,
            )

            # Remove the reference document from results if present
            formatted_results = []
            for result in results:
                if result.id != document_id:
                    formatted_results.append({
                        "id": result.id,
                        "score": float(result.score),
                        "metadata": result.payload,
                    })

            return formatted_results[:limit]
        except Exception as e:
            raise ValueError(f"Similar document search failed: {str(e)}")
