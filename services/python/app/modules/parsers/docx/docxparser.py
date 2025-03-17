import re
from docx2python import docx2python
from typing import List, Dict, Tuple, Any, Set
from nltk.tokenize import sent_tokenize


class DocxParser:
    def __init__(self):
        """Initialize parser with docx file path"""
        # self.binary = binary
        # self.doc = docx2python(self.binary)
        # self.html_map = self.doc.html_map
        # self.images = self.doc.images
        # self.image_folder = self.doc.image_folder

    def _extract_links(self, paragraph: str) -> List[Dict[str, str]]:
        """Extract links from paragraph text"""
        links = []
        link_pattern = r'<a href="([^"]+)">([^<]+)</a>'
        for match in re.finditer(link_pattern, paragraph):
            links.append({
                'url': match.group(1),
                'text': match.group(2)
            })
        return links

    def _extract_image_info(self, paragraph: str) -> Dict[str, str]:
        """Extract image information from paragraph text"""
        image_pattern = r'----Image alt text----><----media/([^-]+)----'
        match = re.search(image_pattern, paragraph)
        if match:
            image_name = match.group(1)
            # Find corresponding image data from self.images dictionary
            if image_name in self.images:
                return {
                    'name': image_name,
                    'data': self.images[image_name],
                    'path': f'media/{image_name}'
                }
        return None

    def _is_table_cell(self, lineage: Tuple) -> bool:
        """Check if paragraph is a table cell"""
        return lineage == ('document', 'tbl', 'tr', 'tc', 'p')

    def _extract_text_from_runs(self, runs: List) -> str:
        """Extract clean text from paragraph runs"""
        text = ''
        for run in runs:
            if isinstance(run, str):
                text += run
            elif hasattr(run, 'text'):
                text += run.text
        return text.strip()

    def _find_table_structure(self, cell_text: str, matched_cells: Set[Tuple[int, int, int]]) -> Tuple[int, int, int]:
        """Find cell's position in table structure from body
        Returns (table_index, row, col) or (-1, -1, -1) if not found"""
        # Keep track of cells we've already matched to avoid DUPLICATEs

        for table_idx, table in enumerate(self.doc.body):
            # Check for valid table structure: [[['cell1'], ['cell2']], [['cell3'], ['cell4']]]
            # Must have multiple rows, each row must have multiple columns
            if not (isinstance(table, list) and len(table) > 1 and  # Multiple rows
                    all(isinstance(row, list) and len(row) > 1 and   # Each row has multiple columns
                        all(isinstance(cell, list)
                            for cell in row)   # Each column is a list
                        for row in table)):
                continue

            # print("table", table)

            # Search through table cells
            for row_idx, row in enumerate(table):
                for col_idx, cell in enumerate(row):
                    # Skip if we've already matched this cell position
                    cell_pos = (table_idx, row_idx, col_idx)
                    if cell_pos in matched_cells:
                        continue

                    cell_content = [
                        text for text in cell if isinstance(text, str)]
                    cell_text_combined = '\n'.join(cell_content).strip()
                    search_text = cell_text.strip()

                    # print(f"Comparing: '{search_text}' with '{cell_text_combined}'")  # Debug print

                    if cell_text_combined == search_text:
                        # print(f"Found match at table {table_idx}, row {row_idx}, col {col_idx}")
                        matched_cells.add(cell_pos)
                        # print("matched_cells", matched_cells)
                        return (table_idx, row_idx, col_idx), matched_cells

        print(f"No match found for cell text: '{cell_text}'")  # Debug print
        return (-1, -1, -1)

    def parse(self, docx_binary: bytes) -> Dict[str, Any]:
        """Parse the docx document and return structured content"""
        try:    
            result = {
                'paragraphs': [],
                'tables': [],
                'images': []
            }
            
            self.doc = docx2python(docx_binary)
            self.html_map = self.doc.html_map
            self.images = self.doc.images
            self.image_folder = self.doc.image_folder

            current_table = []
            current_table_id = 0
            last_table_idx = -1
            matched_cells = set()
            # Process each paragraph in body_pars
            for par_group in self.doc.body_pars:
                for par_list in par_group:
                    for par in par_list:
                        if not isinstance(par, list):
                            par = [par]

                        for p in par:
                            if not hasattr(p, 'runs') or not hasattr(p, 'lineage'):
                                continue

                            text = self._extract_text_from_runs(p.runs)
                            if not text:
                                continue

                            # Check for images
                            image_info = self._extract_image_info(text)
                            if image_info:
                                result['images'].append(image_info)
                                # Add image paragraph
                                result['paragraphs'].append({
                                    'text': text,
                                    'sentences': [],
                                    'links': [],
                                    'lineage': p.lineage,
                                    'type': 'image',
                                    'image_ref': len(result['images']) - 1
                                })
                                continue

                            # Process paragraph content
                            paragraph_data = {
                                'text': text,
                                'sentences': sent_tokenize(text),
                                'links': self._extract_links(text),
                                'lineage': p.lineage,
                                'type': 'text'
                            }

                            # Handle table cells
                            if self._is_table_cell(p.lineage):
                                # Find cell position in table structure
                                # print("matched_cells", matched_cells)
                                (table_idx, row, col), matched_cells = self._find_table_structure(
                                    text, matched_cells)

                                # If found and it's a new table
                                if table_idx != -1 and table_idx != last_table_idx:
                                    if current_table:
                                        result['tables'].append(current_table)
                                    current_table = []
                                    current_table_id = len(result['tables'])
                                    last_table_idx = table_idx

                                paragraph_data.update({
                                    'type': 'table_cell',
                                    'table_ref': current_table_id,
                                    'row': row,
                                    'col': col
                                })
                                current_table.append(paragraph_data)
                            else:
                                # If we were building a table and now hit non-table paragraph
                                if current_table:
                                    result['tables'].append(current_table)
                                    current_table = []
                                    last_table_idx = -1

                            # All paragraphs get added to paragraphs list
                            result['paragraphs'].append(paragraph_data)

            # Add any remaining table
            if current_table:
                result['tables'].append(current_table)

            return result

        except Exception as e:
            print(f"Error parsing DOCX document: {e}")
            raise e

def main():
    """Demo the DocxParser functionality"""

    docx_path = "modules/parsers/docx/test.docx"
    parser = DocxParser(docx_path)
    result = parser.parse()

    print("\n=== DOCUMENT PARSING RESULTS ===\n")

    # Print summary
    print("📊 SUMMARY:")
    print("-" * 50)
    print(f"Total Paragraphs: {len(result['paragraphs'])}")
    print(f"Total Tables: {len(result['tables'])}")
    print(f"Total Images: {len(result['images'])}")
    print()

    # Print regular paragraphs
    print("📄 PARAGRAPHS:")
    print("-" * 50)
    for i, para in enumerate(result['paragraphs'], 1):
        print(f"\nParagraph {i} ({para['type']}):")
        print(f"Text: {para['text']}")
        print(f"Sentences: {len(para['sentences'])}")
        if para['links']:
            print("Links:")
            for link in para['links']:
                print(f"  - {link['text']} -> {link['url']}")
        print(f"Lineage: {para['lineage']}")

        if para['type'] == 'table_cell':
            print(f"Table Reference: {para['table_ref']}")
            print(f"Position: Row {para['row']}, Col {para['col']}")
        elif para['type'] == 'image':
            print(f"Image Reference: {para['image_ref']}")

    # Print tables
    print("\n📊 TABLES:")
    print("-" * 50)
    for i, table in enumerate(result['tables'], 1):
        print(f"\nTable {i}:")
        for cell in table:
            print(f"  Cell [Row {cell['row']}, Col {cell['col']}]: {cell['text'][:50]}..." if len(
                cell['text']) > 50 else f"  Cell [Row {cell['row']}, Col {cell['col']}]: {cell['text']}")

    # Print images
    print("\n🖼️ IMAGES:")
    print("-" * 50)
    for i, img in enumerate(result['images'], 1):
        print(f"\nImage {i}:")
        print(f"Name: {img['name']}")
        print(f"Path: {img['path']}")
        print(f"Data size: {len(img['data'])} bytes")

    print("\n=== END OF PARSING RESULTS ===\n")


if __name__ == "__main__":
    main()
