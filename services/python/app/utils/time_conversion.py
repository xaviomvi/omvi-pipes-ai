
from datetime import datetime, timezone

def get_epoch_timestamp_in_ms():
    now = datetime.now(timezone.utc).timestamp()
    return int(now * 1000) 