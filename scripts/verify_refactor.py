import sys
import os

# Add project root to path
sys.path.append(os.getcwd())

# Mock httpx since it might not be installed in this env
import sys
from unittest.mock import MagicMock
sys.modules["httpx"] = MagicMock()

try:
    from backend.social_adapter import get_social_adapter, OutstandAdapter
    print("Successfully imported social_adapter")
    
    adapter = get_social_adapter()
    print(f"Adapter type: {type(adapter)}")
    
    if isinstance(adapter, OutstandAdapter):
        print("PASS: Adapter is OutstandAdapter")
    else:
        print(f"FAIL: Adapter is {type(adapter)}")
        sys.exit(1)

    # Test publish method signature (mocking logic not needed just structure check)
    import inspect
    sig = inspect.signature(adapter.publish)
    print(f"Publish signature: {sig}")
    
except ImportError as e:
    print(f"ImportError: {e}")
    sys.exit(1)
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
