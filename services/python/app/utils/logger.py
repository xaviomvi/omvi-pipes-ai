import logging
import os

# Ensure log directory exists
log_dir = 'logs'
os.makedirs(log_dir, exist_ok=True)

# Configure base logging settings
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s'
)

# Create loggers for different services


def create_logger(service_name):
    """
    Create a logger for a specific service with file and console handlers

    Args:
        service_name (str): Name of the service/module

    Returns:
        logging.Logger: Configured logger for the service
    """
    # Create logger
    logger = logging.getLogger(service_name)
    logger.setLevel(logging.DEBUG)

    # Prevent DUPLICATE handlers
    if not logger.handlers:
        # File handler with enhanced format including file name and line number
        file_handler = logging.FileHandler(
            os.path.join(log_dir, f'{service_name}.log'))
        file_handler.setFormatter(logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s'
        ))

        # # Console handler
        # console_handler = logging.StreamHandler()
        # console_handler.setFormatter(logging.Formatter(
        #     '%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s'
        # ))

        # Add handlers
        logger.addHandler(file_handler)
        # logger.addHandler(console_handler)

    return logger


# Create default logger
logger = create_logger('default')
