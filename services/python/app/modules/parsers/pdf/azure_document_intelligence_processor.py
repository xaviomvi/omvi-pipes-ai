from azure.core.credentials import AzureKeyCredential
from azure.ai.formrecognizer.aio import DocumentAnalysisClient as AsyncDocumentAnalysisClient
from typing import Dict, Any, List, Optional
from io import BytesIO
import fitz  # PyMuPDF for initial document check
from app.utils.logger import logger
from app.modules.parsers.pdf.ocr_handler import OCRStrategy
from spacy import Language
import spacy
import time
import os


class AzureOCRStrategy(OCRStrategy):
    def __init__(
        self,
        endpoint: str,
        key: str,
        model_id: str = "prebuilt-document"
    ):
        self.endpoint = endpoint
        self.key = key
        self.model_id = model_id
        self.document_analysis_result = None
        self.doc = None  # PyMuPDF document for initial check
        self.nlp = None
        self._processed = False
        self.ocr_pdf_content = None  # Store the OCR-processed PDF content

    async def load_document(self, content: bytes) -> None:
        """Load and analyze document using Azure Document Intelligence"""
        logger.info("🔄 Starting Azure Document Intelligence load...")

        # Load with PyMuPDF first for OCR need check
        logger.debug("📄 Initial PyMuPDF load for OCR check")
        with fitz.open(stream=content, filetype="pdf") as temp_doc:
            # Check if any page needs OCR
            logger.debug("🔍 Checking if document needs OCR")
            needs_ocr = any(self.needs_ocr(page) for page in temp_doc)
            self._needs_ocr = needs_ocr
            logger.debug(f"🔍 OCR need check result: {needs_ocr}")

        if needs_ocr:
            logger.info("🤖 Document needs OCR, processing with Azure...")
            try:
                async with AsyncDocumentAnalysisClient(
                    endpoint=self.endpoint,
                    credential=AzureKeyCredential(self.key)
                ) as doc_client:
                    document = BytesIO(content)
                    document.seek(0)

                    logger.debug("📤 Sending document to Azure for analysis")
                    poller = await doc_client.begin_analyze_document(
                        model_id=self.model_id,
                        document=document
                    )
                    logger.debug("⏳ Waiting for Azure analysis results")
                    self.doc = await poller.result()

                    # Create searchable PDF after successful OCR
                    logger.info("📄 Creating searchable PDF...")
                    self.ocr_pdf_content = await self._create_searchable_pdf(content)
                    logger.info("✅ Searchable PDF created successfully")

                logger.info("✅ Azure document analysis completed successfully")
            except Exception as e:
                logger.error(f"❌ Azure document analysis failed: {e}")
                logger.info("⚠️ Falling back to direct PyMuPDF extraction")
                self.doc = fitz.open(stream=content, filetype="pdf")  # Open the document outside the context manager
                self._needs_ocr = False
                self.ocr_pdf_content = None

        else:
            logger.info(
                "📝 Document doesn't need OCR, using PyMuPDF extraction")
            self.doc = fitz.open(stream=content, filetype="pdf")  # Open the document outside the context manager
            self.ocr_pdf_content = None

        logger.debug("🔄 Pre-processing document to match Azure's structure")
        self.document_analysis_result = self._preprocess_document()
        logger.info(f"✅ Document loaded with {len(self.doc.pages())} pages")

    @Language.component("custom_sentence_boundary")
    def custom_sentence_boundary(doc):
        for token in doc[:-1]:  # Avoid out-of-bounds errors
            next_token = doc[token.i + 1]

            # Force sentence split BEFORE bullet points and list markers
            if (
                # Check if next token is a bullet point or list marker
                next_token.text in ["•", "∙", "·", "○", "●", "-", "–", "—"] or
                # Numeric bullets (1., 2., etc)
                (next_token.like_num and len(next_token.text) <= 2 and
                 next_token.i + 1 < len(doc) and doc[next_token.i + 1].text == ".") or
                # Letter bullets (a., b., etc)
                (len(next_token.text) == 1 and next_token.text.isalpha()
                 and next_token.i + 1 < len(doc) and doc[next_token.i + 1].text == ".")
            ):
                next_token.is_sent_start = True
                continue

            # Check if current token is a bullet point or list marker
            is_current_bullet = (
                token.text in ["•", "∙", "·", "○", "●", "-", "–", "—"] or
                (token.like_num and next_token.text == "." and len(token.text) <= 2) or
                (len(token.text) == 1 and token.text.isalpha()
                 and next_token.text == ".")
            )

            # Check if next token starts a new bullet point
            is_next_bullet_start = (
                token.i + 2 < len(doc) and (
                    doc[token.i + 2].text in ["•", "∙", "·", "○", "●", "-", "–", "—"] or
                    (doc[token.i + 2].like_num and len(doc[token.i + 2].text) <= 2) or
                    (len(doc[token.i + 2].text) ==
                     1 and doc[token.i + 2].text.isalpha())
                )
            )

            # Split between bullet points
            if is_current_bullet and is_next_bullet_start:
                doc[token.i + 2].is_sent_start = True
                continue

            # Handle common abbreviations
            if token.text.lower() in [
                "mr", "mrs", "dr", "ms", "prof", "sr", "jr", "inc", "ltd", "co",
                "etc", "vs", "fig", "et", "al", "e.g", "i.e", "vol", "pg", "pp"
            ] and next_token.text == ".":
                next_token.is_sent_start = False
                continue

            # Handle single uppercase letters (likely acronyms)
            if (len(token.text) == 1 and token.text.isupper() and
                    next_token.text == "."):
                next_token.is_sent_start = False
                continue

            # Handle ellipsis (...) - don't split
            if token.text == "." and next_token.text == ".":
                next_token.is_sent_start = False
                continue

        return doc

    def _create_custom_tokenizer(self, nlp):
        """
        Creates a custom tokenizer that handles special cases for sentence boundaries.
        """
        # Add the custom rule to the pipeline
        if "sentencizer" not in nlp.pipe_names:
            nlp.add_pipe("sentencizer", before="parser")

        # Add custom sentence boundary detection
        if "custom_sentence_boundary" not in nlp.pipe_names:
            nlp.add_pipe("custom_sentence_boundary", after="sentencizer")

        # Configure the tokenizer to handle special cases
        special_cases = {
            # Common abbreviations
            "e.g.": [{"ORTH": "e.g."}],
            "i.e.": [{"ORTH": "i.e."}],
            "etc.": [{"ORTH": "etc."}],
            "...": [{"ORTH": "..."}],

            # Bullet points and list markers
            "·": [{"ORTH": "·"}],
            "•": [{"ORTH": "•"}],
            "-": [{"ORTH": "-"}],
            "–": [{"ORTH": "–"}],
            "—": [{"ORTH": "—"}],
        }

        for case, mapping in special_cases.items():
            nlp.tokenizer.add_special_case(case, mapping)

        return nlp

    async def process_page(self, page) -> Dict[str, Any]:
        """Process a single page - Implemented for consistency but not primary method"""
        if self._processed:
            raise NotImplementedError(
                "Azure processes entire document at once")
        else:
            # Use PyMuPDF extraction for non-OCR pages
            page_width = page.rect.width
            page_height = page.rect.height

            words = []
            lines = []

            # Extract words
            for word in page.get_text("words"):
                x0, y0, x1, y1, text = word[:5]
                if text.strip():
                    words.append({
                        "content": text.strip(),
                        "confidence": None,
                        "bounding_box": self._normalize_bbox((x0, y0, x1, y1), page_width, page_height)
                    })

            # Extract lines
            text_dict = page.get_text("dict")
            for block in text_dict.get("blocks", []):
                for line in block.get("lines", []):
                    text = " ".join(span.get("text", "")
                                    for span in line.get("spans", []))
                    if text.strip() and line.get("bbox"):
                        lines.append({
                            "content": text.strip(),
                            "bounding_box": self._normalize_bbox(line["bbox"], page_width, page_height)
                        })

            return {
                "words": words,
                "lines": lines,
                "page_width": page_width,
                "page_height": page_height
            }

    def _normalize_bbox(self, bbox, page_width: float, page_height: float) -> List[Dict[str, float]]:
        """Normalize bounding box coordinates to 0-1 range"""
        x0, y0, x1, y1 = bbox
        return [
            {"x": x0 / page_width, "y": y0 / page_height},
            {"x": x1 / page_width, "y": y0 / page_height},
            {"x": x1 / page_width, "y": y1 / page_height},
            {"x": x0 / page_width, "y": y1 / page_height}
        ]

    def _get_bounding_box(self, element) -> List[Dict[str, float]]:
        """Get bounding box from element"""
        if hasattr(element, 'polygon'):
            return [
                {"x": point.x, "y": point.y}
                for point in element.polygon
            ]
        elif hasattr(element, 'bounding_regions'):
            region = element.bounding_regions[0]
            return [
                {"x": point.x, "y": point.y}
                for point in region.polygon
            ]
        return []

    def _normalize_coordinates(
        self,
        coordinates: List[Dict[str, float]],
        page_width: float,
        page_height: float
    ) -> List[Dict[str, float]]:
        """Normalize coordinates to 0-1 range"""
        if not coordinates:
            return None

        normalized = []
        for point in coordinates:
            x = point.get('x', 0)
            y = point.get('y', 0)
            normalized.append({
                'x': x / page_width,
                'y': y / page_height
            })
        return normalized

    def _normalize_element_data(self, element_data: Dict[str, Any], page_width: float, page_height: float) -> Dict[str, Any]:
        """Normalize coordinates to 0-1 range"""
        if "bounding_box" in element_data and element_data["bounding_box"]:
            element_data["bounding_box"] = self._normalize_coordinates(
                element_data["bounding_box"],
                page_width,
                page_height
            )
        return element_data

    def _process_block_text(self, block, page_width: float, page_height: float) -> Dict[str, Any]:
        """Process a text block to extract lines, sentences, and metadata

        Args:
            block: Azure paragraph object
            page_width: Width of the page for bbox normalization
            page_height: Height of the page for bbox normalization

        Returns:
            Dictionary containing processed text data including lines, spans, words and metadata
        """
        logger.debug("================================================")
        logger.debug(f"🔤 Processing block content: {block.content}")
        block_text = []
        block_words = []

        # Process words if available
        if hasattr(block, 'words'):
            for word in block.words:
                word_data = {
                    "content": word.content,
                    "bounding_box": self._normalize_coordinates(
                        self._get_bounding_box(word),
                        page_width,
                        page_height
                    ),
                    "confidence": word.confidence if hasattr(word, 'confidence') else None
                }
                block_words.append(word_data)

        # Get block metadata
        block_metadata = {
            "role": block.role if hasattr(block, 'role') else None,
            "confidence": block.confidence if hasattr(block, 'confidence') else None
        }

        # Create paragraph from block
        if hasattr(block, 'content'):
            block_text.append(block.content.strip())

        paragraph = {
            "content": " ".join(block_text).strip(),
            "bounding_box": self._normalize_coordinates(
                self._get_bounding_box(block),
                page_width,
                page_height
            ),
            "words": block_words,
            "metadata": block_metadata
        }

        return paragraph if block_text else None

    def _preprocess_document(self) -> Dict[str, Any]:
        """Pre-process document to match PyMuPDF's structure"""
        try:
            logger.debug("🔄 Starting document pre-processing")

            # Handle both Azure and PyMuPDF document types
            if hasattr(self.doc, 'pages'):
                doc_pages = list(self.doc.pages())  # Convert generator to list to ensure it's iterable
            else:
                doc_pages = range(len(self.doc))  # PyMuPDF case

            result = {
                "pages": [],
                "lines": [],
                "paragraphs": [],
                "sentences": [],
                "tables": [],
                "key_value_pairs": []
            }

            logger.debug(f"doc_pages: {doc_pages}")
            logger.debug(f"type of doc_pages: {type(doc_pages)}")

            # First pass: collect all lines and paragraphs by page
            for page in doc_pages:
                # Ensure page is accessed correctly
                if isinstance(page, int):
                    page = self.doc[page]  # Access page by index for PyMuPDF

                logger.debug(f"📄 Processing page {page.page_number if hasattr(page, 'page_number') else page}")

                # Get page properties based on document type
                if hasattr(page, 'width'):
                    logger.debug("PAGE WIDTH: %f", page.width)
                    logger.debug("PAGE HEIGHT: %f", page.height)
                    logger.debug("PAGE UNIT: %s", page.unit)
                    logger.debug("PAGE NUMBER: %d", page.page_number)
                else:
                    logger.debug("PAGE RECT WIDTH: %f", page.rect.width)
                    logger.debug("PAGE RECT HEIGHT: %f", page.rect.height)
                    logger.debug("PAGE RECT UNIT: %s", "point")
                    logger.debug("PAGE RECT NUMBER: %d", page.number)
                    # PyMuPDF case
                    page_width = page.rect.width
                    page_height = page.rect.height
                    page_unit = "point"
                    page_number = page.number

                page_dict = {
                    "page_number": page_number,
                    "width": page_width,
                    "height": page_height,
                    "unit": page_unit,
                    "lines": [],
                    "words": [],
                    "tables": []
                }

                # Collect all lines from the page
                page_lines = []
                if hasattr(page, 'lines'):
                    logger.debug("Processing page lines")
                    for line in page.lines:
                        line_data = self._process_line(
                            line, page_width, page_height)
                        if line_data:
                            line_data["page_number"] = page_number
                            page_lines.append(line_data)
                            page_dict["lines"].append(line_data)
                            result["lines"].append(line_data)

                # Process paragraphs and their associated lines
                if hasattr(self.doc, 'paragraphs'):
                    logger.debug("Processing paragraphs")
                    for idx, paragraph in enumerate(self.doc.paragraphs):
                        processed_paragraph = self._process_block_text(
                            paragraph, page_width, page_height)
                        if processed_paragraph:
                            processed_paragraph["page_number"] = page_number
                            processed_paragraph["paragraph_number"] = idx

                            # Find lines that belong to this paragraph
                            paragraph_lines = self._get_lines_for_paragraph(
                                page_lines,
                                processed_paragraph["content"],
                                processed_paragraph["bounding_box"]
                            )

                            # print("================================================")
                            # print("PARAGRAPH LINES", paragraph_lines)
                            # print("================================================")

                            # Process sentences for this paragraph's lines
                            paragraph_sentences = self._merge_lines_to_sentences(
                                paragraph_lines)

                            # Add sentences to the result with paragraph mapping
                            for sentence in paragraph_sentences:
                                sentence_data = {
                                    "content": sentence["sentence"],
                                    "bounding_box": sentence["bounding_box"],
                                    "paragraph_numbers": [idx],
                                    "page_number": page_number
                                }
                                result["sentences"].append(sentence_data)

                            processed_paragraph["sentences"] = paragraph_sentences
                            result["paragraphs"].append(processed_paragraph)

                # Process tables if present
                if hasattr(page, 'tables'):
                    for table in page.tables:
                        table_data = self._process_table(table, page)
                        page_dict["tables"].append(table_data)
                        result["tables"].append(table_data)

                result["pages"].append(page_dict)

            return result
        except Exception as e:
            logger.error(f"❌ Error processing document: {str(e)}")
            raise

    def _get_lines_for_paragraph(
        self,
        page_lines: List[Dict[str, Any]],
        paragraph_text: str,
        paragraph_bbox: List[Dict[str, float]],
        overlap_threshold: float = 0.5
    ) -> List[Dict[str, Any]]:
        """Find lines that belong to a paragraph based on content and spatial overlap"""
        logger.debug(f"Finding lines for paragraph: {paragraph_text[:100]}...")

        paragraph_lines = []
        paragraph_words = set(paragraph_text.lower().split())

        for line in page_lines:
            line_content = line["content"]
            line_bbox = line["bounding_box"]

            # Check for content overlap
            line_words = set(line_content.lower().split())
            word_overlap = len(line_words.intersection(
                paragraph_words)) / len(line_words)

            # Check for spatial overlap
            spatial_overlap = self._check_bbox_overlap(
                line_bbox, paragraph_bbox, threshold=overlap_threshold)

            if word_overlap > 0.9 and spatial_overlap:
                paragraph_lines.append(line)
                logger.debug(f"Added line to paragraph: {line_content}")

        # Sort lines by vertical position
        paragraph_lines.sort(key=lambda x: sum(
            p["y"] for p in x["bounding_box"]) / len(x["bounding_box"]))

        return paragraph_lines

    async def extract_text(self) -> Dict[str, Any]:
        """Extract text and layout information"""
        logger.debug("📊 Starting text extraction")
        if not self.doc or not self.document_analysis_result:
            logger.error("❌ Document not loaded")
            raise ValueError("Document not loaded. Call load_document first.")

        logger.debug("📊 Returning document analysis result:")
        logger.debug(f"- Pages: {len(self.document_analysis_result['pages'])}")
        logger.debug(f"- Lines: {len(self.document_analysis_result['lines'])}")
        logger.debug(
            f"- Paragraphs: {len(self.document_analysis_result['paragraphs'])}")
        logger.debug(
            f"- Sentences: {len(self.document_analysis_result['sentences'])}")

        logger.info("✅ Text extraction completed")
        return self.document_analysis_result

    def _merge_lines_to_sentences(self, lines_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Merge lines into sentences using spaCy"""
        logger.debug(f"🚀 Merging lines to sentences: {lines_data}")

        self.nlp = spacy.load("en_core_web_sm")
        self.nlp = self._create_custom_tokenizer(
            self.nlp)  # Apply custom tokenization rules

        full_text = ""
        line_map = []
        char_index = 0

        # Log each line being processed
        for line_data in lines_data:
            content = line_data["content"].strip()
            logger.debug(f"📝 Processing line: '{content}'")
            logger.debug(f"📐 Line bbox: {line_data['bounding_box']}")

            if not content:
                continue

            full_text += content + " "
            line_map.append(
                (char_index, char_index + len(content), line_data["bounding_box"]))
            char_index += len(content) + 1

        logger.debug(f"📄 Full text for processing: '{full_text}'")

        doc = self.nlp(full_text)
        sentences = []

        # Log each sentence being formed
        for sent in doc.sents:
            sent_text = sent.text.strip()
            sent_start, sent_end = sent.start_char, sent.end_char

            logger.debug("================================================")
            logger.debug(f"🔤 Processing sentence: '{sent_text}'")
            logger.debug(f"📍 Sentence span: {sent_start} to {sent_end}")

            sentence_bboxes = []
            for start_idx, end_idx, bbox in line_map:
                if start_idx < sent_end and end_idx > sent_start:
                    logger.debug(f"📎 Including line bbox: {bbox}")
                    sentence_bboxes.append(bbox)

            merged_bbox = self._merge_bounding_boxes(
                sentence_bboxes) if sentence_bboxes else None
            logger.debug(f"📐 Merged sentence bbox: {merged_bbox}")

            sentences.append({
                "sentence": sent_text,
                "bounding_box": merged_bbox
            })

        logger.debug("================================================")
        logger.debug(f"✅ Merged into {len(sentences)} sentences")
        return sentences

    def _process_table(self, table, page) -> Dict[str, Any]:
        """Process table data with normalized coordinates"""
        cells_data = []
        for cell in table.cells:
            cell_data = {
                "content": cell.content,
                "row_index": cell.row_index,
                "column_index": cell.column_index,
                "row_span": cell.row_span,
                "column_span": cell.column_span,
                "bounding_box": self._normalize_element_data(
                    {"bounding_box": self._get_bounding_box(cell)},
                    page.width,
                    page.height
                )["bounding_box"],
                "confidence": cell.confidence if hasattr(cell, 'confidence') else None
            }
            cells_data.append(cell_data)

        return {
            "row_count": table.row_count,
            "column_count": table.column_count,
            "page_number": self._get_page_number(table),
            "cells": cells_data,
            "bounding_box": self._normalize_element_data(
                {"bounding_box": self._get_bounding_box(table)},
                page.width,
                page.height
            )["bounding_box"]
        }

    def _merge_bounding_boxes(self, bboxes: List[List[Dict[str, float]]]) -> List[Dict[str, float]]:
        """Merge multiple bounding boxes into one encompassing box

        Args:
            bboxes: List of bounding boxes, each containing 4 points with x,y coordinates

        Returns:
            Single bounding box containing 4 points that encompass all input boxes
        """
        logger.debug(f"🚀 Merging bounding boxes: {bboxes}")

        # Flatten all points from all boxes
        all_points = [point for box in bboxes for point in box]

        # Find the extremes
        min_x = min(point["x"] for point in all_points)
        min_y = min(point["y"] for point in all_points)
        max_x = max(point["x"] for point in all_points)
        max_y = max(point["y"] for point in all_points)

        logger.debug(f"✅ Merged bounding box: {min_x}, {min_y}, {max_x}, {max_y}")
        return [
            {"x": min_x, "y": min_y},  # top-left
            {"x": max_x, "y": min_y},  # top-right
            {"x": max_x, "y": max_y},  # bottom-right
            {"x": min_x, "y": max_y}   # bottom-left
        ]

    def _process_line(self, line, page_width: float, page_height: float) -> Dict[str, Any]:
        """Process a single line from Azure Document output

        Args:
            line: Azure DocumentLine object
            page_width: Width of the page for bbox normalization
            page_height: Height of the page for bbox normalization

        Returns:
            Dictionary containing processed line data
        """
        if not hasattr(line, 'content') or not line.content.strip():
            return None

        return {
            "content": line.content.strip(),
            "bounding_box": self._normalize_coordinates(
                self._get_bounding_box(line),
                page_width,
                page_height
            ),
            "confidence": line.confidence if hasattr(line, 'confidence') else None
        }

    def _check_bbox_overlap(self, bbox1, bbox2, threshold=0.1) -> bool:
        """Check if two bounding boxes overlap significantly"""
        # Calculate intersection area
        x_left = max(min(p["x"] for p in bbox1), min(p["x"] for p in bbox2))
        x_right = min(max(p["x"] for p in bbox1), max(p["x"] for p in bbox2))
        y_top = max(min(p["y"] for p in bbox1), min(p["y"] for p in bbox2))
        y_bottom = min(max(p["y"] for p in bbox1), max(p["y"] for p in bbox2))

        if x_right < x_left or y_bottom < y_top:
            return False

        intersection = (x_right - x_left) * (y_bottom - y_top)

        # Calculate areas of both boxes
        def box_area(bbox):
            width = max(p["x"] for p in bbox) - min(p["x"] for p in bbox)
            height = max(p["y"] for p in bbox) - min(p["y"] for p in bbox)
            return width * height

        area1 = box_area(bbox1)
        area2 = box_area(bbox2)

        # Calculate overlap ratio
        overlap_ratio = intersection / min(area1, area2)

        return overlap_ratio > threshold

    async def _create_searchable_pdf(self, original_content: bytes, output_dir: str = "output/searchable/azure") -> bytes:
        """Create a searchable PDF by overlaying OCR text from Azure results"""
        logger.debug("🔄 Starting searchable PDF creation")

        # Create output directory if it doesn't exist
        os.makedirs(output_dir, exist_ok=True)
        logger.debug(f"📁 Using output directory: {output_dir}")

        # Generate unique filename using timestamp
        timestamp = time.strftime("%Y%m%d_%H%M%S")
        output_filename = f"searchable_pdf_{timestamp}.pdf"
        output_path = os.path.join(output_dir, output_filename)
        logger.debug(f"📄 Output file will be saved as: {output_path}")

        # Open the original PDF from bytes
        doc = fitz.open(stream=original_content, filetype="pdf")
        logger.debug(f"📄 Opened original PDF with {len(doc)} pages")

        # Process each page
        for page_num in range(len(doc)):
            page = doc[page_num]

            # Get Azure OCR results for this page
            azure_page = next(
                (p for p in self.doc.pages if p.page_number == page_num), None)
            if not azure_page:
                logger.debug(f"⚠️ No Azure OCR results found for page {page_num + 1}")
                continue

            logger.debug(f"🔄 Processing page {page_num + 1}")
            word_count = 0

            # Add text overlay for each word
            for word in azure_page.words:
                if not word.content.strip():
                    continue

                # Get the bounding box
                if not word.bounding_regions:
                    continue

                bbox = word.bounding_regions[0].polygon

                # Convert Azure coordinates (0-1) to page coordinates and ensure correct bounds
                x_coords = [p.x * page.rect.width for p in bbox]
                y_coords = [p.y * page.rect.height for p in bbox]
                rect = fitz.Rect(min(x_coords), min(y_coords),
                                 max(x_coords), max(y_coords))

                # Add searchable text overlay
                page.insert_textbox(
                    rect,                     # rectangle to place text
                    word.content,            # the text to insert
                    fontname="helv",         # use a standard font
                    fontsize=10,             # reasonable font size
                    align=0,                 # left alignment
                    color=(0, 0, 0, 0),      # transparent color
                    overlay=True             # overlay on top of existing content
                )

                word_count += 1

            logger.debug(f"✅ Added {word_count} words to page {page_num + 1}")

        # Save the modified PDF to the output file
        logger.info(f"💾 Saving searchable PDF to: {output_path}")
        doc.save(output_path)
        doc.close()
        logger.debug("📄 Closed PDF document")

        # Read the saved file
        logger.debug(f"📖 Reading saved searchable PDF: {output_path}")
        with open(output_path, 'rb') as f:
            ocr_pdf_content = f.read()

        logger.info("✅ Searchable PDF creation completed")
        return ocr_pdf_content
