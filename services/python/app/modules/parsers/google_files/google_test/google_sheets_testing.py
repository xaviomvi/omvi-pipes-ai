"""Test module for Google Sheets API integration"""

import os
import pickle
import asyncio
import json
from typing import Dict, List, Optional, Any, Tuple
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from app.modules.parsers.excel.prompt_template import prompt, sheet_summary_prompt, table_summary_prompt, row_text_prompt
from langchain_openai import AzureChatOpenAI

from app.utils.logger import create_logger

logger = create_logger(__name__)

class GoogleSheetsTest:
    """Test class for Google Sheets API operations"""

    def __init__(self):
        self.sheets_service = None
        self.drive_service = None
        self.workbook = None
        self.spreadsheet_id = None
        
        # Store prompts
        self.table_summary_prompt = table_summary_prompt
        self.row_text_prompt = row_text_prompt

    async def authenticate(self) -> bool:
        """Authenticate using OAuth2 for individual user"""
        try:
            SCOPES = [
                'https://www.googleapis.com/auth/drive.readonly',
                'https://www.googleapis.com/auth/spreadsheets.readonly'
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
                        'credentials.json',
                        SCOPES
                    )
                    creds = flow.run_local_server(port=8090)
                with open('token.pickle', 'wb') as token:
                    pickle.dump(creds, token)

            # Build both Drive and Sheets services
            self.drive_service = build('drive', 'v3', credentials=creds)
            self.sheets_service = build('sheets', 'v4', credentials=creds)
            return True

        except Exception as e:
            logger.error("❌ Authentication failed: %s", str(e))
            return False

    async def list_spreadsheets(self) -> List[Dict]:
        """List all Google Sheets in the user's Drive"""
        try:
            # Get both file metadata and content in a single call
            results = self.drive_service.files().list(
                q="mimeType='application/vnd.google-apps.spreadsheet'",
                spaces='drive',
                fields="files(id, name, createdTime, modifiedTime, properties, version)",
                pageSize=100
            ).execute()

            spreadsheets = results.get('files', [])
            logger.info("✅ Found %d spreadsheets", len(spreadsheets))
            return spreadsheets

        except Exception as e:
            logger.error("❌ Failed to list spreadsheets: %s", str(e))
            return []

    async def parse_spreadsheet(self, spreadsheet_id: str) -> Dict[str, Any]:
        """Parse Google Sheets file and extract content similar to Excel parser"""
        try:
            # Get spreadsheet metadata
            spreadsheet = self.sheets_service.spreadsheets().get(
                spreadsheetId=spreadsheet_id
            ).execute()

            sheets_data = []
            total_rows = 0
            total_cells = 0
            all_text = []

            # Process each sheet
            for sheet in spreadsheet['sheets']:
                sheet_props = sheet['properties']
                sheet_name = sheet_props['title']
                
                # Get sheet data
                range_name = f"{sheet_name}!A1:ZZ"
                result = self.sheets_service.spreadsheets().values().get(
                    spreadsheetId=spreadsheet_id,
                    range=range_name
                ).execute()
                values = result.get('values', [])

                if not values:
                    continue

                # Process headers and data
                headers = values[0] if values else []
                data = []

                for row_idx, row in enumerate(values[1:], 2):
                    row_data = []
                    # Pad row with None values if needed
                    padded_row = row + [None] * (len(headers) - len(row))
                    
                    for col_idx, value in enumerate(padded_row, 1):
                        cell_data = {
                            'value': value,
                            'header': headers[col_idx-1] if col_idx-1 < len(headers) else None,
                            'row': row_idx,
                            'column': col_idx,
                            'column_letter': self._get_column_letter(col_idx),
                            'coordinate': f"{self._get_column_letter(col_idx)}{row_idx}",
                            'data_type': self._get_data_type(value),
                        }
                        row_data.append(cell_data)
                        if value:
                            total_cells += 1
                            all_text.append(str(value))

                    data.append(row_data)

                total_rows += len(values)
                sheets_data.append({
                    'name': sheet_name,
                    'data': data,
                    'headers': headers,
                    'row_count': sheet_props['gridProperties']['rowCount'],
                    'column_count': sheet_props['gridProperties']['columnCount'],
                })

            # Prepare metadata
            metadata = {
                'title': spreadsheet.get('properties', {}).get('title'),
                'locale': spreadsheet.get('properties', {}).get('locale'),
                'timeZone': spreadsheet.get('properties', {}).get('timeZone'),
                'sheet_count': len(spreadsheet['sheets'])
            }

            return {
                'sheets': sheets_data,
                'metadata': metadata,
                'text_content': '\n'.join(all_text),
                'sheet_names': [sheet['name'] for sheet in sheets_data],
                'total_rows': total_rows,
                'total_cells': total_cells
            }

        except Exception as e:
            logger.error("❌ Failed to parse spreadsheet: %s", str(e))
            raise

    def _get_column_letter(self, col_idx: int) -> str:
        """Convert column index to letter (1 = A, 27 = AA, etc.)"""
        result = ""
        while col_idx > 0:
            col_idx, remainder = divmod(col_idx - 1, 26)
            result = chr(65 + remainder) + result
        return result

    def _get_data_type(self, value: Any) -> str:
        """Determine the data type of a value"""
        if value is None:
            return 'n'  # null
        elif isinstance(value, bool):
            return 'b'  # boolean
        elif isinstance(value, (int, float)):
            return 'n'  # numeric
        elif isinstance(value, str):
            return 's'  # string
        return 's'  # default to string


    def find_tables(self, sheet: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Find and process all tables in a sheet"""
        try:
            tables = []
            visited_cells = set()

            # Get sheet data
            range_name = f"{sheet['name']}!A1:ZZ"
            result = self.sheets_service.spreadsheets().values().get(
                spreadsheetId=self.spreadsheet_id,
                range=range_name
            ).execute()
            values = result.get('values', [])

            if not values:
                return tables

            def get_table(start_row, start_col):
                """Extract a table starting from (start_row, start_col)."""
                if start_row >= len(values):
                    return None

                # Find table boundaries
                max_col = start_col
                max_row = start_row
                
                # Find max_col
                for row in values[start_row:]:
                    for col_idx, cell in enumerate(row[start_col:], start_col):
                        if cell:
                            max_col = max(max_col, col_idx)
                            max_row = max(max_row, start_row + values[start_row:].index(row))

                # Process table data
                table_data = []
                headers = []

                # Process header row
                if start_row < len(values) and start_col < len(values[start_row]):
                    header_row = values[start_row][start_col:max_col+1]
                    headers = header_row
                    for col_idx, value in enumerate(header_row, start_col):
                        visited_cells.add((start_row, col_idx))

                # Process data rows
                for row_idx in range(start_row + 1, max_row + 1):
                    if row_idx >= len(values):
                        break
                        
                    row_data = []
                    row = values[row_idx]
                    for col_idx in range(start_col, max_col + 1):
                        value = row[col_idx] if col_idx < len(row) else None
                        header = headers[col_idx - start_col] if col_idx - start_col < len(headers) else None
                        cell_data = self._process_cell(value, header, row_idx + 1, col_idx + 1)
                        row_data.append(cell_data)
                        if value:
                            visited_cells.add((row_idx, col_idx))
                    table_data.append(row_data)

                return {
                    'headers': headers,
                    'data': table_data,
                    'start_row': start_row + 1,
                    'start_col': start_col + 1,
                    'end_row': max_row + 1,
                    'end_col': max_col + 1
                }

            # Find all tables
            for row_idx, row in enumerate(values):
                for col_idx, cell in enumerate(row):
                    if cell and (row_idx, col_idx) not in visited_cells:
                        table = get_table(row_idx, col_idx)
                        if table and table['data']:
                            tables.append(table)

            return tables

        except Exception as e:
            raise

    def _process_cell(self, value: Any, header: str, row: int, col: int) -> Dict[str, Any]:
        """Process a single cell and return its data"""
        return {
            'value': value,
            'header': header,
            'row': row,
            'column': col,
            'column_letter': self._get_column_letter(col),
            'coordinate': f"{self._get_column_letter(col)}{row}",
            'data_type': self._get_data_type(value),
            'style': {
                'font': {},
                'fill': {},
                'alignment': {}
            }
        }

    async def get_tables_in_sheet(self, sheet: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Get all tables in a specific sheet"""
        try:
            tables = self.find_tables(sheet)
            
            tables_context = []
            for idx, table in enumerate(tables, 1):
                table_data = [
                    [cell['value'] for cell in row]
                    for row in table['data']
                ]
                tables_context.append(f"Table {idx}:\n{table_data}")


            # Process each table with LLM similar to Excel parser
            processed_tables = []
            for table in tables:
                table_data = [
                    [cell['value'] for cell in row]
                    for row in table['data']
                ]

                # Format prompt and get LLM response
                formatted_prompt = prompt.format(
                    table_data=table_data,
                    tables_context=tables_context,
                    start_row=table['start_row'],
                    start_col=table['start_col'],
                    end_row=table['end_row'],
                    end_col=table['end_col'],
                    num_columns=len(table['data'][0]) if table['data'] else 0
                )

                messages = [
                    {"role": "system", "content": "You are a data analysis expert. Respond with only the list of headers."},
                    {"role": "user", "content": formatted_prompt}
                ]
                response = await self.llm.ainvoke(messages)

                try:
                    new_headers = [h.strip() for h in response.content.strip().split(',')]
                    if len(new_headers) != len(table['data'][0]):
                        new_headers = table['headers']

                    processed_tables.append({
                        'headers': new_headers,
                        'data': table['data'],
                        'start_row': table['start_row'],
                        'start_col': table['start_col'],
                        'end_row': table['end_row'],
                        'end_col': table['end_col']
                    })

                except Exception:
                    processed_tables.append(table)

            return processed_tables

        except Exception as e:
            raise

    async def process_sheet_with_summaries(self, llm, sheet: Dict[str, Any]) -> Dict[str, Any]:
        """Process a sheet and generate all summaries and row texts"""
        try:
            self.llm = llm
            
            # Get tables in the sheet
            tables = await self.get_tables_in_sheet(sheet)
            
            # Process each table
            processed_tables = []
            for table in tables:
                # Get table summary
                table_summary = await self.get_table_summary(table)
                
                # Process rows in batches of 20
                processed_rows = []
                batch_size = 20
                
                for i in range(0, len(table['data']), batch_size):
                    batch = table['data'][i:i + batch_size]
                    row_texts = await self.get_rows_text(batch, table_summary)
                    
                    # Add processed rows to results
                    for row, row_text in zip(batch, row_texts):
                        processed_rows.append({
                            'raw_data': {cell['header']: cell['value'] for cell in row},
                            'natural_language_text': row_text,
                            'row_num': row[0]['row']
                        })
                
                processed_tables.append({
                    'headers': table['headers'],
                    'summary': table_summary,
                    'rows': processed_rows,
                    'location': {
                        'start_row': table['start_row'],
                        'start_col': table['start_col'],
                        'end_row': table['end_row'],
                        'end_col': table['end_col']
                    }
                })
            
            return {
                'sheet_name': sheet['name'],
                'tables': processed_tables
            }
            
        except Exception as e:
            logger.error(f"❌ Error processing sheet with summaries: {str(e)}")
            raise

    async def get_table_summary(self, table: Dict[str, Any]) -> str:
        """Get a natural language summary of a specific table"""
        try:
            # Prepare sample data
            sample_data = [
                {cell['header']: cell['value'] for cell in row}
                for row in table['data'][:3]  # Use first 3 rows as sample
            ]

            # Get summary from LLM
            messages = self.table_summary_prompt.format_messages(
                headers=table['headers'],
                sample_data=json.dumps(sample_data, indent=2)
            )
            response = await self.llm.ainvoke(messages)
            return response.content

        except Exception as e:
            logger.error(f"❌ Error getting table summary: {str(e)}")
            raise

    async def get_rows_text(self, rows: List[List[Dict[str, Any]]], table_summary: str) -> List[str]:
        """Convert multiple rows into natural language text using context from summaries"""
        try:
            # Prepare rows data
            rows_data = [
                {cell['header']: cell['value'] for cell in row}
                for row in rows
            ]

            # Get natural language text from LLM for all rows
            messages = self.row_text_prompt.format_messages(
                table_summary=table_summary,
                rows_data=json.dumps(rows_data, indent=2)
            )

            response = await self.llm.ainvoke(messages)

            # Parse JSON array from response
            try:
                return json.loads(response.content)
            except json.JSONDecodeError:
                # Fallback handling for non-JSON responses
                content = response.content
                start = content.find('[')
                end = content.rfind(']')
                if start != -1 and end != -1:
                    try:
                        return json.loads(content[start:end+1])
                    except json.JSONDecodeError:
                        return [content]
                else:
                    return [content]

        except Exception as e:
            logger.error(f"❌ Error getting rows text: {str(e)}")
            raise

async def main():
    """Main function to demonstrate usage"""
    try:
        # Initialize parser and authenticate
        gs_test = GoogleSheetsTest()
        auth_success = await gs_test.authenticate()
        
        # Initialize LLM
        llm = AzureChatOpenAI(
            api_key="",
            model="",
            azure_endpoint="",
            api_version="",
            temperature=0.3,
            azure_deployment="",
        )
        
        if not auth_success:
            logger.error("Failed to authenticate")
            return

        # List and process spreadsheets
        spreadsheets = await gs_test.list_spreadsheets()
        if not spreadsheets:
            logger.info("No spreadsheets found")
            return

        # Process first spreadsheet
        spreadsheet = spreadsheets[0]
        logger.info(f"Processing spreadsheet: {spreadsheet['name']}")
        
        # Parse spreadsheet and process each sheet
        gs_test.spreadsheet_id = spreadsheet['id']
        parsed_result = await gs_test.parse_spreadsheet(spreadsheet['id'])
        
        all_sheet_results = []
        for sheet in parsed_result['sheets']:
            sheet_name = sheet['name']
            logger.info(f"Processing sheet: {sheet_name}")
            
            # Process sheet with summaries
            sheet_result = await gs_test.process_sheet_with_summaries(llm, sheet)
            all_sheet_results.append(sheet_result)
            
            # Log sheet processing results
            logger.info(f"Processed {len(sheet_result['tables'])} tables in sheet {sheet_name}")
            for table in sheet_result['tables']:
                logger.info(f"Table with {len(table['rows'])} rows processed")
                logger.info(f"Table summary: {table['summary'][:100]}...")

        # Final results summary
        logger.info("\nProcessing Summary:")
        logger.info(f"Spreadsheet: {parsed_result['metadata']['title']}")
        logger.info(f"Total Sheets: {len(parsed_result['sheets'])}")
        logger.info(f"Total Processed Sheets: {len(all_sheet_results)}")
        logger.info(f"Total Cells: {parsed_result['total_cells']}")

    except Exception as e:
        logger.error(f"Error in main: {str(e)}")
        raise

if __name__ == "__main__":
    asyncio.run(main())
