from typing import List, Dict, Any, Optional
from langchain_community.embeddings import HuggingFaceEmbeddings
from qdrant_client import QdrantClient
from qdrant_client.http.models import Filter
from langchain_qdrant import QdrantVectorStore, FastEmbedSparse, RetrievalMode
from dotenv import load_dotenv


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
                **doc.metadata  # Unpack metadata keys at the top level
            }
            formatted_results.append(formatted_result)
        return formatted_results


    async def search(
        self,
        query: str,
        org_id: str,
        top_k: int = 5,
        filters: Optional[Dict[str, Any]] = None,
        retrieval_mode: RetrievalMode = RetrievalMode.HYBRID,
    ) -> List[Dict[str, Any]]:
        """
        Perform semantic search using the vector store.

        Args:
            query: Search query text
            top_k: Number of results to return
            filters: Optional metadata filters
            retrieval_mode: Search mode (DENSE, SPARSE, or HYBRID)

        Returns:
            List of search results with scores and metadata
        """
        try:
            print(query, "query")
            processed_query = self._preprocess_query(query)

            # Convert filters to Qdrant format if provided
            qdrant_filter = Filter(**filters) if filters else None

            # Set vector store retrieval mode
            self.vector_store.retrieval_mode = retrieval_mode

            # Perform search using the same vector store as indexing
            results = self.vector_store.similarity_search_with_score(
                query=processed_query,
                k=top_k,
                filter=qdrant_filter
            )

            print(results, "results")

            return self._format_results(results)
        except Exception as e:
            raise ValueError(f"Search failed: {str(e)}")

    async def similar_documents(
        self,
        document_id: str,
        top_k: int = 5,
        filters: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Find similar documents to a given document by ID.

        Args:
            document_id: ID of the reference document
            top_k: Number of similar documents to return
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
                limit=top_k + 1,  # Add 1 to account for the reference document
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

            return formatted_results[:top_k]
        except Exception as e:
            raise ValueError(f"Similar document search failed: {str(e)}")
