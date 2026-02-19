import asyncio
import httpx
import json
import logging
import os
import re
import shutil
import subprocess
import time
from typing import Optional

try:
    from .env_config import LLM_BASE_URL, LLM_MODEL, USE_MOCK, LLM_API_KEY, LLM_API_KEY_HEADER
except ImportError:
    from env_config import LLM_BASE_URL, LLM_MODEL, USE_MOCK, LLM_API_KEY, LLM_API_KEY_HEADER

logger = logging.getLogger(__name__)

_http_client: Optional[httpx.AsyncClient] = None
_llm_available: Optional[bool] = None
_llm_check_time: float = 0
_llm_cache_ttl: float = 300
_llm_lock = asyncio.Lock()
LLM_USE_CURL = os.getenv("LLM_USE_CURL", "auto").lower()
_last_llm_error: str = ""


def _build_auth_headers() -> dict:
    headers = {}
    if LLM_API_KEY:
        if LLM_API_KEY_HEADER.lower() == "authorization":
            headers["Authorization"] = f"Bearer {LLM_API_KEY}"
        else:
            headers[LLM_API_KEY_HEADER] = LLM_API_KEY
    return headers


def _build_auth_header_candidates() -> list[dict]:
    if not LLM_API_KEY:
        return [{}]
    primary = _build_auth_headers()
    candidates: list[dict] = [primary]
    key = LLM_API_KEY
    if "Authorization" in primary:
        candidates.append({"x-goog-api-key": key})
    elif "x-goog-api-key" in {k.lower(): v for k, v in primary.items()}:
        candidates.append({"Authorization": f"Bearer {key}"})
    else:
        candidates.append({"Authorization": f"Bearer {key}"})
        candidates.append({"x-goog-api-key": key})
    # de-duplicate
    uniq: list[dict] = []
    seen = set()
    for h in candidates:
        sig = tuple(sorted(h.items()))
        if sig in seen:
            continue
        seen.add(sig)
        uniq.append(h)
    return uniq


def _find_curl() -> Optional[str]:
    for name in ("curl.exe", "curl"):
        path = shutil.which(name)
        if path:
            return path
    common_paths = [
        r"C:\Program Files\Git\mingw64\bin\curl.exe",
        r"C:\Windows\System32\curl.exe",
    ]
    for path in common_paths:
        if os.path.exists(path):
            return path
    return None


def _curl_request(method: str, url: str, headers: dict, body: Optional[dict], timeout_sec: int = 30) -> tuple[int, str]:
    curl = _find_curl()
    if not curl:
        return 0, "curl_not_found"

    cmd = [curl, "-sS", "-X", method, url]
    for k, v in headers.items():
        cmd.extend(["-H", f"{k}: {v}"])
    if body is not None:
        cmd.extend(["-H", "Content-Type: application/json", "-d", json.dumps(body, ensure_ascii=False)])
    cmd.extend(["-w", "\n%{http_code}"])

    try:
        cp = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout_sec, check=False)
        raw = (cp.stdout or "").strip()
        stderr = (cp.stderr or "").strip()
        if not raw:
            return 0, stderr
        lines = raw.splitlines()
        code_str = lines[-1].strip()
        text = "\n".join(lines[:-1]).strip()
        try:
            code = int(code_str)
        except ValueError:
            code = 0
            text = raw
        if code == 0 and stderr:
            return 0, stderr
        return code, text
    except Exception as e:
        return 0, str(e)


async def get_http_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None:
        # Respect proxy/cert env vars from the runtime environment.
        _http_client = httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=10.0), trust_env=True)
    return _http_client


async def check_llm() -> bool:
    global _llm_available, _llm_check_time, _last_llm_error

    if USE_MOCK == "true":
        return False

    # USE_MOCK=false 라도 실제 연결 확인은 수행한다.
    # 그렇지 않으면 health가 live로 오판되어 운영 확인에 혼선을 준다.
    async with _llm_lock:
        now = time.time()
        if _llm_available is not None and (now - _llm_check_time) < _llm_cache_ttl:
            return _llm_available

        if LLM_USE_CURL != "false":
            curl_code, curl_text = _curl_request(
                method="GET",
                url=f"{LLM_BASE_URL}/models",
                headers=_build_auth_headers(),
                body=None,
                timeout_sec=20,
            )
            if curl_code == 200:
                _llm_available = True
                _llm_check_time = now
                _last_llm_error = ""
                logger.info("LLM 연결 성공 (/models via curl)")
                return True
            if curl_text:
                _last_llm_error = f"curl precheck failed: {curl_text[:200]}"
                logger.warning(f"LLM curl 사전 확인 실패: {curl_code} {curl_text[:200]}")

        for attempt in range(3):
            try:
                client = await get_http_client()
                for headers in _build_auth_header_candidates():
                    r = await client.get(
                        f"{LLM_BASE_URL}/models",
                        timeout=5.0,
                        headers=headers or None,
                    )
                    if r.status_code == 200:
                        _llm_available = True
                        _llm_check_time = now
                        _last_llm_error = ""
                        logger.info("LLM 연결 성공")
                        return True
                    _last_llm_error = f"/models status={r.status_code} body={r.text[:200]}"
                    logger.warning(f"LLM 상태 확인 실패: {r.status_code}")
            except Exception as e:
                wait_time = 2 ** attempt
                _last_llm_error = str(e)
                logger.warning(f"LLM 연결 시도 {attempt + 1}/3 실패: {e}. {wait_time}초 후 재시도...")
                if attempt < 2:
                    await asyncio.sleep(wait_time)

        if LLM_USE_CURL != "false":
            curl_code, curl_text = _curl_request(
                method="GET",
                url=f"{LLM_BASE_URL}/models",
                headers=_build_auth_headers(),
                body=None,
                timeout_sec=20,
            )
            if curl_code == 200:
                _llm_available = True
                _llm_check_time = now
                _last_llm_error = ""
                logger.info("LLM 연결 성공 (/models via curl fallback)")
                return True
            if curl_text:
                _last_llm_error = f"curl fallback failed: {curl_text[:200]}"
                logger.warning(f"LLM curl fallback 실패: {curl_code} {curl_text[:200]}")

        # Some environments block /models but allow /chat/completions.
        # Re-validate with a minimal completion request before declaring failure.
        try:
            client = await get_http_client()
            probe_payload = {
                "model": LLM_MODEL,
                "messages": [{"role": "user", "content": "ping"}],
                "temperature": 0,
                "max_tokens": 1,
            }
            for headers in _build_auth_header_candidates():
                probe = await client.post(
                    f"{LLM_BASE_URL}/chat/completions",
                    json=probe_payload,
                    timeout=20.0,
                    headers=headers or None,
                )
                if probe.status_code == 200:
                    _llm_available = True
                    _llm_check_time = now
                    _last_llm_error = ""
                    logger.info("LLM 연결 성공 (/chat/completions probe)")
                    return True
                _last_llm_error = f"probe status={probe.status_code} body={probe.text[:200]}"
                logger.warning(f"LLM probe 실패: {probe.status_code} {probe.text[:200]}")
        except Exception as e:
            _last_llm_error = str(e)
            logger.warning(f"LLM probe 예외: {e}")

        _llm_available = False
        _llm_check_time = now
        logger.error("LLM 연결 불가 (3회 재시도 모두 실패)")
        return False


async def call_llm(system_prompt: str, user_message: str, allow_text_fallback: bool = False,
                   max_tokens: int = 2000, temperature: float = 0.7):
    global _last_llm_error
    available = await check_llm()
    if not available and USE_MOCK != "false":
        return None

    client = await get_http_client()
    payload = {
        "model": LLM_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    headers = _build_auth_headers()

    if LLM_USE_CURL != "false":
        curl_code, curl_text = _curl_request(
            method="POST",
            url=f"{LLM_BASE_URL}/chat/completions",
            headers=headers or {},
            body=payload,
            timeout_sec=70,
        )
        if curl_code == 200:
            try:
                parsed = json.loads(curl_text)
                content = parsed["choices"][0]["message"]["content"]
                if "<think>" in content:
                    content = content.split("</think>")[-1]
                if "```json" in content:
                    content = content.split("```json")[1].split("```")[0]
                elif "```" in content:
                    content = content.split("```")[1].split("```")[0]
                _set_llm_connected()
                try:
                    return json.loads(content.strip())
                except json.JSONDecodeError:
                    match = re.search(r"\{.*\}", content, re.DOTALL)
                    if match:
                        return json.loads(match.group())
                    if allow_text_fallback:
                        text = content.strip()
                        if text:
                            return {"speech": text, "suggestions": [], "quickQueries": []}
                    raise
            except Exception as e:
                logger.error(f"curl 우선 경로 파싱 실패: {e}")
        elif curl_text:
            _last_llm_error = f"curl primary failed: {curl_text[:200]}"
            logger.warning(f"curl 우선 경로 실패: {curl_code} {curl_text[:200]}")

    for attempt in range(3):
        try:
            start_time = time.time()
            r = None
            http_error = None
            for h in _build_auth_header_candidates():
                try:
                    r = await client.post(f"{LLM_BASE_URL}/chat/completions", json=payload, timeout=60.0, headers=h or None)
                    r.raise_for_status()
                    break
                except httpx.HTTPStatusError as he:
                    http_error = he
                    _last_llm_error = f"http status={he.response.status_code} body={he.response.text[:200]}"
                    continue
            if r is None:
                if http_error:
                    raise http_error
                raise RuntimeError("LLM request failed without response")
            content = r.json()["choices"][0]["message"]["content"]
            elapsed = time.time() - start_time
            logger.info(f"LLM 응답 시간: {elapsed:.2f}초")
            _set_llm_connected()

            if "<think>" in content:
                content = content.split("</think>")[-1]
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]

            try:
                return json.loads(content.strip())
            except json.JSONDecodeError:
                match = re.search(r"\{.*\}", content, re.DOTALL)
                if match:
                    return json.loads(match.group())
                if allow_text_fallback:
                    text = content.strip()
                    if text:
                        return {"speech": text, "suggestions": [], "quickQueries": []}
                raise
        except asyncio.TimeoutError:
            wait_time = 2 ** attempt
            _last_llm_error = "timeout"
            logger.warning(f"LLM 타임아웃 (시도 {attempt + 1}/3). {wait_time}초 후 재시도...")
            if attempt < 2:
                await asyncio.sleep(wait_time)
        except httpx.HTTPStatusError as e:
            _last_llm_error = f"http status={e.response.status_code} body={e.response.text[:200]}"
            logger.error(f"LLM HTTP 오류: {e.response.status_code} {e.response.text}")
            return None
        except Exception as e:
            wait_time = 2 ** attempt
            _last_llm_error = str(e)
            logger.warning(f"LLM 요청 실패 (시도 {attempt + 1}/3): {e}. {wait_time}초 후 재시도...")
            if attempt < 2:
                await asyncio.sleep(wait_time)

    if LLM_USE_CURL != "false":
        curl_code, curl_text = _curl_request(
            method="POST",
            url=f"{LLM_BASE_URL}/chat/completions",
            headers=headers or {},
            body=payload,
            timeout_sec=70,
        )
        if curl_code == 200:
            try:
                parsed = json.loads(curl_text)
                content = parsed["choices"][0]["message"]["content"]
                if "<think>" in content:
                    content = content.split("</think>")[-1]
                if "```json" in content:
                    content = content.split("```json")[1].split("```")[0]
                elif "```" in content:
                    content = content.split("```")[1].split("```")[0]
                _set_llm_connected()
                try:
                    return json.loads(content.strip())
                except json.JSONDecodeError:
                    match = re.search(r"\{.*\}", content, re.DOTALL)
                    if match:
                        return json.loads(match.group())
                    if allow_text_fallback:
                        text = content.strip()
                        if text:
                            return {"speech": text, "suggestions": [], "quickQueries": []}
                    raise
            except Exception as e:
                logger.error(f"curl fallback 응답 파싱 실패: {e}")
                return None
        if curl_text:
            _last_llm_error = f"curl fallback failed: {curl_text[:200]}"
            logger.error(f"curl fallback 실패: {curl_code} {curl_text[:500]}")

    logger.error("LLM 호출 실패 (3회 재시도 모두 실패)")
    return None


def _set_llm_connected() -> None:
    global _llm_available, _llm_check_time, _last_llm_error
    _llm_available = True
    _llm_check_time = time.time()
    _last_llm_error = ""


def get_llm_debug_status() -> dict:
    return {
        "base_url": LLM_BASE_URL,
        "model": LLM_MODEL,
        "use_mock": USE_MOCK,
        "auth_header": LLM_API_KEY_HEADER,
        "use_curl": LLM_USE_CURL,
        "last_error": _last_llm_error,
    }


async def close_http_client() -> None:
    global _http_client
    if _http_client:
        await _http_client.aclose()
        _http_client = None
        logger.info("HTTP 클라이언트 종료")
