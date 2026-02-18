from pathlib import Path
import os
import logging

logger = logging.getLogger(__name__)


def _parse_env_file(path: Path) -> dict[str, str]:
    parsed: dict[str, str] = {}
    try:
        for raw_line in path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#"):
                continue
            if line.lower().startswith("export "):
                line = line[7:].strip()
            if "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key:
                parsed[key] = value
    except Exception as e:
        logger.warning(f"환경 설정 파일 로딩 실패 ({path}): {e}")
    return parsed


def load_local_env_files() -> None:
    backend_dir = Path(__file__).resolve().parent
    candidates = [
        backend_dir / ".env",
        backend_dir / "environment.txt",
        backend_dir.parent / ".env",
        backend_dir.parent / "environment.txt",
    ]
    for env_path in candidates:
        if not env_path.exists():
            continue
        loaded = _parse_env_file(env_path)
        for key, value in loaded.items():
            os.environ.setdefault(key, value)
        logger.info(f"환경 설정 파일 로드 완료: {env_path}")


load_local_env_files()

LLM_BASE_URL = os.getenv("LLM_BASE_URL", "http://10.240.248.157:8533/v1")
LLM_MODEL = os.getenv("LLM_MODEL", "Qwen3-Next")
USE_MOCK = os.getenv("USE_MOCK", "auto")
LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_API_KEY_HEADER = os.getenv("LLM_API_KEY_HEADER", "Authorization")
