import subprocess
import os
import tempfile
import shutil
from io import BytesIO


class PPTParser:
    """Parser for Microsoft PowerPoint .ppt files"""

    def __init__(self):
        pass

    def convert_ppt_to_pptx(self, binary: bytes) -> bytes:
        """Convert .ppt file to .pptx using LibreOffice
        
        Args:
            binary (bytes): The binary content of the .ppt file
            
        Returns:
            bytes: The converted .pptx file content as bytes
            
        Raises:
            subprocess.CalledProcessError: If LibreOffice is not installed
            Exception: If conversion fails
        """
        temp_dir = None
        temp_ppt = None
        try:
            # Check if LibreOffice is installed
            subprocess.run(['which', 'libreoffice'], check=True)

            # Create temporary directory and file
            temp_dir = tempfile.mkdtemp()
            temp_ppt = os.path.join(temp_dir, 'input.ppt')
            
            # Write binary content to temporary file
            with open(temp_ppt, 'wb') as f:
                f.write(binary)

            # Convert .ppt to .pptx using LibreOffice
            subprocess.run([
                'libreoffice',
                '--headless',
                '--convert-to', 'pptx',
                '--outdir', temp_dir,
                temp_ppt
            ], check=True, capture_output=True)

            # Get the pptx file path
            pptx_file = os.path.join(temp_dir, 'input.pptx')

            if not os.path.exists(pptx_file):
                raise Exception("PPTX conversion failed")

            # Read the converted file into bytes
            with open(pptx_file, 'rb') as f:
                pptx_content = f.read()
            
            return pptx_content

        except subprocess.CalledProcessError:
            print("Error: 'libreoffice' is not installed. Please install it using:")
            print("sudo apt-get install libreoffice")
            raise
        except Exception as e:
            print(f"Error converting .ppt to .pptx: {e}")
            raise
        finally:
            # Clean up temporary files in all cases
            if temp_dir and os.path.exists(temp_dir):
                shutil.rmtree(temp_dir)
