"""Test module for Google Sheets API integration"""

import os
import pickle
import asyncio
from typing import Dict, List, Optional, Any, Tuple
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from app.utils.logger import create_logger

logger = create_logger(__name__)

class GoogleSheetsTest:
    """Test class for Google Sheets API operations"""

    def __init__(self):
        self.sheets_service = None
        self.drive_service = None

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

    async def get_spreadsheet_data(self, spreadsheet_id: str) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
        """Get all spreadsheet data including metadata and sheet contents in a single call"""
        try:
            # Make a single API call to get all necessary data
            spreadsheet = self.sheets_service.spreadsheets().get(
                spreadsheetId=spreadsheet_id,
                includeGridData=True,
                fields='properties,sheets(properties,data.rowData.values(formattedValue,effectiveFormat,userEnteredValue))'
            ).execute()

            # Extract metadata
            metadata = {
                'title': spreadsheet['properties']['title'],
                'locale': spreadsheet['properties'].get('locale'),
                'timeZone': spreadsheet['properties'].get('timeZone'),
                'sheets': [{
                    'title': sheet['properties']['title'],
                    'sheetId': sheet['properties']['sheetId'],
                    'index': sheet['properties']['index'],
                    'gridProperties': sheet['properties'].get('gridProperties', {})
                } for sheet in spreadsheet.get('sheets', [])]
            }

            # Process each sheet's data
            processed_sheets = []
            for sheet in spreadsheet.get('sheets', []):
                sheet_data = self._process_sheet_data(sheet)
                if sheet_data:
                    processed_sheets.append({
                        'name': sheet['properties']['title'],
                        **sheet_data
                    })

            return metadata, processed_sheets

        except Exception as e:
            logger.error("❌ Failed to get spreadsheet data: %s", str(e))
            return None, []

    def _process_sheet_data(self, sheet: Dict) -> Dict[str, Any]:
        """Process sheet data from the API response"""
        try:
            if not sheet.get('data', []):
                return None

            grid_data = sheet['data'][0]
            processed_data = {
                'headers': [],
                'data': [],
                'tables': []
            }

            row_data = grid_data.get('rowData', [])
            if not row_data:
                return processed_data

            # Process headers (first row)
            first_row = row_data[0]
            processed_data['headers'] = [
                cell.get('formattedValue', '') 
                for cell in first_row.get('values', [])
            ]

            # Process data rows
            for row_idx, row in enumerate(row_data[1:], 2):
                processed_row = [
                    self._process_cell(
                        cell,
                        processed_data['headers'][col_idx] if col_idx < len(processed_data['headers']) else '',
                        row_idx,
                        col_idx + 1
                    )
                    for col_idx, cell in enumerate(row.get('values', []))
                ]
                processed_data['data'].append(processed_row)

            # Detect and process tables
            processed_data['tables'] = self._detect_tables(processed_data)
            
            return processed_data

        except Exception as e:
            logger.error("❌ Failed to process sheet data: %s", str(e))
            return None

    def _process_cell(self, cell: Dict, header: str, row: int, col: int) -> Dict[str, Any]:
        """Process individual cell data and formatting"""
        if not cell:
            return {
                'value': None,
                'header': header,
                'row': row,
                'column': col,
                'column_letter': self._get_column_letter(col),
                'coordinate': f"{self._get_column_letter(col)}{row}"
            }

        format_data = cell.get('effectiveFormat', {})
        
        return {
            'value': cell.get('formattedValue'),
            'header': header,
            'row': row,
            'column': col,
            'column_letter': self._get_column_letter(col),
            'coordinate': f"{self._get_column_letter(col)}{row}",
            'formula': cell.get('userEnteredValue', {}).get('formulaValue'),
            'format': {
                'backgroundColor': format_data.get('backgroundColor'),
                'textFormat': format_data.get('textFormat'),
                'horizontalAlignment': format_data.get('horizontalAlignment'),
                'verticalAlignment': format_data.get('verticalAlignment')
            }
        }

    def _detect_tables(self, sheet_data: Dict) -> List[Dict[str, Any]]:
        """Detect tables in sheet data based on data patterns and formatting"""
        tables = []
        data = sheet_data['data']
        headers = sheet_data['headers']

        if not data:
            return tables

        current_table = None
        for row_idx, row in enumerate(data):
            # Check if row could be start of a new table
            if self._is_table_header(row, headers):
                # If we were tracking a table, close it
                if current_table:
                    self._finalize_table(current_table, row_idx + 1)
                    tables.append(current_table)

                # Start new table
                first_value_col = next((i + 1 for i, cell in enumerate(row) if cell['value']), 1)
                last_value_col = max((i + 1 for i, cell in enumerate(row) if cell['value']), default=first_value_col)
                
                current_table = {
                    'headers': [cell['value'] for cell in row if cell['value']],
                    'data': [],
                    'start_row': row_idx + 2,  # +2 because data starts after header row
                    'start_col': first_value_col,
                    'end_col': last_value_col,
                    'end_row': row_idx + 2  # Initialize with start row, will be updated
                }
            elif current_table and any(cell['value'] for cell in row):
                # Add row to current table
                current_table['data'].append(row)
                # Update end_col if this row is wider
                last_value_col = max((i + 1 for i, cell in enumerate(row) if cell['value']), default=current_table['end_col'])
                current_table['end_col'] = max(current_table['end_col'], last_value_col)
                current_table['end_row'] = row_idx + 2
            elif current_table and not any(cell['value'] for cell in row):
                # Empty row after data - close current table
                self._finalize_table(current_table, row_idx + 1)
                tables.append(current_table)
                current_table = None

        # Close last table if exists
        if current_table:
            self._finalize_table(current_table, len(data) + 1)
            tables.append(current_table)

        return tables

    def _finalize_table(self, table: Dict[str, Any], last_row: int) -> None:
        """Finalize table dimensions and ensure all required fields are set"""
        table['end_row'] = last_row
        table['end_col'] = max(
            table['end_col'],
            len(table['headers']),
            max((len(row) for row in table['data']), default=table['end_col'])
        )
        # Ensure minimum dimensions
        table['start_col'] = min(table['start_col'], table['end_col'])
        table['start_row'] = min(table['start_row'], table['end_row'])

    def _is_table_header(self, row: List[Dict], sheet_headers: List[str]) -> bool:
        """Determine if a row is likely a table header"""
        if not any(cell.get('value') for cell in row):
            return False

        # Check if row has different formatting than sheet headers
        # or contains different values than sheet headers
        header_cells = [cell for cell in row if cell.get('value')]
        return (
            any(cell['format'].get('backgroundColor') for cell in header_cells) or
            any(cell['format'].get('textFormat', {}).get('bold') for cell in header_cells) or
            any(cell['value'] != header 
                for cell, header in zip(header_cells, sheet_headers) 
                if cell['value'] and header)
        )

    def _get_column_letter(self, column_number: int) -> str:
        """Convert column number to letter (1 = A, 2 = B, etc.)"""
        result = ""
        while column_number > 0:
            column_number, remainder = divmod(column_number - 1, 26)
            result = chr(65 + remainder) + result
        return result

async def main():
    """Test function to demonstrate Google Sheets parsing"""
    sheets_test = GoogleSheetsTest()

    # Authenticate
    if not await sheets_test.authenticate():
        logger.error("❌ Authentication failed")
        return

    # List all spreadsheets
    spreadsheets = await sheets_test.list_spreadsheets()
    if not spreadsheets:
        logger.error("❌ No spreadsheets found")
        return

    # Process first spreadsheet
    first_sheet = spreadsheets[0]
    logger.info(f"\n📊 Processing spreadsheet: {first_sheet['name']}")
    
    metadata, sheets_data = await sheets_test.get_spreadsheet_data(first_sheet['id'])
    
    if metadata and sheets_data:
        # Display metadata
        logger.info("\n📑 Spreadsheet Metadata:")
        logger.info(f"Title: {metadata['title']}")
        logger.info(f"Locale: {metadata['locale']}")
        logger.info(f"TimeZone: {metadata['timeZone']}")
        logger.info(f"Total Sheets: {len(metadata['sheets'])}")

        # Display sheet information
        for sheet in sheets_data:
            logger.info(f"\n📋 Sheet: {sheet['name']}")
            logger.info(f"Headers: {sheet['headers']}")
            logger.info(f"Total Rows: {len(sheet['data'])}")
            
            # Display tables found
            for idx, table in enumerate(sheet['tables'], 1):
                logger.info(f"\n  Table {idx}:")
                logger.info(f"    Location: {sheets_test._get_column_letter(table['start_col'])}"
                          f"{table['start_row']}:{sheets_test._get_column_letter(table['end_col'])}"
                          f"{table['end_row']}")
                logger.info(f"    Headers: {table['headers']}")
                logger.info(f"    Rows: {len(table['data'])}")

if __name__ == "__main__":
    asyncio.run(main())
