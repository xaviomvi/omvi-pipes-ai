"""Test module for Google Docs API integration"""

import os
import pickle
import asyncio
from typing import Dict, List, Optional, Tuple
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from app.utils.logger import create_logger

logger = create_logger(__name__)

class GoogleDocsTest:
    """Test class for Google Docs API operations"""

    def __init__(self):
        self.docs_service = None
        self.drive_service = None

    async def authenticate(self) -> bool:
        """Authenticate using OAuth2 for individual user"""
        try:
            SCOPES = [
                'https://www.googleapis.com/auth/drive.readonly',
                'https://www.googleapis.com/auth/documents.readonly'
            ]

            creds = None
            if os.path.exists('token.pickle'):
                with open('token.pickle', 'rb') as token:
                    creds = pickle.load(token)

            if not creds or not creds.valid:
                if creds and creds.expired and creds.refresh_token:
                    creds.refresh(Request())
                else:
                    flow = InstalledAppFlow.from_client_secrets_file(
                        'credentials.json',  # Make sure this file exists
                        SCOPES
                    )
                    creds = flow.run_local_server(port=8090)
                with open('token.pickle', 'wb') as token:
                    pickle.dump(creds, token)

            # Build both Drive and Docs services
            self.drive_service = build('drive', 'v3', credentials=creds)
            self.docs_service = build('docs', 'v1', credentials=creds)
            return True

        except Exception as e:
            logger.error("❌ Authentication failed: %s", str(e))
            return False

    async def list_docs(self) -> List[Dict]:
        """List all Google Docs in the user's Drive"""
        try:
            results = self.drive_service.files().list(
                q="mimeType='application/vnd.google-apps.document'",
                spaces='drive',
                fields="files(id, name, createdTime, modifiedTime)",
                pageSize=10  # Limiting to 10 docs for testing
            ).execute()

            docs = results.get('files', [])
            logger.info("✅ Found %d documents", len(docs))
            return docs

        except Exception as e:
            logger.error("❌ Failed to list documents: %s", str(e))
            return []

    async def parse_doc_content(self, doc_id: str) -> Optional[Dict]:
        """Parse detailed content from a Google Doc including structural elements"""
        try:
            # Fetch the document
            document = self.docs_service.documents().get(documentId=doc_id).execute()

            # Initialize content structure
            content = {
                'title': document.get('title', ''),
                'elements': [],
                'tables': [],
                'images': [],
                'headers': [],
                'footers': [],
            }

            # Process document body
            for element in document.get('body', {}).get('content', []):
                # Process paragraphs
                if 'paragraph' in element:
                    para_content = {
                        'type': 'paragraph',
                        'start_index': element.get('startIndex', 0),
                        'end_index': element.get('endIndex', 0),
                        'text': '',
                        'style': element['paragraph'].get('paragraphStyle', {}),
                        'bullet': element['paragraph'].get('bullet', None),
                        'links': []  # Add links array to store link information
                    }

                    # Extract text, formatting, and links from paragraph elements
                    for para_element in element['paragraph'].get('elements', []):
                        if 'textRun' in para_element:
                            text_run = para_element['textRun']
                            text_content = text_run.get('content', '')
                            para_content['text'] += text_content

                            # Include text styling information
                            para_content['textStyle'] = text_run.get(
                                'textStyle', {})

                            # Check for links in the text run
                            if text_run.get('textStyle', {}).get('link'):
                                para_content['links'].append({
                                    'text': text_content,
                                    'url': text_run['textStyle']['link'].get('url', ''),
                                    'start_index': para_element.get('startIndex', 0),
                                    'end_index': para_element.get('endIndex', 0)
                                })

                    content['elements'].append(para_content)

                # Process tables
                elif 'table' in element:
                    table_content = {
                        'type': 'table',
                        'start_index': element.get('startIndex', 0),
                        'end_index': element.get('endIndex', 0),
                        'rows': len(element['table'].get('tableRows', [])),
                        'columns': len(element['table'].get('tableRows', [{}])[0].get('tableCells', [])),
                        'cells': []
                    }

                    # Process each cell in the table
                    for row_idx, row in enumerate(element['table'].get('tableRows', [])):
                        for col_idx, cell in enumerate(row.get('tableCells', [])):
                            cell_content = {
                                'row': row_idx,  # Add row number
                                'column': col_idx,  # Add column number
                                'start_index': cell.get('startIndex', 0),
                                'end_index': cell.get('endIndex', 0),
                                'content': [],
                                'links': []  # Add links array for table cells
                            }

                            # Extract content from cell
                            for cell_element in cell.get('content', []):
                                if 'paragraph' in cell_element:
                                    text = ''
                                    for para_element in cell_element['paragraph'].get('elements', []):
                                        if 'textRun' in para_element:
                                            text_run = para_element['textRun']
                                            text_content = text_run.get(
                                                'content', '')
                                            text += text_content

                                            # Check for links in the cell
                                            if text_run.get('textStyle', {}).get('link'):
                                                cell_content['links'].append({
                                                    'text': text_content,
                                                    'url': text_run['textStyle']['link'].get('url', ''),
                                                    'start_index': para_element.get('startIndex', 0),
                                                    'end_index': para_element.get('endIndex', 0)
                                                })
                                    cell_content['content'].append(text)

                            table_content['cells'].append(cell_content)

                    content['tables'].append(table_content)

                # Process inline images
                elif 'inlineObjectElement' in element:
                    obj_id = element['inlineObjectElement'].get(
                        'inlineObjectId')
                    if obj_id and obj_id in document.get('inlineObjects', {}):
                        image_obj = document['inlineObjects'][obj_id]
                        image_content = {
                            'type': 'image',
                            'start_index': element.get('startIndex', 0),
                            'end_index': element.get('endIndex', 0),
                            'source_uri': image_obj.get('inlineObjectProperties', {})
                            .get('embeddedObject', {})
                            .get('imageProperties', {})
                            .get('sourceUri', ''),
                            'size': image_obj.get('inlineObjectProperties', {})
                            .get('embeddedObject', {})
                            .get('size', {})
                        }
                        content['images'].append(image_content)

            # Process headers
            for header_id, header in document.get('headers', {}).items():
                header_content = {
                    'id': header_id,
                    'content': []
                }
                for element in header.get('content', []):
                    if 'paragraph' in element:
                        text = ''
                        for para_element in element['paragraph'].get('elements', []):
                            if 'textRun' in para_element:
                                text += para_element['textRun'].get(
                                    'content', '')
                        header_content['content'].append(text)
                content['headers'].append(header_content)

            # Process footers
            for footer_id, footer in document.get('footers', {}).items():
                footer_content = {
                    'id': footer_id,
                    'content': []
                }
                for element in footer.get('content', []):
                    if 'paragraph' in element:
                        text = ''
                        for para_element in element['paragraph'].get('elements', []):
                            if 'textRun' in para_element:
                                text += para_element['textRun'].get(
                                    'content', '')
                        footer_content['content'].append(text)
                content['footers'].append(footer_content)

            return content

        except Exception as e:
            logger.error("❌ Failed to parse document %s: %s", doc_id, str(e))
            return None
        
    def order_document_content(self, content: Dict) -> Tuple[List, List, List]:
        """
        Orders document content chronologically by start and end indices.
        
        Args:
            content: Dictionary containing parsed document content
            
        Returns:
            Tuple containing:
            - List of ordered content elements
            - List of headers
            - List of footers
        """
        all_content = []
        
        # Add paragraphs
        for para in content['elements']:
            all_content.append({
                'type': 'paragraph',
                'start_index': para['start_index'],
                'end_index': para['end_index'],
                'content': para
            })

        # Add tables
        for table in content['tables']:
            all_content.append({
                'type': 'table',
                'start_index': table['start_index'],
                'end_index': table['end_index'],
                'content': table
            })

        # Add images
        for image in content['images']:
            all_content.append({
                'type': 'image',
                'start_index': image['start_index'],
                'end_index': image['end_index'],
                'content': image
            })

        # Sort all content by start_index and end_index
        all_content.sort(key=lambda x: (x['start_index'], x['end_index']))
        
        return all_content, content['headers'], content['footers']



async def main():
    """Main function to test Google Docs functionality"""
    docs_test = GoogleDocsTest()

    # Authenticate
    if not await docs_test.authenticate():
        logger.error("❌ Authentication failed")
        return

    # List documents
    docs = await docs_test.list_docs()
    if not docs:
        logger.error("❌ No documents found")
        return

    # Parse the first document in detail
    first_doc = docs[0]
    logger.info("🔍 Analyzing document: %s", first_doc['name'])

    content = await docs_test.parse_doc_content(first_doc['id'])
    if content:
        logger.info("\n✅ Document Analysis Results:")
        logger.info("=" * 50)
        logger.info("📄 Title: %s\n", content['title'])

        # Get ordered content
        all_content, headers, footers = docs_test.order_document_content(content)

        # Display all content chronologically
        logger.info("📑 Document Content:")
        logger.info("-" * 30)
        for idx, item in enumerate(all_content, 1):
            logger.info(f"Element {idx} ({item['type']}):")
            logger.info(f"  Start Index: {item['start_index']}")
            logger.info(f"  End Index: {item['end_index']}")

            if item['type'] == 'paragraph':
                para = item['content']
                logger.info(f"  Text: {para['text']}")
                if para.get('bullet'):
                    logger.info(f"  Bullet: Yes")
                if para.get('textStyle'):
                    style = para['textStyle']
                    style_info = []
                    if style.get('bold'): style_info.append('bold')
                    if style.get('italic'): style_info.append('italic')
                    if style.get('underline'): style_info.append('underlined')
                    if style_info:
                        logger.info(f"  Style: {', '.join(style_info)}")
                if para.get('links'):
                    logger.info("  Links:")
                    for link in para['links']:
                        logger.info(f"    - {link['text']} ({link['url']})")

            elif item['type'] == 'table':
                table = item['content']
                logger.info(f"  Dimensions: {table['rows']}x{table['columns']}")
                logger.info("  Cells:")
                for cell in table['cells']:
                    logger.info(f"    Cell [Row {cell['row']}, Col {cell['column']}]:")
                    logger.info(f"      Content: {' '.join(cell['content'])}")
                    if cell.get('links'):
                        logger.info("      Links:")
                        for link in cell['links']:
                            logger.info(f"        - {link['text']} ({link['url']})")

            elif item['type'] == 'image':
                image = item['content']
                logger.info(f"  Source URI: {image['source_uri']}")
                if image.get('size'):
                    logger.info(f"  Size: {image['size']}")

            logger.info("")

        # Headers and footers are typically displayed separately as they're not part of the main flow
        if headers:
            logger.info("\n📑 Headers:")
            logger.info("-" * 30)
            for idx, header in enumerate(headers, 1):
                logger.info(f"Header {idx}:")
                logger.info(f"  ID: {header['id']}")
                logger.info(f"  Content: {' '.join(header['content'])}")
                logger.info("")

        if footers:
            logger.info("\n📟 Footers:")
            logger.info("-" * 30)
            for idx, footer in enumerate(footers, 1):
                logger.info(f"Footer {idx}:")
                logger.info(f"  ID: {footer['id']}")
                logger.info(f"  Content: {' '.join(footer['content'])}")
                logger.info("")

    else:
        logger.error("❌ Failed to parse document content")




if __name__ == "__main__":
    asyncio.run(main())
