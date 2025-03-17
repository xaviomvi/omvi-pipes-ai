import csv
from typing import List, Dict, Any, Optional, TextIO
from pathlib import Path
import os


class CSVParser:
    def __init__(self, delimiter: str = ',', quotechar: str = '"', encoding: str = 'utf-8'):
        """
        Initialize the CSV parser with configurable parameters.

        Args:
            delimiter: Character used to separate fields (default: comma)
            quotechar: Character used for quoting fields (default: double quote)
            encoding: File encoding (default: utf-8)
        """
        self.delimiter = delimiter
        self.quotechar = quotechar
        self.encoding = encoding

    def read_file(self, file_path: str | Path) -> List[Dict[str, Any]]:
        """
        Read a CSV file and return its contents as a list of dictionaries.

        Args:
            file_path: Path to the CSV file

        Returns:
            List of dictionaries where keys are column headers and values are row values

        Raises:
            FileNotFoundError: If the specified file doesn't exist
            ValueError: If the CSV file is empty or malformed
        """
        file_path = Path(file_path)
        if not file_path.exists():
            raise FileNotFoundError(f"CSV file not found: {file_path}")

        with open(file_path, 'r', encoding=self.encoding) as file:
            return self.read_stream(file)

    def read_stream(self, file_stream: TextIO) -> List[Dict[str, Any]]:
        """
        Read a CSV from a file stream and return its contents as a list of dictionaries.

        Args:
            file_stream: An opened file stream containing CSV data

        Returns:
            List of dictionaries where keys are column headers and values are row values
        """
        reader = csv.DictReader(
            file_stream,
            delimiter=self.delimiter,
            quotechar=self.quotechar
        )

        # Convert all rows to dictionaries and store them
        data = []
        for row in reader:
            # Clean up the row data
            cleaned_row = {
                key: self._parse_value(value)
                for key, value in row.items()
                if key is not None  # Skip None keys that might appear in malformed CSVs
            }
            data.append(cleaned_row)

        if not data:
            raise ValueError("CSV file is empty or has no valid rows")

        return data

    def write_file(self, file_path: str | Path, data: List[Dict[str, Any]]) -> None:
        """
        Write data to a CSV file.

        Args:
            file_path: Path where the CSV file should be written
            data: List of dictionaries to write to the CSV

        Raises:
            ValueError: If the data is empty or malformed
        """
        if not data:
            raise ValueError("No data provided to write to CSV")

        file_path = Path(file_path)
        fieldnames = data[0].keys()

        with open(file_path, 'w', encoding=self.encoding, newline='') as file:
            writer = csv.DictWriter(
                file,
                fieldnames=fieldnames,
                delimiter=self.delimiter,
                quotechar=self.quotechar,
                quoting=csv.QUOTE_MINIMAL
            )

            writer.writeheader()
            writer.writerows(data)

    def _parse_value(self, value: str) -> Any:
        """
        Parse a string value into its appropriate Python type.

        Args:
            value: String value to parse

        Returns:
            Parsed value as the appropriate type (int, float, bool, or string)
        """
        if value is None or value.strip() == '':
            return None

        # Remove leading/trailing whitespace
        value = value.strip()

        # Try to convert to boolean
        if value.lower() in ('true', 'false'):
            return value.lower() == 'true'

        # Try to convert to integer
        try:
            return int(value)
        except ValueError:
            pass

        # Try to convert to float
        try:
            return float(value)
        except ValueError:
            pass

        # Return as string if no other type matches
        return value


def main():
    """Test the CSV parser functionality"""
    # Create sample data
    test_data = [
        {
            "name": "John Doe",
            "age": "30",
            "active": "true",
            "salary": "50000.50",
            "notes": "Senior Developer"
        },
        {
            "name": "Jane Smith",
            "age": "25",
            "active": "false",
            "salary": "45000.75",
            "notes": "Junior Developer"
        }
    ]

    parser = CSVParser()
    test_file = "test_output.csv"

    try:
        # Test writing
        print("Writing test data to CSV...")
        parser.write_file(test_file, test_data)
        print(f"✅ Successfully wrote data to {test_file}")

        # Test reading
        print("\nReading test data from CSV...")
        read_data = parser.read_file(test_file)
        print("✅ Successfully read data from CSV")
        print("\nParsed data:")
        for row in read_data:
            print(row)

        # Verify data types
        print("\nVerifying data types:")
        first_row = read_data[0]
        print(f"name (str): {first_row['name']} ({type(first_row['name'])})")
        print(f"age (int): {first_row['age']} ({type(first_row['age'])})")
        print(f"""active (bool): {first_row['active']} ({
              type(first_row['active'])})""")
        print(f"""salary (float): {
              first_row['salary']} ({type(first_row['salary'])})""")

    finally:
        # Clean up test file
        if os.path.exists(test_file):
            os.remove(test_file)
            print(f"\nℹ️ Cleaned up test file: {test_file}")


if __name__ == "__main__":
    main()
