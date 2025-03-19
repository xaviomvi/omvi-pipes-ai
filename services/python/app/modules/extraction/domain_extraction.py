import os
from typing import List, Literal
from pydantic import BaseModel, Field
from langchain.prompts import PromptTemplate
from langchain.output_parsers import PydanticOutputParser
from langchain.schema import HumanMessage
from app.modules.extraction.prompt_template import prompt
from app.utils.logger import create_logger
import uuid
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.decomposition import LatentDirichletAllocation
from sklearn.metrics.pairwise import cosine_similarity

import numpy as np
from app.core.llm_service import LLMFactory
from app.config.arangodb_constants import CollectionNames, DepartmentNames
logger = create_logger("domain_extraction")

# Update the Literal types
SentimentType = Literal["Positive", "Neutral", "Negative"]


class SubCategories(BaseModel):
    level1: str = Field(
        description="Level 1 subcategory"
    )
    level2: str = Field(
        description="Level 2 subcategory"
    )
    level3: str = Field(
        description="Level 3 subcategory"
    )

class DocumentClassification(BaseModel):
    departments: List[DepartmentNames] = Field(
        description="The list of departments this document belongs to",
        max_items=3
    )
    categories: str = Field(
        description="Main category this document belongs to"
    )
    subcategories: SubCategories = Field(
        description="Nested subcategories for the document"
    )
    languages: List[str] = Field(
        description="List of languages detected in the document"
    )
    sentiment: SentimentType = Field(
        description="Overall sentiment of the document"
    )
    confidence_score: float = Field(
        description="Confidence score of the classification",
        ge=0,
        le=1
    )
    topics: List[str] = Field(
        description="List of key topics/themes extracted from the document"
    )


class DomainExtractor:
    def __init__(self, base_arango_service, llm_config):
        self.arango_service = base_arango_service
        logger.info("🚀 self.arango_service: %s", self.arango_service)
        logger.info("🚀 self.arango_service.db: %s", self.arango_service.db)

        self.llm = LLMFactory.create_llm(llm_config)
        self.parser = PydanticOutputParser(
            pydantic_object=DocumentClassification)

        # Format department list for the prompt
        department_list = "\n".join(
            f"     - \"{dept.value}\"" for dept in DepartmentNames)

        # Format sentiment list for the prompt
        sentiment_list = "\n".join(
            f"     - \"{sentiment}\"" for sentiment in SentimentType.__args__)

        # Initialize topics storage
        self.topics_store = set()  # Store all accepted topics

        # Initialize TF-IDF vectorizer for topic similarity
        self.vectorizer = TfidfVectorizer(stop_words='english')
        self.similarity_threshold = 0.65  # Adjusted for TF-IDF similarity

        # Initialize LDA model as backup
        self.lda = LatentDirichletAllocation(
            n_components=10,  # Adjust based on your needs
            random_state=42
        )

        # Update prompt with department and sentiment lists
        filled_prompt = prompt.replace("{department_list}", department_list).replace(
            "{sentiment_list}", sentiment_list)
        self.prompt_template = PromptTemplate.from_template(filled_prompt)

        # logger.info(f"🎯 Prompt template: {self.prompt_template}")

    async def find_similar_topics(self, new_topic: str) -> str:
        """
        Find if a similar topic already exists in the topics store using TF-IDF similarity.
        Returns the existing topic if a match is found, otherwise returns the new topic.
        """
        # First check exact matches
        if new_topic in self.topics_store:
            return new_topic

        # If no topics exist yet, return the new topic
        if not self.topics_store:
            return new_topic

        try:
            # Convert topics to TF-IDF vectors
            all_topics = list(self.topics_store) + [new_topic]
            tfidf_matrix = self.vectorizer.fit_transform(all_topics)

            # Calculate cosine similarity between new topic and existing topics
            # Get the last row (new topic)
            new_topic_vector = tfidf_matrix[-1:]
            # Get all but the last row
            existing_topics_matrix = tfidf_matrix[:-1]

            similarities = cosine_similarity(
                new_topic_vector, existing_topics_matrix)[0]

            # Find the most similar topic
            max_similarity_idx = np.argmax(similarities)
            max_similarity = similarities[max_similarity_idx]

            if max_similarity >= self.similarity_threshold:
                return list(self.topics_store)[max_similarity_idx]

            # If TF-IDF similarity is low, try LDA as backup
            if max_similarity < self.similarity_threshold:
                try:
                    # Fit LDA on all topics
                    dtm = self.vectorizer.fit_transform(all_topics)
                    topic_distributions = self.lda.fit_transform(dtm)

                    # Compare topic distributions
                    new_topic_dist = topic_distributions[-1]
                    existing_topics_dist = topic_distributions[:-1]

                    # Calculate Jensen-Shannon divergence or cosine similarity
                    lda_similarities = cosine_similarity(
                        [new_topic_dist], existing_topics_dist)[0]
                    max_lda_sim_idx = np.argmax(lda_similarities)
                    max_lda_similarity = lda_similarities[max_lda_sim_idx]

                    if max_lda_similarity >= self.similarity_threshold:
                        return list(self.topics_store)[max_lda_sim_idx]

                except Exception as e:
                    logger.error(f"❌ Error in LDA similarity check: {str(e)}")

        except Exception as e:
            logger.error(f"❌ Error in topic similarity check: {str(e)}")

        return new_topic

    async def process_new_topics(self, new_topics: List[str]) -> List[str]:
        """
        Process new topics against existing topics store.
        Returns list of topics, using existing ones where matches are found.
        """
        processed_topics = []
        for topic in new_topics:
            matched_topic = await self.find_similar_topics(topic)
            processed_topics.append(matched_topic)
            # Only add to topics_store if it's a new topic
            if matched_topic == topic:  # This means no match was found
                self.topics_store.add(topic)

        return list(set(processed_topics))

    async def extract_metadata(self, content: str) -> DocumentClassification:
        """
        Extract metadata from document content using Azure OpenAI.
        """
        logger.info("🎯 Extracting domain metadata")

        try:
            # Test Azure connection before making the call
            test_message = [HumanMessage(content="test")]
            await self.llm.ainvoke(test_message)
            logger.info("🎯 Connection test successful")

        except Exception as e:
            logger.error(f"❌ Azure OpenAI connection test failed: {str(e)}")
            raise ValueError(f"Azure OpenAI connection failed: {str(e)}")

        try:
            formatted_prompt = self.prompt_template.format(content=content)
            logger.info(f"🎯 Prompt formatted successfully")

            messages = [HumanMessage(content=formatted_prompt)]
            response = await self.llm.ainvoke(messages)

            # Clean the response content
            response_text = response.content.strip()
            if response_text.startswith("```json"):
                response_text = response_text.replace("```json", "", 1)
            if response_text.endswith("```"):
                response_text = response_text.rsplit("```", 1)[0]
            response_text = response_text.strip()

            logger.info(f"🎯 Response received: {response_text}")

            try:
                # Parse the response using the Pydantic parser
                parsed_response = self.parser.parse(response_text)

                # Process topics through similarity check
                canonical_topics = await self.process_new_topics(parsed_response.topics)
                parsed_response.topics = canonical_topics

                return parsed_response

            except Exception as e:
                logger.error(f"❌ Failed to parse response: {str(e)}")
                logger.error(f"Response content: {response_text}")
                raise ValueError(f"Failed to parse LLM response: {str(e)}")

        except Exception as e:
            logger.error(f"❌ Error during metadata extraction: {str(e)}")
            raise

    async def save_metadata_to_arango(self, document_id: str, metadata: DocumentClassification):
        """
        Extract metadata from a document in ArangoDB and create department relationships
        """
        logger.info("🚀 Saving metadata to ArangoDB")
        
        try:
            # Retrieve the document content from ArangoDB
            record = await self.arango_service.get_document(document_id, CollectionNames.RECORDS.value)
            logger.info(f"🚀 Record: {record}")

            # Create domain metadata document for batch upsert
            # Start with all existing fields from record
            doc = dict(record)  # Create a copy of all existing fields

            # Convert SubCategories to dict for JSON serialization
            subcategories_dict = {
                "level1": metadata.subcategories.level1,
                "level2": metadata.subcategories.level2,
                "level3": metadata.subcategories.level3
            }

            # Update with new metadata fields
            doc.update({
                "_key": document_id,  # Use same key as record
                "extractionStatus": "COMPLETED"
            })

            docs = [doc]

            logger.info(f"🎯 Upserting domain metadata for document: {document_id}")
            # Batch upsert the domain metadata
            await self.arango_service.batch_upsert_nodes(docs, CollectionNames.RECORDS.value)

            # Create relationships with departments
            for department in metadata.departments:
                try:
                    # Find department node using await properly
                    dept_query = f'FOR d IN departments FILTER d.departmentName == @department RETURN d'
                    cursor = self.arango_service.db.aql.execute(
                        dept_query,
                        bind_vars={'department': department.value}
                    )
                    
                    # Get the first result directly from the cursor
                    dept_doc = cursor.next()
                    logger.info(f"🚀 Department: {dept_doc}")
                    
                    if dept_doc:  # If we found a matching department
                        # Create edge document
                        edge = {
                            "_from": f"{CollectionNames.RECORDS.value}/{document_id}",
                            "_to": f"{CollectionNames.DEPARTMENTS.value}/{dept_doc['_key']}",
                        }

                        # Insert edge into belongs_to_department collection
                        await self.arango_service.batch_create_edges([edge], CollectionNames.BELONGS_TO_DEPARTMENT.value)
                        logger.info(f"🔗 Created relationship between document {document_id} and department {department.value}")

                except StopAsyncIteration:
                    logger.warning(f"⚠️ No department found for: {department.value}")
                    continue
                except Exception as e:
                    logger.error(f"❌ Error creating relationship with department {department.value}: {str(e)}")
                    continue
                
            # Handle single category
            category_key = str(uuid.uuid4())
            self.arango_service.db.collection(CollectionNames.CATEGORIES.value).insert({
                "_key": category_key,
                "name": metadata.categories,
            })
            self.arango_service.db.collection(CollectionNames.BELONGS_TO_CATEGORY.value).insert({
                "_from": f"records/{document_id}",
                "_to": f"categories/{category_key}",
            })

            # Handle Level 1 subcategory
            subcategory1_key = str(uuid.uuid4())
            self.arango_service.db.collection(CollectionNames.SUBCATEGORIES1.value).insert({
                "_key": subcategory1_key,
                "name": metadata.subcategories.level1,
            })
            self.arango_service.db.collection(CollectionNames.BELONGS_TO_CATEGORY.value).insert({
                "_from": f"records/{document_id}",
                "_to": f"subcategories1/{subcategory1_key}",
            })
            # Link to parent category
            self.arango_service.db.collection(CollectionNames.INTER_CATEGORY_RELATIONS.value).insert({
                "_from": f"subcategories1/{subcategory1_key}",
                "_to": f"categories/{category_key}",
            })

            # Handle Level 2 subcategory
            subcategory2_key = str(uuid.uuid4())
            self.arango_service.db.collection(CollectionNames.SUBCATEGORIES2.value).insert({
                "_key": subcategory2_key,
                "name": metadata.subcategories.level2,
            })
            self.arango_service.db.collection(CollectionNames.BELONGS_TO_CATEGORY.value).insert({
                "_from": f"records/{document_id}",
                "_to": f"subcategories2/{subcategory2_key}",
            })
            # Link to parent subcategory1
            self.arango_service.db.collection(CollectionNames.INTER_CATEGORY_RELATIONS.value).insert({
                "_from": f"subcategories2/{subcategory2_key}",
                "_to": f"subcategories1/{subcategory1_key}",
            })

            # Handle Level 3 subcategory
            subcategory3_key = str(uuid.uuid4())
            self.arango_service.db.collection(CollectionNames.SUBCATEGORIES3.value).insert({
                "_key": subcategory3_key,
                "name": metadata.subcategories.level3,
            })
            self.arango_service.db.collection(CollectionNames.BELONGS_TO_CATEGORY.value).insert({
                "_from": f"records/{document_id}",
                "_to": f"subcategories3/{subcategory3_key}",
            })
            # Link to parent subcategory2
            self.arango_service.db.collection(CollectionNames.INTER_CATEGORY_RELATIONS.value).insert({
                "_from": f"subcategories3/{subcategory3_key}",
                "_to": f"subcategories2/{subcategory2_key}",
            })

            for language in metadata.languages:
                language_key = str(uuid.uuid4())
                self.arango_service.db.collection(CollectionNames.LANGUAGES.value).insert({
                    "_key": language_key,
                    "name": language,
                })
                self.arango_service.db.collection(CollectionNames.BELONGS_TO_LANGUAGE.value).insert({
                    "_from": f"records/{document_id}",
                    "_to": f"languages/{language_key}",
                })

            for topic in metadata.topics:
                topic_key = str(uuid.uuid4())
                self.arango_service.db.collection(CollectionNames.TOPICS.value).insert({
                    "_key": topic_key,
                    "name": topic,
                })
                self.arango_service.db.collection(CollectionNames.BELONGS_TO_TOPIC.value).insert({
                    "_from": f"records/{document_id}",
                    "_to": f"topics/{topic_key}",
                })

            logger.info(f"🚀 Metadata saved successfully for document: {document_id}")
            
            # Add metadata fields to doc
            doc.update({
                "departments": [dept.value for dept in metadata.departments],
                "categories": metadata.categories,
                "subcategoryLevel1": metadata.subcategories.level1,
                "subcategoryLevel2": metadata.subcategories.level2,
                "subcategoryLevel3": metadata.subcategories.level3,
                "topics": metadata.topics,
                "languages": metadata.languages
            })

            return doc

        except Exception as e:
            logger.error(f"❌ Error saving metadata to ArangoDB: {str(e)}")
            raise
