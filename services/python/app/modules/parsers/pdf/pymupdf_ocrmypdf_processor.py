import fitz
import ocrmypdf
import tempfile
import os
import spacy
import time
from typing import Dict, Any, List, Tuple, Optional
from app.utils.logger import logger
from app.modules.parsers.pdf.ocr_handler import OCRStrategy
from spacy.language import Language


class PyMuPDFOCRStrategy(OCRStrategy):
    def __init__(self, language: str = "eng"):
        logger.info("🛠️ Initializing PyMuPDF OCR Strategy")
        self.language = language
        self.doc = None
        self._processed_pages = {}
        self._needs_ocr = False
        self.document_analysis_result = None
        self.nlp = None
        self.ocr_pdf_content = None
        logger.debug("✅ PyMuPDF OCR Strategy initialized")

    async def load_document(self, content: bytes) -> None:
        """Load and analyze document"""
        logger.info("🔄 Starting document load...")

        # Load with PyMuPDF first
        logger.debug("📄 Initial PyMuPDF load")
        temp_doc = fitz.open(stream=content, filetype="pdf")

        # Check if any page needs OCR
        logger.debug("🔍 Checking if document needs OCR")
        needs_ocr = any(self.needs_ocr(page) for page in temp_doc)
        self._needs_ocr = needs_ocr
        logger.debug(f"📊 OCR need determination: {needs_ocr}")

        if needs_ocr:
            logger.info("🤖 Document needs OCR, processing with OCRmyPDF")
            try:
                logger.debug("📝 Creating temporary files for OCR processing")
                with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as temp_in, \
                        tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as temp_out:

                    logger.debug("📤 Writing content to temporary input file")
                    temp_in.write(content)
                    temp_in.flush()

                    logger.debug("🔄 Running OCRmyPDF")
                    ocrmypdf.ocr(
                        temp_in.name,
                        temp_out.name,
                        language=self.language,
                        output_type="pdf",
                        force_ocr=True,
                        optimize=0,
                        progress_bar=False,
                        deskew=True,
                        clean=True,
                        quiet=True
                    )

                    logger.debug("📥 Loading OCR-processed PDF")
                    with open(temp_out.name, "rb") as f:
                        ocr_content = f.read()
                        processed_doc = fitz.open("pdf", ocr_content)
                        # Store the OCR-processed PDF content
                        self.ocr_pdf_content = ocr_content

                        # Create output directory if it doesn't exist
                        output_dir = "output/searchable/pymupdf"
                        os.makedirs(output_dir, exist_ok=True)
                        logger.debug(f"📁 Using output directory: {output_dir}")

                        # Generate unique filename using timestamp
                        timestamp = time.strftime("%Y%m%d_%H%M%S")
                        output_filename = f"ocr_processed_{timestamp}.pdf"
                        output_path = os.path.join(output_dir, output_filename)

                        # Save the PDF to file
                        logger.info(
                            f"💾 Saving OCR-processed PDF to: {output_path}")
                        with open(output_path, "wb") as ocr_file:
                            ocr_file.write(ocr_content)

                logger.info("✅ OCR processing completed successfully")
                self.doc = processed_doc

            except Exception as e:
                logger.error(f"❌ OCR processing failed: {str(e)}")
                logger.info("⚠️ Falling back to direct PyMuPDF extraction")
                self.doc = temp_doc
                self._needs_ocr = False
                self.ocr_pdf_content = None

            finally:
                logger.debug("🧹 Cleaning up temporary files")
                for path in [temp_in.name, temp_out.name]:
                    if os.path.exists(path):
                        try:
                            os.remove(path)
                        except Exception as e:
                            logger.error(
                                "❌ Error cleaning up temp file, %s: %s", path, str(e))
        else:
            logger.info(
                "📝 Document doesn't need OCR, using direct PyMuPDF extraction")
            self.doc = temp_doc
            self.ocr_pdf_content = None

        print("SELF.DOC", self.doc, flush=True)

        logger.debug("🔄 Pre-processing document to match Azure's structure")
        self.document_analysis_result = self._preprocess_document(
            self._needs_ocr)
        logger.info(f"✅ Document loaded with {len(self.doc)} pages")

    @Language.component("custom_sentence_boundary")
    def custom_sentence_boundary(doc):
        for token in doc[:-1]:  # Avoid out-of-bounds errors
            next_token = doc[token.i + 1]

            # If token is a number and followed by a period, don't treat it as a sentence boundary
            if token.like_num and next_token.text == ".":
                next_token.is_sent_start = False

            # Handle common abbreviations
            elif token.text.lower() in [
                "mr", "mrs", "dr", "ms", "prof", "sr", "jr", "inc", "ltd", "co",
                "etc", "vs", "fig", "et", "al", "e.g", "i.e", "vol", "pg", "pp"
            ] and next_token.text == ".":
                next_token.is_sent_start = False

            # Handle bullet points and list markers
            elif (
                # Numeric bullets with period (1., 2., etc)
                (token.like_num and next_token.text == "." and
                 len(token.text) <= 2) or  # Limit to 2 digits
                # Letter bullets with period (a., b., etc)
                (len(token.text) == 1 and token.text.isalpha() and
                 next_token.text == ".") or
                # Common bullet point markers
                token.text in ["•", "∙", "·", "○", "●", "-", "–", "—"]
            ):
                next_token.is_sent_start = False

            # Check for potential headings (all caps or title case without period)
            elif (
                # All caps text likely a heading
                token.text.isupper() and
                len(token.text) > 1 and  # Avoid single letters
                not any(c.isdigit()
                        for c in token.text)  # Avoid serial numbers
            ):
                if next_token.i < len(doc) - 1:
                    next_token.is_sent_start = False

            # Handle ellipsis (...) - don't split
            elif token.text == "." and next_token.text == ".":
                next_token.is_sent_start = False

        return doc

    def _create_custom_tokenizer(self, nlp):
        """
        Creates a custom tokenizer that handles special cases for sentence boundaries.
        """
        # Add the custom rule to the pipeline
        if "sentencizer" not in nlp.pipe_names:
            nlp.add_pipe("sentencizer", before="parser")

        # Add custom sentence boundary detection
        nlp.add_pipe("custom_sentence_boundary", after="sentencizer")

        # Configure the tokenizer to handle special cases
        special_cases = {
            "e.g.": [{"ORTH": "e.g."}],
            "i.e.": [{"ORTH": "i.e."}],
            "etc.": [{"ORTH": "etc."}],
            "...": [{"ORTH": "..."}],
        }

        for case, mapping in special_cases.items():
            nlp.tokenizer.add_special_case(case, mapping)

        return nlp

    def _merge_bounding_boxes(self, bboxes: List[List[Dict[str, float]]]) -> List[Dict[str, float]]:
        """Merge multiple bounding boxes into one encompassing box"""
        logger.debug(f"🚀 Merging bounding boxes: {bboxes}")
        all_points = [point for box in bboxes for point in box]
        min_x = min(point["x"] for point in all_points)
        min_y = min(point["y"] for point in all_points)
        max_x = max(point["x"] for point in all_points)
        max_y = max(point["y"] for point in all_points)

        logger.debug("✅ Merged bounding box: %s, %s, %s, %s",
                     min_x, min_y, max_x, max_y)
        return [
            {"x": min_x, "y": min_y},  # top-left
            {"x": max_x, "y": min_y},  # top-right
            {"x": max_x, "y": max_y},  # bottom-right
            {"x": min_x, "y": max_y}   # bottom-left
        ]

    def _merge_lines_to_sentences(self, lines_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Merge lines into sentences using spaCy"""
        logger.debug(f"🚀 Merging lines to sentences: {lines_data}")

        nlp = spacy.load("en_core_web_sm")
        self.nlp = self._create_custom_tokenizer(
            nlp)  # Apply custom tokenization rules

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

    def _process_block_text(self, block: Dict[str, Any], page_width: float, page_height: float) -> Dict[str, Any]:
        """Process a text block to extract lines, sentences, and metadata

        Handles both single-span and multi-span lines:
        - Single-span: One span containing complete line text
        - Multi-span: Multiple spans containing individual words/characters

        Args:
            block: Dictionary containing text block data
            page_width: Width of the page for bbox normalization
            page_height: Height of the page for bbox normalization

        Returns:
            Dictionary containing processed text data including lines, spans, words and metadata
        """
        logger.debug("================================================")
        logger.debug(f"🔤 Processing block: {block.get('number')}")
        logger.debug(f"📍 Block type: {block.get('type')}")
        logger.debug(f"📐 Block bbox: {block.get('bbox')}")
        logger.debug("================================================")

        block_lines = []
        block_text = []
        block_spans = []
        block_words = []

        # Process lines and their spans
        for line in block.get("lines", []):
            spans = line.get("spans", [])
            if not spans:
                continue

            # Check if this is a multi-span line by looking at text content
            is_multi_span = len(spans) > 1

            # Combine span text appropriately
            if is_multi_span:
                # For multi-span lines, preserve spaces between spans
                line_text = ""
                for span in spans:
                    span_text = span.get("text", "")
                    # Add space only if it's not already a space span
                    if line_text and not span_text.isspace() and not line_text.endswith(" "):
                        line_text += " "
                    line_text += span_text
            else:
                # For single-span lines, use the text directly
                line_text = spans[0].get("text", "")

            if line_text.strip():
                logger.debug(f"📏 Processing line: {line_text}")
                line_data = {
                    "content": line_text.strip(),
                    "bounding_box": self._normalize_bbox(line["bbox"], page_width, page_height)
                }
                logger.debug(f"📏 Line data: {line_data}")
                block_lines.append(line_data)

                # Process spans
                for span in spans:
                    span_text = span.get("text", "").strip()
                    if span_text or is_multi_span:  # Include empty spans for multi-span lines
                        block_text.append(span.get("text", ""))
                        span_data = {
                            "text": span.get("text", ""),
                            "bounding_box": self._normalize_bbox(span["bbox"], page_width, page_height),
                            "font": span.get("font"),
                            "size": span.get("size"),
                            "flags": span.get("flags")
                        }
                        logger.debug(f"📎 Span data: {span_data}")
                        block_spans.append(span_data)

                        # Process individual characters if available
                        logger.debug("🔤 Processing words in span")
                        for char in span.get("chars", []):
                            word_text = char.get("c", "").strip()
                            if word_text:
                                word = {
                                    "content": word_text,
                                    "bounding_box": self._normalize_bbox(char["bbox"], page_width, page_height),
                                    "confidence": None
                                }
                                logger.debug(f"📝 Word data: {word}")
                                block_words.append(word)

        # Get block metadata from first available span
        first_span = block.get("lines", [])[0].get("spans", [])[
            0] if block.get("lines") else {}
        block_metadata = {
            "font": first_span.get("font"),
            "size": first_span.get("size"),
            "color": first_span.get("color"),
            "span_type": "multi_span" if len(block.get("lines", [])[0].get("spans", [])) > 1 else "single_span"
        }
        logger.debug(f"📋 Block metadata: {block_metadata}")

        # Process sentences using the lines
        logger.debug("🔄 Processing sentences from lines")
        sentences = self._merge_lines_to_sentences(block_lines)
        processed_sentences = []
        for sentence in sentences:
            sentence_data = {
                "content": sentence["sentence"],
                "bounding_box": sentence["bounding_box"],
                "block_number": block.get("number"),
                "block_type": block.get("type"),
                "metadata": block_metadata
            }
            logger.debug(f"📑 Processed sentence data: {sentence_data}")
            processed_sentences.append(sentence_data)

        # Create paragraph from block
        paragraph = {
            "content": " ".join(block_text).strip(),
            "bounding_box": self._normalize_bbox(block["bbox"], page_width, page_height),
            "block_number": block.get("number"),
            "spans": block_spans,
            "words": block_words,
            "metadata": block_metadata
        }
        logger.debug("================================================")
        logger.debug(f"📚 Processed paragraph data:")
        logger.debug(f"📝 Content: {paragraph['content'][:100]}...")
        logger.debug(f"📍 Block number: {paragraph['block_number']}")
        logger.debug(f"📐 Bounding box: {paragraph['bounding_box']}")
        logger.debug(f"📊 Metadata: {paragraph['metadata']}")
        logger.debug(f"📎 Number of spans: {len(paragraph['spans'])}")
        logger.debug(f"🔤 Number of words: {len(paragraph['words'])}")
        logger.debug("================================================")

        return {
            "lines": block_lines,
            "sentences": processed_sentences,
            "paragraph": paragraph if block_text else None,
            "words": block_words
        }

    def _should_merge_blocks(self, block1: Dict[str, Any], block2: Dict[str, Any], word_threshold: int = 15) -> bool:
        """
        Determine if blocks should be merged based on word count threshold.
        Merges if block1 has fewer words than the threshold.

        Args:
            block1: First text block
            block2: Second text block
            word_threshold: Minimum word count threshold (default 10 words)

        Returns:
            bool: True if blocks should be merged
        """
        if block1.get("type") != 0 or block2.get("type") != 0:
            return False

        # Get word count for first block
        text1 = " ".join(span.get("text", "") for line in block1.get("lines", [])
                         for span in line.get("spans", []))
        word_count = len(text1.split())

        logger.debug(f"Block word count: {word_count}")

        # Merge if word count is below threshold
        return word_count < word_threshold

    def _merge_block_content(self, block1: Dict[str, Any], block2: Dict[str, Any]) -> Dict[str, Any]:
        """
        Merge two text blocks into one.
        """
        merged_block = block1.copy()

        # Merge lines
        merged_block["lines"] = block1.get(
            "lines", []) + block2.get("lines", [])

        # Update bbox to encompass both blocks
        b1 = block1.get("bbox", (0, 0, 0, 0))
        b2 = block2.get("bbox", (0, 0, 0, 0))
        merged_block["bbox"] = (
            min(b1[0], b2[0]),  # x0
            min(b1[1], b2[1]),  # y0
            max(b1[2], b2[2]),  # x1
            max(b1[3], b2[3])   # y1
        )

        return merged_block

    def _preprocess_document(self, needs_ocr: bool) -> Dict[str, Any]:
        """Pre-process document to match Azure's structure"""
        logger.debug("🔄 Starting document pre-processing")
        result = {
            "pages": [],
            "lines": [],
            "paragraphs": [],
            "sentences": [],
            "tables": [],
            "key_value_pairs": []
        }

        for page_idx in range(len(self.doc)):
            logger.debug(f"📄 Processing page {page_idx + 1}")
            page = self.doc[page_idx]
            page_width = page.rect.width
            page_height = page.rect.height

            logger.debug("📊 Processing page content")
            page_dict = {
                "page_number": page_idx + 1,
                "width": page_width,
                "height": page_height,
                "unit": "pt",
                "lines": [],
                "words": [],
                "tables": []
            }

            logger.debug("📝 Extracting text blocks and paragraphs")
            text_dict = page.get_text("dict")
            blocks = text_dict.get("blocks", [])

            # Process and merge blocks
            merged_blocks = []
            i = 0
            while i < len(blocks):
                current_block = blocks[i]
                next_index = i + 1

                # Keep merging blocks until we have enough words or run out of blocks
                while (next_index < len(blocks) and
                       self._should_merge_blocks(current_block, blocks[next_index])):
                    logger.debug(f"Merging blocks {i} and {next_index}")
                    current_block = self._merge_block_content(
                        current_block, blocks[next_index])
                    next_index += 1

                merged_blocks.append(current_block)
                i = next_index if next_index > i + 1 else i + 1

            # Process merged blocks
            for block in merged_blocks:
                if block.get("type") == 0:  # Text block
                    processed_block = self._process_block_text(
                        block, page_width, page_height)

                    # Add to page-level collections
                    page_dict["lines"].extend(processed_block["lines"])
                    page_dict["words"].extend(processed_block["words"])

                    # Add to document-level collections
                    if processed_block["paragraph"]:
                        processed_block["paragraph"]["page_number"] = page_idx + 1
                        result["paragraphs"].append(
                            processed_block["paragraph"])
                        logger.debug(
                            "📚 Added paragraph to document collection (Page %s, Block %s)", page_idx + 1, processed_block['paragraph']['block_number'])

                    for sentence in processed_block["sentences"]:
                        sentence["page_number"] = page_idx + 1
                        result["sentences"].append(sentence)
                        logger.debug(
                            "📑 Added sentence to document collection (Page %s, Block %s)", page_idx + 1, sentence['block_number'])

            logger.debug(f"✅ Completed processing page {page_idx + 1}")
            logger.debug(f"📊 Page statistics:")
            logger.debug(f"- Lines: {len(page_dict['lines'])}")
            logger.debug(f"- Words: {len(page_dict['words'])}")
            result["pages"].append(page_dict)

        logger.debug("📊 Final document analysis result:")
        logger.debug(f"- Total pages: {len(result['pages'])}")
        logger.debug(f"- Total paragraphs: {len(result['paragraphs'])}")
        logger.debug(f"- Total sentences: {len(result['sentences'])}")

        return result

    async def extract_text(self) -> Dict[str, Any]:
        """Extract text and layout information"""
        logger.debug("📊 Starting text extraction")
        if not self.doc or not self.document_analysis_result:
            logger.error("❌ Document not loaded")
            raise ValueError("Document not loaded. Call load_document first.")

        logger.debug("📊 Returning document analysis result:")
        logger.debug(f"- Pages: {len(self.document_analysis_result['pages'])}")
        logger.debug(
            f"- Paragraphs: {len(self.document_analysis_result['paragraphs'])}")
        logger.debug(
            f"- Sentences: {len(self.document_analysis_result['sentences'])}")

        logger.info("✅ Text extraction completed")
        return self.document_analysis_result

    def _normalize_bbox(self, bbox: Tuple[float, float, float, float],
                        page_width: float, page_height: float) -> List[Dict[str, float]]:
        """Normalize bounding box coordinates to 0-1 range"""
        x0, y0, x1, y1 = bbox
        return [
            {"x": x0 / page_width, "y": y0 / page_height},
            {"x": x1 / page_width, "y": y0 / page_height},
            {"x": x1 / page_width, "y": y1 / page_height},
            {"x": x0 / page_width, "y": y1 / page_height}
        ]

    async def process_page(self, page) -> Dict[str, Any]:
        """Process a single page"""
        logger.debug("📊 Processing page content")
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

        logger.debug("✅ Completed processing page")

        return {
            "words": words,
            "lines": lines,
            "page_width": page_width,
            "page_height": page_height
        }

    def print_merge_statistics(self) -> None:
        """Print statistics about the merged sentences and paragraphs"""
        if not self.document_analysis_result:
            logger.error("❌ No document analysis result available")
            return

        logger.info("📊 Document Merge Statistics:")

        # Page statistics
        for page_idx, page in enumerate(self.document_analysis_result["pages"]):
            logger.info(f"\n📄 Page {page_idx + 1}:")
            logger.info(f"- Lines: {len(page['lines'])}")
            logger.info(f"- Words: {len(page['words'])}")

            # Count sentences and paragraphs on this page
            page_sentences = [s for s in self.document_analysis_result["sentences"]
                              if s["page_number"] == page_idx + 1]
            page_paragraphs = [p for p in self.document_analysis_result["paragraphs"]
                               if p["page_number"] == page_idx + 1]

            logger.info(f"- Sentences: {len(page_sentences)}")
            logger.info(f"- Paragraphs: {len(page_paragraphs)}")

            # Log sample content
            if page_sentences:
                logger.info("\n📝 Sample sentences:")
                # Show first 3 sentences
                for i, sent in enumerate(page_sentences[:3]):
                    logger.info(f"{i+1}. '{sent['content'][:100]}...'")
                    logger.info("   Block: %s, BBox: %s",
                                sent['block_number'], sent['bounding_box'])

            if page_paragraphs:
                logger.info("\n📚 Sample paragraphs:")
                # Show first 2 paragraphs
                for i, para in enumerate(page_paragraphs[:2]):
                    logger.info(f"{i+1}. '{para['content'][:100]}...'")
                    logger.info("   Block: %s, BBox: %s",
                                para['block_number'], para['bounding_box'])

    def create_debug_pdf(self, output_path: str) -> None:
        """Create a debug PDF showing sentence and paragraph boundaries"""
        logger.info("🎨 Creating debug visualization PDF")

        # Copy original document
        debug_doc = fitz.open()
        for page in self.doc:
            debug_doc.new_page(width=page.rect.width, height=page.rect.height)

        # Define colors
        paragraph_color = (1, 0, 0)  # Red for paragraphs
        sentence_color = (0, 0, 1)   # Blue for sentences

        for page_idx, page in enumerate(debug_doc):
            page_width = page.rect.width
            page_height = page.rect.height

            # Draw paragraphs
            logger.debug(f"📝 Drawing paragraphs for page {page_idx + 1}")
            for para in self.document_analysis_result["paragraphs"]:
                if para["page_number"] - 1 == page_idx:
                    bbox = para["bounding_box"]
                    rect = fitz.Rect(
                        bbox[0]["x"] * page_width,
                        bbox[0]["y"] * page_height,
                        bbox[2]["x"] * page_width,
                        bbox[2]["y"] * page_height
                    )
                    # Draw rectangle with red color
                    page.draw_rect(rect, color=paragraph_color, width=1)
                    logger.debug("📦 Drew paragraph: %s...",
                                 para['content'][:50])

            # Draw sentences
            logger.debug(f"📝 Drawing sentences for page {page_idx + 1}")
            for sent in self.document_analysis_result["sentences"]:
                if sent["page_number"] - 1 == page_idx:
                    bbox = sent["bounding_box"]
                    rect = fitz.Rect(
                        bbox[0]["x"] * page_width,
                        bbox[0]["y"] * page_height,
                        bbox[2]["x"] * page_width,
                        bbox[2]["y"] * page_height
                    )
                    # Draw rectangle with blue color
                    page.draw_rect(rect, color=sentence_color, width=0.5)
                    logger.debug(f"📜 Drew sentence: {sent['content'][:50]}...")

        # Save debug PDF
        debug_doc.save(output_path)
        debug_doc.close()
        logger.info(f"✅ Debug PDF saved to {output_path}")
